<script lang="ts">
    import { getElevation } from '@windy/fetch';
    import { createEventDispatcher, onDestroy, tick } from 'svelte';

    import {
        suggestAmapLocations,
    } from './amap';
    import { disposeBaiduSdk, suggestBaiduLocations } from './baidu';
    import { loadElevationsWithConcurrency } from './locationSearch';
    import {
        LOCATION_PROVIDERS,
        locationSearchFailureMessage,
        type LocationProvider,
        type LocationProviderApiKeys,
        type LocationSearchSelection,
    } from './locationProvider';
    import { suggestTencentLocations } from './tencent';
    import type { Coordinates } from './solar';

    const API_KEY_APPLICATION_URLS: Record<LocationProvider, string> = {
        amap: 'https://lbs.amap.com/api/webservice/create-project-and-key',
        baidu: 'https://lbsyun.baidu.com/docs/jsapi?title=jsapi4/quickstart/prepare',
        tencent: 'https://lbs.qq.com/webApi/javascriptGL/glGuide/glBasic',
    };

    export let apiKeys: LocationProviderApiKeys;
    export let language: 'zh' | 'en' = 'zh';
    export let location: Coordinates;
    export let provider: LocationProvider = 'amap';

    type DisplayResult = LocationSearchSelection;

    const dispatch = createEventDispatcher<{
        select: LocationSearchSelection;
        providerchange: LocationProvider;
    }>();
    const labels = {
        zh: {
            label: '地址搜索',
            providerLabel: '搜索提供商',
            providers: {
                amap: '高德',
                baidu: '百度',
                tencent: '腾讯',
            },
            placeholder: '搜索地点或地址',
            missingKey: '请先配置 {provider} API Key',
            missingKeyPrompt: '使用 {provider} 搜索需要对应的 API Key，请先申请并在设置中保存。',
            applyForKey: '申请 {provider} API Key',
            search: '搜索',
            loading: '正在搜索…',
            noResults: '没有找到可定位的地址，请换个关键词。',
            error: '地址搜索失败，请检查 API Key 或稍后重试。',
            suggestions: '地址推荐',
            distance: '直线',
            elevation: '海拔',
        },
        en: {
            label: 'Location search',
            providerLabel: 'Search provider',
            providers: {
                amap: 'Amap',
                baidu: 'Baidu',
                tencent: 'Tencent',
            },
            placeholder: 'Search for a place or address',
            missingKey: 'Configure a {provider} API Key first',
            missingKeyPrompt: '{provider} search requires its API Key. Apply for one, then save it in Settings.',
            applyForKey: 'Apply for a {provider} API Key',
            search: 'Search',
            loading: 'Searching…',
            noResults: 'No locatable address found. Try another keyword.',
            error: 'Location search failed. Check the API Key or try again later.',
            suggestions: 'Suggested locations',
            distance: 'Direct',
            elevation: 'Elevation',
        },
    } as const;

    let query = '';
    let results: DisplayResult[] = [];
    let status: 'idle' | 'loading' | 'ready' | 'empty' | 'error' = 'idle';
    let errorMessage = '';
    let activeIndex = -1;
    let requestId = 0;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let abortController: AbortController | null = null;
    let rootElement: HTMLElement | null = null;
    let text = labels.zh;
    let searchContextKey = '';
    let apiKey = '';
    let missingKeyText = '';
    let missingKeyPromptText = '';
    let applyForKeyText = '';
    let providerMenuOpen = false;
    let providerMenuIndex = 0;
    let providerButtonElement: HTMLButtonElement | null = null;
    let providerMenuElement: HTMLElement | null = null;

    $: text = labels[language];
    $: apiKey = apiKeys[provider] || '';
    $: missingKeyText = text.missingKey.replace('{provider}', text.providers[provider]);
    $: missingKeyPromptText = text.missingKeyPrompt.replace('{provider}', text.providers[provider]);
    $: applyForKeyText = text.applyForKey.replace('{provider}', text.providers[provider]);
    $: {
        const nextSearchContextKey = `${provider}|${apiKey}|${location.lat}|${location.lon}`;
        if (searchContextKey && searchContextKey !== nextSearchContextKey) {
            cancelPendingSearch();
            results = [];
            status = 'idle';
            errorMessage = '';
            activeIndex = -1;
        }
        searchContextKey = nextSearchContextKey;
    }

    const cancelPendingSearch = () => {
        requestId += 1;
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }
        abortController?.abort();
        abortController = null;
    };

    const updateElevation = (id: string, elevationM: number | null) => {
        results = results.map(result => result.id === id ? { ...result, elevationM } : result);
    };

    const loadResultElevations = async (nextResults: DisplayResult[], ownRequestId: number) => {
        await loadElevationsWithConcurrency({
            results: nextResults,
            concurrency: 3,
            isCurrent: () => ownRequestId === requestId,
            loadElevation: async result => (await getElevation(result.wgs84.lat, result.wgs84.lon)).data,
            onResult: updateElevation,
        });
    };

    const runSearch = async () => {
        const keyword = query.trim();
        if (!apiKey || !keyword) {
            cancelPendingSearch();
            results = [];
            status = 'idle';
            errorMessage = '';
            activeIndex = -1;
            return;
        }

        abortController?.abort();
        abortController = new AbortController();
        const ownRequestId = ++requestId;
        const ownProvider = provider;
        const ownProviderName = text.providers[ownProvider];
        const fallbackErrorMessage = text.error;
        const ownLanguage = language;
        status = 'loading';
        errorMessage = '';
        activeIndex = -1;
        try {
            const search = {
                amap: suggestAmapLocations,
                baidu: suggestBaiduLocations,
                tencent: suggestTencentLocations,
            }[ownProvider];
            const nextResults = await search({
                apiKey,
                keyword,
                origin: location,
                signal: abortController.signal,
            });
            if (ownRequestId !== requestId) {
                return;
            }
            results = nextResults.map(result => ({ ...result, elevationM: undefined }));
            status = nextResults.length ? 'ready' : 'empty';
            errorMessage = '';
            if (nextResults.length) {
                void loadResultElevations(results, ownRequestId);
            }
        } catch (error) {
            if (ownRequestId !== requestId || (error instanceof DOMException && error.name === 'AbortError')) {
                return;
            }
            results = [];
            status = 'error';
            errorMessage = locationSearchFailureMessage(
                error,
                ownProviderName,
                fallbackErrorMessage,
                ownLanguage,
            );
        }
    };

    const scheduleSearch = () => {
        if (!apiKey || !query.trim()) {
            return;
        }
        debounceTimer = setTimeout(() => {
            debounceTimer = null;
            void runSearch();
        }, 300);
    };

    const handleInput = () => {
        cancelPendingSearch();
        results = [];
        status = 'idle';
        errorMessage = '';
        activeIndex = -1;
        if (!apiKey || !query.trim()) {
            return;
        }
        scheduleSearch();
    };

    const selectProvider = (nextProvider: LocationProvider) => {
        if (nextProvider === provider) {
            return;
        }
        cancelPendingSearch();
        results = [];
        status = 'idle';
        errorMessage = '';
        activeIndex = -1;
        provider = nextProvider;
        dispatch('providerchange', nextProvider);
        void tick().then(scheduleSearch);
    };

    const focusProviderOption = async () => {
        await tick();
        providerMenuElement
            ?.querySelectorAll<HTMLButtonElement>('[role="option"]')[providerMenuIndex]
            ?.focus();
    };

    const openProviderMenu = (index = LOCATION_PROVIDERS.indexOf(provider)) => {
        providerMenuIndex = Math.max(0, index);
        providerMenuOpen = true;
        void focusProviderOption();
    };

    const closeProviderMenu = (restoreFocus = false) => {
        providerMenuOpen = false;
        if (restoreFocus) {
            void tick().then(() => providerButtonElement?.focus());
        }
    };

    const chooseProvider = (nextProvider: LocationProvider) => {
        selectProvider(nextProvider);
        closeProviderMenu(true);
    };

    const handleProviderButtonKeydown = (event: KeyboardEvent) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const selectedIndex = LOCATION_PROVIDERS.indexOf(provider);
            openProviderMenu(event.key === 'ArrowDown'
                ? selectedIndex
                : (selectedIndex - 1 + LOCATION_PROVIDERS.length) % LOCATION_PROVIDERS.length);
        } else if (event.key === 'Escape' && providerMenuOpen) {
            event.preventDefault();
            closeProviderMenu();
        }
    };

    const handleProviderOptionKeydown = (event: KeyboardEvent, index: number) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeProviderMenu(true);
            return;
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            return;
        }
        event.preventDefault();
        if (event.key === 'Home') {
            providerMenuIndex = 0;
        } else if (event.key === 'End') {
            providerMenuIndex = LOCATION_PROVIDERS.length - 1;
        } else {
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            providerMenuIndex = (index + direction + LOCATION_PROVIDERS.length) % LOCATION_PROVIDERS.length;
        }
        void focusProviderOption();
    };

    const handleSubmit = (event: SubmitEvent) => {
        event.preventDefault();
        rootElement?.querySelector<HTMLInputElement>('#location-search-input')?.focus();
        cancelPendingSearch();
        void runSearch();
    };

    const selectResult = (result: DisplayResult) => {
        cancelPendingSearch();
        query = result.name;
        results = [];
        status = 'idle';
        errorMessage = '';
        activeIndex = -1;
        dispatch('select', result);
    };

    const handleKeydown = (event: KeyboardEvent) => {
        event.stopPropagation();
        if (!results.length) {
            return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (activeIndex < 0) {
                activeIndex = event.key === 'ArrowDown' ? 0 : results.length - 1;
            } else {
                const direction = event.key === 'ArrowDown' ? 1 : -1;
                activeIndex = (activeIndex + direction + results.length) % results.length;
            }
            void tick().then(() => {
                rootElement
                    ?.querySelector<HTMLElement>(`#location-search-result-${activeIndex}`)
                    ?.scrollIntoView({ block: 'nearest' });
            });
        } else if (event.key === 'Enter' && activeIndex >= 0) {
            event.preventDefault();
            selectResult(results[activeIndex]);
        } else if (event.key === 'Escape') {
            cancelPendingSearch();
            results = [];
            status = 'idle';
            errorMessage = '';
            activeIndex = -1;
        }
    };

    const handleFocusOut = (event: FocusEvent) => {
        if (!rootElement?.contains(event.relatedTarget as Node | null)) {
            providerMenuOpen = false;
            cancelPendingSearch();
            results = [];
            status = 'idle';
            errorMessage = '';
            activeIndex = -1;
        }
    };

    const handleFocusIn = (event: FocusEvent) => {
        const target = event.target instanceof Element ? event.target : null;
        if (providerMenuOpen && !target?.closest('.location-search__provider-picker')) {
            providerMenuOpen = false;
        }
    };

    const regionPrimary = (result: DisplayResult): string =>
        result.city || result.province || result.district;

    const regionSecondary = (result: DisplayResult): string =>
        [result.area, result.address].filter(Boolean).join(' · ');

    const distanceParts = (distanceKm: number | null): { value: string; unit: string } => {
        if (distanceKm === null) {
            return { value: '--', unit: 'km' };
        }
        if (distanceKm < 1) {
            return { value: String(Math.max(1, Math.round(distanceKm * 1_000))), unit: 'm' };
        }
        return {
            value: distanceKm < 100 ? distanceKm.toFixed(1) : String(Math.round(distanceKm)),
            unit: 'km',
        };
    };

    const elevationValue = (elevationM: number | null | undefined): string =>
        Number.isFinite(elevationM) ? String(Math.round(elevationM as number)) : '--';

    const metricLabel = (label: string, parts: { value: string; unit: string }): string =>
        `${label} ${parts.value} ${parts.unit}`;

    onDestroy(() => {
        cancelPendingSearch();
        disposeBaiduSdk();
    });
</script>

<section
    class="location-search"
    bind:this={rootElement}
    on:focusin={handleFocusIn}
    on:focusout={handleFocusOut}
    aria-label={text.label}
>
    <form class="location-search__form" on:submit={handleSubmit}>
        <label class="location-search__label" for="location-search-input">{text.label}</label>
        <div class="location-search__control">
            <div class="location-search__provider-picker">
                <button
                    type="button"
                    class="location-search__provider-button"
                    bind:this={providerButtonElement}
                    aria-label={`${text.providerLabel}: ${text.providers[provider]}`}
                    aria-haspopup="listbox"
                    aria-expanded={providerMenuOpen}
                    aria-controls="location-provider-menu"
                    on:click={() => providerMenuOpen ? closeProviderMenu() : openProviderMenu()}
                    on:keydown={handleProviderButtonKeydown}
                >
                    <span>{text.providers[provider]}</span>
                    <span class="location-search__provider-chevron" aria-hidden="true"></span>
                </button>
                {#if providerMenuOpen}
                    <div
                        id="location-provider-menu"
                        class="location-search__provider-menu"
                        bind:this={providerMenuElement}
                        role="listbox"
                        aria-label={text.providerLabel}
                    >
                        {#each LOCATION_PROVIDERS as providerOption, index}
                            <button
                                type="button"
                                role="option"
                                aria-selected={provider === providerOption}
                                tabindex={index === providerMenuIndex ? 0 : -1}
                                class:active={provider === providerOption}
                                on:click={() => chooseProvider(providerOption)}
                                on:keydown={event => handleProviderOptionKeydown(event, index)}
                            >
                                <span>{text.providers[providerOption]}</span>
                                <span class="location-search__provider-check" aria-hidden="true">
                                    {provider === providerOption ? '✓' : ''}
                                </span>
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>
            <input
                id="location-search-input"
                type="search"
                bind:value={query}
                placeholder={apiKey ? text.placeholder : missingKeyText}
                disabled={!apiKey}
                autocomplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="location-search-results"
                aria-expanded={status === 'ready'}
                aria-activedescendant={activeIndex >= 0 ? `location-search-result-${activeIndex}` : undefined}
                aria-describedby="location-search-status"
                on:input={handleInput}
                on:keydown={handleKeydown}
            />
            <button
                type="submit"
                class="location-search__submit"
                disabled={!apiKey || !query.trim() || status === 'loading'}
            >
                {text.search}
            </button>
        </div>
    </form>

    {#if status === 'ready'}
        <div
            class="location-search__results"
            aria-label={text.suggestions}
        >
            <div id="location-search-results" role="listbox" aria-label={text.suggestions}>
                {#each results as result, index (result.id)}
                    <button
                        id={`location-search-result-${index}`}
                        type="button"
                        role="option"
                        tabindex="-1"
                        aria-selected={activeIndex === index}
                        class:active={activeIndex === index}
                        on:mousedown|preventDefault
                        on:click={() => selectResult(result)}
                    >
                        <span class="location-result__headline">
                            <strong>{result.name}</strong>
                            <span
                                class="location-result__metric"
                                title={text.distance}
                                aria-label={metricLabel(text.distance, distanceParts(result.distanceKm))}
                            >
                                <span class="location-result__metric-icon" aria-hidden="true">↔</span>
                                <span class="location-result__metric-value">{distanceParts(result.distanceKm).value}</span>
                                <span class="location-result__metric-unit">{distanceParts(result.distanceKm).unit}</span>
                            </span>
                        </span>
                        <span class="location-result__detail">
                            <span class="location-result__region">
                                <strong>{regionPrimary(result)}</strong>
                                {#if regionSecondary(result)}
                                    <span>{regionSecondary(result)}</span>
                                {/if}
                            </span>
                            <span
                                class="location-result__metric"
                                title={text.elevation}
                                aria-label={`${text.elevation} ${elevationValue(result.elevationM)} m`}
                            >
                                <span class="location-result__metric-icon" aria-hidden="true">▲</span>
                                <span class="location-result__metric-value">{elevationValue(result.elevationM)}</span>
                                <span class="location-result__metric-unit">m</span>
                            </span>
                        </span>
                    </button>
                {/each}
            </div>
        </div>
    {/if}

    <div id="location-search-status" class="location-search__status" aria-live="polite">
        {#if !apiKey}
            <span class="location-search__missing-key">
                <span>{missingKeyPromptText}</span>
                <a href={API_KEY_APPLICATION_URLS[provider]} target="_blank" rel="noreferrer">
                    {applyForKeyText}
                </a>
            </span>
        {:else if status === 'loading'}
            {text.loading}
        {:else if status === 'empty'}
            {text.noResults}
        {:else if status === 'error'}
            <span role="alert">{errorMessage || text.error}</span>
        {/if}
    </div>
</section>

<style lang="less">
    .location-search {
        position: relative;
        z-index: 20;
    }

    .location-search__label {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        clip-path: inset(50%);
        white-space: nowrap;
    }

    .location-search__control {
        position: relative;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        min-height: 46px;
        border: 1px solid var(--panel-border);
        border-radius: 7px;
        background: rgba(8, 15, 27, 0.68);
        transition: border-color 160ms ease, box-shadow 160ms ease;
    }

    .location-search__control:focus-within {
        border-color: var(--panel-accent);
        box-shadow: 0 0 0 2px rgba(99, 185, 238, 0.18);
    }

    .location-search__provider-picker {
        position: relative;
        min-width: 88px;
    }

    .location-search__provider-button {
        display: flex;
        gap: 8px;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        min-width: 88px;
        min-height: 44px;
        padding: 0 11px;
        border: 0;
        border-right: 1px solid var(--panel-border);
        border-radius: 6px 0 0 6px;
        background: rgba(99, 185, 238, 0.12);
        color: var(--panel-text);
        font: inherit;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        touch-action: manipulation;
        transition: background-color 160ms ease;
    }

    .location-search__provider-button:hover,
    .location-search__provider-button[aria-expanded='true'] {
        background: rgba(99, 185, 238, 0.22);
    }

    .location-search__provider-button:focus-visible {
        position: relative;
        z-index: 5;
        outline: 2px solid var(--panel-accent);
        outline-offset: -3px;
    }

    .location-search__provider-chevron {
        width: 7px;
        height: 7px;
        border-right: 1.5px solid currentColor;
        border-bottom: 1.5px solid currentColor;
        transform: translateY(-2px) rotate(45deg);
    }

    .location-search__provider-menu {
        position: absolute;
        z-index: 6;
        top: calc(100% + 4px);
        left: 0;
        display: grid;
        width: max(100%, 112px);
        padding: 4px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 7px;
        background: #172237;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.42);
    }

    .location-search__provider-menu button {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 16px;
        gap: 8px;
        align-items: center;
        min-height: 44px;
        padding: 0 10px;
        border: 0;
        border-radius: 5px;
        background: transparent;
        color: var(--panel-muted);
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        text-align: left;
        cursor: pointer;
        touch-action: manipulation;
    }

    .location-search__provider-menu button:hover,
    .location-search__provider-menu button.active {
        background: rgba(99, 185, 238, 0.18);
        color: var(--panel-text);
    }

    .location-search__provider-menu button:focus-visible {
        outline: 2px solid var(--panel-accent);
        outline-offset: -2px;
    }

    .location-search__provider-check {
        color: var(--panel-accent);
        font-weight: 700;
        text-align: center;
    }

    .location-search__control input {
        min-width: 0;
        height: 44px;
        padding: 0 11px;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--panel-text);
        font: inherit;
        font-size: 13px;
    }

    .location-search__control input::placeholder {
        color: var(--panel-muted);
        opacity: 0.9;
    }

    .location-search__control input:disabled {
        cursor: not-allowed;
        opacity: 0.72;
    }

    .location-search__submit {
        min-width: 60px;
        min-height: 44px;
        padding: 0 12px;
        border: 0;
        border-left: 1px solid var(--panel-border);
        border-radius: 0 6px 6px 0;
        background: rgba(99, 185, 238, 0.16);
        color: var(--panel-accent);
        font: inherit;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
    }

    .location-search__submit:hover:not(:disabled) {
        background: rgba(99, 185, 238, 0.25);
    }

    .location-search__submit:focus-visible {
        outline: 2px solid var(--panel-accent);
        outline-offset: -3px;
    }

    .location-search__submit:disabled {
        cursor: not-allowed;
        opacity: 0.45;
    }

    .location-search__results {
        position: absolute;
        top: calc(100% - 16px);
        right: 0;
        left: 0;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 7px;
        background: #172237;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.42);
    }

    .location-search__results [role='listbox'] {
        overflow-y: auto;
        max-height: 300px;
        padding: 4px;
    }

    .location-search__results button {
        display: grid;
        gap: 4px;
        width: 100%;
        min-height: 58px;
        padding: 8px 9px;
        border: 0;
        border-radius: 5px;
        background: transparent;
        color: var(--panel-text);
        font: inherit;
        text-align: left;
        cursor: pointer;
    }

    .location-search__results button:hover,
    .location-search__results button.active {
        background: rgba(99, 185, 238, 0.18);
    }

    .location-search__results button:focus-visible {
        outline: 2px solid var(--panel-accent);
        outline-offset: -2px;
    }

    .location-result__headline,
    .location-result__detail,
    .location-result__region {
        min-width: 0;
    }

    .location-result__headline,
    .location-result__detail {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        align-items: baseline;
    }

    .location-result__headline > strong,
    .location-result__region > span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .location-result__headline > strong {
        color: var(--panel-accent);
        font-size: 13px;
        line-height: 1.3;
    }

    .location-result__detail,
    .location-result__metric {
        color: var(--panel-muted);
        font-size: 11px;
        line-height: 1.3;
    }

    .location-result__region {
        display: flex;
        gap: 5px;
    }

    .location-result__region strong {
        flex: none;
        color: var(--panel-text);
        font-size: 11px;
        line-height: 1.3;
    }

    .location-result__metric {
        display: grid;
        grid-template-columns: 12px 6ch 2.4ch;
        column-gap: 5px;
        align-items: center;
        min-width: calc(12px + 10px + 8.4ch);
        font-variant-numeric: tabular-nums;
    }

    .location-result__metric-icon {
        color: rgba(255, 255, 255, 0.68);
        font-size: 10px;
        line-height: 1;
        text-align: center;
    }

    .location-result__metric-value {
        text-align: right;
    }

    .location-result__metric-unit {
        text-align: left;
    }

    .location-search__status {
        min-height: 16px;
        padding-top: 2px;
        color: var(--panel-muted);
        font-size: 11px;
        line-height: 1.3;
    }

    .location-search__status [role='alert'] {
        color: #ffb4ad;
    }

    .location-search__missing-key {
        display: flex;
        flex-wrap: wrap;
        gap: 2px 6px;
        align-items: baseline;
        color: var(--panel-muted);
        line-height: 1.45;
    }

    .location-search__missing-key a {
        display: inline-flex;
        align-items: center;
        min-height: 24px;
        color: var(--panel-accent);
        font-weight: 700;
        text-underline-offset: 2px;
    }

    .location-search__missing-key a:hover {
        color: var(--panel-text);
    }

    .location-search__missing-key a:focus-visible {
        border-radius: 3px;
        outline: 2px solid var(--panel-accent);
        outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
        .location-search__control,
        .location-search__provider-button {
            transition: none;
        }
    }

    @media (max-width: 600px) {
        .location-search__results [role='listbox'] {
            max-height: min(300px, calc(30dvh - 20px - env(safe-area-inset-bottom, 0px)));
        }
    }
</style>

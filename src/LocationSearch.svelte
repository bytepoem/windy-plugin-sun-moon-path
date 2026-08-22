<script lang="ts">
    import { getElevation } from '@windy/fetch';
    import { createEventDispatcher, onDestroy, tick } from 'svelte';

    import {
        suggestAmapLocations,
        type AmapLocationResult,
    } from './amap';
    import { loadElevationsWithConcurrency } from './locationSearch';
    import type { Coordinates } from './solar';

    const AMAP_API_KEY_APPLICATION_URL = 'https://lbs.amap.com/api/webservice/create-project-and-key';

    export let apiKey = '';
    export let language: 'zh' | 'en' = 'zh';
    export let location: Coordinates;

    type DisplayResult = AmapLocationResult & {
        elevationM: number | null | undefined;
    };

    const dispatch = createEventDispatcher<{ select: AmapLocationResult }>();
    const labels = {
        zh: {
            label: '地址搜索',
            placeholder: '搜索地点或地址',
            missingKey: '请先配置高德 Web 服务 API Key',
            missingKeyPrompt: '地址搜索需要高德 Web 服务 API Key，请先申请并在设置中保存。',
            applyForKey: '申请高德 API Key',
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
            placeholder: 'Search for a place or address',
            missingKey: 'Configure an Amap Web Service API Key first',
            missingKeyPrompt: 'Location search requires an Amap Web Service API Key. Apply for one, then save it in Settings.',
            applyForKey: 'Apply for an Amap API Key',
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
    let activeIndex = -1;
    let requestId = 0;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let abortController: AbortController | null = null;
    let rootElement: HTMLElement | null = null;
    let text = labels.zh;
    let searchContextKey = '';

    $: text = labels[language];
    $: {
        const nextSearchContextKey = `${apiKey}|${location.lat}|${location.lon}`;
        if (searchContextKey && searchContextKey !== nextSearchContextKey) {
            cancelPendingSearch();
            results = [];
            status = 'idle';
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
            activeIndex = -1;
            return;
        }

        abortController?.abort();
        abortController = new AbortController();
        const ownRequestId = ++requestId;
        status = 'loading';
        activeIndex = -1;
        try {
            const nextResults = await suggestAmapLocations({
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
            if (nextResults.length) {
                void loadResultElevations(results, ownRequestId);
            }
        } catch (error) {
            if (ownRequestId !== requestId || (error instanceof DOMException && error.name === 'AbortError')) {
                return;
            }
            results = [];
            status = 'error';
        }
    };

    const handleInput = () => {
        cancelPendingSearch();
        results = [];
        status = 'idle';
        activeIndex = -1;
        if (!apiKey || !query.trim()) {
            return;
        }
        debounceTimer = setTimeout(() => {
            debounceTimer = null;
            void runSearch();
        }, 300);
    };

    const handleSubmit = (event: SubmitEvent) => {
        event.preventDefault();
        cancelPendingSearch();
        void runSearch();
    };

    const selectResult = (result: DisplayResult) => {
        cancelPendingSearch();
        query = result.name;
        results = [];
        status = 'idle';
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
                    ?.querySelector<HTMLElement>(`#amap-location-result-${activeIndex}`)
                    ?.scrollIntoView({ block: 'nearest' });
            });
        } else if (event.key === 'Enter' && activeIndex >= 0) {
            event.preventDefault();
            selectResult(results[activeIndex]);
        } else if (event.key === 'Escape') {
            cancelPendingSearch();
            results = [];
            status = 'idle';
            activeIndex = -1;
        }
    };

    const handleFocusOut = (event: FocusEvent) => {
        if (!rootElement?.contains(event.relatedTarget as Node | null)) {
            cancelPendingSearch();
            results = [];
            status = 'idle';
            activeIndex = -1;
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

    onDestroy(cancelPendingSearch);
</script>

<section class="location-search" bind:this={rootElement} on:focusout={handleFocusOut} aria-label={text.label}>
    <form class="location-search__form" on:submit={handleSubmit}>
        <label class="location-search__label" for="amap-location-search">{text.label}</label>
        <div class="location-search__control">
            <input
                id="amap-location-search"
                type="search"
                bind:value={query}
                placeholder={apiKey ? text.placeholder : text.missingKey}
                disabled={!apiKey}
                autocomplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="amap-location-results"
                aria-expanded={status === 'ready'}
                aria-activedescendant={activeIndex >= 0 ? `amap-location-result-${activeIndex}` : undefined}
                aria-describedby="amap-location-status"
                on:input={handleInput}
                on:keydown={handleKeydown}
            />
            <button type="submit" disabled={!apiKey || !query.trim() || status === 'loading'}>{text.search}</button>
        </div>
    </form>

    {#if status === 'ready'}
        <div
            class="location-search__results"
            aria-label={text.suggestions}
        >
            <div id="amap-location-results" role="listbox" aria-label={text.suggestions}>
                {#each results as result, index (result.id)}
                    <button
                        id={`amap-location-result-${index}`}
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

    <div id="amap-location-status" class="location-search__status" aria-live="polite">
        {#if !apiKey}
            <span class="location-search__missing-key">
                <span>{text.missingKeyPrompt}</span>
                <a href={AMAP_API_KEY_APPLICATION_URL} target="_blank" rel="noreferrer">
                    {text.applyForKey}
                </a>
            </span>
        {:else if status === 'loading'}
            {text.loading}
        {:else if status === 'empty'}
            {text.noResults}
        {:else if status === 'error'}
            <span role="alert">{text.error}</span>
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
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        min-height: 42px;
        border: 1px solid var(--panel-border);
        border-radius: 7px;
        background: rgba(8, 15, 27, 0.68);
        transition: border-color 160ms ease, box-shadow 160ms ease;
    }

    .location-search__control:focus-within {
        border-color: var(--panel-accent);
        box-shadow: 0 0 0 2px rgba(99, 185, 238, 0.18);
    }

    .location-search__control input {
        min-width: 0;
        height: 40px;
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

    .location-search__control button {
        min-width: 60px;
        min-height: 40px;
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

    .location-search__control button:hover:not(:disabled) {
        background: rgba(99, 185, 238, 0.25);
    }

    .location-search__control button:focus-visible {
        outline: 2px solid var(--panel-accent);
        outline-offset: -3px;
    }

    .location-search__control button:disabled {
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
        .location-search__control {
            transition: none;
        }
    }

    @media (max-width: 600px) {
        .location-search__results [role='listbox'] {
            max-height: min(300px, calc(30dvh - 20px - env(safe-area-inset-bottom, 0px)));
        }
    }
</style>

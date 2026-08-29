<script lang="ts">
    import { getElevation, getPointForecastData, getTimezoneInfo } from '@windy/fetch';
    import { createEventDispatcher, onDestroy, tick } from 'svelte';

    import {
        createFavoriteComparisonPlanner,
        type FavoriteComparisonResult,
        type FavoriteComparisonSession,
        type FavoriteComparisonTarget,
    } from './favoriteComparison';
    import { fetchLightPollutionPoint } from './lightPollution';
    import { compactLocationLabel } from './location';
    import { fetchOpenMeteoAtmosphere } from './openMeteo';
    import {
        transformWeatherPayload,
        weatherConditionLabel,
        type WeatherForecastPayload,
        type WeatherModel,
    } from './weather';
    import WeatherMetricIcon from './WeatherMetricIcon.svelte';
    import {
        calculateCurrentMoonInfo,
        dateInputForInstant,
        type AstronomyIntervalKind,
    } from './solar';

    export let open = false;
    export let targets: FavoriteComparisonTarget[] = [];
    export let selectedDate = '';
    export let currentInstant: Date;
    export let initialModel: WeatherModel = 'ecmwf';
    export let language: 'zh' | 'en' = 'zh';
    export let mobile = false;
    export let fullscreen = false;
    export let openUpward = false;
    export let returnFocus: HTMLElement | null = null;

    const dispatch = createEventDispatcher<{
        back: void;
        close: void;
    }>();
    const labels = {
        zh: {
            title: '收藏地点时间窗口对比',
            back: '返回收藏',
            close: '关闭地点对比',
            dateControl: '观测日期',
            moonless: '无月',
            milkyWay: '银河',
            conditions: '窗口内条件',
            modelLabel: '预报模型',
            weather: '天气',
            cloud: '云量',
            highCloud: '高云',
            mediumCloud: '中云',
            lowCloud: '低云',
            temperature: '气温',
            dewPoint: '露点',
            precipitation: '降水',
            wind: '风速',
            humidity: '湿度',
            visibility: '能见度',
            aod: 'AOD',
            bortle: '光污染',
            moonIllumination: '月相',
            loadingContext: '正在计算各地点天文窗口与固定条件…',
            loadingModel: '正在刷新模型条件…',
            prepareError: '无法建立地点对比，请稍后重试。',
            timeZoneError: '时区不可用',
            noWindow: '无可用时段',
            outsideForecast: '日期超出预报范围',
            weatherError: '模型数据不可用',
            retry: '刷新对比',
        },
        en: {
            title: 'Favorite time-window comparison',
            back: 'Back to favorites',
            close: 'Close comparison',
            dateControl: 'Observing date',
            moonless: 'Moonless',
            milkyWay: 'Milky Way',
            conditions: 'Conditions in window',
            modelLabel: 'Forecast model',
            weather: 'Weather',
            cloud: 'Cloud cover',
            highCloud: 'High cloud',
            mediumCloud: 'Mid cloud',
            lowCloud: 'Low cloud',
            temperature: 'Temperature',
            dewPoint: 'Dew point',
            precipitation: 'Precipitation',
            wind: 'Wind',
            humidity: 'Humidity',
            visibility: 'Visibility',
            aod: 'AOD',
            bortle: 'Light pollution',
            moonIllumination: 'Moon phase',
            loadingContext: 'Calculating astronomy windows and fixed conditions…',
            loadingModel: 'Refreshing model conditions…',
            prepareError: 'Unable to prepare the comparison. Try again later.',
            timeZoneError: 'Time zone unavailable',
            noWindow: 'No available window',
            outsideForecast: 'Date outside forecast range',
            weatherError: 'Model data unavailable',
            retry: 'Refresh comparison',
        },
    } as const;
    const modelOptions: { value: WeatherModel; label: string }[] = [
        { value: 'ecmwf', label: 'EC' },
        { value: 'gfs', label: 'GFS' },
        { value: 'icon', label: 'ICON' },
    ];
    type ComparisonMetric = {
        label: string;
        metric: 'totalCloudPercent' | 'highCloudPercent' | 'mediumCloudPercent' | 'lowCloudPercent'
            | 'temperatureC' | 'dewPointC' | 'precipMm' | 'windKmh' | 'humidityPercent'
            | 'visibilityKm' | 'aod550';
        evidenceField: 'totalCloudPercent' | 'highCloudPercent' | 'mediumCloudPercent' | 'lowCloudPercent'
            | 'temperatureC' | 'dewPointC' | 'precipitationMm' | 'windKmh' | 'humidityPercent'
            | 'visibilityKm' | 'aod550';
    };
    const windowKinds: AstronomyIntervalKind[] = ['moonless-night', 'milky-way'];
    const comparisonPlanner = createFavoriteComparisonPlanner({
        getTimeZone: async (location, datetime) => (await getTimezoneInfo(location, datetime)).data.TZname,
        getElevation: async (location, signal) => (
            await getElevation(location.lat, location.lon, { abortSignal: signal })
        ).data,
        getAtmosphere: (location, _requestedAt, signal) => fetchOpenMeteoAtmosphere({ location, signal }),
        getLightPollution: (location, signal) => fetchLightPollutionPoint(location, signal),
        getWeather: async (location, weatherModel, requestedAt, signal) => {
            const response = await getPointForecastData(
                weatherModel,
                {
                    lat: location.lat,
                    lon: location.lon,
                    days: 5,
                    step: 1,
                    source: 'detail',
                },
                {
                    header: true,
                    meteogram: true,
                    sounding: true,
                },
                { abortSignal: signal },
            );
            return transformWeatherPayload(response.data as WeatherForecastPayload, requestedAt);
        },
    });

    let text = labels.zh;
    let previousOpen = false;
    let previousSelectedDate = selectedDate;
    let panelElement: HTMLElement | null = null;
    let model: WeatherModel = 'ecmwf';
    let session: FavoriteComparisonSession | null = null;
    let results: FavoriteComparisonResult[] = [];
    let prepareStatus: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
    let modelLoading = false;
    let prepareRequestId = 0;
    let modelRequestId = 0;
    let prepareAbortController: AbortController | null = null;
    let modelAbortController: AbortController | null = null;
    let expandedLocationId: string | null = null;
    let destroyed = false;
    let comparisonMetrics: ComparisonMetric[] = [];

    $: text = labels[language];
    $: comparisonMetrics = [
        { label: text.cloud, metric: 'totalCloudPercent', evidenceField: 'totalCloudPercent' },
        { label: text.highCloud, metric: 'highCloudPercent', evidenceField: 'highCloudPercent' },
        { label: text.mediumCloud, metric: 'mediumCloudPercent', evidenceField: 'mediumCloudPercent' },
        { label: text.lowCloud, metric: 'lowCloudPercent', evidenceField: 'lowCloudPercent' },
        { label: text.temperature, metric: 'temperatureC', evidenceField: 'temperatureC' },
        { label: text.dewPoint, metric: 'dewPointC', evidenceField: 'dewPointC' },
        { label: text.humidity, metric: 'humidityPercent', evidenceField: 'humidityPercent' },
        { label: text.precipitation, metric: 'precipMm', evidenceField: 'precipitationMm' },
        { label: text.wind, metric: 'windKmh', evidenceField: 'windKmh' },
        { label: text.visibility, metric: 'visibilityKm', evidenceField: 'visibilityKm' },
        { label: text.aod, metric: 'aod550', evidenceField: 'aod550' },
    ];
    $: if (open !== previousOpen) {
        previousOpen = open;
        if (open) {
            model = initialModel;
            expandedLocationId = null;
            void prepareComparison();
            void tick().then(() => panelElement?.focus());
        } else {
            cancelRequests();
        }
    }
    $: if (!open) {
        previousSelectedDate = selectedDate;
    } else if (selectedDate !== previousSelectedDate) {
        previousSelectedDate = selectedDate;
        void prepareComparison();
    }

    const cancelRequests = () => {
        prepareRequestId += 1;
        modelRequestId += 1;
        prepareAbortController?.abort();
        modelAbortController?.abort();
        prepareAbortController = null;
        modelAbortController = null;
        modelLoading = false;
    };

    const loadModel = async (nextSession: FavoriteComparisonSession, nextModel: WeatherModel) => {
        modelAbortController?.abort();
        const abortController = new AbortController();
        modelAbortController = abortController;
        const requestId = ++modelRequestId;
        modelLoading = true;
        try {
            const nextResults = await nextSession.loadModel(nextModel, abortController.signal);
            if (
                destroyed
                || !open
                || abortController.signal.aborted
                || requestId !== modelRequestId
                || session !== nextSession
            ) {
                return;
            }
            results = nextResults;
        } catch (error) {
            if (!(error instanceof Error && error.name === 'AbortError')) {
                prepareStatus = 'error';
            }
        } finally {
            if (requestId === modelRequestId) {
                modelAbortController = null;
                modelLoading = false;
            }
        }
    };

    const prepareComparison = async () => {
        cancelRequests();
        const abortController = new AbortController();
        prepareAbortController = abortController;
        const requestId = ++prepareRequestId;
        prepareStatus = 'loading';
        results = [];
        session = null;
        try {
            const nextSession = await comparisonPlanner.prepare({
                targets,
                dateInput: selectedDate,
                requestedAt: Date.now(),
                signal: abortController.signal,
            });
            if (
                destroyed
                || !open
                || abortController.signal.aborted
                || requestId !== prepareRequestId
            ) {
                return;
            }
            session = nextSession;
            prepareAbortController = null;
            await loadModel(nextSession, model);
            if (
                !destroyed
                && open
                && requestId === prepareRequestId
                && session === nextSession
                && prepareStatus !== 'error'
            ) {
                prepareStatus = 'ready';
            }
        } catch (error) {
            if (
                !destroyed
                && open
                && requestId === prepareRequestId
                && !(error instanceof Error && error.name === 'AbortError')
            ) {
                prepareStatus = 'error';
            }
        }
    };

    const changeModel = (nextModel: WeatherModel) => {
        if (nextModel === model || !session || modelLoading) {
            return;
        }
        model = nextModel;
        void loadModel(session, nextModel);
    };

    const closeComparison = () => {
        cancelRequests();
        expandedLocationId = null;
        open = false;
        dispatch('close');
        void tick().then(() => returnFocus?.focus());
    };

    const backToFavorites = () => {
        cancelRequests();
        expandedLocationId = null;
        open = false;
        dispatch('back');
    };

    const handleKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            if (expandedLocationId) {
                expandedLocationId = null;
                return;
            }
            closeComparison();
        }
    };

    const handlePanelClick = (event: MouseEvent) => {
        if (
            expandedLocationId
            && event.target instanceof Element
            && !event.target.closest('.favorite-comparison__location-cell')
        ) {
            expandedLocationId = null;
        }
    };

    const handlePanelScrollGesture = (event: WheelEvent | TouchEvent) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target?.closest('.favorite-comparison__table-wrap')) {
            event.preventDefault();
        }
    };

    const toggleLocationDetails = (locationId: string) => {
        expandedLocationId = expandedLocationId === locationId ? null : locationId;
    };

    const openDatePicker = (event: MouseEvent) => {
        const input = event.currentTarget;
        if (input instanceof HTMLInputElement) {
            input.showPicker();
        }
    };

    const selectedWindow = (result: FavoriteComparisonResult, kind: AstronomyIntervalKind) =>
        result.windows.find(window => window.kind === kind) || null;

    const localTime = (timestamp: number, timeZone: string): string => new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).format(timestamp);

    const windowTimeLabel = (
        result: FavoriteComparisonResult,
        kind: AstronomyIntervalKind,
    ): string => {
        if (result.prepared.status === 'error') {
            return text.timeZoneError;
        }
        const interval = selectedWindow(result, kind)?.interval;
        if (!interval) {
            return '--';
        }
        return `${localTime(interval.start.getTime(), result.prepared.timeZone)}–${localTime(
            interval.end.getTime(),
            result.prepared.timeZone,
        )}`;
    };

    const rangeLabel = (
        result: FavoriteComparisonResult,
        field: 'totalCloudPercent' | 'highCloudPercent' | 'mediumCloudPercent' | 'lowCloudPercent'
            | 'temperatureC' | 'dewPointC' | 'precipitationMm' | 'windKmh' | 'humidityPercent'
            | 'visibilityKm' | 'aod550',
    ): string => {
        // 无月与银河窗口合并展示后，条件表同步统计两个有效窗口的完整范围。
        const ranges = result.windows.flatMap(window => {
            const windowRange = window.interval ? window.evidence[field] : null;
            return windowRange ? [windowRange] : [];
        });
        const range = ranges.length > 0
            ? {
                minimum: Math.min(...ranges.map(item => item.minimum)),
                maximum: Math.max(...ranges.map(item => item.maximum)),
            }
            : null;
        if (!range) {
            const openMeteoField = field === 'visibilityKm' || field === 'aod550';
            if (result.weatherStatus === 'error' && !openMeteoField) {
                return text.weatherError;
            }
            if (result.dateSelection.coverage !== 'covered') {
                return text.outsideForecast;
            }
            return '--';
        }
        const format = (value: number) => {
            if (field === 'precipitationMm') {
                return value.toFixed(value === Math.round(value) ? 0 : 1);
            }
            if (field === 'aod550') {
                return value.toFixed(2);
            }
            return String(Math.round(value));
        };
        const formattedRange = range.minimum === range.maximum
            ? format(range.minimum)
            : `${format(range.minimum)}–${format(range.maximum)}`;
        if (field === 'precipitationMm') {
            return `${formattedRange} mm`;
        }
        if (field === 'windKmh') {
            return `${formattedRange} km/h`;
        }
        if (field === 'visibilityKm') {
            return `${formattedRange} km`;
        }
        if (field === 'temperatureC' || field === 'dewPointC') {
            return `${formattedRange} °C`;
        }
        if (field === 'aod550') {
            return formattedRange;
        }
        return `${formattedRange}%`;
    };

    const weatherLabel = (result: FavoriteComparisonResult): string => {
        const codes = result.windows.flatMap(window => {
            const code = window.interval ? window.evidence.dominantWeatherIconCode : null;
            return code === null ? [] : [code];
        });
        if (codes.length > 0) {
            const counts = new Map<number, number>();
            let dominantCode = codes[0];
            let dominantCount = 0;
            for (const code of codes) {
                const count = (counts.get(code) || 0) + 1;
                counts.set(code, count);
                if (count > dominantCount) {
                    dominantCode = code;
                    dominantCount = count;
                }
            }
            return weatherConditionLabel(dominantCode, language);
        }
        if (result.weatherStatus === 'error') {
            return text.weatherError;
        }
        return result.dateSelection.coverage === 'covered' ? '--' : text.outsideForecast;
    };

    const bortleLabel = (result: FavoriteComparisonResult): string => {
        if (result.prepared.status === 'error') {
            return '--';
        }
        const value = result.prepared.lightPollution?.estimatedBortle;
        return value === undefined || value === null ? '--' : value.toFixed(1);
    };

    const moonIlluminationLabel = (comparisonResults: FavoriteComparisonResult[]): string => {
        const percentages = comparisonResults.flatMap(result => {
            if (result.prepared.status !== 'ready') {
                return [];
            }
            const fraction = dateInputForInstant(currentInstant, result.prepared.timeZone) === selectedDate
                ? calculateCurrentMoonInfo({
                    date: currentInstant,
                    location: result.prepared.target.location,
                }).illuminationFraction
                : result.prepared.timeline.moonIllumination.fraction;
            return [Number((fraction * 100).toFixed(1))];
        });
        if (percentages.length === 0) {
            return '--';
        }
        const minimum = Math.min(...percentages);
        const maximum = Math.max(...percentages);
        return minimum === maximum
            ? `${minimum.toFixed(1)}%`
            : `${minimum.toFixed(1)}–${maximum.toFixed(1)}%`;
    };

    const dateLabel = (dateInput: string, currentLanguage: 'zh' | 'en'): string => {
        const [, month, day] = dateInput.split('-').map(Number);
        return currentLanguage === 'zh' ? `${month}月${day}日` : `${month}/${day}`;
    };

    const windowKindLabel = (kind: AstronomyIntervalKind): string => kind === 'moonless-night'
        ? text.moonless
        : text.milkyWay;

    onDestroy(() => {
        destroyed = true;
        cancelRequests();
    });
</script>

{#if open}
    <section
        id="favorite-comparison-panel"
        class="favorite-comparison"
        class:mobile={mobile}
        class:fullscreen={fullscreen}
        class:open-upward={openUpward}
        role="dialog"
        aria-modal="true"
        aria-label={text.title}
        tabindex="-1"
        bind:this={panelElement}
        on:click={handlePanelClick}
        on:touchmove|nonpassive={handlePanelScrollGesture}
        on:wheel|nonpassive={handlePanelScrollGesture}
        on:keydown={handleKeydown}
    >
        <header class="favorite-comparison__header">
            <button type="button" class="icon-button" aria-label={text.back} on:click={backToFavorites}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7M8 12h11"></path></svg>
            </button>
            <strong>{text.title}</strong>
            <div class="favorite-comparison__header-meta">
                <label class="favorite-comparison__date-control">
                    <span>{dateLabel(selectedDate, language)}</span>
                    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                        <path d="m3 4.5 3 3 3-3"></path>
                    </svg>
                    <input
                        type="date"
                        bind:value={selectedDate}
                        aria-label={text.dateControl}
                        on:click={openDatePicker}
                    />
                </label>
                <span aria-hidden="true">·</span>
                <span class="favorite-comparison__moon-meta">
                    <span aria-hidden="true">☾</span>
                    {text.moonIllumination} {moonIlluminationLabel(results)}
                </span>
            </div>
            <button type="button" class="icon-button" aria-label={text.close} on:click={closeComparison}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>
            </button>
        </header>

        {#if prepareStatus === 'loading'}
            <div class="favorite-comparison__message" role="status">
                <span class="favorite-comparison__spinner" aria-hidden="true"></span>
                {text.loadingContext}
            </div>
        {:else if prepareStatus === 'error'}
            <div class="favorite-comparison__message favorite-comparison__message--error" role="alert">
                <span>{text.prepareError}</span>
                <button type="button" on:click={() => void prepareComparison()}>{text.retry}</button>
            </div>
        {:else}
            <section class="favorite-comparison__conditions" class:loading={modelLoading} aria-label={text.conditions}>
                {#if modelLoading}
                    <p class="favorite-comparison__model-status" role="status">{text.loadingModel}</p>
                {/if}
                <div class="favorite-comparison__table-wrap">
                    <table style={`--comparison-table-width: ${122 + results.length * 80}px`}>
                        <thead>
                            <tr>
                                <th scope="col" class="favorite-comparison__model-cell">
                                    <div class="favorite-comparison__models" aria-label={text.modelLabel}>
                                        {#each modelOptions as option}
                                            <button
                                                type="button"
                                                class:active={model === option.value}
                                                aria-pressed={model === option.value}
                                                disabled={modelLoading}
                                                on:click={() => changeModel(option.value)}
                                            >{option.label}</button>
                                        {/each}
                                    </div>
                                </th>
                                {#each results as result, index (result.prepared.target.id)}
                                    <th
                                        scope="col"
                                        class={`favorite-comparison__location-cell column-${index + 1}`}
                                        class:last-location={index === results.length - 1}
                                        title={result.prepared.target.title}
                                    >
                                        <button
                                            type="button"
                                            class="favorite-comparison__location-button"
                                            aria-label={result.prepared.target.title}
                                            aria-expanded={expandedLocationId === result.prepared.target.id}
                                            aria-describedby={expandedLocationId === result.prepared.target.id
                                                ? `favorite-comparison-location-${result.prepared.target.id}`
                                                : undefined}
                                            on:click={() => toggleLocationDetails(result.prepared.target.id)}
                                            on:blur={() => {
                                                if (expandedLocationId === result.prepared.target.id) {
                                                    expandedLocationId = null;
                                                }
                                            }}
                                        >
                                            <span class="favorite-comparison__location-label">
                                                {compactLocationLabel(result.prepared.target.title)}
                                            </span>
                                        </button>
                                        {#if expandedLocationId === result.prepared.target.id}
                                            <span
                                                id={`favorite-comparison-location-${result.prepared.target.id}`}
                                                class="favorite-comparison__location-tooltip"
                                                role="tooltip"
                                            >{result.prepared.target.title}</span>
                                        {/if}
                                    </th>
                                {/each}
                            </tr>
                        </thead>
                        <tbody>
                            {#each windowKinds as kind}
                                <tr
                                    class="favorite-comparison__window-row"
                                    class:last-window={kind === 'milky-way'}
                                >
                                    <th scope="row">
                                        <span aria-hidden="true">
                                            {#if kind === 'moonless-night'}
                                                <svg viewBox="0 0 16 16" focusable="false">
                                                    <path d="M11.7 11.3A5.2 5.2 0 0 1 5 4.6a5.2 5.2 0 1 0 6.7 6.7Z"></path>
                                                </svg>
                                            {:else}
                                                <svg viewBox="0 0 16 16" focusable="false">
                                                    <path d="M8 2.2 9.1 6.9 13.8 8l-4.7 1.1L8 13.8 6.9 9.1 2.2 8l4.7-1.1L8 2.2Z"></path>
                                                </svg>
                                            {/if}
                                        </span>
                                        <span>{windowKindLabel(kind)}</span>
                                    </th>
                                    {#each results as result, index (result.prepared.target.id)}
                                        <td
                                            class={`column-${index + 1}`}
                                            title={result.prepared.status === 'error'
                                                ? text.timeZoneError
                                                : selectedWindow(result, kind)?.interval ? undefined : text.noWindow}
                                        >{windowTimeLabel(result, kind)}</td>
                                    {/each}
                                </tr>
                            {/each}
                            <tr>
                                <th scope="row">
                                    <span aria-hidden="true"><WeatherMetricIcon metric="totalCloudPercent" size={14} /></span>
                                    <span>{text.weather}</span>
                                </th>
                                {#each results as result, index (result.prepared.target.id)}
                                    <td class={`column-${index + 1}`}>{weatherLabel(result)}</td>
                                {/each}
                            </tr>
                            {#each comparisonMetrics as metric}
                                <tr>
                                    <th scope="row">
                                        <span aria-hidden="true"><WeatherMetricIcon metric={metric.metric} size={14} /></span>
                                        <span>{metric.label}</span>
                                    </th>
                                    {#each results as result, index (result.prepared.target.id)}
                                        <td class={`column-${index + 1}`}>{rangeLabel(
                                            result,
                                            metric.evidenceField,
                                        )}</td>
                                    {/each}
                                </tr>
                            {/each}
                            <tr>
                                <th scope="row"><span aria-hidden="true">✦</span><span>{text.bortle}</span></th>
                                {#each results as result, index (result.prepared.target.id)}
                                    <td class={`column-${index + 1}`}>{bortleLabel(result)}</td>
                                {/each}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

        {/if}

        <footer class="favorite-comparison__footer">
            <button type="button" class="favorite-comparison__back" on:click={backToFavorites}>{text.back}</button>
            <button type="button" class="favorite-comparison__refresh" on:click={() => void prepareComparison()} disabled={prepareStatus === 'loading'}>
                {text.retry}
            </button>
        </footer>
    </section>
{/if}

<style lang="less">
    .favorite-comparison {
        position: absolute;
        z-index: 25;
        top: calc(100% + 4px);
        right: 0;
        left: 0;
        max-height: min(720px, 82dvh);
        overflow-y: auto;
        border: 1px solid rgba(255, 255, 255, 0.22);
        border-radius: 9px;
        outline: 0;
        color: var(--panel-text);
        background: #0d1d34;
        box-shadow: 0 14px 38px rgba(0, 0, 0, 0.52);
        font-size: 11px;
    }

    .favorite-comparison.open-upward {
        top: auto;
        bottom: 44px;
        max-height: min(720px, 86dvh);
    }

    .favorite-comparison__header {
        display: grid;
        grid-template-columns: 36px minmax(0, 1fr) auto 36px;
        align-items: center;
        min-height: 38px;
        border-bottom: 1px solid var(--panel-border);
    }

    .favorite-comparison__header strong {
        overflow: hidden;
        font-size: 13px;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .favorite-comparison__header-meta {
        display: flex;
        gap: 4px;
        align-items: center;
        min-width: 0;
        color: var(--panel-muted);
        font-size: 9px;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

    .favorite-comparison__moon-meta {
        display: inline-flex;
        gap: 3px;
        align-items: center;
    }

    .favorite-comparison__moon-meta > span {
        color: #8b75ff;
        font-size: 11px;
    }

    .favorite-comparison__date-control {
        position: relative;
        display: inline-flex;
        gap: 2px;
        align-items: center;
        height: 20px;
        padding: 0 4px;
        border: 1px solid rgba(116, 151, 188, 0.38);
        border-radius: 4px;
        background: rgba(4, 15, 30, 0.38);
        cursor: pointer;
    }

    .favorite-comparison__date-control:hover,
    .favorite-comparison__date-control:focus-within {
        border-color: rgba(99, 185, 238, 0.72);
        background: rgba(17, 169, 231, 0.1);
    }

    .favorite-comparison__date-control svg {
        width: 8px;
        height: 8px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.5;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .favorite-comparison__date-control input {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        cursor: pointer;
        opacity: 0;
    }

    .icon-button {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        padding: 0;
        border: 0;
        color: var(--panel-muted);
        background: transparent;
        cursor: pointer;
    }

    .icon-button svg {
        width: 16px;
        height: 16px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .favorite-comparison__conditions {
        position: relative;
        padding: 5px 8px 4px;
    }

    .favorite-comparison__models {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        width: 100%;
        overflow: hidden;
    }

    .favorite-comparison__models button {
        min-width: 0;
        height: 27px;
        padding: 0 2px;
        border: 0;
        border-right: 1px solid rgba(255, 255, 255, 0.12);
        color: var(--panel-muted);
        background: transparent;
        font: inherit;
        font-size: 9px;
        cursor: pointer;
    }

    .favorite-comparison__models button:last-child {
        border-right: 0;
    }

    .favorite-comparison__models button.active {
        color: #5bc5f4;
        background: rgba(17, 169, 231, 0.11);
        box-shadow: inset 0 -2px #11a9e7;
    }

    .favorite-comparison__models button:disabled {
        cursor: wait;
    }

    .favorite-comparison__table-wrap {
        overflow: auto;
        overscroll-behavior: none;
        touch-action: pan-x pan-y;
        -webkit-overflow-scrolling: touch;
    }

    table {
        width: max(100%, var(--comparison-table-width));
        min-width: 360px;
        border-collapse: collapse;
        table-layout: fixed;
    }

    th,
    td {
        height: 27px;
        padding: 2px 1px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.12);
        border-left: 1px solid rgba(255, 255, 255, 0.12);
        text-align: center;
        font-variant-numeric: tabular-nums;
    }

    thead th:first-child,
    tbody th {
        width: 122px;
        border-left: 0;
        background: #0d1d34;
    }

    tbody th {
        position: sticky;
        left: 0;
        z-index: 2;
    }

    thead th {
        overflow: hidden;
        color: var(--panel-muted);
        font-size: 10px;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .favorite-comparison__location-cell {
        position: relative;
        overflow: visible;
        padding: 0;
    }

    .favorite-comparison__location-button {
        width: 100%;
        height: 27px;
        min-width: 0;
        padding: 2px 4px;
        border: 0;
        color: inherit;
        background: transparent;
        font: inherit;
        cursor: help;
        touch-action: manipulation;
    }

    .favorite-comparison__location-button:hover,
    .favorite-comparison__location-button[aria-expanded='true'] {
        background: rgba(99, 185, 238, 0.08);
    }

    .favorite-comparison__location-label {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .favorite-comparison__location-tooltip {
        position: absolute;
        z-index: 4;
        top: calc(100% + 3px);
        left: 50%;
        width: max-content;
        max-width: 190px;
        padding: 4px 6px;
        border: 1px solid rgba(116, 151, 188, 0.56);
        border-radius: 4px;
        color: var(--panel-text);
        background: #071221;
        box-shadow: 0 5px 14px rgba(0, 0, 0, 0.42);
        font-size: 9px;
        font-weight: 500;
        line-height: 1.35;
        pointer-events: none;
        text-align: left;
        white-space: normal;
        word-break: break-word;
        transform: translateX(-50%);
    }

    .favorite-comparison__location-cell.column-1 .favorite-comparison__location-tooltip {
        left: 2px;
        transform: none;
    }

    .favorite-comparison__location-cell.last-location .favorite-comparison__location-tooltip {
        right: 2px;
        left: auto;
        transform: none;
    }

    .favorite-comparison__model-cell {
        position: sticky;
        left: 0;
        z-index: 4;
        padding: 0;
        background: #0d1d34;
    }

    tbody th {
        display: grid;
        grid-template-columns: 14px max-content;
        gap: 3px;
        align-items: center;
        justify-content: center;
        color: var(--panel-text);
        font-size: 9px;
        font-weight: 500;
        text-align: center;
        white-space: nowrap;
    }

    tbody th > span:nth-child(2) {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    tbody th > span:first-child {
        color: var(--panel-muted);
        text-align: center;
    }

    .favorite-comparison__window-row th > span:first-child {
        display: grid;
        place-items: center;
    }

    .favorite-comparison__window-row svg {
        width: 13px;
        height: 13px;
        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 1.25;
    }

    .favorite-comparison__window-row.last-window th,
    .favorite-comparison__window-row.last-window td {
        border-bottom-color: rgba(99, 185, 238, 0.34);
    }

    tbody td {
        overflow: hidden;
        padding-inline: 1px;
        font-size: 9px;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    th.column-1,
    td.column-1 {
        color: #19b8f3;
    }

    th.column-2,
    td.column-2 {
        color: #978cff;
    }

    th.column-3,
    td.column-3 {
        color: #c6d0dd;
    }

    th.column-4,
    td.column-4 {
        color: #f0ad72;
    }

    th.column-5,
    td.column-5 {
        color: #73d6ae;
    }

    .favorite-comparison__model-status {
        position: absolute;
        z-index: 2;
        top: 4px;
        right: 10px;
        margin: 0;
        padding: 2px 5px;
        border-radius: 4px;
        color: var(--panel-text);
        background: rgba(7, 18, 33, 0.88);
        font-size: 8px;
    }

    .favorite-comparison__conditions.loading .favorite-comparison__table-wrap {
        opacity: 0.58;
    }

    .favorite-comparison__footer {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        padding: 6px 8px 8px;
        border-top: 1px solid var(--panel-border);
    }

    .favorite-comparison__footer button,
    .favorite-comparison__message button {
        min-height: 32px;
        border: 1px solid rgba(116, 151, 188, 0.48);
        border-radius: 6px;
        color: var(--panel-text);
        background: transparent;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
    }

    .favorite-comparison__footer .favorite-comparison__refresh {
        border-color: transparent;
        color: #071525;
        background: var(--panel-accent);
    }

    .favorite-comparison__footer button:disabled {
        cursor: wait;
        opacity: 0.48;
    }

    .favorite-comparison__message {
        display: flex;
        gap: 9px;
        align-items: center;
        justify-content: center;
        min-height: 180px;
        padding: 18px;
        color: var(--panel-muted);
        text-align: center;
    }

    .favorite-comparison__message--error {
        flex-direction: column;
        color: #ffb4b4;
    }

    .favorite-comparison__message button {
        min-height: 30px;
        padding: 0 12px;
    }

    .favorite-comparison__spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(99, 185, 238, 0.25);
        border-top-color: var(--panel-accent);
        border-radius: 50%;
        animation: favorite-comparison-spin 700ms linear infinite;
    }

    button:focus-visible {
        outline: 2px solid var(--panel-accent);
        outline-offset: -2px;
    }

    @keyframes favorite-comparison-spin {
        to { transform: rotate(360deg); }
    }

    .favorite-comparison.mobile {
        inset: 0;
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        max-height: none;
        overflow: hidden;
        overscroll-behavior: none;
    }

    .favorite-comparison.mobile.open-upward {
        top: 0;
        bottom: 0;
        height: 100%;
        max-height: none;
    }

    .favorite-comparison.mobile.fullscreen {
        top: calc(52px + env(safe-area-inset-top, 0px));
        bottom: env(safe-area-inset-bottom, 0px);
        height: auto;
    }

    .favorite-comparison.mobile .favorite-comparison__header,
    .favorite-comparison.mobile .favorite-comparison__footer {
        flex: 0 0 auto;
    }

    .favorite-comparison.mobile .favorite-comparison__conditions {
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
    }

    .favorite-comparison.mobile .favorite-comparison__table-wrap {
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
        overscroll-behavior: none;
    }

    .favorite-comparison.mobile .favorite-comparison__message {
        flex: 1 1 auto;
        min-height: 0;
    }

    .favorite-comparison.mobile thead th {
        position: sticky;
        top: 0;
        z-index: 3;
        background: #0d1d34;
    }

    .favorite-comparison.mobile .favorite-comparison__model-cell {
        z-index: 4;
    }

    @media (max-width: 390px) {
        table {
            min-width: 354px;
        }

        thead th:first-child,
        tbody th {
            width: 118px;
        }
    }
</style>

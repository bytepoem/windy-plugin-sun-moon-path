<script lang="ts">
    import { getElevation, getTimezoneInfo } from '@windy/fetch';
    import { createEventDispatcher, tick } from 'svelte';
    import { labels, messages } from './locales/FavoriteComparison';
    import { loadObservationTimeZone } from './observationTimeZone';
    import { onPluginDestroy as onDestroy } from './pluginLifecycle';

    import {
        createFavoriteComparisonPlanner,
        type FavoriteComparisonResult,
        type FavoriteComparisonSession,
        type FavoriteComparisonTarget,
    } from './favoriteComparison';
    import { fetchLightPollutionPoint } from './lightPollution';
    import { compactLocationLabel } from './location';
    import { fetchOpenMeteoAtmosphereMetric } from './openMeteo';
    import { windyWeatherProvider } from './windyWeatherProvider';
    import {
        weatherConditionLabel,
        type WeatherModel,
        type WeatherSource,
    } from './weather';
    import WeatherMetricIcon from './WeatherMetricIcon.svelte';
    import {
        formatPrecipitationRangeMm,
        formatTemperatureRangeC,
        formatVisibilityRangeKm,
        formatWindSpeedRange,
        type UnitPreferences,
    } from './unitPreferences';
    import {
        calculateCurrentMoonInfo,
        dateInputForInstant,
        type AstronomyIntervalKind,
    } from './solar';
    import { DEFAULT_UI_LANGUAGE, type UiLanguage } from './uiLanguage';
    import ComparisonPeriodDetails from './ComparisonPeriodDetails.svelte';
    import {
        comparisonIntervalLabels,
        comparisonTargetIntervals,
        resolveComparisonCivilTime,
        selectComparisonPeriod,
        type ComparisonMode,
        type ComparisonTargetWindow,
        type ComparisonPeriod,
    } from './favoriteComparisonPeriod';
    import type { PluginDiagnostics } from './pluginDiagnostics';

    export let open = false;
    export let diagnostics: PluginDiagnostics | null = null;
    export let targets: FavoriteComparisonTarget[] = [];
    export let selectedDate = '';
    export let currentInstant: Date;
    export let initialModel: WeatherModel = 'ecmwf';
    export let source: WeatherSource = 'windy';
    export let language: UiLanguage = DEFAULT_UI_LANGUAGE;
    export let mobile = false;
    export let fullscreen = false;
    export let openUpward = false;
    export let units: UnitPreferences;
    export let returnFocus: HTMLElement | null = null;

    const dispatch = createEventDispatcher<{
        back: void;
        close: void;
        select: FavoriteComparisonTarget;
        datechange: void;
    }>();

    const modelOptions: { value: WeatherModel; label: string }[] = [
        { value: 'ecmwf', label: 'EC' },
        { value: 'gfs', label: 'GFS' },
        { value: 'icon', label: 'ICON' },
    ];
    type ComparisonMetric = {
        label: string;
        metric: 'totalCloudPercent' | 'highCloudPercent' | 'mediumCloudPercent' | 'lowCloudPercent'
            | 'temperatureC' | 'dewPointC' | 'precipMm' | 'windMs' | 'humidityPercent'
            | 'visibilityKm' | 'aod550';
        evidenceField: 'totalCloudPercent' | 'highCloudPercent' | 'mediumCloudPercent' | 'lowCloudPercent'
            | 'temperatureC' | 'dewPointC' | 'precipitationMm' | 'windMs' | 'humidityPercent'
            | 'visibilityKm' | 'aod550';
    };
    const windowKinds: AstronomyIntervalKind[] = ['moonless-night', 'milky-way'];
    const comparisonPlanner = createFavoriteComparisonPlanner({
        getTimeZone: (location, datetime) => loadObservationTimeZone(() => getTimezoneInfo(location, datetime)),
        getElevation: async (location, signal) => (
            await getElevation(location.lat, location.lon, { abortSignal: signal })
        ).data,
        getAtmosphere: (metric, location, _requestedAt, signal) => fetchOpenMeteoAtmosphereMetric(metric, { location, signal }),
        getLightPollution: (location, signal) => fetchLightPollutionPoint(location, signal),
        getWeather: async (location, weatherModel, requestedAt, signal, weatherSource = 'windy') => (
            await windyWeatherProvider.weather({ location, model: weatherModel, requestedAt, signal, source: weatherSource })
        ).points,
    });

    let text = labels[language];
    let previousOpen = false;
    let previousSelectedDate = selectedDate;
    let previousSource = source;
    let previousInitialModel = initialModel;
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
    let destroyed = false;
    let comparisonMetrics: ComparisonMetric[] = [];
    let mode: ComparisonMode = 'day';
    let targetWindow: ComparisonTargetWindow = 'milky-way';
    let segments: Record<string, 'all' | number> = {};
    let customStart = `${selectedDate}T18:00`;
    let customEnd = `${selectedDate}T23:00`;
    let previousTargets = '';
    let customDate = selectedDate;
    let segmentContext = '';
    let periods = new Map<FavoriteComparisonResult, ComparisonPeriod>();
    $: targetKey = JSON.stringify(targets);
    // These assignments must stay visible to Svelte's dependency graph: inputs
    // and the UTC interval must change in the same flush, even while closed.
    $: if (selectedDate !== customDate) {
        customDate = selectedDate;
        customStart = `${selectedDate}T18:00`;
        customEnd = `${selectedDate}T23:00`;
    }
    $: nextSegmentContext = JSON.stringify([selectedDate, source, targetKey]);
    $: if (nextSegmentContext !== segmentContext) {
        segmentContext = nextSegmentContext;
        segments = {};
    }
    // The comparison owns a verified local clock. Never borrow the parent map's
    // provisional system/previous-location time zone while context is loading.
    $: customTimeZone = session?.preparedTargets.flatMap(prepared => prepared.status === 'ready' ? [prepared.timeZone] : [])[0] ?? null;
    $: customStartInstant = customTimeZone ? resolveComparisonCivilTime(customStart, customTimeZone) : null;
    $: customEndInstant = customTimeZone ? resolveComparisonCivilTime(customEnd, customTimeZone) : null;
    $: customInterval = customStartInstant !== null && customEndInstant !== null && customEndInstant > customStartInstant
        ? { start: customStartInstant, end: customEndInstant } : null;
    $: periods = new Map(results.map(result => [result, selectComparisonPeriod({
        result, mode, target: targetWindow, segment: segments[result.prepared.target.id] ?? 'all', custom: customInterval,
    })]));

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
        { label: text.wind, metric: 'windMs', evidenceField: 'windMs' },
        { label: text.visibility, metric: 'visibilityKm', evidenceField: 'visibilityKm' },
        { label: text.aod, metric: 'aod550', evidenceField: 'aod550' },
    ];
    // An explicit assignment orders context invalidation before local-time
    // derivation in the same Svelte flush, including a pending preparation.
    $: session = synchronizeContext(open, selectedDate, source, targetKey, initialModel);

    /** Input invalidation also runs while closed. Opening and context changes share
     * one request entry so a new target/date cannot start duplicate preparations.
     */
    const synchronizeContext = (isOpen: boolean, date: string, weatherSource: WeatherSource, key: string, hostModel: WeatherModel) => {
        const opening = isOpen && !previousOpen;
        const closing = !isOpen && previousOpen;
        const contextChanged = date !== previousSelectedDate || weatherSource !== previousSource || key !== previousTargets;
        const hostModelChanged = hostModel !== previousInitialModel;
        previousOpen = isOpen;
        previousSelectedDate = date;
        previousSource = weatherSource;
        previousTargets = key;
        previousInitialModel = hostModel;
        if (opening || hostModelChanged) { model = hostModel; }
        if (closing) { cancelRequests(); }
        if (isOpen && (opening || contextChanged)) {
            void prepareComparison();
            if (opening) { void tick().then(() => { if (!destroyed && open) { panelElement?.focus(); } }); }
        } else if (isOpen && hostModelChanged && session) {
            void loadModel(session, hostModel);
        }
        return session;
    };

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
        const operation = diagnostics?.begin('comparison') ?? 0;
        modelLoading = true;
        results = [];
        try {
            const nextResults = await nextSession.loadModel(nextModel, abortController.signal);
            if (
                destroyed
                || !open
                || abortController.signal.aborted
                || requestId !== modelRequestId
                || session !== nextSession
            ) {
                diagnostics?.end('comparison', operation, 'cancelled');
                return;
            }
            results = nextResults;
            // Only accepted results may report failures; cancelled or superseded work stays silent.
            for (const result of nextResults) {
                if (result.diagnosticError !== undefined) {
                    diagnostics?.error('comparison', result.diagnosticError, operation);
                }
            }
            diagnostics?.end('comparison', operation);
        } catch (error) {
            if (!destroyed && open && !abortController.signal.aborted
                && requestId === modelRequestId && session === nextSession) {
                diagnostics?.error('comparison', error, operation);
                prepareStatus = 'error';
            } else {
                diagnostics?.end('comparison', operation, 'cancelled');
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
        const operation = diagnostics?.begin('comparison') ?? 0;
        prepareStatus = 'loading';
        results = [];
        session = null;
        try {
            const nextSession = await comparisonPlanner.prepare({
                source,
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
                diagnostics?.end('comparison', operation, 'cancelled');
                return;
            }
            session = nextSession;
            for (const prepared of nextSession.preparedTargets) {
                if (prepared.status === 'error' && prepared.diagnosticError) {
                    diagnostics?.error('comparison', prepared.diagnosticError, operation);
                } else if (prepared.status === 'ready') {
                    for (const error of prepared.diagnosticErrors ?? []) {
                        diagnostics?.error('comparison', error, operation);
                    }
                }
            }
            diagnostics?.end('comparison', operation);
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
                && !abortController.signal.aborted
                && requestId === prepareRequestId
            ) {
                diagnostics?.error('comparison', error, operation);
                prepareStatus = 'error';
            } else {
                diagnostics?.end('comparison', operation, 'cancelled');
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
        open = false;
        dispatch('close');
        void tick().then(() => returnFocus?.focus());
    };

    const backToFavorites = () => {
        cancelRequests();
        open = false;
        dispatch('back');
    };

    const handleKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            closeComparison();
        }
    };

    const handlePanelScrollGesture = (event: WheelEvent | TouchEvent) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target?.closest('.favorite-comparison__table-wrap, .favorite-comparison__conditions, .favorite-comparison__period-controls')) {
            event.preventDefault();
        }
    };

    /** Closes comparison before the parent switches the selected map location. */
    const selectLocation = (target: FavoriteComparisonTarget) => {
        cancelRequests();
        open = false;
        dispatch('select', target);
    };

    const openDatePicker = (event: MouseEvent) => {
        const input = event.currentTarget;
        if (input instanceof HTMLInputElement) {
            input.showPicker();
        }
    };

    const selectedWindow = (result: FavoriteComparisonResult, kind: AstronomyIntervalKind) =>
        result.windows.find(window => window.kind === kind) || null;

    const localTime = (timestamp: number, zone: string): string => new Intl.DateTimeFormat('en-GB', {
        timeZone: zone,
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
            | 'temperatureC' | 'dewPointC' | 'precipitationMm' | 'windMs' | 'humidityPercent'
            | 'visibilityKm' | 'aod550',
        selectedUnits: UnitPreferences,
        period: ComparisonPeriod | undefined,
        copy: typeof labels.zh,
        weatherSource: WeatherSource,
    ): string => {
        // Keep Svelte dependencies explicit so a period change updates every metric cell.
        const metric = field === 'precipitationMm' ? 'precipMm' : field;
        const points = field === 'precipitationMm' ? period?.precipitationPoints ?? [] : period?.points ?? [];
        const values = points.flatMap(point => {
            const value = point[metric];
            return value === null || !Number.isFinite(value) ? [] : [value];
        });
        const range = values.length > 0
            ? {
                minimum: Math.min(...values),
                maximum: Math.max(...values),
            }
            : null;
        const independent = field === 'aod550' || (weatherSource === 'windy' && field === 'visibilityKm');
        const weatherSamples = result.forecastPoints.filter(point => period?.intervals.some(interval =>
            point.timestamp >= interval.start && point.timestamp < interval.end));
        const providerTimestamps = new Set(result.forecastPoints.map(point => point.timestamp));
        const missingValues = !independent && (field === 'precipitationMm'
            ? points.filter(point => providerTimestamps.has(point.timestamp)) : weatherSamples)
            .some(point => point[metric] === null || !Number.isFinite(point[metric]));
        const withCoverage = (value: string) => missingValues ? `${value} · ${copy.partial}` : value;
        if (!range) {
            if (result.prepared.status === 'ready'
                && ((field === 'aod550' && result.prepared.aodStatus === 'error')
                    || (field === 'visibilityKm' && result.prepared.visibilityStatus === 'error'))) {
                return copy.atmosphereError;
            }
            const independentField = field === 'aod550' || (weatherSource === 'windy' && field === 'visibilityKm');
            if (result.weatherStatus === 'error' && !independentField) {
                return copy.weatherError;
            }
            if (period?.coverage === 'no-window') { return copy.noWindow; }
            if (period?.coverage === 'invalid') { return '--'; }
            if (period?.coverage === 'outside') {
                return copy.outsideForecast;
            }
            return copy.missing;
        }
        if (field === 'windMs') {
            return withCoverage(formatWindSpeedRange(range, selectedUnits.wind));
        }
        if (field === 'precipitationMm') {
            return withCoverage(formatPrecipitationRangeMm(range, selectedUnits.precipitation));
        }
        if (field === 'visibilityKm') {
            return withCoverage(formatVisibilityRangeKm(range, selectedUnits.distance));
        }
        if (field === 'temperatureC' || field === 'dewPointC') {
            return withCoverage(formatTemperatureRangeC(range, selectedUnits.temperature));
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
        if (field === 'aod550') {
            return withCoverage(formattedRange);
        }
        return withCoverage(`${formattedRange}%`);
    };

    const weatherLabel = (result: FavoriteComparisonResult, period: ComparisonPeriod | undefined, currentLanguage: UiLanguage): string => {
        const copy = labels[currentLanguage];
        const codes = (period?.points ?? []).flatMap(point => {
            const code = point.iconCode;
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
            return weatherConditionLabel(dominantCode, currentLanguage);
        }
        if (result.weatherStatus === 'error') {
            return copy.weatherError;
        }
        const coverage = period?.coverage;
        return coverage === 'outside' ? copy.outsideForecast : coverage === 'no-window' ? copy.noWindow : copy.missing;
    };

    const coverageLabel = (coverage: ComparisonPeriod['coverage'] | undefined, copy: typeof labels.zh) => coverage === 'full' ? copy.full
        : coverage === 'partial' ? copy.partial : coverage === 'outside' ? copy.outsideForecast
        : coverage === 'error' ? copy.weatherError : coverage === 'no-window' ? copy.noWindow
        : coverage === 'invalid' ? '--' : copy.missing;

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

    const dateLabel = (dateInput: string, currentLanguage: UiLanguage): string => {
        const [, month, day] = dateInput.split('-').map(Number);
        return labels[currentLanguage].shortDate(month, day);
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
    <!-- Dialog delegates Escape and nested scroll handling for its interactive children. -->
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
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
        on:touchmove|nonpassive={handlePanelScrollGesture}
        on:wheel|nonpassive={handlePanelScrollGesture}
        on:keydown={handleKeydown}
    >
        <header class="favorite-comparison__header">
            <button type="button" class="icon-button" aria-label={text.back} title={text.back} on:click={backToFavorites}>
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
                        on:change={() => dispatch('datechange')}
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
            <button type="button" class="icon-button" aria-label={text.close} title={text.close} on:click={closeComparison}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>
            </button>
        </header>

        <div class="favorite-comparison__controls">
            <label class="favorite-comparison__source">
                {messages[language].weatherSource}
                <select bind:value={source} title={source === 'open-meteo' ? 'Open-Meteo' : 'Windy'}>
                    <option value="windy">Windy</option>
                    <option value="open-meteo" title="Open-Meteo">OM</option>
                </select>
            </label>
            <div class="favorite-comparison__period-controls">
                <label>{text.mode}
                    <select bind:value={mode}>
                        <option value="day">{text.day}</option>
                        <option value="target">{text.target}</option>
                        <option value="custom">{text.custom}</option>
                    </select>
                </label>
            </div>
            {#if mode === 'target'}
                <div class="favorite-comparison__target-controls">
                    <label>
                        <select aria-label={text.target} bind:value={targetWindow} on:change={() => segments = {}}>
                            <option value="milky-way">{text.milkyWay}</option>
                            <option value="moonless-night">{text.moonless}</option>
                            <option value="sunset">{text.sunset}</option>
                        </select>
                    </label>
                </div>
            {:else if mode === 'custom'}
                <div class="favorite-comparison__custom-controls">
                    <label>{text.start}<input type="datetime-local" step="60" disabled={!customTimeZone} bind:value={customStart} /></label>
                    <label>{text.end}<input type="datetime-local" step="60" disabled={!customTimeZone} bind:value={customEnd} /></label>
                </div>
            {/if}
        </div>
        {#if mode === 'custom' && customTimeZone && !customInterval}<p class="favorite-comparison__forecast-note" role="alert">{text.invalidPeriod}</p>{/if}
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
                <p class="favorite-comparison__forecast-note">{mode === 'day' ? text.conditions : mode === 'target' ? text.eventRule : text.customRule}</p>
                {#if modelLoading}
                    <p class="favorite-comparison__model-status" role="status">
                        <span class="favorite-comparison__spinner" aria-hidden="true"></span>
                        {text.loadingModel}
                    </p>
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
                                            aria-label={text.locate(result.prepared.target.title)}
                                            title={result.prepared.target.title}
                                            on:click={() => selectLocation(result.prepared.target)}
                                        >
                                            <span class="favorite-comparison__location-label">
                                                {compactLocationLabel(result.prepared.target.title)}
                                            </span>
                                        </button>
                                    </th>
                                {/each}
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="favorite-comparison__period-row">
                                <th scope="row">{text.period}</th>
                                {#each results as result, index (result.prepared.target.id)}
                                    <td class={`column-${index + 1}`}>
                                        {#if mode === 'target' && comparisonTargetIntervals(result, targetWindow).length > 1}
                                            <select aria-label={`${text.target} · ${result.prepared.target.title}`}
                                                value={segments[result.prepared.target.id] ?? 'all'}
                                                on:change={event => segments = { ...segments, [result.prepared.target.id]: event.currentTarget.value === 'all' ? 'all' : Number(event.currentTarget.value) }}>
                                                <option value="all">{text.allSegments}</option>
                                                {#each comparisonTargetIntervals(result, targetWindow) as interval, segmentIndex}
                                                    <option value={segmentIndex}>{segmentIndex + 1} · {result.prepared.status === 'ready' ? localTime(interval.start, result.prepared.timeZone) : ''}</option>
                                                {/each}
                                            </select>
                                        {/if}
                                        {#if result.prepared.status !== 'ready'}
                                            <span>{text.timeZoneError}</span>
                                        {:else if periods.get(result)?.intervals.length}
                                            {#each periods.get(result)?.intervals ?? [] as interval}
                                                {@const endpoints = comparisonIntervalLabels(interval, result.prepared.timeZone, selectedDate, text.shortDate)}
                                                <div class="favorite-comparison__interval">
                                                    <span>{endpoints.start}</span><span aria-hidden="true">–</span><span>{endpoints.end}</span>
                                                </div>
                                            {/each}
                                        {:else}
                                            <span>{periods.get(result)?.coverage === 'invalid' ? '--' : text.noWindow}</span>
                                        {/if}
                                        <small>{coverageLabel(periods.get(result)?.coverage, text)}</small>
                                    </td>
                                {/each}
                            </tr>
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
                                    <td class={`column-${index + 1}`}>{weatherLabel(result, periods.get(result), language)}</td>
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
                                            units,
                                            periods.get(result),
                                            text,
                                            source,
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
                <details class="favorite-comparison__details">
                    <summary>{text.details}</summary>
                    <p>{text.resolution}</p>
                    <p>{text.precipitationRule}</p>
                    {#each results as result (result.prepared.target.id)}
                        <ComparisonPeriodDetails {result} period={periods.get(result)} {language} {units} />
                    {/each}
                </details>
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
    .favorite-comparison__controls {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 8px;
        padding: 8px 8px 4px;
    }
    .favorite-comparison__source,
    .favorite-comparison__period-controls,
    .favorite-comparison__target-controls,
    .favorite-comparison__custom-controls,
    .favorite-comparison__controls label {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        max-width: 100%;
    }
    // Target windows share the compact toolbar; custom dates keep a separate row.
    .favorite-comparison__custom-controls { flex-basis: 100%; }
    .favorite-comparison__target-controls select { field-sizing: content; }
    .favorite-comparison__source select,
    .favorite-comparison__period-controls select,
    .favorite-comparison__target-controls select,
    .favorite-comparison__custom-controls input,
    .favorite-comparison__period-row select {
        max-width: 100%;
        min-width: 0;
        min-height: 30px;
        box-sizing: border-box;
        padding: 4px 8px;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        color: inherit;
        background: #0e161f;
        font: inherit;
    }
    .favorite-comparison__controls select,
    .favorite-comparison__period-row select {
        appearance: none;
        padding-inline: 8px 22px;
        background-image: linear-gradient(45deg, transparent 50%, #b9c2ce 50%), linear-gradient(135deg, #b9c2ce 50%, transparent 50%);
        background-position: calc(100% - 11px) 50%, calc(100% - 7px) 50%;
        background-size: 4px 4px;
        background-repeat: no-repeat;
        cursor: pointer;
    }
    .favorite-comparison__controls select:focus-visible,
    .favorite-comparison__controls input:focus-visible,
    .favorite-comparison__period-row select:focus-visible {
        outline: 2px solid var(--panel-accent);
        outline-offset: 2px;
    }
    .favorite-comparison__period-row td { padding: 6px 4px; white-space: normal; }
    .favorite-comparison__period-row select { width: 100%; margin-bottom: 4px; color: var(--panel-text); }
    .favorite-comparison__interval { display: flex; flex-wrap: wrap; gap: 0 3px; justify-content: center; margin: 2px 0; line-height: 1.5; }
    .favorite-comparison__interval + .favorite-comparison__interval { margin-top: 6px; }
    .favorite-comparison__interval span { white-space: nowrap; }
    .favorite-comparison__period-row small { display: block; margin-top: 4px; color: #d6c592; }
    .favorite-comparison__details { padding: 8px; }
    .favorite-comparison__details summary { cursor: pointer; min-height: 28px; }
    .favorite-comparison__details p { color: var(--panel-muted); margin: 4px 0 8px; }
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

    .favorite-comparison__forecast-note {
        margin: 2px 0 6px;
        font-size: 11px;
        color: #a9b8c9;
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
        vertical-align: middle;
        font-variant-numeric: tabular-nums;
    }

    thead th { font-weight: 700; }

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
        min-height: 44px;
        min-width: 0;
        padding: 2px 4px;
        border: 0;
        color: var(--panel-accent);
        background: transparent;
        font: inherit;
        cursor: pointer;
        touch-action: manipulation;
    }

    .favorite-comparison__location-button:hover,
    .favorite-comparison__location-button:focus-visible {
        background: rgba(99, 185, 238, 0.08);
    }

    .favorite-comparison__location-button:focus-visible {
        outline: 2px solid var(--panel-accent);
        outline-offset: -2px;
    }

    .favorite-comparison__location-label {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .favorite-comparison__model-cell {
        position: sticky;
        left: 0;
        z-index: 4;
        padding: 0;
        background: #0d1d34;
    }

    tbody th {
        // Keep table-cell layout so the border spans the full multi-line row.
        display: table-cell;
        overflow: hidden;
        color: var(--panel-text);
        font-size: 9px;
        font-weight: 500;
        text-align: center;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    tbody th > span {
        display: inline-block;
        vertical-align: middle;
    }

    tbody th > span:nth-child(2) {
        max-width: calc(100% - 22px);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    tbody th > span:first-child {
        margin-inline-end: 3px;
        color: var(--panel-muted);
        text-align: center;
    }

    .favorite-comparison__window-row th > span:first-child {
        display: inline-flex;
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
        display: flex;
        align-items: center;
        gap: 5px;
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
    .favorite-comparison.mobile .favorite-comparison__controls,
    .favorite-comparison.mobile .favorite-comparison__footer {
        flex: 0 0 auto;
    }

    .favorite-comparison.mobile .favorite-comparison__conditions {
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        min-height: 0;
        overflow-y: auto;
    }

    .favorite-comparison.mobile .favorite-comparison__table-wrap {
        flex: 0 0 auto;
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
    .favorite-comparison__model-status .favorite-comparison__spinner {
        width: 12px;
        height: 12px;
        flex-shrink: 0;
    }

    @media (prefers-reduced-motion: reduce) {
        .favorite-comparison__spinner {
            animation: none;
        }
    }
</style>

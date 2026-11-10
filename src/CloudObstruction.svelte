<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { map } from '@windy/map';
    import metrics from '@windy/metrics';
    import { UI_LANGUAGES, type UiLanguage } from './uiLanguage';
    import { messages } from './locales/CloudObstruction';
    import { onPluginDestroy as onDestroy, onPluginMount as onMount } from './pluginLifecycle';
    import { cloudArc, cloudTargetPosition, cloudSightDistance, cloudTwilightDistances, type CloudDirectionBody } from './cloudGeometry';
    import CloudHelp from './CloudHelp.svelte';
    import { cloudEventBody, type CloudTimelineEventType } from './cloudTimeline';
    import { selectCloudBase, resolveCloudLayers } from './cloudBase';
    import { CLOUD_BAND_COLORS, createCloudOverlayController } from './cloudOverlayController';
    import {
        CLOUD_BANDS, extractCloudForecast, selectCloudProfile,
        type CloudBand, type CloudHeightSource, type CloudSettings,
    } from './cloudProfile';
    import { formatLocalClock, type Coordinates, type SolarEvent } from './solar';
    import { formatDistanceKm, formatElevationM, type UnitPreferences } from './unitPreferences';
    import type { WeatherForecastPayload, WeatherLoadStatus, WeatherModel } from './weather';

    export let location: Coordinates;
    export let forecast: WeatherForecastPayload | null;
    export let status: WeatherLoadStatus;
    export let model: WeatherModel;
    export let timeZone: string;
    export let language: UiLanguage;
    export let units: UnitPreferences;
    export let settings: CloudSettings;
    export let lineOpacity: number;

    const dispatch = createEventDispatcher<{ modelchange: WeatherModel; retry: void; resync: void }>();
    const overlay = createCloudOverlayController(map);
    export let cloudMapEvent: SolarEvent | null = 'sunset';
    export let timelineEvent: CloudTimelineEventType = 'sunset';
    export let previewingTime = false;
    export let timestamp: number | null;
    let showSourceHelp = false;
    let showHelp = false;
    export let cloudPlanningBody: CloudDirectionBody = 'sun';
    export let cloudDirectionRangeKm = 0;
    export let cloudBounds: [[number, number], [number, number]] | null = null;
    export let cloudDetailBounds: [[number, number], [number, number]] | null = null;
    let mounted = false;
    export let syncError: boolean;
    export let syncing: boolean;
    const changeModel = (event: Event) => dispatch('modelchange', (event.currentTarget as HTMLSelectElement).value as WeatherModel);

    $: single = settings.view === 'single';
    $: visibleBands = single ? ['low'] as CloudBand[] : CLOUD_BANDS;
    $: heightMode = single ? settings.single.mode
        : CLOUD_BANDS.every(band => settings.layers[band].mode === 'manual') ? 'manual' : 'auto';
    $: heightSource = single ? settings.singleSource : settings.layeredSource;
    $: automaticHeights = single ? settings.single.mode === 'auto'
        : CLOUD_BANDS.some(band => settings.layers[band].enabled && settings.layers[band].mode === 'auto');
    $: sourceValue = heightMode === 'manual' ? 'manual' : heightSource;
    // Only the selected automatic method is evaluated; changing time reuses its forecast steps.
    $: cloudForecast = !automaticHeights || heightSource === 'base' ? { profiles: [], modelElevationM: null }
        : extractCloudForecast(forecast, heightSource === 'cloud' ? settings.threshold : settings.dewPointSpreadC, heightSource);
    $: sourceDescriptions = messages[language].heightSourceDescriptions;
    // The parent owns the clock across every Tab, including while this view is unmounted.
    $: planningEvents = timestamp === null ? [] : [{ type: timelineEvent, timestamp }];
    $: scenarios = planningEvents.map(event => {
        const profile = selectCloudProfile(cloudForecast, event.timestamp);
        const base = heightSource === 'base' && automaticHeights ? selectCloudBase(forecast, event.timestamp) : null;
        return { ...event, profile, base, ...cloudTargetPosition(cloudEventBody(timelineEvent), event.timestamp, location),
            layers: resolveCloudLayers(settings, base, profile) };
    });
    $: activeBody = scenarios[0]?.body ?? cloudEventBody(timelineEvent);
    $: cloudPlanningBody = activeBody;
    $: cloudMapEvent = activeBody === 'milkyway' ? null : `${activeBody}${timelineEvent.endsWith('rise') ? 'rise' : 'set'}` as SolarEvent;
    $: bodyName = activeBody === 'milkyway' ? (messages[language].galacticCentre)
        : activeBody === 'sun' ? (messages[language].sun) : (messages[language].moon);
    $: layers = scenarios.flatMap(event => event.layers);
    // Share the outermost cloud distance with event rays, including a small visual overrun.
    $: cloudDirectionRangeKm = Math.max(0, ...scenarios.flatMap(event => event.layers.map(layer => Math.max(
        cloudTwilightDistances(layer.heightM)?.clearKm ?? 0,
        event.position.sightlineAvailable ? cloudSightDistance(layer.heightM, event.position.altitude) ?? 0 : 0,
    )))) * 1.05;
    $: cloudBounds = planningBounds(scenarios, false);
    $: cloudDetailBounds = planningBounds(scenarios, true);
    $: if (mounted) {
        overlay.destroy();
        scenarios.forEach(event => {
            overlay.render({ location, position: event.position, sunAzimuth: event.position.azimuth,
                layers: event.layers, twilight: true, opacity: lineOpacity, language, units });
        });
    }

    $: bandName = (band: CloudBand) => ({
        low: messages[language].l, medium: messages[language].m, high: messages[language].h,
    })[band];
    $: heightLabel = (height: number) => `${formatElevationM(height, units.elevation)} ${units.elevation}`;
    const validHeight = (height: number | undefined): height is number =>
        typeof height === 'number' && Number.isFinite(height) && height > 0 && height <= 30_000;

    const setManualHeight = (band: CloudBand, event: Event) => {
        const input = event.currentTarget as HTMLInputElement;
        const row = single ? settings.single : settings.layers[band];
        row.heightM = input.value === '' ? undefined : input.valueAsNumber * (units.elevation === 'ft' ? 0.3048 : 1);
        settings = { ...settings };
    };

    // Defaults are seeded only when entering manual mode with no saved value;
    // clearing an active input must leave it empty until the user fills it again.
    const changeHeightMode = (band: CloudBand, mode: 'auto' | 'manual') => {
        if (single) {
            settings.single = { ...settings.single, mode,
                heightM: mode === 'manual' && settings.single.heightM === undefined ? 2000 : settings.single.heightM };
            settings = { ...settings };
            return;
        }
        const row = settings.layers[band];
        settings.layers[band] = { ...row, mode,
            heightM: mode === 'manual' && row.heightM === undefined
                ? ({ low: 2000, medium: 4000, high: 6000 })[band] : row.heightM };
        settings = { ...settings };
    };

    /** Keep each view's automatic method and all manual values independent. */
    const changeSource = (event: Event) => {
        showSourceHelp = false;
        const value = (event.currentTarget as HTMLSelectElement).value;
        if (value !== 'manual') {
            if (single) { settings.singleSource = value as CloudHeightSource; }
            else { settings.layeredSource = value as CloudHeightSource; }
        }
        const mode = value === 'manual' ? 'manual' : 'auto';
        visibleBands.forEach(band => changeHeightMode(band, mode));
    };

    /** Fit the rendered geometry; unwrap longitude around the selected point for date-line crossings. */
    const planningBounds = (events: typeof scenarios, detail: boolean): typeof cloudBounds => {
        const points = events.flatMap(event => event.layers.flatMap(layer => {
            const geometry = cloudTwilightDistances(layer.heightM);
            if (!geometry) {return [];}
            const sight = event.position.sightlineAvailable ? cloudSightDistance(layer.heightM, event.position.altitude) : null;
            return [...cloudArc(location, geometry.horizonKm, 180, 360),
                ...cloudArc(location, detail ? (sight ?? geometry.horizonKm) : Math.max(geometry.clearKm, sight ?? 0), event.position.azimuth, detail ? 0 : 36)];
        }));
        if (!points.length) {return null;}
        const lons = points.map(point => location.lon + ((point.lon - location.lon + 540) % 360) - 180);
        return [[Math.max(-85, Math.min(...points.map(point => point.lat))), Math.min(...lons)],
            [Math.min(85, Math.max(...points.map(point => point.lat))), Math.max(...lons)]];
    };
    onMount(() => {
        mounted = true;
    });

    onDestroy(() => {
        mounted = false;
        overlay.destroy();
    });
</script>

<section class="cloud-panel" class:cloud-panel--expanded-headings={!UI_LANGUAGES[language].compactCloudHeadings} aria-label={messages[language].cloudObstructionPlanning}>
    <div class="cloud-forecast-controls">
        <div class="cloud-model-mode">
        <label class="cloud-map-select"><span class="cloud-map-label">{messages[language].cloudMap}</span> <select bind:value={settings.overlay} aria-label={messages[language].cloudMap}>
            <option value="clouds">{messages[language].total}</option><option value="lclouds">{messages[language].low}</option>
            <option value="mclouds">{messages[language].middle}</option><option value="hclouds">{messages[language].high}</option>
            <option value="cbase">{messages[language].cloudBase}</option>
            <option value="satellite">{messages[language].satellite}</option>
        </select></label>
        <label class="cloud-model"><span>{messages[language].model}</span>
            <select aria-label={messages[language].cloudForecastModel} value={model}
                on:change={changeModel}>
                <option value="ecmwf">EC</option><option value="gfs">GFS</option><option value="icon">ICON</option>
            </select>
        </label>
        <label class="cloud-view-select"><span>{messages[language].layers}</span>
        <select bind:value={settings.view} aria-label={messages[language].cloudPlanningMode}>
            <option value="single">{messages[language].single}</option>
            <option value="layers">{messages[language].layered}</option>
        </select></label>
        </div>
    </div>
    <div class="cloud-source-controls">
        <div class="cloud-source-picker">
        <label class="cloud-source-select"><span>{messages[language].heightSource}</span>
            <select value={sourceValue} on:change={changeSource} aria-label={messages[language].cloudHeightSource}>
                <option value="base">{messages[language].forecastBase}</option>
                <option value="cloud">{messages[language].cloudCoverProfile}</option>
                <option value="dewpoint">{messages[language].temperatureDewPointProfile}</option>
                <option value="manual">{messages[language].manualInput}</option>
            </select>
        </label>
            <button class="cloud-source-help" type="button" title={messages[language].explainAllHeightSources}
                aria-label={messages[language].heightSourceExplanation} aria-expanded={showSourceHelp}
                aria-controls="cloud-source-help"
                on:click={event => {
                    showSourceHelp = !showSourceHelp;
                    if (!showSourceHelp && event.detail > 0) { event.currentTarget.blur(); }
                }}>ⓘ</button>
        </div>
    {#if automaticHeights && heightSource === 'dewpoint'}
        <label class="cloud-threshold">{messages[language].temperatureDewPoint}
            <input type="number" min="0" max="10" step="0.1" bind:value={settings.dewPointSpreadC}
                aria-label={messages[language].maximumTemperatureMinusDewPointSpread}
                aria-invalid={!Number.isFinite(settings.dewPointSpreadC) || settings.dewPointSpreadC < 0 || settings.dewPointSpreadC > 10} /> °C
        </label>
        {#if !Number.isFinite(settings.dewPointSpreadC) || settings.dewPointSpreadC < 0 || settings.dewPointSpreadC > 10}
            <p class="cloud-error">{messages[language].enterASpreadThresholdFromToC}</p>
        {/if}
    {/if}
    {#if automaticHeights && heightSource === 'cloud'}
        <div class="cloud-threshold-row">
            <label class="cloud-threshold">{messages[language].onlyIncludeCloudCover}
                <input type="number" min="1" max="100" step="1" bind:value={settings.threshold}
                    aria-invalid={!Number.isFinite(settings.threshold) || settings.threshold < 1 || settings.threshold > 100} /> %
            </label>

        </div>
        {#if !Number.isFinite(settings.threshold) || settings.threshold < 1 || settings.threshold > 100}
            <p class="cloud-error">{messages[language].enterACloudCoverThresholdFromTo}</p>
        {/if}
    {/if}
    </div>
    {#if showSourceHelp}
        <div id="cloud-source-help" class="cloud-source-descriptions cloud-muted">
            {#each sourceDescriptions as description}<p>{description}</p>{/each}
        </div>
    {/if}
    {#if settings.overlay === 'satellite'}
        <p class="cloud-muted">{messages[language].satelliteObservationsImageTimeFollowsTheWindy}</p>
    {/if}
    {#if activeBody === 'milkyway'}
        {#if scenarios[0]}
            <p class="cloud-muted">{messages[language].altitude} {scenarios[0].position.altitude.toFixed(1)}° · {messages[language].azimuth} {scenarios[0].position.azimuth.toFixed(1)}°</p>
        {/if}
    {/if}
    {#if !scenarios.length}
        <p class="cloud-error" role="status">{messages[language].selectedTimeUnavailableOrLocationTimeZone}</p>
    {/if}
    <!-- Svelte 4 treats region as noninteractive; keyboard users need to focus this horizontal scroll region. -->
    <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
    <div class="cloud-table-scroll" tabindex="0" role="region" aria-label={messages[language].cloudDistanceTable}>
    <table class="cloud-table">
        <thead><tr>
            <th scope="col" title={messages[language].cloudsHeightAMSL}>{messages[language].cloudsHeight} ({units.elevation})
                <div class="cloud-data-status" role="status" title={messages[language].forecastStep}>
                    {#if !automaticHeights}
                        {heightMode === 'manual' ? (messages[language].manualHeight)
                            : (messages[language].disabled)}
                    {:else if status === 'loading' || status === 'idle'}
                        {messages[language].loading}
                    {:else if status === 'error'}
                        {messages[language].failed} <button type="button" on:click={() => dispatch('retry')}>{messages[language].retry}</button>
                    {:else}
                        {#each scenarios as event}{@const step = heightSource === 'base' ? event.base : event.profile}<div>{#if step}<span class="cloud-forecast-label">{messages[language].forecast} </span>{formatLocalClock(new Date(step.timestamp), timeZone)}{:else}{messages[language].noForecast}{/if}</div>{/each}
                    {/if}
                </div>
                <div class="cloud-height-heading-controls">
                <button class="cloud-help-trigger" type="button" aria-haspopup="dialog"
                    aria-label={messages[language].cloudDistanceGuide} title={messages[language].cloudDistanceGuide}
                    on:click={() => { showHelp = true; }}>
                    <span aria-hidden="true">ⓘ</span> {messages[language].guide}
                </button>
                </div>
            </th>
            <th scope="col" title={messages[language].blockingTitle(bodyName)}><span class="cloud-heading-line">{messages[language].blockingHeading(bodyName)}</span><span class="cloud-heading-line">{messages[language].blockingDetail(bodyName)}</span><small>({units.distance})</small></th>
            <th scope="col" title={messages[language].cloudsAtHorizon}><span class="cloud-heading-line"><span class="cloud-heading-wide">{messages[language].horizonHeading.wide}</span><span class="cloud-heading-compact">{messages[language].horizonHeading.compact}</span></span><span class="cloud-heading-line">{messages[language].horizon}</span><small>({units.distance})</small></th>
            <!-- Height-derived solar reference columns remain available for both targets. -->
            <th scope="col" title={messages[language].tangentDistance}><span class="cloud-heading-line">{messages[language].tangent}</span><span class="cloud-heading-line">{messages[language].distance}</span><small>({units.distance})</small></th>
            <th scope="col" title={messages[language].furthestNoClouds}><span class="cloud-heading-wide">{messages[language].farHeading.firstLine}<br />{messages[language].farHeading.secondLine}</span><span class="cloud-heading-compact"><span class="cloud-heading-line">{messages[language].furthest}</span><span class="cloud-heading-line">{messages[language].clear}</span></span><small>({units.distance})</small></th>
            <th scope="col" title={messages[language].minimumSolarAltitudeForThisCloudHeight}><span class="cloud-heading-line"><span class="cloud-heading-wide">{messages[language].sunAltitude}</span><span class="cloud-heading-compact">{messages[language].sun}<br />{messages[language].altitude}</span></span><span class="cloud-heading-line">∠</span></th>
        </tr></thead>
        {#each visibleBands as band}
            {@const row = single ? { ...settings.single, enabled: true } : settings.layers[band]}
            {@const bandRows = scenarios.flatMap(event => {
                const matches = single ? event.layers : event.layers.filter(layer => layer.band === band);
                return (matches.length ? matches : [null]).map(layer => ({ event, layer }));
            })}
            <tbody class:cloud-layer--inactive={!row.enabled} style={`--cloud-band-color:${CLOUD_BAND_COLORS[band]}`}>
                {#each bandRows as item, index}
                {@const layer = item.layer}
                {@const geometry = layer ? cloudTwilightDistances(layer.heightM) : null}
                {@const obstruction = layer && item.event.position.sightlineAvailable ? cloudSightDistance(layer.heightM, item.event.position.altitude) : null}
                <tr>
                    <th scope="row" class="cloud-height-cell">
                    <div class="cloud-height-controls">
                    <label class="cloud-band">{#if index === 0 && !single}<input type="checkbox" bind:checked={settings.layers[band].enabled} />{/if}<i></i>{single ? (messages[language].ref) : bandName(band)}</label>
                    {#if row.mode === 'manual' && index === 0}
                        <div class="cloud-height">
                            <input type="number" min="1" max={units.elevation === 'ft' ? 98425 : 30000} step="any"
                                aria-label={`${single ? (messages[language].reference) : bandName(band)} ${messages[language].heightAMSL}`}
                                aria-invalid={!validHeight(row.heightM)}
                                value={row.heightM === undefined ? '' : Number((row.heightM / (units.elevation === 'ft' ? 0.3048 : 1)).toFixed(1))}
                                on:input={event => setManualHeight(band, event)} />
                            <button class="cloud-clear" type="button" title={messages[language].clearHeight} aria-label={`${single ? (messages[language].reference) : bandName(band)} ${messages[language].clearHeight2}`}
                                disabled={row.heightM === undefined} on:click={() => { if (single) { settings.single.heightM = undefined; } else { settings.layers[band].heightM = undefined; } settings = { ...settings }; }}>×</button>
                        </div>
                    {:else}
                        <span>{layer ? `${row.mode === 'auto' ? '≈ ' : ''}${formatElevationM(layer.heightM, units.elevation)}` : '--'}</span>
                    {/if}
                    </div></th>
                    <td class="cloud-sight">{obstruction === null ? '--' : metrics.distance.convertNumber(obstruction * 1000, 2, units.distance).toFixed(2)}</td>
                    <td>{geometry ? formatDistanceKm(geometry.horizonKm, units.distance) : '--'}</td>
                    <td class="cloud-band-value">{geometry ? formatDistanceKm(geometry.tangentKm, units.distance) : '--'}</td>
                    <td class="cloud-band-value">{geometry ? formatDistanceKm(geometry.clearKm, units.distance) : '--'}</td>
                    <td>{geometry ? `${geometry.minimumSunAltitude.toFixed(1)}°` : '--'}</td>
                </tr>
                {#if row.enabled && row.mode === 'auto'}
                    <tr class="cloud-detail"><td colspan="6">
                        {#if heightSource === 'base'}
                            {#if !single && item.event.base?.layer && item.event.base.layer.band !== band}
                                {messages[language].forecastBaseBelongsToAnotherBandThis}
                            {:else if item.event.base?.heightAglM !== null && item.event.base?.heightAglM !== undefined}
                                {messages[language].forecastBaseAGL} {heightLabel(item.event.base.heightAglM)}
                                {#if layer} · {messages[language].altitudeAMSL} {heightLabel(layer.heightM)}
                                {:else} · {messages[language].missingModelTerrainOrHeightOutsideGeometry}{/if}
                            {:else}
                                {messages[language].cloudBaseUnavailableForThisModelOr}
                            {/if}
                        {:else if layer}
                            {messages[language].calculationAltitudeSample} {heightLabel(layer.heightM)}
                            {#if heightSource === 'dewpoint'} · {messages[language].temperatureDewPoint2} {layer.dewPointSpreadC?.toFixed(1)}°C
                            {:else} · {messages[language].cover} {layer.cloudPercent}%{/if}
                            {#if layer.baseMinimumM !== null} · {messages[language].baseInterval} {heightLabel(layer.baseMinimumM)} – {heightLabel(layer.heightM)} ({messages[language].aMSL})
                            {:else} · {messages[language].baseLowerBoundUnknown}{/if}
                        {:else}{(single ? Object.values(item.event.profile?.coverage ?? {}).includes('sampled') : item.event.profile?.coverage[band] === 'sampled') ? (messages[language].noSeparateCloudBaseDetectedDistantClouds) : (messages[language].noHeightData)}{/if}
                    </td></tr>
                {:else if row.enabled && row.heightM !== undefined && !validHeight(row.heightM)}
                    <tr class="cloud-detail"><td colspan="6" class="cloud-error">{messages[language].enterAHeightAboveAndUpTo}</td></tr>
                {/if}
                {/each}
            </tbody>
        {/each}
    </table>
    </div>
    {#if layers.length && scenarios[0] && !scenarios[0].position.sightlineAvailable}
        <p class="cloud-error" role="status">{messages[language].belowHorizon(bodyName, activeBody === 'sun')}</p>
    {:else if layers.length && scenarios[0]?.position.altitude < 0}
        <p class="cloud-error" role="status">{messages[language].belowHorizonReference(bodyName)}</p>
    {/if}
    <div class="cloud-map-options">
        <!-- Keyboard focus allows scrolling the controls when they overflow on mobile. -->
        <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
        <div class="cloud-map-row" tabindex="0" role="region" aria-label={messages[language].cloudMapSettings}>
        <label title={messages[language].syncWindyModelAndTime}><input type="checkbox" bind:checked={settings.syncMap} aria-label={messages[language].syncWindyModelAndTime} /> {messages[language].syncWindy}</label>
        {#if settings.syncMap && syncError && !previewingTime}
        <button class="cloud-resync" type="button" on:click={() => dispatch('resync')}>{messages[language].syncAgain}</button>
        {/if}
        </div>
        {#if !settings.syncMap || syncError || syncing || previewingTime}<div class="cloud-sync-status">
    {#if !settings.syncMap}
        <p class="cloud-error" role="status">{messages[language].independentGeometryMapWeatherIsNotSynchronized}</p>
    {:else if previewingTime}
        <p class="cloud-muted" role="status">{messages[language].timePreviewForecastMapsSyncOnRelease}</p>
    {:else if syncError}
        <p class="cloud-error" role="status">{messages[language].mapModelOrTimeDiffersReferenceLines}</p>
    {:else if syncing}
        <p class="cloud-muted" role="status">{messages[language].synchronizingCloudMap}</p>
    {/if}
        </div>{/if}
    </div>
    <div class="cloud-legend">
        {#each visibleBands as band}<span><i style={`border-color:${CLOUD_BAND_COLORS[band]}`}></i>{single ? (messages[language].referenceLayer) : bandName(band)}</span>{/each}
        <span><i class="sight"></i>{messages[language].blockingTitle(bodyName)}</span>
        <span><i class="horizon"></i>{messages[language].cloudsAtHorizon}</span>
        <span><i class="tangent"></i>{messages[language].tangent2}</span>
        <span><i class="far"></i>{messages[language].furthestNoClouds}</span>
    </div>
    <p class="cloud-limit">{messages[language].cloudDistancesUseAZeroHeightReference}</p>
</section>

{#if showHelp}<CloudHelp {language} on:close={() => { showHelp = false; }} />{/if}

<style>
    .cloud-height-heading-controls { display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 2px 4px; }
    .cloud-panel .cloud-help-trigger { display: inline-flex; align-items: center; gap: 3px; min-height: 0; padding: 0 2px; border: 0; color: #6ed9ee; background: transparent; font-size: inherit; line-height: inherit; white-space: nowrap; }
    .cloud-panel { --cloud-row-gap: 6px; display: flex; flex-direction: column; gap: var(--cloud-row-gap); box-sizing: border-box; container-type: inline-size; height: 100%; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; padding: 12px; color: var(--panel-text, #f2f4fa); font-size: 12px; line-height: 1.5; }
    .cloud-panel > * { flex-shrink: 0; }
    .cloud-panel p { margin: 0; }
    .cloud-model-mode { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; flex: 1 1 0; min-width: 0; }
    .cloud-model-mode > label { flex: 0 0 auto; min-width: 0; }
    .cloud-source-descriptions { display: flex; flex-direction: column; gap: 4px; }
    .cloud-source-picker { display: flex; align-items: center; gap: 3px; min-width: 0; max-width: 100%; }
    .cloud-source-controls > .cloud-source-picker { flex: 0 1 auto; }
    .cloud-source-picker .cloud-source-help { flex-shrink: 0; }
    .cloud-model-mode label select { width: auto; }
    .cloud-panel * { box-sizing: border-box; letter-spacing: 0; }
    .cloud-forecast-controls, .cloud-map-options { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
    .cloud-forecast-controls { flex-wrap: nowrap; }
    .cloud-threshold { margin: 0; }
    .cloud-threshold-row { display: flex; align-items: center; gap: 6px; flex-wrap: nowrap; }
    .cloud-panel .cloud-source-help { min-height: 24px; width: 24px; padding: 0; border: 0; background: transparent; color: #6ed9ee; font-size: 16px; }
    .cloud-forecast-controls label { white-space: nowrap; }
    .cloud-panel .cloud-threshold input { width: 44px; flex: 0 0 44px; padding: 0 6px; appearance: textfield; font-variant-numeric: tabular-nums; }
    .cloud-threshold input::-webkit-inner-spin-button, .cloud-threshold input::-webkit-outer-spin-button { appearance: none; margin: 0; }
    .cloud-panel label { display: flex; align-items: center; gap: 5px; }
    .cloud-panel button, .cloud-panel select, .cloud-panel input { font: inherit; color: inherit; }
    .cloud-panel select, .cloud-panel input[type=number], .cloud-panel input[type=time] { height: 30px; border: 1px solid var(--panel-border); border-radius: 6px; background: rgba(8, 15, 27, .68); padding: 0 8px; min-width: 0; color-scheme: dark; font-size: 13px; }
    .cloud-panel button { min-height: 30px; border: 1px solid var(--panel-border); border-radius: 6px; padding: 4px 8px; background: rgba(255, 255, 255, .06); cursor: pointer; }
    .cloud-panel button:hover:not(.cloud-source-help), .cloud-panel button.active { background: #254754; border-color: #6ed9ee; }
    .cloud-panel .cloud-source-help[aria-expanded="true"] { background: #254754; }
    .cloud-panel button:disabled { opacity: .45; cursor: default; }
    .cloud-panel :is(button, input, select):focus-visible { outline: 2px solid #6ed9ee; outline-offset: 2px; }
    .cloud-panel input[type=checkbox] { accent-color: #6ed9ee; width: 17px; height: 17px; }
    .cloud-muted { color: #b9c2ce; font-size: 11px; overflow-wrap: anywhere; }
    .cloud-data-status { text-align: center; font-size: inherit; font-weight: inherit; color: inherit; white-space: normal; overflow-wrap: anywhere; min-width: 0; }
    .cloud-map-select { white-space: nowrap; font-size: 11px; }
    .cloud-map-select select { width: auto; padding-inline: 3px; font-size: 12px; }
    .cloud-model-mode select { padding-inline: 3px; font-size: 12px; }
    .cloud-table-scroll { overflow-x: auto; margin: 0; }
    .cloud-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; font-variant-numeric: tabular-nums; }
    .cloud-heading-line { display: block; white-space: nowrap; }
    .cloud-heading-compact { display: none; }
    .cloud-table th, .cloud-table td { padding: 4px 0; text-align: center; vertical-align: middle; overflow-wrap: anywhere; }
    /* Inherit one computed row height, including the smaller unit text and guide button. */
    .cloud-table thead { color: #b9c2ce; font-size: 11px; line-height: 1.5em; }
    .cloud-table thead th { font-weight: 700; overflow-wrap: anywhere; }
    .cloud-table thead small { font-weight: inherit; }
    .cloud-table th:first-child { width: 106px; }
    .cloud-panel--expanded-headings .cloud-table thead th { overflow-wrap: normal; }
    .cloud-panel--expanded-headings .cloud-table th:first-child { width: 24%; }
    .cloud-panel--expanded-headings .cloud-table thead th:nth-child(2) { width: 14%; }
    .cloud-panel--expanded-headings .cloud-table thead th:nth-child(3) { width: 17%; }
    .cloud-panel--expanded-headings .cloud-table thead th:nth-child(4) { width: 10%; }
    .cloud-panel--expanded-headings .cloud-table thead th:nth-child(5) { width: 18%; }
    .cloud-panel--expanded-headings .cloud-table thead th:nth-child(6) { width: 17%; }
    .cloud-table small { display: block; font-size: 10px; font-weight: 400; }
    .cloud-table tbody { border-top: 1px solid var(--panel-border); }
    .cloud-table tbody td:not(.cloud-height-cell) { font-weight: 600; }
    .cloud-table .cloud-detail td { padding: 0 4px 4px; text-align: left; color: #b9c2ce; font-size: 11px; font-weight: 400; overflow-wrap: anywhere; }
    .cloud-height-controls { display: grid; grid-template-columns: 40px minmax(0, 1fr); align-items: center; gap: 2px; min-width: 0; }
    /* Keep source and its dependent threshold together when space permits. */
    .cloud-source-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
    .cloud-source-controls > p { flex-basis: 100%; }
    .cloud-source-select, .cloud-threshold { white-space: nowrap; }
    .cloud-source-select { flex: 0 1 auto; min-width: 0; }
    .cloud-source-select select { width: auto; min-width: 0; max-width: 100%; }
    .cloud-source-select > span { flex-shrink: 0; }
    .cloud-panel--expanded-headings .cloud-source-select { max-width: 100%; }
    .cloud-panel--expanded-headings .cloud-source-select select { flex: 1; }
    .cloud-height-controls > span { flex: 1; min-width: 0; }
    .cloud-band i { width: 3px; height: 18px; background: var(--cloud-band-color); border-radius: 2px; flex-shrink: 0; }
    .cloud-band-value { color: var(--cloud-band-color); }
    .cloud-layer--inactive { opacity: .65; }
    .cloud-band { min-height: 30px; font-weight: 600; gap: 1px !important; white-space: nowrap; }
    .cloud-band input[type=checkbox] { width: 14px; height: 14px; margin: 0; flex-shrink: 0; }
    .cloud-height { position: relative; min-width: 0; flex: 0 0 auto; width: calc(5ch + 22px); font-size: 11px; }
    .cloud-height input { width: 100%; padding: 0 17px 0 3px !important; appearance: textfield; font-size: 11px !important; font-variant-numeric: tabular-nums; }
    .cloud-height input::-webkit-inner-spin-button, .cloud-height input::-webkit-outer-spin-button { appearance: none; margin: 0; }
    .cloud-panel .cloud-clear { position: absolute; right: 1px; top: 1px; width: 16px; min-height: 28px; height: calc(100% - 2px); padding: 0; border: 0; background: transparent; font-size: 16px; }
    .cloud-sight { color: #6ed9ee; }
    .cloud-map-row { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 8px; width: 100%; white-space: nowrap; }
    .cloud-sync-status { width: 100%; }
    .cloud-sync-status p { margin: 0; }
    .cloud-resync { flex-shrink: 0; }
    .cloud-map-row > label { flex-shrink: 0; }
    .cloud-map-options { border-top: 1px solid #485364; padding-top: 6px; }
    .cloud-legend { display: flex; flex-wrap: wrap; gap: 5px 12px; margin-top: 0; font-size: 11px; }
    .cloud-legend span { display: flex; gap: 5px; align-items: center; }
    .cloud-legend i { width: 18px; height: 0; border-top: 2px solid; }
    .cloud-legend .sight { border-color: #6ed9ee; }
    .cloud-legend .horizon { border-color: #fff; }
    .cloud-legend .tangent { border-color: #b9c2ce; border-top-style: dashed; }
    .cloud-legend .far { border-color: #b9c2ce; }
    .cloud-error { color: #ffb8ba; font-size: 12px; margin: 0; }
    .cloud-limit { color: #b9c2ce; font-size: 11px; margin: 0; }
    :global(.cloud-planning-marker) { background: transparent; border: 0; text-align: center; }
    :global(.cloud-planning-marker span) { display: inline-block; padding: 0; border: 0; background: transparent; font: 600 12px/24px sans-serif; text-shadow: 0 1px 2px #17212a, 0 0 3px #17212a; text-align: center; white-space: nowrap; }
    :global(.cloud-planning-point span) { display: block; width: 12px; height: 12px; border: 2px solid #6ed9ee; border-radius: 50%; background: #17212a; }
    @container (max-width: 380px) {
        /* Preserve visible labels and selected text at phone widths. */
        .cloud-model-mode { gap: 4px 6px; }
        .cloud-source-controls { gap: 4px 6px; font-size: 11px; }
        .cloud-source-controls label { gap: 3px; }
        .cloud-source-controls .cloud-threshold-row { gap: 2px; }
        .cloud-panel .cloud-threshold input { width: 40px; flex-basis: 40px; }
        .cloud-panel .cloud-source-help { width: 20px; }
        .cloud-model-mode select, .cloud-source-select select, .cloud-map-select select {
            appearance: none;
            padding: 0 14px 0 4px;
            font-size: 11px;
            background-image: linear-gradient(45deg, transparent 50%, #b9c2ce 50%), linear-gradient(135deg, #b9c2ce 50%, transparent 50%);
            background-position: right 7px center, right 3px center;
            background-size: 4px 4px;
            background-repeat: no-repeat;
        }
        .cloud-panel--expanded-headings .cloud-map-row { gap: 2px; font-size: 10px; }
        .cloud-panel--expanded-headings .cloud-map-row label { gap: 3px; }

        .cloud-heading-wide { display: none; }
        .cloud-heading-compact { display: inline; }
        .cloud-table thead { font-size: 10px; }
        .cloud-table th:first-child, .cloud-panel--expanded-headings .cloud-table th:first-child { width: 100px; }
        .cloud-panel--expanded-headings .cloud-table thead th:nth-child(n+2) { width: auto; overflow-wrap: anywhere; }
        .cloud-height-controls { grid-template-columns: 30px minmax(0, 1fr); }
        .cloud-forecast-controls { gap: 4px; font-size: 11px; }
        .cloud-forecast-controls label { gap: 3px; }

        .cloud-legend { gap: 4px 8px; }
    }
</style>

<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { UI_LANGUAGES } from './uiLanguage';
    import { messages } from './locales/EventHorizon';
    import { renderHorizonIcon } from './horizonIcon';
    import { eventHorizonPoints, horizonDistanceKm, MAX_OBSERVER_HEIGHT_M } from './eventHorizon';
    import { formatDistanceKm, type DistanceUnit } from './unitPreferences';
    import { formatLocalClock, type Coordinates } from './solar';
    import type { UiLanguage } from './uiLanguage';
    import type { CloudSettings } from './cloudProfile';
    import type { WeatherModel } from './weather';
    import type { DirectionEvent, DirectionPath } from './eventDirections';

    export let location: Coordinates;
    export let paths: DirectionPath[];
    export let selectedEvent: DirectionEvent;
    export let ready: boolean;
    export let language: UiLanguage;
    export let distanceUnit: DistanceUnit;
    export let horizonHeightM: number | undefined;
    export let heightSource: 'elevation' | 'manual';
    export let elevationM: number | null;
    export let elevationLoading: boolean;
    export let settings: CloudSettings;
    export let model: WeatherModel;
    export let previewingTime: boolean;
    export let timeZone: string;
    export let syncError: boolean;
    export let syncing: boolean;
    export let mapTimestamp: number | null;
    export let mapOverlay: string;

    const dispatch = createEventDispatcher<{ heightchange: number | undefined; retry: void; modelchange: WeatherModel; resync: void }>();
    let showHelp = false;
    // Display the map's accepted forecast time, including any host range clamp,
    // rather than labelling an unsynchronized planning time as map evidence.
    $: forecastTimeLabel = mapTimestamp === null ? '—' : new Intl.DateTimeFormat(UI_LANGUAGES[language].clockLocale, {
        timeZone, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(mapTimestamp);
    $: distanceKm = horizonDistanceKm(horizonHeightM);
    $: missingElevation = heightSource === 'elevation' && elevationM === null;
    $: distanceLabel = distanceKm === null ? '—' : `${formatDistanceKm(distanceKm, distanceUnit)} ${distanceUnit}`;
    // Keep rise and set comparable in one row; the toolbar selection highlights
    // its cell while independently filtering the geographic overlay.
    $: points = ready ? eventHorizonPoints(location, paths, distanceKm) : [];
    const bodies = [
        { body: 'sun', color: '#ffb347', rise: 'sunrise', set: 'sunset' },
        { body: 'moon', color: '#f5efcf', rise: 'moonrise', set: 'moonset' },
        { body: 'galactic', color: '#9de0b7', rise: 'milkywayrise', set: 'milkywayset' },
    ] as const;

    /** Editing makes this a manual observer elevation; later fetch completion cannot overwrite it. */
    const changeHeight = (event: Event) => {
        const input = event.currentTarget as HTMLInputElement;
        dispatch('heightchange', input.value === '' ? undefined : input.valueAsNumber);
    };
    const changeModel = (event: Event) => {
        dispatch('modelchange', (event.currentTarget as HTMLSelectElement).value as WeatherModel);
    };
</script>

<section class="event-horizon" aria-label={messages[language].horizon}>
    <div class="horizon-weather-controls">
        <label class="control-pair">{messages[language].cloudMap}
            <select bind:value={settings.overlay} aria-label={messages[language].cloudMap}>
                <option value="clouds">{messages[language].total}</option>
                <option value="lclouds">{messages[language].low}</option>
                <option value="mclouds">{messages[language].middle}</option>
                <option value="hclouds">{messages[language].high}</option>
                <option value="cbase">{messages[language].cloudBase}</option>
                <option value="satellite">{messages[language].satellite}</option>
            </select>
        </label>
        <label class="control-pair">{messages[language].model}
            <select value={model} aria-label={messages[language].cloudForecastModel}
                on:change={changeModel}>
                <option value="ecmwf">EC</option><option value="gfs">GFS</option><option value="icon">ICON</option>
            </select>
        </label>
    </div>
    <div class="horizon-map-time" role="status">
        {#if mapOverlay === 'satellite'}
            {messages[language].satelliteObservationsImageTimeFollowsTheWindy}
        {:else}
            {settings.syncMap && !syncError ? (messages[language].forecastTime) : (messages[language].windyTime)}：{forecastTimeLabel} <span>({timeZone})</span>
        {/if}
    </div>
    <div class="horizon-map-sync">
        <label class="control-pair"><input type="checkbox" bind:checked={settings.syncMap} />{messages[language].syncWindyModelAndTime}</label>
        {#if settings.syncMap && syncError && !previewingTime}
            <button class="retry-button" type="button" on:click={() => dispatch('resync')}>{messages[language].syncAgain}</button>
        {/if}
    </div>
    {#if !settings.syncMap || previewingTime || syncError || syncing}
        <p class="map-status" role="status">{!settings.syncMap
            ? (messages[language].independentGeometryMapWeatherIsNotSynchronized)
            : previewingTime ? (messages[language].timePreviewForecastMapsSyncOnRelease)
            : syncError ? (messages[language].mapModelOrTimeDiffersCheckThe)
            : (messages[language].synchronizingCloudMap)}</p>
    {/if}
    <div class="horizon-controls">
        <div class="control-pair">
            <label for="horizon-height-source">{messages[language].heightSource}</label>
            <select id="horizon-height-source" value={heightSource} on:change={event => {
                if (event.currentTarget.value === 'manual') {
                    dispatch('heightchange', horizonHeightM);
                } else {
                    heightSource = 'elevation';
                }
            }}>
                <option value="elevation">{messages[language].autoElevation}</option>
                <option value="manual">{messages[language].manualInput}</option>
            </select>
        </div>
        <div class="control-pair">
            <label for="horizon-height">{messages[language].observerHeight}</label>
            <div class="height-field">
                <input id="horizon-height" type="number" min="0" max={MAX_OBSERVER_HEIGHT_M} step="any"
                    value={horizonHeightM ?? ''} on:input={changeHeight} aria-invalid={distanceKm === null && !missingElevation}
                    aria-describedby={distanceKm === null && !missingElevation ? 'horizon-height-error horizon-height-hint' : 'horizon-height-hint'} />
                <button class="clear-button" type="button" disabled={horizonHeightM === undefined}
                    aria-label={messages[language].clearHeight} title={messages[language].clearHeight}
                    on:click={() => dispatch('heightchange', undefined)}>×</button>
            </div>
            <span>m</span>
        </div>
        <button class="help-button" type="button" aria-label={messages[language].horizonGuide}
            aria-expanded={showHelp} aria-controls="event-horizon-help" on:click={() => showHelp = !showHelp}>?</button>
    </div>
    <div class="horizon-summary">
        <div class="elevation-line" aria-live="polite">
            <span>{messages[language].locationElevation}</span>
            <span>{elevationM !== null ? `${elevationM} m` : elevationLoading ? (messages[language].loading) : (messages[language].unavailable)}</span>
            {#if elevationM === null && !elevationLoading}
                <button class="retry-button" type="button" on:click={() => dispatch('retry')}>{messages[language].retry}</button>
            {/if}
        </div>
        <div class="distance-line">
            <span>{messages[language].horizonDistance}</span><output aria-live="polite">{distanceLabel}</output>
        </div>
    </div>
    <span id="horizon-height-hint" class="height-hint">{messages[language].heightAboveTheReferenceSurfaceForA}</span>
    {#if distanceKm === null && !missingElevation}
        <p id="horizon-height-error" class="status" role="status">{horizonHeightM !== undefined && horizonHeightM < 0
            ? (messages[language].theObserverIsBelowSeaLevelThis)
            : (messages[language].enterAValidHeightFromToM)}</p>
    {:else if missingElevation && !elevationLoading}
        <p class="status" role="status">{messages[language].elevationUnavailableRetryOrEnterObserverElevation}</p>
    {/if}
    {#if showHelp}
        <div id="event-horizon-help" class="horizon-help">
            <p>{messages[language].byDefaultTheCurrentLocationElevationFrom}</p>
            <p>{messages[language].atMTheHorizonIsAboutKm}</p>
            <p>{messages[language].openingHorizonFitsTheMapToIts}</p>
            <p>{messages[language].useASmoothSphereWithRKm}</p>
            <p>{messages[language].distanceExcludesRefractionTerrainBuildingsAndCloud}</p>
        </div>
    {/if}
    <table aria-label={messages[language].horizonEventBearingsAndTimes}>
        <thead><tr><th scope="col">{messages[language].body}</th><th scope="col">{messages[language].riseAzimuthTime}</th><th scope="col">{messages[language].setAzimuthTime}</th></tr></thead>
        <tbody>
            {#each bodies as body}
                <tr>
                    <th scope="row"><span class="event-name">
                        {@html renderHorizonIcon(body.body, 14, body.color)}
                        {messages[language].bodies[body.body]}
                    </span></th>
                    {#each [body.rise, body.set] as event}
                        {@const point = points.find(item => item.event === event)}
                        {@const path = paths.find(item => item.event === event)}
                        <td class:selected={selectedEvent === event}>
                            {#if !ready}
                                {messages[language].pending}
                            {:else if path?.status === 'ok'}
                                <span>{point ? `${point.azimuth.toFixed(1)}°` : '—'}</span>
                                <!-- Event times remain available even when observer height is missing or invalid. -->
                                <time datetime={path.eventTime.toISOString()}>{formatLocalClock(path.eventTime, timeZone)}</time>
                            {:else}
                                {messages[language].noEventThisDay}
                            {/if}
                        </td>
                    {/each}
                </tr>
            {/each}
        </tbody>
    </table>
    <p class="caption">{messages[language].eventTimeZone}{timeZone} · {messages[language].geometricDistanceOnlyTerrainAndCloudObstruction}</p>
</section>

<style>
    /* Match the surrounding planning views: compact controls and a plain data table. */
    .event-horizon { box-sizing: border-box; height: 100%; overflow-y: auto; overscroll-behavior: contain; padding: 8px 10px; color: var(--panel-text); font-size: 12px; }
    .horizon-weather-controls, .horizon-map-sync { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 12px; margin-bottom: 6px; }
    .horizon-map-time { color: var(--panel-muted); font-size: 11px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; margin-bottom: 6px; }
    .horizon-map-sync { color: var(--panel-muted); font-size: 11px; }
    .horizon-map-sync input { width: 16px; height: 16px; padding: 0; accent-color: var(--panel-accent); }
    .map-status { margin: 0 0 6px; color: var(--panel-muted); font-size: 11px; }
    .horizon-controls { position: relative; display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; padding-right: 34px; margin-bottom: 6px; }
    .control-pair { display: flex; align-items: center; gap: 6px; }
    .horizon-summary { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 16px; margin-bottom: 5px; }
    label { margin: 0; white-space: nowrap; }
    .height-field { position: relative; width: 70px; flex: 0 0 auto; }
    input { box-sizing: border-box; width: 100%; height: 30px; min-height: 0; margin: 0; padding: 0 21px 0 6px; border: 1px solid var(--panel-border); border-radius: 6px; color: var(--panel-text); background: rgba(8, 15, 27, .68); font: inherit; font-variant-numeric: tabular-nums; color-scheme: dark; appearance: textfield; }
    select { height: 30px; min-width: 0; padding: 0 8px; border: 1px solid var(--panel-border); border-radius: 6px; background: rgba(8, 15, 27, .68); color: var(--panel-text); font: inherit; color-scheme: dark; }
    input::-webkit-inner-spin-button, input::-webkit-outer-spin-button { appearance: none; margin: 0; }
    button { min-height: 28px; border: 0; padding: 0; background: transparent; color: var(--panel-muted); font: inherit; cursor: pointer; }
    button:hover { color: var(--panel-text); background: rgba(99, 185, 238, .12); }
    button:disabled { opacity: .45; cursor: default; }
    button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--panel-accent); outline-offset: -2px; }
    .clear-button { position: absolute; right: 1px; top: 1px; width: 20px; height: 28px; font-size: 16px; }
    .help-button { position: absolute; right: 0; top: 1px; width: 28px; border: 1px solid var(--panel-border); border-radius: 50%; }
    .help-button[aria-expanded="true"] { color: var(--panel-text); background: rgba(99, 185, 238, .18); }
    input[aria-invalid="true"] { border-color: #f6b65c; }
    .height-hint { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    .distance-line { display: flex; align-items: baseline; gap: 6px; color: var(--panel-muted); }
    .elevation-line { display: flex; align-items: center; gap: 6px; color: var(--panel-muted); }
    .retry-button { padding: 0 5px; color: var(--panel-accent); }
    output { color: var(--panel-text); font-variant-numeric: tabular-nums; font-weight: 500; }
    table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 11px; font-variant-numeric: tabular-nums; }
    th, td { padding: 5px 1px; text-align: center; vertical-align: middle; border-bottom: 1px solid var(--panel-border); overflow-wrap: anywhere; }
    th { color: var(--panel-muted); font-weight: 400; }
    thead th { font-weight: 700; }
    td.selected { color: var(--panel-accent); background: rgba(99, 185, 238, .08); }
    td time { display: block; margin-top: 2px; white-space: nowrap; }
    .event-name { display: inline-flex; align-items: center; gap: 4px; }
    p { margin: 7px 0 0; line-height: 1.5; }
    .caption { color: var(--panel-muted); font-size: 11px; }
    .status { color: #edcf90; }
    .horizon-help { margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--panel-border); color: var(--panel-muted); }
    .horizon-help p:first-child { margin-top: 0; }
</style>

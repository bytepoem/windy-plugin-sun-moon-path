<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { renderHorizonIcon } from './horizonIcon';
    import { eventHorizonPoints, horizonDistanceKm, MAX_OBSERVER_HEIGHT_M } from './eventHorizon';
    import { formatDistanceKm, type DistanceUnit } from './unitPreferences';
    import { formatLocalClock, type Coordinates } from './solar';
    import type { CloudSettings } from './cloudProfile';
    import type { WeatherModel } from './weather';
    import type { DirectionEvent, DirectionPath } from './eventDirections';

    export let location: Coordinates;
    export let paths: DirectionPath[];
    export let selectedEvent: DirectionEvent;
    export let ready: boolean;
    export let language: 'zh' | 'en';
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
    $: zh = language === 'zh';
    // Display the map's accepted forecast time, including any host range clamp,
    // rather than labelling an unsynchronized planning time as map evidence.
    $: forecastTimeLabel = mapTimestamp === null ? '—' : new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-GB', {
        timeZone, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(mapTimestamp);
    $: distanceKm = horizonDistanceKm(horizonHeightM);
    $: missingElevation = heightSource === 'elevation' && elevationM === null;
    $: distanceLabel = distanceKm === null ? '—' : `${formatDistanceKm(distanceKm, distanceUnit)} ${distanceUnit}`;
    // Keep rise and set comparable in one row; the toolbar selection highlights
    // its cell while independently filtering the geographic overlay.
    $: points = ready ? eventHorizonPoints(location, paths, distanceKm) : [];
    const bodies = [
        { body: 'sun', color: '#ffb347', zh: '太阳', en: 'Sun', rise: 'sunrise', set: 'sunset' },
        { body: 'moon', color: '#f5efcf', zh: '月亮', en: 'Moon', rise: 'moonrise', set: 'moonset' },
        { body: 'galactic', color: '#9de0b7', zh: '银心', en: 'Galactic centre', rise: 'milkywayrise', set: 'milkywayset' },
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

<section class="event-horizon" aria-label={zh ? '地平线' : 'Horizon'}>
    <div class="horizon-weather-controls">
        <label class="control-pair">{zh ? '云图' : 'Cloud map'}
            <select bind:value={settings.overlay} aria-label={zh ? '云图' : 'Cloud map'}>
                <option value="clouds">{zh ? '总云' : 'Total'}</option>
                <option value="lclouds">{zh ? '低云' : 'Low'}</option>
                <option value="mclouds">{zh ? '中云' : 'Middle'}</option>
                <option value="hclouds">{zh ? '高云' : 'High'}</option>
                <option value="cbase">{zh ? '云底高度' : 'Cloud base'}</option>
                <option value="satellite">{zh ? '卫星云图' : 'Satellite'}</option>
            </select>
        </label>
        <label class="control-pair">{zh ? '模型' : 'Model'}
            <select value={model} aria-label={zh ? '云层预报模型' : 'Cloud forecast model'}
                on:change={changeModel}>
                <option value="ecmwf">EC</option><option value="gfs">GFS</option><option value="icon">ICON</option>
            </select>
        </label>
    </div>
    <div class="horizon-map-time" role="status">
        {#if mapOverlay === 'satellite'}
            {zh ? '卫星实况 · 影像时间以 Windy 时间轴为准' : 'Satellite observations · Image time follows the Windy timeline'}
        {:else}
            {settings.syncMap && !syncError ? (zh ? '预报时次' : 'Forecast time') : (zh ? 'Windy 时间' : 'Windy time')}：{forecastTimeLabel} <span>({timeZone})</span>
        {/if}
    </div>
    <div class="horizon-map-sync">
        <label class="control-pair"><input type="checkbox" bind:checked={settings.syncMap} />{zh ? '同步 Windy 模型与时间' : 'Sync Windy model and time'}</label>
        {#if settings.syncMap && syncError && !previewingTime}
            <button class="retry-button" type="button" on:click={() => dispatch('resync')}>{zh ? '重新同步' : 'Sync again'}</button>
        {/if}
    </div>
    {#if !settings.syncMap || previewingTime || syncError || syncing}
        <p class="map-status" role="status">{!settings.syncMap
            ? (zh ? '独立几何规划 · 底图天气未同步' : 'Independent geometry · Map weather is not synchronized')
            : previewingTime ? (zh ? '时间预览 · 预报云图松开后同步，卫星时间独立' : 'Time preview · Forecast maps sync on release; satellite time stays independent')
            : syncError ? (zh ? '底图模型或时刻未同步，请核对 Windy 时间轴' : 'Map model or time differs; check the Windy timeline')
            : (zh ? '正在同步云图…' : 'Synchronizing cloud map…')}</p>
    {/if}
    <div class="horizon-controls">
        <div class="control-pair">
            <label for="horizon-height-source">{zh ? '高度来源' : 'Height source'}</label>
            <select id="horizon-height-source" value={heightSource} on:change={event => {
                if (event.currentTarget.value === 'manual') {
                    dispatch('heightchange', horizonHeightM);
                } else {
                    heightSource = 'elevation';
                }
            }}>
                <option value="elevation">{zh ? '自动海拔' : 'Auto elevation'}</option>
                <option value="manual">{zh ? '手动输入' : 'Manual input'}</option>
            </select>
        </div>
        <div class="control-pair">
            <label for="horizon-height">{zh ? '视点高度' : 'Observer height'}</label>
            <div class="height-field">
                <input id="horizon-height" type="number" min="0" max={MAX_OBSERVER_HEIGHT_M} step="any"
                    value={horizonHeightM ?? ''} on:input={changeHeight} aria-invalid={distanceKm === null && !missingElevation}
                    aria-describedby={distanceKm === null && !missingElevation ? 'horizon-height-error horizon-height-hint' : 'horizon-height-hint'} />
                <button class="clear-button" type="button" disabled={horizonHeightM === undefined}
                    aria-label={zh ? '清除高度' : 'Clear height'} title={zh ? '清除高度' : 'Clear height'}
                    on:click={() => dispatch('heightchange', undefined)}>×</button>
            </div>
            <span>m</span>
        </div>
        <button class="help-button" type="button" aria-label={zh ? '地平线说明' : 'Horizon guide'}
            aria-expanded={showHelp} aria-controls="event-horizon-help" on:click={() => showHelp = !showHelp}>?</button>
    </div>
    <div class="horizon-summary">
        <div class="elevation-line" aria-live="polite">
            <span>{zh ? '定位点海拔' : 'Location elevation'}</span>
            <span>{elevationM !== null ? `${elevationM} m` : elevationLoading ? (zh ? '读取中…' : 'Loading…') : (zh ? '未获取' : 'Unavailable')}</span>
            {#if elevationM === null && !elevationLoading}
                <button class="retry-button" type="button" on:click={() => dispatch('retry')}>{zh ? '重试' : 'Retry'}</button>
            {/if}
        </div>
        <div class="distance-line">
            <span>{zh ? '地平线距离' : 'Horizon distance'}</span><output aria-live="polite">{distanceLabel}</output>
        </div>
    </div>
    <span id="horizon-height-hint" class="height-hint">{zh ? '视点高于参考面的高度；看海平线时填写视点海拔。' : 'Height above the reference surface; for a sea horizon, use observer elevation above sea level.'}</span>
    {#if distanceKm === null && !missingElevation}
        <p id="horizon-height-error" class="status" role="status">{horizonHeightM !== undefined && horizonHeightM < 0
            ? (zh ? '视点低于海平面，此海平线模型不适用。' : 'The observer is below sea level; this sea-horizon model does not apply.')
            : (zh ? '请输入 0–12000 m 的有效高度。' : 'Enter a valid height from 0 to 12000 m.')}</p>
    {:else if missingElevation && !elevationLoading}
        <p class="status" role="status">{zh ? '未获取海拔，可重试或手动输入视点海拔。' : 'Elevation unavailable; retry or enter observer elevation manually.'}</p>
    {/if}
    {#if showHelp}
        <div id="event-horizon-help" class="horizon-help">
            <p>{zh
                ? '默认读取并填入当前定位点海拔，数值来自 Windy 海拔服务，属于地形估算。视点在楼顶或相机高于地面时，可手动填写包含这部分高度的总海拔；编辑高度会切换为手动，换地点后恢复自动海拔。'
                : 'By default, the current location elevation from Windy’s elevation service fills the height field as a terrain estimate. For a rooftop or raised camera, enter total observer elevation including that extra height. Editing switches to manual; a new location restores auto elevation.'}</p>
            <p>{zh
                ? '2 m 高对应约 5.05 km，100 m 高约 35.70 km，1000 m 高约 112.87 km。这里计算到海平面切点的距离，并非最远能看到物体的距离；高于海面的远山、建筑仍可能在更远处可见。真实海拔 0 m 时几何距离为 0，可按实际视点高度手动修正。'
                : 'At 2 m the horizon is about 5.05 km away; at 100 m, 35.70 km; at 1000 m, 112.87 km. This is the distance to the sea-level tangent point, not the farthest visible object: elevated mountains and buildings may be visible farther away. A true zero elevation gives zero geometric distance; manually add actual observer height when appropriate.'}</p>
            <p>{zh
                ? '进入地平线时自动适配地图范围；调整高度后可点击范围按钮重新适配。顶部按钮筛选日、月和银心升落方向，「全部」显示六个方向；地图只显示所选方向的地平线距离。方位沿用事件计算，不随这里的高度修改。'
                : 'Opening Horizon fits the map to its radius; after changing height, use the fit button to fit again. Filter Sun, Moon and galactic centre rise/set directions with the top buttons; All shows all six. The map shows only the selected horizon distances. Bearings use existing events and do not change with this height input.'}</p>
            <p>{zh
                ? '采用半径 R = 6371.0088 km 的光滑球面，h 为输入高度除以 1000（km）。地表距离 d = R × acos(R / (R + h))；各事件共用这个距离，分别沿各自方位定位。'
                : 'Use a smooth sphere with R = 6371.0088 km and h equal to the entered height divided by 1000 (km). Surface distance d = R × acos(R / (R + h)); all events share this distance, each along its own bearing.'}</p>
            <p>{zh
                ? '距离不包含折射、山体、建筑或云层遮挡，不能保证实际视线畅通。'
                : 'Distance excludes refraction, terrain, buildings and cloud obstruction, so a clear view is not guaranteed.'}</p>
        </div>
    {/if}
    <table aria-label={zh ? '地平线事件方位与时间' : 'Horizon event bearings and times'}>
        <thead><tr><th scope="col">{zh ? '天体' : 'Body'}</th><th scope="col">{zh ? '升起方位 / 时间' : 'Rise azimuth / time'}</th><th scope="col">{zh ? '落下方位 / 时间' : 'Set azimuth / time'}</th></tr></thead>
        <tbody>
            {#each bodies as body}
                <tr>
                    <th scope="row"><span class="event-name">
                        {@html renderHorizonIcon(body.body, 14, body.color)}
                        {zh ? body.zh : body.en}
                    </span></th>
                    {#each [body.rise, body.set] as event}
                        {@const point = points.find(item => item.event === event)}
                        {@const path = paths.find(item => item.event === event)}
                        <td class:selected={selectedEvent === event}>
                            {#if !ready}
                                {zh ? '待计算' : 'Pending'}
                            {:else if path?.status === 'ok'}
                                <span>{point ? `${point.azimuth.toFixed(1)}°` : '—'}</span>
                                <!-- Event times remain available even when observer height is missing or invalid. -->
                                <time datetime={path.eventTime.toISOString()}>{formatLocalClock(path.eventTime, timeZone)}</time>
                            {:else}
                                {zh ? '当日无此事件' : 'No event this day'}
                            {/if}
                        </td>
                    {/each}
                </tr>
            {/each}
        </tbody>
    </table>
    <p class="caption">{zh ? '事件时间时区：' : 'Event time zone: '}{timeZone} · {zh ? '几何距离参考，不包含地形与云层遮挡。' : 'Geometric distance only; terrain and cloud obstruction are excluded.'}</p>
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

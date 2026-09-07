<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from 'svelte';
    import { map } from '@windy/map';
    import store from '@windy/store';
    import metrics from '@windy/metrics';
    import { cloudArc, cloudBodyPosition, cloudSightDistance, cloudTimeInstant, cloudTwilightDistances } from './cloudGeometry';
    import { CLOUD_BAND_COLORS, createCloudOverlayController } from './cloudOverlayController';
    import {
        CLOUD_BANDS, extractCloudForecast, selectCloudProfile,
        type CloudBand, type CloudLayer, type CloudSettings,
    } from './cloudProfile';
    import { formatLocalClock, type Coordinates } from './solar';
    import { formatDistanceKm, formatElevationM, type UnitPreferences } from './unitPreferences';
    import type { WeatherForecastPayload, WeatherLoadStatus, WeatherModel } from './weather';

    export let location: Coordinates;
    export let sunEvents: { type: 'sunrise' | 'sunset'; timestamp: number }[];
    export let forecast: WeatherForecastPayload | null;
    export let status: WeatherLoadStatus;
    export let model: WeatherModel;
    export let timeZone: string;
    export let selectedDate: string;
    export let language: 'zh' | 'en';
    export let units: UnitPreferences;
    export let settings: CloudSettings;

    const dispatch = createEventDispatcher<{ modelchange: WeatherModel; retry: void }>();
    const overlay = createCloudOverlayController(map);
    export let selectedSunEvent: 'sunrise' | 'sunset' = 'sunset';
    let manualClock: string | null = null;
    export let cloudBounds: [[number, number], [number, number]] | null = null;
    export let cloudDetailBounds: [[number, number], [number, number]] | null = null;
    let mounted = false;
    let syncError = false;
    let syncing = false;
    let syncRevision = 0;
    let syncQueue: Promise<void> = Promise.resolve();
    let lastSyncKey = '';
    const listeners: number[] = [];
    const options = { UIident: 'windy-plugin-sun-moon-path', doNotStore: true, doNotSaveToCloud: true };
    const changeModel = (event: Event) => dispatch('modelchange', (event.currentTarget as HTMLSelectElement).value as WeatherModel);

    $: zh = language === 'zh';
    $: cloudForecast = extractCloudForecast(forecast, settings.threshold);
    $: automaticEvent = sunEvents.find(event => event.type === selectedSunEvent);
    $: manualTimestamp = manualClock === null ? null : cloudTimeInstant(selectedDate, manualClock, timeZone);
    $: planningEvents = manualClock === null ? (automaticEvent ? [automaticEvent] : [])
        : manualTimestamp === null ? [] : [{ type: selectedSunEvent, timestamp: manualTimestamp }];
    $: displayedClock = manualClock ?? (automaticEvent ? formatLocalClock(new Date(automaticEvent.timestamp), timeZone) : '');
    $: scenarios = planningEvents.map(event => {
        const profile = selectCloudProfile(cloudForecast, event.timestamp);
        return { ...event, profile, position: cloudBodyPosition('sun', event.timestamp, location),
            layers: resolveLayers(settings, profile?.layers || []) };
    });
    $: layers = scenarios.flatMap(event => event.layers);
    $: timestamp = scenarios[0]?.timestamp ?? null;
    $: cloudBounds = planningBounds(scenarios, false);
    $: cloudDetailBounds = planningBounds(scenarios, true);
    $: if (mounted) {
        overlay.destroy();
        scenarios.forEach(event => {
            overlay.render({ location, position: event.position, sunAzimuth: event.position.azimuth,
                layers: event.layers, twilight: true, opacity: settings.opacity, language, units });
        });
    }
    $: if (mounted) {
        const key = `${model}|${timestamp}|${settings.overlay}|${settings.syncMap}`;
        if ((!settings.syncMap || timestamp === null) && key !== lastSyncKey) {
            lastSyncKey = key;
            syncRevision += 1;
            syncing = false;
        } else if (settings.syncMap && timestamp !== null && key !== lastSyncKey) {
            lastSyncKey = key;
            synchronizeMap(model, timestamp, settings.overlay);
        }
    }

    $: bandName = (band: CloudBand) => ({
        low: zh ? '低' : 'L', medium: zh ? '中' : 'M', high: zh ? '高' : 'H',
    })[band];
    $: heightLabel = (height: number) => `${formatElevationM(height, units.elevation)} ${units.elevation}`;
    const validHeight = (height: number | undefined): height is number =>
        typeof height === 'number' && Number.isFinite(height) && height > 0 && height <= 30_000;

    /** Manual entries are isolated from model updates. Each disconnected automatic layer stays separate. */
    const resolveLayers = (input: CloudSettings, automatic: CloudLayer[]): CloudLayer[] => CLOUD_BANDS.flatMap(band => {
        const row = input.layers[band];
        if (!row.enabled) {return [];}
        if (row.mode === 'auto') {return automatic.filter(layer => layer.band === band);}
        return validHeight(row.heightM)
            ? [{ band, heightM: row.heightM, baseMinimumM: null, topM: row.heightM, cloudPercent: 0 }] : [];
    });

    const setManualHeight = (band: CloudBand, event: Event) => {
        const input = event.currentTarget as HTMLInputElement;
        settings.layers[band].heightM = input.value === '' ? undefined : input.valueAsNumber * (units.elevation === 'ft' ? 0.3048 : 1);
        settings = { ...settings };
    };

    // Defaults are seeded only when entering manual mode with no saved value;
    // clearing an active input must leave it empty until the user fills it again.
    const changeHeightMode = (band: CloudBand, event: Event) => {
        const mode = (event.currentTarget as HTMLSelectElement).value as 'auto' | 'manual';
        const row = settings.layers[band];
        settings.layers[band] = { ...row, mode,
            heightM: mode === 'manual' && row.heightM === undefined
                ? ({ low: 2000, medium: 4000, high: 6000 })[band] : row.heightM };
        settings = { ...settings };
    };

    /** Serialize Windy's async setters. A superseded or destroyed session cannot enqueue later writes. */
    const synchronizeMap = (nextModel: WeatherModel, instant: number, nextOverlay: CloudSettings['overlay']) => {
        const revision = ++syncRevision;
        syncing = true;
        syncError = false;
        syncQueue = syncQueue.then(async () => {
            try {
                if (!mounted || revision !== syncRevision) {return;}
                if (store.get('product') !== nextModel) {await store.set('product', nextModel, options);}
                if (!mounted || revision !== syncRevision) {return;}
                if (store.get('overlay') !== nextOverlay) {await store.set('overlay', nextOverlay, options);}
                if (!mounted || revision !== syncRevision) {return;}
                if (store.get('timestamp') !== instant) {store.set('timestamp', instant, options);}
                if (!mounted || revision !== syncRevision) {return;}
                syncError = Math.abs(store.get('timestamp') - instant) > 1_000
                    || store.get('product') !== nextModel || store.get('overlay') !== nextOverlay;
            } catch {
                if (mounted && revision === syncRevision) {syncError = true;}
            } finally {
                if (mounted && revision === syncRevision) {syncing = false;}
            }
        });
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
    const fitMap = () => {
        if (cloudBounds) {map.fitBounds(cloudBounds, { padding: [30, 30] });}
    };

    onMount(() => {
        settings.body = 'sun';
        mounted = true;
        listeners.push(store.on('timestamp', value => {
            if (mounted && settings.syncMap && !syncing && typeof value === 'number') {
                syncError = timestamp === null || Math.abs(value - timestamp) > 1_000
                    || store.get('product') !== model || store.get('overlay') !== settings.overlay;
            }
        }));
        listeners.push(store.on('product', value => {
            if (!mounted || !settings.syncMap || syncing) {return;}
            if (value === 'ecmwf' || value === 'gfs' || value === 'icon') {dispatch('modelchange', value);}
            else { syncError = true; }
        }));
        listeners.push(store.on('overlay', value => {
            if (!mounted || !settings.syncMap || syncing) {return;}
            if (['clouds', 'lclouds', 'mclouds', 'hclouds'].includes(value)) {
                settings = { ...settings, overlay: value as CloudSettings['overlay'] };
            } else { syncError = true; }
        }));
    });

    onDestroy(() => {
        mounted = false;
        syncRevision += 1;
        listeners.forEach(id => store.off(id));
        overlay.destroy();
    });
</script>

<section class="cloud-panel" class:cloud-panel--english={!zh} aria-label={zh ? '云层遮挡规划' : 'Cloud obstruction planning'}>
    <div class="cloud-controls">
    <div class="cloud-toolbar">
        <select class="cloud-target" value="sun" aria-label={zh ? '遮蔽类型' : 'Obstruction target'}>
            <option value="auto" disabled>{zh ? '自动（暂未开放）' : 'Auto (coming soon)'}</option>
            <option value="sun">{zh ? '遮蔽太阳' : 'Blocking Sun'}</option>
            <option value="moon" disabled>{zh ? '遮蔽月亮（暂未开放）' : 'Blocking Moon (coming soon)'}</option>
            <option value="milkyway" disabled>{zh ? '遮蔽银河（暂未开放）' : 'Milky Way (coming soon)'}</option>
        </select>
        <div class="cloud-presets" role="group" aria-label={zh ? '升落时刻' : 'Rise or set'}>
            <button type="button" class:active={manualClock === null && selectedSunEvent === 'sunrise'} aria-pressed={manualClock === null && selectedSunEvent === 'sunrise'} on:click={() => { manualClock = null; selectedSunEvent = 'sunrise'; }}>{zh ? '日出' : 'Sunrise'}</button>
            <button type="button" class:active={manualClock === null && selectedSunEvent === 'sunset'} aria-pressed={manualClock === null && selectedSunEvent === 'sunset'} on:click={() => { manualClock = null; selectedSunEvent = 'sunset'; }}>{zh ? '日落' : 'Sunset'}</button>
            <input class="cloud-clock" type="time" step="60" value={displayedClock}
                aria-label={zh ? '当地计算时间' : 'Local calculation time'}
                title={zh ? '手动输入当地时间；点击日出或日落恢复自动时刻' : 'Enter local time; Sunrise or Sunset restores the event time'}
                on:input={event => { manualClock = event.currentTarget.value; }} />
        </div>
    </div>
    <div class="cloud-forecast-controls">
        <label class="cloud-model"><span>{zh ? '模型' : 'Model'}</span>
            <select aria-label={zh ? '云层预报模型' : 'Cloud forecast model'} value={model}
                on:change={changeModel}>
                <option value="ecmwf">ECMWF</option><option value="gfs">GFS</option><option value="icon">ICON</option>
            </select>
        </label>
        <label class="cloud-threshold">{zh ? '检出云量 ≥' : 'Cloud cover ≥'} <input type="number" min="1" max="100" step="1" bind:value={settings.threshold} /> %</label>
    </div>
    </div>
    {#if !scenarios.length}
        <p class="cloud-error" role="status">{manualClock !== null ? (zh ? '请输入有效的当地时间' : 'Enter a valid local time') : (zh ? '该日暂无所选升落时刻' : 'Selected rise/set time unavailable for this date')}</p>
    {/if}
    <div class="cloud-status-row">
    <div class="cloud-data-status" role="status">
        {#if status === 'loading' || status === 'idle'}
            {zh ? '正在读取云层剖面…' : 'Loading cloud profile…'}
        {:else if status === 'error'}
            {zh ? '云层预报加载失败' : 'Cloud forecast failed'} <button type="button" on:click={() => dispatch('retry')}>{zh ? '重试' : 'Retry'}</button>
        {:else}
            {#each scenarios as event}<div>{event.profile ? `${zh ? '预报时次' : 'Forecast step'} ${formatLocalClock(new Date(event.profile.timestamp), timeZone)}` : (zh ? '无可用剖面' : 'No profile available')}</div>{/each}
        {/if}
    </div>
    </div>
    <div class="cloud-table-scroll" tabindex="0" role="region" aria-label={zh ? '云层距离表' : 'Cloud distance table'}>
    <table class="cloud-table">
        <thead><tr>
            <th scope="col" title={zh ? '云层海拔高度' : 'Clouds Height AMSL'}>{zh ? '云层高度' : 'Clouds Height'} ({units.elevation})
                <span class="cloud-mode-size">
                <span aria-hidden="true">{settings.layers.low.mode === 'auto' ? (zh ? '自动' : 'Auto') : (zh ? '手动' : 'Manual')}</span>
                <select class="cloud-mode" value={settings.layers.low.mode} on:change={event => CLOUD_BANDS.forEach(band => changeHeightMode(band, event))} aria-label={zh ? '云层高度来源' : 'Cloud height source'}>
                    <option value="auto">{zh ? '自动' : 'Auto'}</option><option value="manual">{zh ? '手动' : 'Manual'}</option>
                </select>
                </span>
            </th>
            <th scope="col" title={zh ? '遮蔽太阳云距' : 'Blocking Sun'}><span class="cloud-heading-line">{zh ? '遮蔽太阳' : 'Blocking'}</span><span class="cloud-heading-line">{zh ? '云距' : 'Sun'}</span><small>({units.distance})</small></th>
            <th scope="col" title={zh ? '地平线云距' : 'Clouds at Horizon'}><span class="cloud-heading-line">{#if zh}地平线{:else}<span class="cloud-heading-wide">Clouds at</span><span class="cloud-heading-compact">Clouds</span>{/if}</span><span class="cloud-heading-line">{zh ? '云距' : 'Horizon'}</span><small>({units.distance})</small></th>
            <th scope="col" title={zh ? '擦地云距' : 'Tangent distance'}><span class="cloud-heading-line">{zh ? '擦地' : 'Tangent'}</span><span class="cloud-heading-line">{zh ? '云距' : 'distance'}</span><small>({units.distance})</small></th>
            <th scope="col" title={zh ? '最远无云距' : 'Furthest No Clouds'}><span class="cloud-heading-wide">{#if zh}最远无云<br />距{:else}Furthest No<br />Clouds{/if}</span><span class="cloud-heading-compact"><span class="cloud-heading-line">{zh ? '最远' : 'Furthest'}</span><span class="cloud-heading-line">{zh ? '无云距' : 'clear'}</span></span><small>({units.distance})</small></th>
            <th scope="col" title={zh ? '该云高对应的太阳最低高度角' : 'Minimum solar altitude for this cloud height'}><span class="cloud-heading-line"><span class="cloud-heading-wide">{zh ? '太阳高度角' : 'Sun Altitude'}</span><span class="cloud-heading-compact">{zh ? '太阳' : 'Sun'}<br />{zh ? '高度角' : 'Altitude'}</span></span><span class="cloud-heading-line">∠</span></th>
        </tr></thead>
        {#each CLOUD_BANDS as band}
            {@const row = settings.layers[band]}
            {@const bandRows = scenarios.flatMap(event => {
                const matches = event.layers.filter(layer => layer.band === band);
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
                    <label class="cloud-band">{#if index === 0}<input type="checkbox" bind:checked={settings.layers[band].enabled} />{/if}<i></i>{bandName(band)}</label>
                    {#if row.mode === 'manual' && index === 0}
                        <div class="cloud-height">
                            <input type="number" min="1" max={units.elevation === 'ft' ? 98425 : 30000} step="any"
                                aria-label={`${bandName(band)} ${zh ? '海拔高度' : 'height AMSL'}`}
                                aria-invalid={!validHeight(row.heightM)}
                                value={row.heightM === undefined ? '' : Number((row.heightM / (units.elevation === 'ft' ? 0.3048 : 1)).toFixed(1))}
                                on:input={event => setManualHeight(band, event)} />
                            <button class="cloud-clear" type="button" title={zh ? '清除高度' : 'Clear height'} aria-label={`${bandName(band)} ${zh ? '清除高度' : 'clear height'}`}
                                disabled={row.heightM === undefined} on:click={() => { settings.layers[band].heightM = undefined; settings = { ...settings }; }}>×</button>
                        </div>
                    {:else}
                        <span>{layer ? `${row.mode === 'auto' ? '≈ ' : ''}${formatElevationM(layer.heightM, units.elevation)}` : '--'}</span>
                    {/if}
                    </div></th>
                    <td class="cloud-sight"><small>{manualClock !== null ? (zh ? '自选' : 'Custom') : item.event.type === 'sunrise' ? (zh ? '日出' : 'Sunrise') : (zh ? '日落' : 'Sunset')}</small>{obstruction === null ? '--' : metrics.distance.convertNumber(obstruction * 1000, 2, units.distance).toFixed(2)}</td>
                    <td>{geometry ? formatDistanceKm(geometry.horizonKm, units.distance) : '--'}</td>
                    <td class="cloud-band-value">{geometry ? formatDistanceKm(geometry.tangentKm, units.distance) : '--'}</td>
                    <td class="cloud-band-value">{geometry ? formatDistanceKm(geometry.clearKm, units.distance) : '--'}</td>
                    <td>{geometry ? `${geometry.minimumSunAltitude.toFixed(1)}°` : '--'}</td>
                </tr>
                {#if row.enabled && row.mode === 'auto'}
                    <tr class="cloud-detail"><td colspan="6">
                        {#if layer}
                            {zh ? '采样云高' : 'Sample height'} {heightLabel(layer.heightM)} · {zh ? '云量' : 'Cover'} {layer.cloudPercent}%
                            {#if layer.baseMinimumM !== null} · {zh ? '云底区间' : 'Base interval'} {heightLabel(layer.baseMinimumM)} – {heightLabel(layer.heightM)}{/if}
                        {:else}{item.event.profile?.coverage[band] === 'sampled' ? (zh ? '未检出独立云底；不代表远方无云' : 'No separate cloud base detected; distant clouds unknown') : (zh ? '无可用高度数据' : 'No height data')}{/if}
                    </td></tr>
                {:else if row.enabled && row.heightM !== undefined && !validHeight(row.heightM)}
                    <tr class="cloud-detail"><td colspan="6" class="cloud-error">{zh ? '请输入大于 0、最高 30000 米的海拔高度' : 'Enter a height above 0 and up to 30,000 m AMSL'}</td></tr>
                {/if}
                {/each}
            </tbody>
        {/each}
    </table>
    </div>
    <div class="cloud-map-options">
        <label><input type="checkbox" bind:checked={settings.syncMap} /> {zh ? '同步 Windy 模型与时间' : 'Sync Windy model and time'}</label>
        <label>{zh ? '云图' : 'Cloud map'} <select bind:value={settings.overlay}>
            <option value="clouds">{zh ? '总云' : 'Total'}</option><option value="lclouds">{zh ? '低云' : 'Low'}</option>
            <option value="mclouds">{zh ? '中云' : 'Middle'}</option><option value="hclouds">{zh ? '高云' : 'High'}</option>
        </select></label>
        <label class="cloud-opacity">{zh ? '线条' : 'Opacity'} <input type="range" min="10" max="100" step="5" bind:value={settings.opacity} />{settings.opacity}%</label>
        <button type="button" disabled={!layers.length} on:click={fitMap}>{zh ? '显示全部云距' : 'Fit cloud distances'}</button>
    </div>
    {#if !settings.syncMap}
        <p class="cloud-error" role="status">{zh ? '独立几何规划 · 底图天气未同步' : 'Independent geometry · Map weather is not synchronized'}</p>
    {:else if syncError}
        <p class="cloud-error" role="status">{zh ? '底图模型或时刻未同步，参考线仍对应所选计算时刻' : 'Map model or time differs; reference lines retain the selected calculation time'}
            <button type="button" on:click={() => { lastSyncKey = ''; }}>{zh ? '重新同步' : 'Sync again'}</button></p>
    {:else if syncing}
        <p class="cloud-muted" role="status">{zh ? '正在同步云图…' : 'Synchronizing cloud map…'}</p>
    {/if}
    <div class="cloud-legend">
        {#each CLOUD_BANDS as band}<span><i style={`border-color:${CLOUD_BAND_COLORS[band]}`}></i>{bandName(band)}</span>{/each}
        <span><i class="sight"></i>{zh ? '遮蔽太阳云距' : 'Blocking Sun'}</span>
        <span><i class="horizon"></i>{zh ? '地平线云距' : 'Clouds at Horizon'}</span>
        <span><i class="tangent"></i>{zh ? '擦地云距' : 'Tangent'}</span>
        <span><i class="far"></i>{zh ? '最远无云距' : 'Furthest No Clouds'}</span>
    </div>
    <p class="cloud-limit">{zh ? '云距采用零高度基准，不扣除机位海拔；未校验沿途云况、地形或消光' : 'Cloud distances use a zero-height reference without subtracting camera elevation; path clouds, terrain and extinction unverified'}</p>
</section>

<style>
    .cloud-panel { box-sizing: border-box; container-type: inline-size; height: 100%; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; padding: 12px; color: var(--panel-text, #f2f4fa); font-size: 12px; line-height: 1.5; }
    .cloud-panel * { box-sizing: border-box; letter-spacing: 0; }
    .cloud-toolbar, .cloud-forecast-controls, .cloud-map-options { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
    .cloud-controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 12px; }
    .cloud-controls > div { flex: 1 1 auto; justify-content: space-between; }
    .cloud-forecast-controls { gap: 8px; }
    .cloud-forecast-controls label { white-space: nowrap; }
    .cloud-panel .cloud-threshold input { width: 54px; flex: 0 0 54px; padding: 0 6px; appearance: textfield; font-variant-numeric: tabular-nums; }
    .cloud-threshold input::-webkit-inner-spin-button, .cloud-threshold input::-webkit-outer-spin-button { appearance: none; margin: 0; }
    .cloud-panel label { display: flex; align-items: center; gap: 5px; }
    .cloud-panel button, .cloud-panel select, .cloud-panel input { font: inherit; color: inherit; }
    .cloud-panel select, .cloud-panel input[type=number], .cloud-panel input[type=time] { height: 30px; border: 1px solid var(--panel-border); border-radius: 6px; background: rgba(8, 15, 27, .68); padding: 0 8px; min-width: 0; color-scheme: dark; font-size: 13px; }
    .cloud-panel button { min-height: 30px; border: 1px solid var(--panel-border); border-radius: 6px; padding: 4px 8px; background: rgba(255, 255, 255, .06); cursor: pointer; }
    .cloud-panel button:hover, .cloud-panel button.active { background: #254754; border-color: #6ed9ee; }
    .cloud-panel button:disabled { opacity: .45; cursor: default; }
    .cloud-panel :is(button, input, select):focus-visible { outline: 2px solid #6ed9ee; outline-offset: 2px; }
    .cloud-panel input[type=checkbox] { accent-color: #6ed9ee; width: 17px; height: 17px; }
    .cloud-panel input[type=range] { appearance: none; -webkit-appearance: none; background: transparent; border: 0; padding: 0; min-width: 0; height: 30px; }
    .cloud-panel input[type=range]::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: #607587; }
    .cloud-panel input[type=range]::-webkit-slider-thumb { appearance: none; -webkit-appearance: none; width: 18px; height: 18px; margin-top: -7px; border: 2px solid #17212a; border-radius: 50%; background: #6ed9ee; }
    .cloud-panel input[type=range]::-moz-range-track { height: 4px; background: #607587; }
    .cloud-panel input[type=range]::-moz-range-thumb { width: 16px; height: 16px; border: 2px solid #17212a; border-radius: 50%; background: #6ed9ee; }
    .cloud-target { width: 132px; }
    .cloud-presets { display: flex; gap: 4px; }
    .cloud-panel .cloud-clock { width: 94px; padding: 0 4px; font-size: 12px; }
    .cloud-muted { color: #b9c2ce; font-size: 11px; overflow-wrap: anywhere; }
    .cloud-status-row { display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-top: 6px; color: #b9c2ce; }
    .cloud-data-status { font-size: 11px; }
    .cloud-table-scroll { overflow-x: auto; margin: 8px 0; }
    .cloud-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; font-variant-numeric: tabular-nums; }
    .cloud-heading-line { display: block; white-space: nowrap; }
    .cloud-heading-compact { display: none; }
    .cloud-table th, .cloud-table td { padding: 5px 0; text-align: center; vertical-align: middle; overflow-wrap: anywhere; }
    .cloud-table thead { color: #b9c2ce; font-size: 11px; }
    .cloud-table thead th { font-weight: 500; overflow-wrap: anywhere; }
    .cloud-table th:first-child { width: 106px; }
    .cloud-panel--english .cloud-table thead th { overflow-wrap: normal; }
    .cloud-panel--english .cloud-table th:first-child { width: 24%; }
    .cloud-panel--english .cloud-table thead th:nth-child(2) { width: 14%; }
    .cloud-panel--english .cloud-table thead th:nth-child(3) { width: 17%; }
    .cloud-panel--english .cloud-table thead th:nth-child(4) { width: 10%; }
    .cloud-panel--english .cloud-table thead th:nth-child(5) { width: 18%; }
    .cloud-panel--english .cloud-table thead th:nth-child(6) { width: 17%; }
    .cloud-table small { display: block; font-size: 10px; font-weight: 400; }
    .cloud-table tbody { border-top: 1px solid var(--panel-border); }
    .cloud-table tbody td:not(.cloud-height-cell) { font-weight: 600; }
    .cloud-table .cloud-detail td { padding: 0 4px 6px; text-align: left; color: #b9c2ce; font-size: 11px; font-weight: 400; overflow-wrap: anywhere; }
    .cloud-height-controls { display: grid; grid-template-columns: 40px minmax(0, 1fr); align-items: center; gap: 2px; min-width: 0; }
    .cloud-mode-size { position: relative; display: table; margin: 2px auto 0; font-size: 11px; font-weight: 400; }
    .cloud-mode-size > span { display: block; visibility: hidden; padding: 0 24px 0 6px; height: 24px; white-space: nowrap; }
    /* Own the arrow footprint so native select insets cannot clip the measured text. */
    .cloud-mode-size::after { content: ''; position: absolute; right: 8px; top: 7px; width: 6px; height: 6px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(45deg); pointer-events: none; }
    .cloud-panel .cloud-mode { position: absolute; inset: 0; width: 100%; height: 24px; min-height: 24px; padding: 0 22px 0 4px; font-size: inherit; appearance: none; -webkit-appearance: none; }
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
    .cloud-map-options { border-top: 1px solid #485364; padding-top: 10px; }
    .cloud-opacity { flex: 1; min-width: 180px; }
    .cloud-opacity input { flex: 1; width: 70px; }
    .cloud-legend { display: flex; flex-wrap: wrap; gap: 5px 12px; margin-top: 12px; font-size: 11px; }
    .cloud-legend span { display: flex; gap: 5px; align-items: center; }
    .cloud-legend i { width: 18px; height: 0; border-top: 2px solid; }
    .cloud-legend .sight { border-color: #6ed9ee; }
    .cloud-legend .horizon { border-color: #fff; }
    .cloud-legend .tangent { border-color: #b9c2ce; border-top-style: dashed; }
    .cloud-legend .far { border-color: #b9c2ce; }
    .cloud-error { color: #ffb8ba; font-size: 12px; margin: 6px 0; }
    .cloud-limit { color: #b9c2ce; font-size: 11px; margin: 8px 0 0; }
    :global(.cloud-planning-marker) { background: transparent; border: 0; text-align: center; }
    :global(.cloud-planning-marker span) { display: inline-block; padding: 0; border: 0; background: transparent; font: 600 12px/24px sans-serif; text-shadow: 0 1px 2px #17212a, 0 0 3px #17212a; text-align: center; white-space: nowrap; }
    :global(.cloud-planning-point span) { display: block; width: 12px; height: 12px; border: 2px solid #6ed9ee; border-radius: 50%; background: #17212a; }
    @container (max-width: 380px) {
        .cloud-heading-wide { display: none; }
        .cloud-heading-compact { display: inline; }
        .cloud-table thead { font-size: 10px; }
        .cloud-table th:first-child, .cloud-panel--english .cloud-table th:first-child { width: 100px; }
        .cloud-panel--english .cloud-table thead th:nth-child(n+2) { width: auto; overflow-wrap: anywhere; }
        .cloud-height-controls { grid-template-columns: 30px minmax(0, 1fr); }
        .cloud-forecast-controls { gap: 6px; font-size: 11px; }
        .cloud-forecast-controls label { gap: 3px; }
        .cloud-forecast-controls select { padding: 0 4px; font-size: 12px; }
        .cloud-presets button { padding: 4px 6px; }
        .cloud-legend { gap: 4px 8px; }
    }
</style>

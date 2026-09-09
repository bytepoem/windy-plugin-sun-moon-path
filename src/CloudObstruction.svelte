<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from 'svelte';
    import { map } from '@windy/map';
    import store from '@windy/store';
    import metrics from '@windy/metrics';
    import { cloudArc, cloudTargetPosition, cloudSightDistance, cloudTimeInstant, cloudTwilightDistances, type CloudDirectionBody } from './cloudGeometry';
    import CloudTimeline from './CloudTimeline.svelte';
    import CloudHelp from './CloudHelp.svelte';
    import { galacticCenterEvents, cloudEventBody, cloudTimelineLabel, type CloudTimelineEventType } from './cloudTimeline';
    import { selectCloudBase, resolveSingleLayer } from './cloudBase';
    import { CLOUD_BAND_COLORS, createCloudOverlayController } from './cloudOverlayController';
    import {
        CLOUD_BANDS, extractCloudForecast, selectCloudProfile,
        type CloudBand, type CloudLayer, type CloudSettings,
    } from './cloudProfile';
    import { formatLocalClock, type Coordinates, type SolarEvent } from './solar';
    import { formatDistanceKm, formatElevationM, type UnitPreferences } from './unitPreferences';
    import type { WeatherForecastPayload, WeatherLoadStatus, WeatherModel } from './weather';

    export let location: Coordinates;
    export let celestialEvents: { type: SolarEvent; timestamp: number }[];
    export let forecast: WeatherForecastPayload | null;
    export let status: WeatherLoadStatus;
    export let model: WeatherModel;
    export let timeZone: string;
    export let selectedDate: string;
    export let language: 'zh' | 'en';
    export let units: UnitPreferences;
    export let settings: CloudSettings;
    export let lineOpacity: number;

    const dispatch = createEventDispatcher<{ modelchange: WeatherModel; retry: void }>();
    const overlay = createCloudOverlayController(map);
    export let selectedCloudEvent: SolarEvent = 'sunset';
    export let cloudMapEvent: SolarEvent | null = 'sunset';
    let manualClock: string | null = null;
    let timelineEvent: CloudTimelineEventType | null = null;
    let previewingTime = false;
    let showThresholdHelp = false;
    let showHelp = false;
    export let cloudPlanningBody: CloudDirectionBody = 'sun';
    export let cloudPlanningTimestamp: number | null = null;
    export let cloudDirectionRangeKm = 0;
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
    $: thresholdHelpText = zh
        ? '自动识别云层时，忽略云量低于此值的高度层。调低可纳入更稀疏的云层；此数值不代表遮挡概率或云层厚度。'
        : 'Automatic cloud detection ignores altitude levels with cloud cover below this value. Lower values include sparser clouds; this is not a blocking probability or cloud thickness.';
    $: single = settings.view === 'single';
    $: visibleBands = single ? ['low'] as CloudBand[] : CLOUD_BANDS;
    $: heightMode = single ? settings.single.mode : settings.layers.low.mode;
    // Profile extraction is only needed when the user requests the multi-layer view.
    $: cloudForecast = single ? { profiles: [], modelElevationM: null } : extractCloudForecast(forecast, settings.threshold);
    $: timelineEvents = [...celestialEvents, ...galacticCenterEvents(selectedDate, timeZone, location)];
    $: automaticEvent = timelineEvents.find(event => event.type === (timelineEvent ?? selectedCloudEvent));
    $: manualTimestamp = manualClock === null ? null : cloudTimeInstant(selectedDate, manualClock, timeZone);
    $: planningEvents = manualClock === null ? (automaticEvent ? [automaticEvent] : [])
        : manualTimestamp === null ? [] : [{ type: selectedCloudEvent, timestamp: manualTimestamp }];
    $: displayedClock = manualClock ?? (automaticEvent ? formatLocalClock(new Date(automaticEvent.timestamp), timeZone) : '');
    $: scenarios = planningEvents.map(event => {
        const profile = selectCloudProfile(cloudForecast, event.timestamp);
        const base = single ? selectCloudBase(forecast, event.timestamp) : null;
        return { ...event, profile, base, ...cloudTargetPosition(settings.body, event.timestamp, location),
            layers: single ? resolveSingleLayer(settings.single, base) : resolveLayers(settings, profile?.layers || []) };
    });
    $: activeBody = scenarios[0]?.body ?? (settings.body === 'milkyway' ? 'milkyway' : settings.body === 'moon'
        || (settings.body === 'auto' && selectedCloudEvent.startsWith('moon')) ? 'moon' : 'sun');
    $: cloudPlanningBody = activeBody;
    $: cloudMapEvent = activeBody === 'milkyway' ? null : `${activeBody}${(timelineEvent ?? selectedCloudEvent).endsWith('rise') ? 'rise' : 'set'}` as SolarEvent;
    $: bodyName = activeBody === 'milkyway' ? (zh ? '银心' : 'Galactic centre')
        : activeBody === 'sun' ? (zh ? '太阳' : 'Sun') : (zh ? '月亮' : 'Moon');
    $: eventName = (event: CloudTimelineEventType) => cloudTimelineLabel(event, zh);
    $: layers = scenarios.flatMap(event => event.layers);
    // Share the outermost cloud distance with event rays, including a small visual overrun.
    $: cloudDirectionRangeKm = Math.max(0, ...scenarios.flatMap(event => event.layers.map(layer => Math.max(
        cloudTwilightDistances(layer.heightM)?.clearKm ?? 0,
        event.position.sightlineAvailable ? cloudSightDistance(layer.heightM, event.position.altitude) ?? 0 : 0,
    )))) * 1.05;
    $: timestamp = scenarios[0]?.timestamp ?? null;
    $: cloudPlanningTimestamp = timestamp;
    $: cloudBounds = planningBounds(scenarios, false);
    $: cloudDetailBounds = planningBounds(scenarios, true);
    $: if (mounted) {
        overlay.destroy();
        scenarios.forEach(event => {
            overlay.render({ location, position: event.position, sunAzimuth: event.position.azimuth,
                layers: event.layers, twilight: true, opacity: lineOpacity, language, units });
        });
    }
    $: if (mounted && !previewingTime) {
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
        const row = single ? settings.single : settings.layers[band];
        row.heightM = input.value === '' ? undefined : input.valueAsNumber * (units.elevation === 'ft' ? 0.3048 : 1);
        settings = { ...settings };
    };

    // Defaults are seeded only when entering manual mode with no saved value;
    // clearing an active input must leave it empty until the user fills it again.
    const changeHeightMode = (band: CloudBand, event: Event) => {
        const mode = (event.currentTarget as HTMLSelectElement).value as 'auto' | 'manual';
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
    /** Keep the displayed time when changing body; the old event shortcut is no longer selected. */
    const changeTarget = (event: Event) => {
        manualClock = displayedClock;
        previewingTime = false;
        settings = { ...settings, body: (event.currentTarget as HTMLSelectElement).value as CloudSettings['body'] };
    };
    /** Preview locally; invalidate outstanding map writes until the user commits the slider. */
    const previewTime = (clock: string) => {
        previewingTime = true;
        lastSyncKey = '';
        syncRevision += 1;
        syncing = false;
        manualClock = clock;
        // The explicit target remains selected when moving away from an event.
    };
    const jumpTime = (type: CloudTimelineEventType) => {
        settings = { ...settings, body: cloudEventBody(type) };
        timelineEvent = type;
        manualClock = null;
        previewingTime = false;
        if (type !== 'milkywayrise' && type !== 'milkywayset') {selectedCloudEvent = type;}
    };


    onMount(() => {
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
            if (['clouds', 'lclouds', 'mclouds', 'hclouds', 'cbase'].includes(value)) {
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
    <CloudTimeline events={timelineEvents} clock={displayedClock} selected={manualClock === null ? (timelineEvent ?? selectedCloudEvent) : null}
        {timeZone} {zh} on:preview={event => previewTime(event.detail)}
        on:commit={() => { previewingTime = false; }} on:jump={event => jumpTime(event.detail)}>
        <select slot="target" class="cloud-target" value={settings.body} on:change={changeTarget} aria-label={zh ? '遮蔽类型' : 'Obstruction target'}>
            <option value="auto">{zh ? '自动' : 'Auto'}</option>
            <option value="sun">{zh ? '遮蔽太阳' : 'Blocking Sun'}</option>
            <option value="moon">{zh ? '遮蔽月亮' : 'Blocking Moon'}</option>
            <option value="milkyway">{zh ? '遮蔽银心' : 'Galactic centre'}</option>
        </select>
    </CloudTimeline>
    <p class="cloud-muted cloud-height-description">{single ? (heightMode === 'auto' ? (zh ? '预报云底 · 一层参考不代表天空只有一层云' : 'Forecast cloud base · One reference does not describe every cloud layer') : (zh ? '手动高度 · 输入所关注云层的海拔高度' : 'Manual height · Enter the target cloud altitude AMSL')) : (zh ? '剖面采样云高 · 仅使用实际检出的云层' : 'Profile sample heights · Only detected layers are used')}</p>
    {#if settings.body === 'auto' && scenarios.length}
        <p class="cloud-muted" role="status">{zh ? `自动：遮蔽${bodyName} · 太阳中心在地平线上时选太阳，否则选月亮` : `Auto: Blocking ${bodyName} · Sun when its centre is above the horizon, otherwise Moon`}</p>
    {/if}
    {#if activeBody === 'milkyway'}
        {#if scenarios[0]}
            <p class="cloud-muted">{zh ? '高度角' : 'Altitude'} {scenarios[0].position.altitude.toFixed(1)}° · {zh ? '方位角' : 'Azimuth'} {scenarios[0].position.azimuth.toFixed(1)}°</p>
        {/if}
    {/if}
    {#if scenarios[0] && !scenarios[0].position.sightlineAvailable}
        <p class="cloud-error" role="status">{zh ? `${bodyName}${activeBody === 'sun' ? '中心' : ''}在地平线下，不显示遮蔽${bodyName}云距` : `${bodyName} is below the horizon and not visible; blocking distance is unavailable`}</p>
    {:else if scenarios[0]?.position.altitude < 0}
        <p class="cloud-error" role="status">{zh ? `${bodyName}中心在地平线下，遮蔽云距仅为几何参考` : `${bodyName} centre is below the horizon; blocking distance is a geometric reference only`}</p>
    {/if}
    {#if !scenarios.length}
        <p class="cloud-error" role="status">{manualClock !== null ? (zh ? '请输入有效的当地时间' : 'Enter a valid local time') : (zh ? '该日暂无所选升落时刻' : 'Selected rise/set time unavailable for this date')}</p>
    {/if}
    <div class="cloud-forecast-controls">
        <div class="cloud-model-mode">
        <label class="cloud-model"><span>{zh ? '模型' : 'Model'}</span>
            <select aria-label={zh ? '云层预报模型' : 'Cloud forecast model'} value={model}
                on:change={changeModel}>
                <option value="ecmwf">ECMWF</option><option value="gfs">GFS</option><option value="icon">ICON</option>
            </select>
        </label>
        <select bind:value={settings.view} aria-label={zh ? '云层规划模式' : 'Cloud planning mode'}>
            <option value="single">{zh ? '单层' : 'Single'}</option>
            <option value="layers">{zh ? '分层' : 'Layered'}</option>
        </select>
        </div>
        <div class="cloud-data-status" role="status" title={zh ? '预报时次' : 'Forecast step'}>
        {#if status === 'loading' || status === 'idle'}
            {zh ? '正在读取云层预报…' : 'Loading…'}
        {:else if status === 'error'}
            {zh ? '云层预报加载失败' : 'Failed'} <button type="button" on:click={() => dispatch('retry')}>{zh ? '重试' : 'Retry'}</button>
        {:else}
            {#each scenarios as event}{@const step = single ? event.base : event.profile}<div>{#if step}<span class="cloud-forecast-label">{zh ? '预报时次' : 'Forecast step'} </span>{formatLocalClock(new Date(step.timestamp), timeZone)}{:else}{zh ? '所选时间无可用预报' : 'No forecast'}{/if}</div>{/each}
        {/if}
    </div>
    </div>
    {#if !single && heightMode === 'auto'}
        <div class="cloud-threshold-row">
            <label class="cloud-threshold">{zh ? '仅考虑云量 ≥' : 'Only include cloud cover ≥'}
                <input type="number" min="1" max="100" step="1" bind:value={settings.threshold}
                    aria-describedby={showThresholdHelp ? 'cloud-threshold-help' : undefined} /> %
            </label>
            <button class="cloud-threshold-help" type="button" title={thresholdHelpText}
                aria-label={zh ? '云量筛选说明' : 'Cloud cover filter explanation'} aria-expanded={showThresholdHelp}
                on:click={event => {
                    showThresholdHelp = !showThresholdHelp;
                    // Pointer activation can retain a focus ring on touch browsers.
                    // Keep keyboard focus (detail === 0) so the button remains navigable.
                    if (!showThresholdHelp && event.detail > 0) {event.currentTarget.blur();}
                }}>ⓘ</button>
        </div>
        {#if showThresholdHelp}<p id="cloud-threshold-help" class="cloud-muted">{thresholdHelpText}</p>{/if}
    {/if}
    <div class="cloud-table-scroll" tabindex="0" role="region" aria-label={zh ? '云层距离表' : 'Cloud distance table'}>
    <table class="cloud-table">
        <thead><tr>
            <th scope="col" title={zh ? '云层海拔高度' : 'Clouds Height AMSL'}>{zh ? '云层高度' : 'Clouds Height'} ({units.elevation})
                <div class="cloud-height-heading-controls">
                <span class="cloud-mode-size">
                <span aria-hidden="true">{heightMode === 'auto' ? (zh ? '自动' : 'Auto') : (zh ? '手动' : 'Manual')}</span>
                <select class="cloud-mode" value={heightMode} on:change={event => visibleBands.forEach(band => changeHeightMode(band, event))} aria-label={zh ? '云层高度来源' : 'Cloud height source'}>
                    <option value="auto">{zh ? '自动' : 'Auto'}</option><option value="manual">{zh ? '手动' : 'Manual'}</option>
                </select>
                </span>
                <button class="cloud-help-trigger" type="button" aria-haspopup="dialog"
                    aria-label={zh ? '云层距离图解' : 'Cloud distance guide'} title={zh ? '云层距离图解' : 'Cloud distance guide'}
                    on:click={() => { showHelp = true; }}>
                    <span aria-hidden="true">ⓘ</span> {zh ? '图解' : 'Guide'}
                </button>
                </div>
            </th>
            <th scope="col" title={zh ? `遮蔽${bodyName}云距` : `Blocking ${bodyName}`}><span class="cloud-heading-line">{zh ? `遮蔽${bodyName}` : 'Blocking'}</span><span class="cloud-heading-line">{zh ? '云距' : bodyName}</span><small>({units.distance})</small></th>
            <th scope="col" title={zh ? '地平线云距' : 'Clouds at Horizon'}><span class="cloud-heading-line">{#if zh}地平线{:else}<span class="cloud-heading-wide">Clouds at</span><span class="cloud-heading-compact">Clouds</span>{/if}</span><span class="cloud-heading-line">{zh ? '云距' : 'Horizon'}</span><small>({units.distance})</small></th>
            <!-- Height-derived solar reference columns remain available for both targets. -->
            <th scope="col" title={zh ? '擦地云距' : 'Tangent distance'}><span class="cloud-heading-line">{zh ? '擦地' : 'Tangent'}</span><span class="cloud-heading-line">{zh ? '云距' : 'distance'}</span><small>({units.distance})</small></th>
            <th scope="col" title={zh ? '最远无云距' : 'Furthest No Clouds'}><span class="cloud-heading-wide">{#if zh}最远无云<br />距{:else}Furthest No<br />Clouds{/if}</span><span class="cloud-heading-compact"><span class="cloud-heading-line">{zh ? '最远' : 'Furthest'}</span><span class="cloud-heading-line">{zh ? '无云距' : 'clear'}</span></span><small>({units.distance})</small></th>
            <th scope="col" title={zh ? '该云高对应的太阳最低高度角' : 'Minimum solar altitude for this cloud height'}><span class="cloud-heading-line"><span class="cloud-heading-wide">{zh ? '太阳高度角' : 'Sun Altitude'}</span><span class="cloud-heading-compact">{zh ? '太阳' : 'Sun'}<br />{zh ? '高度角' : 'Altitude'}</span></span><span class="cloud-heading-line">∠</span></th>
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
                    <label class="cloud-band">{#if index === 0 && !single}<input type="checkbox" bind:checked={settings.layers[band].enabled} />{/if}<i></i>{single ? (zh ? '参考' : 'Ref') : bandName(band)}</label>
                    {#if row.mode === 'manual' && index === 0}
                        <div class="cloud-height">
                            <input type="number" min="1" max={units.elevation === 'ft' ? 98425 : 30000} step="any"
                                aria-label={`${single ? (zh ? '参考' : 'Reference') : bandName(band)} ${zh ? '海拔高度' : 'height AMSL'}`}
                                aria-invalid={!validHeight(row.heightM)}
                                value={row.heightM === undefined ? '' : Number((row.heightM / (units.elevation === 'ft' ? 0.3048 : 1)).toFixed(1))}
                                on:input={event => setManualHeight(band, event)} />
                            <button class="cloud-clear" type="button" title={zh ? '清除高度' : 'Clear height'} aria-label={`${single ? (zh ? '参考' : 'Reference') : bandName(band)} ${zh ? '清除高度' : 'clear height'}`}
                                disabled={row.heightM === undefined} on:click={() => { if (single) { settings.single.heightM = undefined; } else { settings.layers[band].heightM = undefined; } settings = { ...settings }; }}>×</button>
                        </div>
                    {:else}
                        <span>{layer ? `${row.mode === 'auto' ? '≈ ' : ''}${formatElevationM(layer.heightM, units.elevation)}` : '--'}</span>
                    {/if}
                    </div></th>
                    <td class="cloud-sight"><small>{manualClock !== null ? (zh ? '自选' : 'Custom') : eventName(item.event.type)}</small>{obstruction === null ? '--' : metrics.distance.convertNumber(obstruction * 1000, 2, units.distance).toFixed(2)}</td>
                    <td>{geometry ? formatDistanceKm(geometry.horizonKm, units.distance) : '--'}</td>
                    <td class="cloud-band-value">{geometry ? formatDistanceKm(geometry.tangentKm, units.distance) : '--'}</td>
                    <td class="cloud-band-value">{geometry ? formatDistanceKm(geometry.clearKm, units.distance) : '--'}</td>
                    <td>{geometry ? `${geometry.minimumSunAltitude.toFixed(1)}°` : '--'}</td>
                </tr>
                {#if row.enabled && row.mode === 'auto'}
                    <tr class="cloud-detail"><td colspan="6">
                        {#if single}
                            {#if item.event.base?.heightAglM !== null && item.event.base?.heightAglM !== undefined}
                                {zh ? '预报云底（离地）' : 'Forecast base (AGL)'} {heightLabel(item.event.base.heightAglM)}
                                {#if layer} · {zh ? '计算海拔' : 'Altitude AMSL'} {heightLabel(layer.heightM)}
                                {:else} · {zh ? '缺少模型高程或高度不适用于云距计算' : 'Missing model terrain or height outside geometry limits'}{/if}
                            {:else}
                                {zh ? '所选模型或时刻无可用云底；不代表无云。可选择手动高度或分层模式。' : 'Cloud base unavailable for this model or time; this does not mean clear skies. Choose manual height or the layered view.'}
                            {/if}
                        {:else if layer}
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
        <div class="cloud-map-row" tabindex="0" role="region" aria-label={zh ? '云图设置' : 'Cloud map settings'}>
        <label title={zh ? '同步 Windy 模型与时间' : 'Sync Windy model and time'}><input type="checkbox" bind:checked={settings.syncMap} aria-label={zh ? '同步 Windy 模型与时间' : 'Sync Windy model and time'} /> {zh ? '同步 Windy 模型与时间' : 'Sync Windy'}</label>
        <label><span class="cloud-map-label">{zh ? '云图' : 'Cloud map'}</span> <select bind:value={settings.overlay} aria-label={zh ? '云图' : 'Cloud map'}>
            <option value="clouds">{zh ? '总云' : 'Total'}</option><option value="lclouds">{zh ? '低云' : 'Low'}</option>
            <option value="mclouds">{zh ? '中云' : 'Middle'}</option><option value="hclouds">{zh ? '高云' : 'High'}</option>
            <option value="cbase">{zh ? '云底高度' : 'Cloud base'}</option>
        </select></label>

        </div>
        {#if !settings.syncMap || syncError || syncing || previewingTime}<div class="cloud-sync-status">
    {#if !settings.syncMap}
        <p class="cloud-error" role="status">{zh ? '独立几何规划 · 底图天气未同步' : 'Independent geometry · Map weather is not synchronized'}</p>
    {:else if previewingTime}
        <p class="cloud-muted" role="status">{zh ? '时间预览 · 松开后同步底图' : 'Time preview · Release to sync the map'}</p>
    {:else if syncError}
        <p class="cloud-error" role="status">{zh ? '底图模型或时刻未同步，参考线仍对应所选计算时刻' : 'Map model or time differs; reference lines retain the selected calculation time'}</p>
        <button class="cloud-resync" type="button" on:click={() => { lastSyncKey = ''; }}>{zh ? '重新同步' : 'Sync again'}</button>
    {:else if syncing}
        <p class="cloud-muted" role="status">{zh ? '正在同步云图…' : 'Synchronizing cloud map…'}</p>
    {/if}
        </div>{/if}
    </div>
    <div class="cloud-legend">
        {#each visibleBands as band}<span><i style={`border-color:${CLOUD_BAND_COLORS[band]}`}></i>{single ? (zh ? '参考云层' : 'Reference layer') : bandName(band)}</span>{/each}
        <span><i class="sight"></i>{zh ? `遮蔽${bodyName}云距` : `Blocking ${bodyName}`}</span>
        <span><i class="horizon"></i>{zh ? '地平线云距' : 'Clouds at Horizon'}</span>
        <span><i class="tangent"></i>{zh ? '擦地云距' : 'Tangent'}</span>
        <span><i class="far"></i>{zh ? '最远无云距' : 'Furthest No Clouds'}</span>
    </div>
    <p class="cloud-limit">{zh ? '云距采用零高度基准，不扣除机位海拔；未校验沿途云况、地形或消光' : 'Cloud distances use a zero-height reference without subtracting camera elevation; path clouds, terrain and extinction unverified'}</p>
</section>

{#if showHelp}<CloudHelp {zh} on:close={() => { showHelp = false; }} />{/if}

<style>
    .cloud-height-heading-controls { display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 2px 4px; margin-top: 2px; }
    .cloud-height-heading-controls .cloud-mode-size { margin: 0; }
    .cloud-panel .cloud-help-trigger { display: inline-flex; align-items: center; gap: 3px; min-height: 24px; padding: 0 2px; border-color: transparent; color: #6ed9ee; background: transparent; font-size: 11px; white-space: nowrap; }
    .cloud-panel { --cloud-row-gap: 6px; display: flex; flex-direction: column; gap: var(--cloud-row-gap); box-sizing: border-box; container-type: inline-size; height: 100%; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; padding: 12px; color: var(--panel-text, #f2f4fa); font-size: 12px; line-height: 1.5; }
    .cloud-panel > * { flex-shrink: 0; }
    .cloud-panel p { margin: 0; }
    .cloud-model-mode { display: flex; align-items: center; flex-wrap: nowrap; gap: 8px; }
    .cloud-panel * { box-sizing: border-box; letter-spacing: 0; }
    .cloud-forecast-controls, .cloud-map-options { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
    .cloud-forecast-controls { flex-wrap: nowrap; }
    .cloud-threshold { margin: 0; }
    .cloud-threshold-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .cloud-panel .cloud-threshold-help { min-height: 24px; width: 24px; padding: 0; border: 0; background: transparent; color: #6ed9ee; font-size: 16px; }
    .cloud-forecast-controls label { white-space: nowrap; }
    .cloud-panel .cloud-threshold input { width: 54px; flex: 0 0 54px; padding: 0 6px; appearance: textfield; font-variant-numeric: tabular-nums; }
    .cloud-threshold input::-webkit-inner-spin-button, .cloud-threshold input::-webkit-outer-spin-button { appearance: none; margin: 0; }
    .cloud-panel label { display: flex; align-items: center; gap: 5px; }
    .cloud-panel button, .cloud-panel select, .cloud-panel input { font: inherit; color: inherit; }
    .cloud-panel select, .cloud-panel input[type=number], .cloud-panel input[type=time] { height: 30px; border: 1px solid var(--panel-border); border-radius: 6px; background: rgba(8, 15, 27, .68); padding: 0 8px; min-width: 0; color-scheme: dark; font-size: 13px; }
    .cloud-panel button { min-height: 30px; border: 1px solid var(--panel-border); border-radius: 6px; padding: 4px 8px; background: rgba(255, 255, 255, .06); cursor: pointer; }
    .cloud-panel button:hover:not(.cloud-threshold-help), .cloud-panel button.active { background: #254754; border-color: #6ed9ee; }
    .cloud-panel .cloud-threshold-help[aria-expanded="true"] { background: #254754; }
    .cloud-panel button:disabled { opacity: .45; cursor: default; }
    .cloud-panel :is(button, input, select):focus-visible { outline: 2px solid #6ed9ee; outline-offset: 2px; }
    .cloud-panel input[type=checkbox] { accent-color: #6ed9ee; width: 17px; height: 17px; }
    .cloud-target { width: 100%; padding: 0 4px !important; }
    .cloud-muted { color: #b9c2ce; font-size: 11px; overflow-wrap: anywhere; }
    .cloud-height-description { margin: 0; }
    .cloud-data-status { margin-left: auto; text-align: right; font-size: 11px; color: #b9c2ce; white-space: normal; min-width: 0; flex: 1; }
    .cloud-table-scroll { overflow-x: auto; margin: 0; }
    .cloud-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; font-variant-numeric: tabular-nums; }
    .cloud-heading-line { display: block; white-space: nowrap; }
    .cloud-heading-compact { display: none; }
    .cloud-table th, .cloud-table td { padding: 4px 0; text-align: center; vertical-align: middle; overflow-wrap: anywhere; }
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
    .cloud-table .cloud-detail td { padding: 0 4px 4px; text-align: left; color: #b9c2ce; font-size: 11px; font-weight: 400; overflow-wrap: anywhere; }
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
    .cloud-map-row { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 8px; width: 100%; white-space: nowrap; }
    .cloud-sync-status { width: 100%; }
    .cloud-sync-status p { margin: 0; }
    .cloud-resync { display: block; margin: 6px 0 0; }
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
        .cloud-panel--english .cloud-map-row { gap: 2px; font-size: 10px; }
        .cloud-panel--english .cloud-data-status { font-size: 10px; }
        .cloud-panel--english .cloud-map-row label { gap: 3px; }
        .cloud-panel--english .cloud-map-row select { padding: 0 2px; font-size: 11px; }
        .cloud-heading-wide { display: none; }
        .cloud-heading-compact { display: inline; }
        .cloud-table thead { font-size: 10px; }
        .cloud-table th:first-child, .cloud-panel--english .cloud-table th:first-child { width: 100px; }
        .cloud-panel--english .cloud-table thead th:nth-child(n+2) { width: auto; overflow-wrap: anywhere; }
        .cloud-height-controls { grid-template-columns: 30px minmax(0, 1fr); }
        .cloud-forecast-controls { gap: 6px; font-size: 11px; }
        .cloud-forecast-controls label { gap: 3px; }
        .cloud-forecast-controls select { padding: 0 4px; font-size: 12px; }
        .cloud-legend { gap: 4px 8px; }
    }
</style>

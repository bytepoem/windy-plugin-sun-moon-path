<div class="plugin__mobile-header">
    { title }
</div>

<section class="plugin__content sun-path-panel">
    <button
        type="button"
        class="plugin__title plugin__title--chevron-back panel-title"
        on:click={() => bcast.emit('rqstOpen', 'menu')}
    >
        { title }
    </button>

    <div class="panel-intro">
        <div class="eyebrow">SUN PATH</div>
        <p>以当前观察点为起点，查看太阳在事件前后 30 分钟的方位变化。</p>
    </div>

    <div class="control-grid">
        <label class="control-field">
            <span class="control-label">观测日期</span>
            <input type="date" bind:value={selectedDate} aria-label="观测日期" />
        </label>

        <fieldset class="event-selector">
            <legend class="control-label">事件</legend>
            <div class="segmented-control" role="group" aria-label="选择太阳事件">
                <button
                    type="button"
                    class:active={selectedEvent === 'sunrise'}
                    aria-pressed={selectedEvent === 'sunrise'}
                    on:click={() => (selectedEvent = 'sunrise')}
                >
                    日出
                </button>
                <button
                    type="button"
                    class:active={selectedEvent === 'sunset'}
                    aria-pressed={selectedEvent === 'sunset'}
                    on:click={() => (selectedEvent = 'sunset')}
                >
                    日落
                </button>
            </div>
        </fieldset>
    </div>

    <div class="location-summary">
        <div>
            <span class="control-label">观察位置</span>
            <strong>{selectedLocation.lat.toFixed(4)}, {selectedLocation.lon.toFixed(4)}</strong>
        </div>
        <span class="location-hint">单击地图重新选择</span>
    </div>

    <div class="status-region" aria-live="polite">
        {#if status === 'loading'}
            <div class="status-message">正在计算太阳方位…</div>
        {:else if status === 'error'}
            <div class="status-message status-message--error" role="alert">
                <span>{errorMessage}</span>
                <button type="button" class="text-button" on:click={() => void refreshPath(refreshKey)}>
                    重试
                </button>
            </div>
        {:else if solarPath?.status === 'unavailable'}
            <div class="status-message status-message--muted">
                {unavailableMessage(solarPath.event, solarPath.reason)}
            </div>
        {:else if solarPath?.status === 'ok'}
            <div class="event-summary">
                <div>
                    <span class="control-label">{selectedEvent === 'sunrise' ? '日出时间' : '日落时间'}</span>
                    <strong>{formatLocalDateTime(solarPath.eventTime, timeZone)}</strong>
                </div>
                <div class="event-summary__meta">
                    <span>{timeZone}</span>
                    {#if elevationM > 0}
                        <span>海拔 {Math.round(elevationM)} m</span>
                    {/if}
                </div>
            </div>

            <div class="sample-list">
                {#each solarPath.samples as sample}
                    <div class="sample-row">
                        <span
                            class="line-swatch"
                            style={`--line-color: ${LINE_COLORS[sample.kind]}`}
                            aria-hidden="true"
                        ></span>
                        <span class="sample-row__name">{sample.label}</span>
                        <span class="sample-row__time">{formatLocalDateTime(sample.time, timeZone)}</span>
                        <span class="sample-row__azimuth">
                            {Math.round(sample.azimuth)}° {compassDirection(sample.azimuth)}
                        </span>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <div class="legend" aria-label="地图图例">
        <div class="legend__title">地图图例</div>
        <div class="legend__items">
            <span class="legend-item">
                <span class="legend-dot legend-dot--origin" aria-hidden="true"></span>
                用户位置
            </span>
            <span class="legend-item">
                <span class="legend-dot legend-dot--inner" aria-hidden="true"></span>
                200 km
            </span>
            <span class="legend-item">
                <span class="legend-dot legend-dot--outer" aria-hidden="true"></span>
                400 km
            </span>
        </div>
        <div class="legend__items legend__items--lines">
            <span class="legend-item">
                <span class="legend-line legend-line--before" aria-hidden="true"></span>
                前 30 分钟
            </span>
            <span class="legend-item">
                <span class="legend-line legend-line--event" aria-hidden="true"></span>
                {selectedEvent === 'sunrise' ? '日出' : '日落'}
            </span>
            <span class="legend-item">
                <span class="legend-line legend-line--after" aria-hidden="true"></span>
                后 30 分钟
            </span>
            <span class="legend-item">
                <span class="legend-line legend-line--current" aria-hidden="true"></span>
                当前太阳方位
            </span>
        </div>
    </div>

    <p class="panel-note">
        方向线表示天文方位，不代表山体、建筑或云层遮挡条件下的实际可见性。
    </p>
</section>

<script lang="ts">
    import bcast from '@windy/broadcast';
    import { getElevation, getTimezoneInfo } from '@windy/fetch';
    import { getMyLatestPos } from '@windy/geolocation';
    import { centerMap, map } from '@windy/map';
    import { setUrl } from '@windy/location';
    import { singleclick } from '@windy/singleclick';
    import { onDestroy, onMount } from 'svelte';

    import config from './pluginConfig';
    import {
        calculateSolarPath,
        calculateCurrentSolarDirection,
        compassDirection,
        CURRENT_DIRECTION_COLOR,
        dateInputForInstant,
        dateInputToUtcNoon,
        formatLocalDateTime,
        LINE_COLORS,
        splitPolylineAtDateLine,
        type Coordinates,
        type SolarEvent,
        type SolarPath,
    } from './solar';

    import type { LatLon } from '@windy/interfaces.d';

    const { name, title } = config;
    const systemTimeZone = (() => {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        } catch {
            return 'UTC';
        }
    })();
    const latestPosition = getMyLatestPos();
    const asFiniteCoordinate = (value: number | string | undefined, fallback: number): number => {
        const numericValue = Number(value);
        return Number.isFinite(numericValue) ? numericValue : fallback;
    };

    let selectedLocation: Coordinates = {
        lat: asFiniteCoordinate(latestPosition.lat, 23.05),
        lon: asFiniteCoordinate(latestPosition.lon, 113.37),
    };
    let selectedDate = dateInputForInstant(new Date(), systemTimeZone);
    let selectedEvent: SolarEvent = 'sunset';
    let timeZone = systemTimeZone;
    let elevationM = 0;
    let solarPath: SolarPath | null = null;
    let status: 'idle' | 'loading' | 'ready' | 'empty' | 'error' = 'idle';
    let errorMessage = '';
    let isMounted = false;
    let latestRequestId = 0;
    let refreshKey = '';
    let mapLayerGroup: L.LayerGroup | null = null;
    let lines: L.Polyline[] = [];
    let markers: L.Marker[] = [];
    let currentDirectionLines: L.Polyline[] = [];
    let currentDirectionTimer: ReturnType<typeof setInterval> | null = null;

    $: refreshKey = `${selectedDate}|${selectedEvent}|${selectedLocation.lat}|${selectedLocation.lon}`;

    $: if (isMounted && refreshKey) {
        void refreshPath(refreshKey);
    }

    $: if (isMounted) {
        setUrl(name, { lat: selectedLocation.lat, lon: selectedLocation.lon });
    }

    const isValidTimeZone = (candidate: string): boolean => {
        try {
            new Intl.DateTimeFormat(undefined, { timeZone: candidate }).format();
            return true;
        } catch {
            return false;
        }
    };

    const removeMapFeatures = () => {
        mapLayerGroup?.remove();
        mapLayerGroup = null;
        lines = [];
        markers = [];
        currentDirectionLines = [];
    };

    const markerIcon = (kind: 'origin' | 'inner' | 'outer'): L.DivIcon => {
        const sizes = {
            origin: 18,
            inner: 12,
            outer: 12,
        };
        const size = sizes[kind];

        return new L.DivIcon({
            className: `sun-path-marker sun-path-marker--${kind}`,
            html: '<span></span>',
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
        });
    };

    const toLatLng = (location: Coordinates): [number, number] => [location.lat, location.lon];

    const removeCurrentDirectionLines = () => {
        for (const line of currentDirectionLines) {
            line.remove();
        }
        currentDirectionLines = [];
    };

    const drawCurrentDirectionLine = () => {
        if (!mapLayerGroup) {
            return;
        }

        removeCurrentDirectionLines();
        const direction = calculateCurrentSolarDirection({
            date: new Date(),
            location: selectedLocation,
        });
        const pathSegments = splitPolylineAtDateLine([selectedLocation, direction.endpoint]);
        const layerGroup = mapLayerGroup;

        currentDirectionLines = pathSegments.map(
            segment =>
                new L.Polyline(segment.map(toLatLng), {
                    color: CURRENT_DIRECTION_COLOR,
                    weight: 2,
                    opacity: 0.95,
                    lineCap: 'round',
                    lineJoin: 'round',
                }).addTo(layerGroup),
        );
    };

    const drawMapFeatures = (path: SolarPath) => {
        removeMapFeatures();

        if (path.status !== 'ok') {
            return;
        }

        mapLayerGroup = new L.LayerGroup().addTo(map);
        const layerGroup = mapLayerGroup;

        const originMarker = new L.Marker(toLatLng(selectedLocation), {
            icon: markerIcon('origin'),
        }).addTo(layerGroup);
        originMarker.bindTooltip('用户位置', { direction: 'top', offset: [0, -8] });
        markers.push(originMarker);
        drawCurrentDirectionLine();

        for (const sample of path.samples) {
            const pathSegments = splitPolylineAtDateLine([
                selectedLocation,
                sample.point200,
                sample.point400,
            ]);
            for (const segment of pathSegments) {
                const line = new L.Polyline(segment.map(toLatLng), {
                    color: LINE_COLORS[sample.kind],
                    weight: 3,
                    opacity: 0.95,
                    lineCap: 'round',
                    lineJoin: 'round',
                }).addTo(layerGroup);
                lines.push(line);
            }

            const innerMarker = new L.Marker(toLatLng(sample.point200), {
                icon: markerIcon('inner'),
            }).addTo(layerGroup);
            innerMarker.bindTooltip(`${sample.label} · 200 km`, { direction: 'top', offset: [0, -6] });
            markers.push(innerMarker);

            const outerMarker = new L.Marker(toLatLng(sample.point400), {
                icon: markerIcon('outer'),
            }).addTo(layerGroup);
            outerMarker.bindTooltip(`${sample.label} · 400 km`, { direction: 'top', offset: [0, -6] });
            markers.push(outerMarker);
        }
    };

    const loadLocationContext = async (
        location: Coordinates,
        dateInput: string,
        requestId: number,
    ): Promise<{ timeZone: string; elevationM: number } | null> => {
        const datetime = dateInputToUtcNoon(dateInput, 'UTC').toISOString();
        const [timezoneResult, elevationResult] = await Promise.allSettled([
            getTimezoneInfo(location, datetime),
            getElevation(location.lat, location.lon),
        ]);

        if (requestId !== latestRequestId) {
            return null;
        }

        if (timezoneResult.status !== 'fulfilled') {
            throw new Error('无法取得观察点时区，请稍后重试。');
        }

        const candidate = timezoneResult.value.data.TZname;
        if (!candidate || !isValidTimeZone(candidate)) {
            throw new Error('Windy 返回的观察点时区无效，请稍后重试。');
        }
        const resolvedTimeZone = candidate;

        let resolvedElevation = 0;
        if (elevationResult.status === 'fulfilled' && Number.isFinite(elevationResult.value.data)) {
            resolvedElevation = Math.max(0, elevationResult.value.data);
        }

        timeZone = resolvedTimeZone;
        elevationM = resolvedElevation;
        return { timeZone: resolvedTimeZone, elevationM: resolvedElevation };
    };

    const refreshPath = async (key: string) => {
        const requestId = ++latestRequestId;
        const location = { ...selectedLocation };
        const dateInput = selectedDate;
        const event = selectedEvent;

        status = 'loading';
        errorMessage = '';
        removeMapFeatures();

        try {
            const context = await loadLocationContext(location, dateInput, requestId);
            if (!context || key !== refreshKey) {
                return;
            }

            const nextPath = calculateSolarPath({
                date: dateInputToUtcNoon(dateInput, context.timeZone),
                location,
                event,
                elevationM: context.elevationM,
            });

            if (requestId !== latestRequestId || key !== refreshKey) {
                return;
            }

            solarPath = nextPath;
            status = nextPath.status === 'ok' ? 'ready' : 'empty';
            drawMapFeatures(nextPath);
        } catch (error) {
            if (requestId !== latestRequestId || key !== refreshKey) {
                return;
            }

            status = 'error';
            solarPath = null;
            errorMessage = error instanceof Error ? error.message : '太阳方位计算失败，请稍后重试。';
        }
    };

    const unavailableMessage = (
        event: SolarEvent,
        reason: 'always-up' | 'always-down' | 'not-available',
    ): string => {
        const eventName = event === 'sunrise' ? '日出' : '日落';
        if (reason === 'always-up') {
            return `当天太阳始终在地平线以上，没有可用的${eventName}时刻。`;
        }
        if (reason === 'always-down') {
            return `当天太阳始终在地平线以下，没有可用的${eventName}时刻。`;
        }
        return `当天没有可用的${eventName}时刻。`;
    };

    const setLocation = (latLon: LatLon) => {
        const lat = asFiniteCoordinate(latLon.lat, Number.NaN);
        const lon = asFiniteCoordinate(latLon.lon, Number.NaN);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return;
        }

        selectedLocation = { lat, lon };
    };

    export const onopen = (params?: LatLon) => {
        const nextLocation = params || getMyLatestPos();
        setLocation(nextLocation);
        centerMap({ lat: selectedLocation.lat, lon: selectedLocation.lon, zoom: 6 });
    };

    onMount(() => {
        isMounted = true;
        singleclick.on(name, setLocation);
        currentDirectionTimer = setInterval(drawCurrentDirectionLine, 5_000);
    });

    onDestroy(() => {
        isMounted = false;
        latestRequestId += 1;
        if (currentDirectionTimer) {
            clearInterval(currentDirectionTimer);
            currentDirectionTimer = null;
        }
        removeMapFeatures();
        singleclick.off(name, setLocation);
    });
</script>

<style lang="less">
    :global(.sun-path-marker) {
        background: transparent;
        border: 0;
    }

    :global(.sun-path-marker span) {
        display: block;
        box-sizing: border-box;
        border-radius: 50%;
        box-shadow: 0 1px 5px rgba(0, 0, 0, 0.55);
    }

    :global(.sun-path-marker--origin span) {
        width: 18px;
        height: 18px;
        background: #7553f2;
        border: 2px solid rgba(255, 255, 255, 0.9);
    }

    :global(.sun-path-marker--inner span) {
        width: 12px;
        height: 12px;
        background: #17aa03;
        border: 1px solid rgba(255, 255, 255, 0.82);
    }

    :global(.sun-path-marker--outer span) {
        width: 12px;
        height: 12px;
        background: #318bff;
        border: 1px solid rgba(255, 255, 255, 0.82);
    }

    .sun-path-panel {
        --panel-bg: rgba(19, 25, 32, 0.96);
        --panel-surface: rgba(255, 255, 255, 0.06);
        --panel-surface-hover: rgba(255, 255, 255, 0.1);
        --panel-border: rgba(255, 255, 255, 0.16);
        --panel-text: #f3f6f8;
        --panel-muted: #aebac4;
        --panel-accent: #49a9e8;
        --panel-warning: #f6b65c;

        box-sizing: border-box;
        max-width: 460px;
        padding: 12px 16px 20px;
        color: var(--panel-text);
        background: var(--panel-bg);
        font-size: 14px;
        line-height: 1.5;
    }

    .panel-title {
        width: 100%;
        border: 0;
        color: inherit;
        text-align: left;
        cursor: pointer;
    }

    .panel-intro {
        margin: 18px 0 16px;
        padding: 12px;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        background: var(--panel-surface);
    }

    .panel-intro p,
    .panel-note {
        margin: 4px 0 0;
        color: var(--panel-muted);
    }

    .eyebrow {
        color: var(--panel-accent);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
    }

    .control-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 12px;
    }

    .control-field,
    .event-selector {
        min-width: 0;
        margin: 0;
        padding: 0;
        border: 0;
    }

    .control-label {
        display: block;
        margin-bottom: 5px;
        color: var(--panel-muted);
        font-size: 12px;
    }

    input[type='date'] {
        box-sizing: border-box;
        width: 100%;
        min-height: 42px;
        padding: 8px 10px;
        border: 1px solid var(--panel-border);
        border-radius: 5px;
        color: var(--panel-text);
        background: rgba(0, 0, 0, 0.22);
        font: inherit;
        color-scheme: dark;
    }

    input[type='date']:focus-visible,
    button:focus-visible {
        outline: 2px solid var(--panel-accent);
        outline-offset: 2px;
    }

    .segmented-control {
        display: grid;
        grid-template-columns: 1fr 1fr;
        min-height: 42px;
        overflow: hidden;
        border: 1px solid var(--panel-border);
        border-radius: 5px;
    }

    .segmented-control button,
    .text-button {
        border: 0;
        color: var(--panel-muted);
        background: transparent;
        font: inherit;
        cursor: pointer;
        transition: color 160ms ease, background 160ms ease;
    }

    .segmented-control button + button {
        border-left: 1px solid var(--panel-border);
    }

    .segmented-control button:hover,
    .segmented-control button.active {
        color: var(--panel-text);
        background: rgba(73, 169, 232, 0.22);
    }

    .location-summary,
    .event-summary {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 16px;
        padding: 12px 0;
        border-top: 1px solid var(--panel-border);
        border-bottom: 1px solid var(--panel-border);
    }

    .location-summary strong,
    .event-summary strong {
        display: block;
        color: var(--panel-text);
        font-size: 15px;
        font-variant-numeric: tabular-nums;
        overflow-wrap: anywhere;
    }

    .location-hint,
    .event-summary__meta {
        min-width: 0;
        max-width: 100%;
        flex: 0 0 auto;
        color: var(--panel-muted);
        font-size: 12px;
        text-align: right;
    }

    .event-summary__meta {
        display: grid;
        gap: 2px;
    }

    .status-region {
        min-height: 42px;
    }

    .status-message {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 0;
        color: var(--panel-warning);
    }

    .status-message--error {
        color: #ff9a9a;
    }

    .status-message--muted {
        color: var(--panel-muted);
    }

    .text-button {
        flex: 0 0 auto;
        padding: 4px 0;
        color: var(--panel-accent);
        text-decoration: underline;
        text-underline-offset: 3px;
    }

    .sample-list {
        display: grid;
        gap: 1px;
        margin-top: 12px;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        overflow: hidden;
    }

    .sample-row {
        display: grid;
        grid-template-columns: 8px minmax(0, 1fr) auto;
        gap: 8px 10px;
        align-items: center;
        padding: 10px 11px;
        background: var(--panel-surface);
    }

    .sample-row__name {
        min-width: 0;
        color: var(--panel-text);
    }

    .sample-row__time,
    .sample-row__azimuth {
        color: var(--panel-muted);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

    .sample-row__azimuth {
        grid-column-start: 2;
        grid-column-end: -1;
        font-size: 12px;
    }

    .line-swatch {
        width: 8px;
        height: 28px;
        border-radius: 4px;
        background: var(--line-color);
    }

    .legend {
        margin-top: 18px;
        padding-top: 14px;
        border-top: 1px solid var(--panel-border);
    }

    .legend__title {
        margin-bottom: 8px;
        color: var(--panel-text);
        font-weight: 600;
    }

    .legend__items {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 14px;
    }

    .legend__items--lines {
        margin-top: 8px;
    }

    .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--panel-muted);
        white-space: nowrap;
    }

    .legend-dot {
        width: 10px;
        height: 10px;
        border: 1px solid rgba(255, 255, 255, 0.8);
        border-radius: 50%;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    }

    .legend-dot--origin {
        width: 12px;
        height: 12px;
        background: #7553f2;
    }

    .legend-dot--inner {
        background: #17aa03;
    }

    .legend-dot--outer {
        background: #318bff;
    }

    .legend-line {
        display: inline-block;
        width: 24px;
        height: 3px;
        border-radius: 2px;
    }

    .legend-line--before {
        background: #f6b65c;
    }

    .legend-line--event {
        background: #f97316;
    }

    .legend-line--after {
        background: #991b1b;
    }

    .legend-line--current {
        background: #ffffff;
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
    }

    .panel-note {
        margin-top: 16px;
        font-size: 12px;
    }

    @media (max-width: 520px) {
        .sun-path-panel {
            max-width: none;
            padding-right: 14px;
            padding-left: 14px;
        }

        .control-grid {
            grid-template-columns: 1fr;
        }

        .sample-row {
            grid-template-columns: 8px minmax(0, 1fr) auto;
        }

        .event-summary {
            align-items: flex-start;
        }

        .event-summary__meta,
        .location-hint {
            flex: 1 1 100%;
            text-align: left;
        }

        .event-summary__meta {
            display: flex;
            flex-wrap: wrap;
            gap: 2px 10px;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .segmented-control button,
        .text-button {
            transition: none;
        }
    }
</style>

<div class="plugin__mobile-header">
    { title }
</div>

<section class="plugin__content sun-path-panel">
    <button type="button" class="panel-title" on:click={() => bcast.emit('rqstOpen', 'menu')}>
        <span class="panel-title__arrow" aria-hidden="true">←</span>
        <span>{ title }</span>
    </button>

    <div class="panel-intro">
        <div class="eyebrow">ASTRONOMY PATH</div>
        <p>查看太阳和月亮在事件前后 30 分钟的方位线，以及当天的日月时间轴。</p>
    </div>

    <div class="control-grid">
        <label class="control-field">
            <span class="control-label">观测日期</span>
            <input type="date" bind:value={selectedDate} aria-label="观测日期" />
        </label>

        <fieldset class="event-selector">
            <legend class="control-label">方向线事件</legend>
            <div class="segmented-control segmented-control--events" role="group" aria-label="选择日月事件">
                {#each eventOptions as option}
                    <button
                        type="button"
                        class:active={selectedEvent === option.value}
                        aria-pressed={selectedEvent === option.value}
                        on:click={() => (selectedEvent = option.value)}
                    >
                        {option.label}
                    </button>
                {/each}
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
            <div class="status-message">正在计算日月方位…</div>
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
                    <span class="control-label">{eventDisplayName(selectedEvent)}时间</span>
                    <strong>{formatLocalDateTime(solarPath.eventTime, timeZone)}</strong>
                </div>
                <div class="event-summary__meta">
                    <span>{timeZone}</span>
                    {#if elevationM > 0}
                        <span>海拔 {Math.round(elevationM)} m</span>
                    {/if}
                </div>
            </div>

            <div class="sample-list" aria-label={`${eventDisplayName(selectedEvent)}方向线数据`}>
                {#each solarPath.samples as sample}
                    <div class="sample-row">
                        <span
                            class="line-swatch"
                            style={`--line-color: ${LINE_COLORS[sample.kind]}`}
                            aria-hidden="true"
                        ></span>
                        <span class="sample-row__name">{sample.label}</span>
                        <span class="sample-row__time">{formatLocalClock(sample.time, timeZone)}</span>
                        <span class="sample-row__azimuth">
                            {Math.round(sample.azimuth)}° {compassDirection(sample.azimuth)}
                        </span>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <section class="timeline-card" aria-label="日月时间轴">
        <div class="timeline-card__heading">
            <div>
                <div class="eyebrow">ASTRONOMY TIMELINE</div>
                <strong>{timelineLead()}</strong>
            </div>
            <span class="timeline-card__now">现在 {formatLocalClock(currentInstant, timeZone)}</span>
        </div>

        <div class="timeline-track" aria-hidden="true">
            <span class="timeline-track__night"></span>
            {#if timelineItemByKind('sunrise')?.time && timelineItemByKind('sunset')?.time}
                <span
                    class="timeline-track__daylight"
                    style={`left: ${timelineProgress(timelineItemByKind('sunrise')?.time)}%; width: ${timelineProgress(timelineItemByKind('sunset')?.time) - timelineProgress(timelineItemByKind('sunrise')?.time)}%`}
                ></span>
            {/if}
            {#each astronomyTimeline?.items || [] as item}
                {#if item.time}
                    <span
                        class:item-moon={item.body === 'moon'}
                        class="timeline-track__marker"
                        style={`left: ${timelineProgress(item.time)}%`}
                    ></span>
                {/if}
            {/each}
            <span class="timeline-track__current" style={`left: ${timelineProgress(currentInstant)}%`}></span>
        </div>

        <div class="timeline-events">
            {#each astronomyTimeline?.items || [] as item}
                <div class:item-moon={item.body === 'moon'} class="timeline-event">
                    <span class="timeline-event__dot" aria-hidden="true"></span>
                    <span class="timeline-event__label">{item.label}</span>
                    <strong>{item.time ? formatLocalClock(item.time, timeZone) : '--:--'}</strong>
                </div>
            {/each}
        </div>

        <div class="timeline-legend" aria-label="时间轴图例">
            <span><i class="timeline-legend__line timeline-legend__line--sun" aria-hidden="true"></i>太阳轨迹</span>
            <span><i class="timeline-legend__line timeline-legend__line--moon" aria-hidden="true"></i>月亮轨迹</span>
        </div>
    </section>

    <section class="celestial-grid" aria-label="实时日月位置">
        <article class="celestial-card celestial-card--sun">
            <div class="celestial-card__heading">
                <span class="celestial-symbol celestial-symbol--sun" aria-hidden="true">☀</span>
                <div>
                    <div class="eyebrow">LIVE SUN</div>
                    <strong>实时太阳位置</strong>
                </div>
            </div>
            {#if currentSolarDirection}
                <div class="celestial-card__value">
                    {Math.round(currentSolarDirection.azimuth)}° {compassDirection(currentSolarDirection.azimuth)}
                </div>
                <div class="celestial-card__meta">
                    高度角 {currentSolarDirection.altitude.toFixed(1)}° · 白线 · {formatLocalClock(currentInstant, timeZone)}
                </div>
            {:else}
                <div class="celestial-card__value">--</div>
            {/if}
        </article>

        <article class="celestial-card celestial-card--moon">
            <div class="celestial-card__heading">
                <span class="celestial-symbol celestial-symbol--moon" aria-hidden="true">◐</span>
                <div>
                    <div class="eyebrow">LIVE MOON</div>
                    <strong>实时月亮位置</strong>
                </div>
            </div>
            {#if currentMoonInfo}
                <div class="celestial-card__value">
                    {Math.round(currentMoonInfo.azimuth)}° {compassDirection(currentMoonInfo.azimuth)}
                </div>
                <div class="celestial-card__meta">
                    高度角 {currentMoonInfo.altitude.toFixed(1)}° · {moonPhaseName(currentMoonInfo.phase)} · {Math.round(currentMoonInfo.illuminationFraction * 100)}%<br />
                    距离 {Math.round(currentMoonInfo.distanceKm)} km · 蓝色虚线
                </div>
            {:else}
                <div class="celestial-card__value">--</div>
            {/if}
        </article>
    </section>

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
                {eventDisplayName(selectedEvent)}
            </span>
            <span class="legend-item">
                <span class="legend-line legend-line--after" aria-hidden="true"></span>
                后 30 分钟
            </span>
            <span class="legend-item">
                <span class="legend-line legend-line--current" aria-hidden="true"></span>
                当前太阳方位
            </span>
            <span class="legend-item">
                <span class="legend-line legend-line--moon" aria-hidden="true"></span>
                当前月亮方位
            </span>
        </div>
    </div>

    <p class="panel-note">
        方向线表示天文方位，不代表山体、建筑或云层遮挡条件下的实际可见性。关闭面板后，方向线会保留在地图上；重新打开插件时会接管并更新同一组图层。
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
    import { claimOverlayOwner } from './overlayOwner';
    import {
        calculateAstronomyTimeline,
        calculateCurrentMoonInfo,
        calculateCurrentSolarDirection,
        calculateSolarPath,
        compassDirection,
        CURRENT_DIRECTION_COLOR,
        CURRENT_MOON_DIRECTION_COLOR,
        dateInputForInstant,
        dateInputToUtcMidnight,
        dateInputToUtcNoon,
        formatLocalClock,
        formatLocalDateTime,
        LINE_COLORS,
        moonPhaseName,
        splitPolylineAtDateLine,
        type AstronomyTimeline,
        type Coordinates,
        type CurrentMoonInfo,
        type SolarDirection,
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
    const eventOptions: Array<{ value: SolarEvent; label: string }> = [
        { value: 'sunrise', label: '日出' },
        { value: 'sunset', label: '日落' },
        { value: 'moonrise', label: '月升' },
        { value: 'moonset', label: '月落' },
    ];
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
    let astronomyTimeline: AstronomyTimeline | null = null;
    let currentSolarDirection: SolarDirection | null = null;
    let currentMoonInfo: CurrentMoonInfo | null = null;
    let currentInstant = new Date();
    let status: 'idle' | 'loading' | 'ready' | 'empty' | 'error' = 'idle';
    let errorMessage = '';
    let isMounted = false;
    let latestRequestId = 0;
    let refreshKey = '';
    let mapLayerGroup: L.LayerGroup | null = null;
    let lines: L.Polyline[] = [];
    let markers: L.Marker[] = [];
    let currentDirectionLines: L.Polyline[] = [];
    let currentMoonDirectionLines: L.Polyline[] = [];
    let currentDirectionTimer: ReturnType<typeof setInterval> | null = null;

    $: refreshKey = `${selectedDate}|${selectedEvent}|${selectedLocation.lat}|${selectedLocation.lon}`;

    $: if (isMounted && refreshKey) {
        void refreshPath(refreshKey);
    }

    $: if (isMounted) {
        setUrl(name, { lat: selectedLocation.lat, lon: selectedLocation.lon });
    }

    const eventDisplayName = (event: SolarEvent): string => {
        const option = eventOptions.find(candidate => candidate.value === event);
        return option?.label || event;
    };

    const isValidTimeZone = (candidate: string): boolean => {
        try {
            new Intl.DateTimeFormat(undefined, { timeZone: candidate }).format();
            return true;
        } catch {
            return false;
        }
    };

    const makeRefreshKey = (location: Coordinates, dateInput: string, event: SolarEvent): string =>
        `${dateInput}|${event}|${location.lat}|${location.lon}`;

    const removeMapFeatures = () => {
        mapLayerGroup?.remove();
        mapLayerGroup = null;
        lines = [];
        markers = [];
        currentDirectionLines = [];
        currentMoonDirectionLines = [];
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
        for (const line of [...currentDirectionLines, ...currentMoonDirectionLines]) {
            line.remove();
        }
        currentDirectionLines = [];
        currentMoonDirectionLines = [];
    };

    const drawDirectionLine = (
        direction: { endpoint: Coordinates },
        color: string,
        layerGroup: L.LayerGroup,
        options: L.PolylineOptions = {},
    ): L.Polyline[] =>
        splitPolylineAtDateLine([selectedLocation, direction.endpoint]).map(
            segment =>
                new L.Polyline(segment.map(toLatLng), {
                    color,
                    weight: 2,
                    opacity: 0.95,
                    lineCap: 'round',
                    lineJoin: 'round',
                    ...options,
                }).addTo(layerGroup),
        );

    const drawCurrentDirectionLines = () => {
        currentInstant = new Date();
        try {
            currentSolarDirection = calculateCurrentSolarDirection({
                date: currentInstant,
                location: selectedLocation,
            });
            currentMoonInfo = calculateCurrentMoonInfo({
                date: currentInstant,
                location: selectedLocation,
            });
        } catch {
            currentSolarDirection = null;
            currentMoonInfo = null;
        }

        if (!mapLayerGroup) {
            return;
        }

        removeCurrentDirectionLines();
        const layerGroup = mapLayerGroup;
        if (currentSolarDirection) {
            currentDirectionLines = drawDirectionLine(currentSolarDirection, CURRENT_DIRECTION_COLOR, layerGroup);
        }
        if (currentMoonInfo) {
            currentMoonDirectionLines = drawDirectionLine(
                currentMoonInfo,
                CURRENT_MOON_DIRECTION_COLOR,
                layerGroup,
                { dashArray: '7 6' },
            );
        }
    };

    const drawMapFeatures = (path: SolarPath) => {
        removeMapFeatures();

        if (path.status !== 'ok') {
            drawCurrentDirectionLines();
            return;
        }

        mapLayerGroup = new L.LayerGroup().addTo(map);
        const layerGroup = mapLayerGroup;

        const originMarker = new L.Marker(toLatLng(selectedLocation), {
            icon: markerIcon('origin'),
        }).addTo(layerGroup);
        originMarker.bindTooltip('用户位置', { direction: 'top', offset: [0, -8] });
        markers.push(originMarker);
        drawCurrentDirectionLines();

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

        let resolvedElevation = 0;
        if (elevationResult.status === 'fulfilled' && Number.isFinite(elevationResult.value.data)) {
            resolvedElevation = Math.max(0, elevationResult.value.data);
        }

        timeZone = candidate;
        elevationM = resolvedElevation;
        return { timeZone: candidate, elevationM: resolvedElevation };
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

            const eventDate = event === 'moonrise' || event === 'moonset'
                ? dateInputToUtcMidnight(dateInput, context.timeZone)
                : dateInputToUtcNoon(dateInput, context.timeZone);
            const nextPath = calculateSolarPath({
                date: eventDate,
                dateInput,
                timeZone: context.timeZone,
                location,
                event,
                elevationM: context.elevationM,
            });
            const nextTimeline = calculateAstronomyTimeline({
                dateInput,
                timeZone: context.timeZone,
                location,
                elevationM: context.elevationM,
            });

            if (requestId !== latestRequestId || key !== refreshKey) {
                return;
            }

            solarPath = nextPath;
            astronomyTimeline = nextTimeline;
            status = nextPath.status === 'ok' ? 'ready' : 'empty';
            drawMapFeatures(nextPath);
        } catch (error) {
            if (requestId !== latestRequestId || key !== refreshKey) {
                return;
            }

            status = 'error';
            solarPath = null;
            astronomyTimeline = null;
            errorMessage = error instanceof Error ? error.message : '日月方位计算失败，请稍后重试。';
        }
    };

    const unavailableMessage = (
        event: SolarEvent,
        reason: 'always-up' | 'always-down' | 'not-available',
    ): string => {
        const nameForEvent = eventDisplayName(event);
        if (reason === 'always-up') {
            return `当天${nameForEvent === '月升' || nameForEvent === '月落' ? '月亮' : '太阳'}始终在地平线以上，没有可用的${nameForEvent}时刻。`;
        }
        if (reason === 'always-down') {
            return `当天${nameForEvent === '月升' || nameForEvent === '月落' ? '月亮' : '太阳'}始终在地平线以下，没有可用的${nameForEvent}时刻。`;
        }
        return `当天没有可用的${nameForEvent}时刻。`;
    };

    const setLocation = (latLon: LatLon) => {
        const lat = asFiniteCoordinate(latLon.lat, Number.NaN);
        const lon = asFiniteCoordinate(latLon.lon, Number.NaN);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return;
        }

        const nextLocation = { lat, lon };
        selectedLocation = nextLocation;
        const nextKey = makeRefreshKey(nextLocation, selectedDate, selectedEvent);
        refreshKey = nextKey;

        if (!isMounted) {
            setUrl(name, nextLocation);
            void refreshPath(nextKey);
        }
    };

    const timelineItemByKind = (kind: string) =>
        astronomyTimeline?.items.find(item => item.kind === kind);

    const timelineProgress = (time: Date | null | undefined): number => {
        if (!time || !astronomyTimeline) {
            return 0;
        }

        const total = astronomyTimeline.dayEnd.getTime() - astronomyTimeline.dayStart.getTime();
        const progress = ((time.getTime() - astronomyTimeline.dayStart.getTime()) / total) * 100;
        return Math.min(100, Math.max(0, progress));
    };

    const formatRemaining = (milliseconds: number): string => {
        const totalMinutes = Math.max(1, Math.round(milliseconds / 60_000));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return hours > 0 ? `${hours}小时${minutes}分钟` : `${minutes}分钟`;
    };

    const timelineLead = (): string => {
        const next = astronomyTimeline?.items.find(item => item.time && item.time.getTime() > currentInstant.getTime());
        if (!next?.time) {
            return '今日天文时段已结束';
        }
        return `距离${next.label}开始还有 ${formatRemaining(next.time.getTime() - currentInstant.getTime())}`;
    };

    export const onopen = (params?: LatLon) => {
        const nextLocation = params || getMyLatestPos();
        setLocation(nextLocation);
        centerMap({ lat: selectedLocation.lat, lon: selectedLocation.lon, zoom: 6 });
    };

    const overlayOwner = {
        deactivateForReplacement: () => {
            isMounted = false;
            latestRequestId += 1;
            if (currentDirectionTimer) {
                clearInterval(currentDirectionTimer);
                currentDirectionTimer = null;
            }
            removeMapFeatures();
            singleclick.off(name, setLocation);
        },
    };

    onMount(() => {
        claimOverlayOwner(overlayOwner);
        isMounted = true;
        singleclick.on(name, setLocation);
        drawCurrentDirectionLines();
        currentDirectionTimer = setInterval(drawCurrentDirectionLines, 5_000);
    });

    onDestroy(() => {
        isMounted = false;
        // Windy destroys fullscreen UI on close, but the requested map overlay must remain usable.
        // The next plugin mount claims the owner and performs the actual cleanup.
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

    :global(.plugin__mobile-header) {
        box-sizing: border-box;
        min-height: 44px;
        padding: 10px 16px;
        color: #f3f6f8 !important;
        background: #131920 !important;
        font-size: 16px;
        font-weight: 700;
        line-height: 24px;
    }

    .sun-path-panel {
        --panel-bg: rgba(19, 25, 32, 0.98);
        --panel-surface: rgba(255, 255, 255, 0.06);
        --panel-surface-hover: rgba(255, 255, 255, 0.1);
        --panel-border: rgba(255, 255, 255, 0.16);
        --panel-text: #f3f6f8;
        --panel-muted: #b8c3cc;
        --panel-accent: #63b9ee;
        --panel-warning: #f6b65c;
        --timeline-bg: #111a31;
        --timeline-sun: #ff9c38;
        --timeline-moon: #5ca9ff;

        box-sizing: border-box;
        width: 100%;
        max-width: 460px;
        max-height: calc(100dvh - 52px);
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 12px 16px calc(20px + env(safe-area-inset-bottom, 0px));
        color: var(--panel-text);
        background: var(--panel-bg);
        font-size: 14px;
        line-height: 1.5;
    }

    .panel-title {
        display: flex;
        align-items: center;
        gap: 9px;
        box-sizing: border-box;
        width: 100%;
        min-height: 44px;
        padding: 8px 0;
        border: 0;
        color: var(--panel-text) !important;
        background: var(--panel-bg) !important;
        font: inherit;
        font-size: 16px;
        font-weight: 700;
        text-align: left;
        cursor: pointer;
    }

    .panel-title__arrow {
        color: var(--panel-accent);
        font-size: 22px;
        line-height: 1;
    }

    .panel-title:focus-visible,
    input[type='date']:focus-visible,
    button:focus-visible {
        outline: 2px solid var(--panel-accent);
        outline-offset: 2px;
    }

    .panel-intro {
        margin: 12px 0 16px;
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
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
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
        min-height: 44px;
        padding: 8px 10px;
        border: 1px solid var(--panel-border);
        border-radius: 5px;
        color: var(--panel-text);
        background: rgba(0, 0, 0, 0.22);
        font: inherit;
        color-scheme: dark;
    }

    .segmented-control {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        min-height: 44px;
        overflow: hidden;
        border: 1px solid var(--panel-border);
        border-radius: 5px;
    }

    .segmented-control button,
    .text-button {
        min-height: 44px;
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
        gap: 5px 10px;
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

    .timeline-card {
        margin-top: 18px;
        padding: 14px 12px 12px;
        border: 1px solid rgba(122, 158, 207, 0.28);
        border-radius: 8px;
        background: var(--timeline-bg);
    }

    .timeline-card__heading {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        min-height: 44px;
    }

    .timeline-card__heading strong {
        display: block;
        margin-top: 3px;
        color: #edf3ff;
        font-size: 15px;
    }

    .timeline-card__now {
        flex: 0 0 auto;
        color: #aeb9cb;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
    }

    .timeline-track {
        position: relative;
        height: 30px;
        margin: 14px 0 12px;
        overflow: hidden;
        border-radius: 15px;
        background: #0b122b;
    }

    .timeline-track__night,
    .timeline-track__daylight {
        position: absolute;
        top: 0;
        bottom: 0;
    }

    .timeline-track__night {
        right: 0;
        left: 0;
        background: #0b122b;
    }

    .timeline-track__daylight {
        background: rgba(67, 141, 211, 0.58);
    }

    .timeline-track__marker,
    .timeline-track__current {
        position: absolute;
        z-index: 2;
        top: 4px;
        bottom: 4px;
        width: 3px;
        transform: translateX(-50%);
        border-radius: 2px;
        background: var(--timeline-sun);
        box-shadow: 0 0 0 2px rgba(17, 26, 49, 0.7);
    }

    .timeline-track__marker.item-moon {
        background: var(--timeline-moon);
    }

    .timeline-track__current {
        z-index: 3;
        top: -4px;
        bottom: -4px;
        width: 2px;
        background: #f7f9fc;
        box-shadow: none;
    }

    .timeline-events {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 8px;
    }

    .timeline-event {
        min-width: 0;
        color: #aeb9cb;
        font-size: 11px;
        text-align: center;
    }

    .timeline-event__dot {
        display: block;
        width: 7px;
        height: 7px;
        margin: 0 auto 4px;
        border-radius: 50%;
        background: var(--timeline-sun);
    }

    .timeline-event.item-moon .timeline-event__dot {
        background: var(--timeline-moon);
    }

    .timeline-event__label {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .timeline-event strong {
        display: block;
        margin-top: 2px;
        color: #eef3fb;
        font-size: 13px;
        font-variant-numeric: tabular-nums;
    }

    .timeline-legend {
        display: flex;
        justify-content: center;
        gap: 16px;
        margin-top: 12px;
        color: #aeb9cb;
        font-size: 11px;
    }

    .timeline-legend span {
        display: inline-flex;
        align-items: center;
        gap: 5px;
    }

    .timeline-legend__line {
        display: inline-block;
        width: 24px;
        height: 3px;
        border-radius: 2px;
        background: var(--timeline-sun);
    }

    .timeline-legend__line--moon {
        background: var(--timeline-moon);
        background-image: linear-gradient(90deg, var(--timeline-moon) 0 55%, transparent 55% 100%);
        background-size: 8px 3px;
    }

    .celestial-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-top: 14px;
    }

    .celestial-card {
        min-width: 0;
        padding: 12px;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        background: var(--panel-surface);
    }

    .celestial-card__heading {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .celestial-card__heading strong {
        display: block;
        margin-top: 2px;
        color: var(--panel-text);
        font-size: 13px;
    }

    .celestial-symbol {
        display: grid;
        flex: 0 0 auto;
        place-items: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        font-size: 18px;
    }

    .celestial-symbol--sun {
        color: #211504;
        background: #f6b65c;
    }

    .celestial-symbol--moon {
        color: #dcecff;
        background: #355f99;
    }

    .celestial-card__value {
        margin-top: 12px;
        color: #ffffff;
        font-size: 17px;
        font-variant-numeric: tabular-nums;
        font-weight: 700;
    }

    .celestial-card__meta {
        margin-top: 4px;
        color: var(--panel-muted);
        font-size: 11px;
        line-height: 1.55;
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

    .legend-line--moon {
        background: #8ec5ff;
        background-image: linear-gradient(90deg, #8ec5ff 0 55%, transparent 55% 100%);
        background-size: 8px 3px;
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

        .segmented-control--events {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .segmented-control--events button:nth-child(3) {
            border-top: 1px solid var(--panel-border);
            border-left: 0;
        }

        .segmented-control--events button:nth-child(4) {
            border-top: 1px solid var(--panel-border);
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

        .timeline-card__heading {
            display: block;
        }

        .timeline-card__now {
            display: block;
            margin-top: 4px;
        }

        .timeline-events {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            row-gap: 12px;
        }

        .timeline-legend {
            justify-content: flex-start;
        }

        .celestial-grid {
            grid-template-columns: 1fr;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .segmented-control button,
        .text-button {
            transition: none;
        }
    }
</style>

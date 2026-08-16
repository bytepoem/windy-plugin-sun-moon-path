<section
    class="sun-path-panel"
    class:plugin__content={!isMobileOrTablet}
    class:mobile_ui={isMobileOrTablet}
>
    <div
        class="panel-title"
        class:plugin__title={!isMobileOrTablet}
        class:plugin__title--chevron-back={!isMobileOrTablet}
        on:click={() => !isMobileOrTablet && bcast.emit('rqstOpen', 'menu')}
    >
        <span>{title}</span>
        {#if isMobileOrTablet}
            <button
                type="button"
                class="panel-close"
                aria-label="关闭面板"
                on:click|stopPropagation={() => bcast.emit('rqstClose', name)}
            >
                ×
            </button>
        {/if}
    </div>

    <div class="mobile-scroll-content">
    <div class="panel-intro">
        <p>日月关键时刻、事件前后 30 分钟方位线和夜间观测时段。</p>
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

    <div
        class="status-region"
        class:status-region--event-details={selectedEvent !== 'all' && activeSolarPath?.status !== undefined}
        aria-live="polite"
    >
        {#if status === 'loading'}
            <div class="status-message">正在计算日月方位…</div>
        {:else if status === 'error'}
            <div class="status-message status-message--error" role="alert">
                <span>{errorMessage}</span>
                <button type="button" class="text-button" on:click={() => void refreshPaths(refreshKey)}>
                    重试
                </button>
            </div>
        {:else if selectedEvent !== 'all' && activeSolarPath?.status === 'unavailable'}
            <div class="status-message status-message--muted">
                {unavailableMessage(activeSolarPath.event, activeSolarPath.reason)}
            </div>
        {:else if selectedEvent !== 'all' && activeSolarPath?.status === 'ok'}
            <div class="event-summary">
                <div>
                    <span class="control-label">{eventDisplayName(selectedEvent)}时间</span>
                    <strong>{formatLocalDateTime(activeSolarPath.eventTime, timeZone)}</strong>
                </div>
                <div class="event-summary__meta">
                    <span>{timeZone}</span>
                    {#if elevationM > 0}
                        <span>海拔 {Math.round(elevationM)} m</span>
                    {/if}
                </div>
            </div>

            <div class="sample-list" aria-label={`${eventDisplayName(selectedEvent)}方向线数据`}>
                {#each activeSolarPath.samples as sample}
                    <div class="sample-row">
                        <span
                            class="line-swatch"
                            style={`--line-color: ${lineColorForEvent(selectedEvent, sample.kind)}`}
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

    <section class="map-bottom-module" aria-label="Sun Position 风格日月面板">
        <nav class="summary-tabs" role="tablist" aria-label="日月信息视图">
            <button type="button" class:active={summaryTab === 'diagram'} on:click={() => (summaryTab = 'diagram')}>事件</button>
            <button type="button" class:active={summaryTab === 'current'} on:click={() => (summaryTab = 'current')}>当前</button>
            <button type="button" class:active={summaryTab === 'about'} on:click={() => (summaryTab = 'about')}>说明</button>
        </nav>

        {#if summaryTab === 'diagram'}
            <section class="astronomy-panel" aria-label="今日天文时段">
                <div class="astronomy-panel__heading">
                    <div class="astronomy-panel__lead">
                        <strong>{timelineLeadText}</strong>
                        <span>现在 {formatLocalClock(currentInstant, timeZone)}</span>
                    </div>
                    <div class="orbit-badge orbit-badge--moon">
                        <svg class="orbit-moon" viewBox="0 0 48 48" aria-label="当前月相" role="img">
                            <circle cx="24" cy="24" r="18" fill="#f5efcf"></circle>
                            <circle
                                class="orbit-moon__shadow"
                                cx={moonShadowCenterValue}
                                cy="24"
                                r="18"
                            ></circle>
                        </svg>
                        <span class="orbit-badge__caption">{moonPhaseLabelText}</span>
                    </div>
                </div>

                <div class="timeline-events" aria-label="今日天文事件">
                    {#each astronomyTimeline?.items || [] as item}
                        <div
                            class:item-moon={item.body === 'moon'}
                            class:item-blue-hour={item.kind === 'dawn' || item.kind === 'dusk'}
                            class:timeline-event--missing={!item.time}
                            class="timeline-event"
                        >
                            <span class="timeline-event__label">{timelineEventLabel(item)}</span>
                            <strong>{item.time ? formatLocalClock(item.time, timeZone) : '--:--'}</strong>
                        </div>
                    {/each}
                </div>

                <div class="night-window-list" aria-label="夜间观测时段">
                    {#each displayAstronomyIntervals as interval}
                        <article class:night-window--milky-way={interval.kind === 'milky-way'} class="night-window">
                            <div class="night-window__body">
                                <strong>{interval.label}</strong>
                                <span>{formatInterval(interval)} · {formatIntervalDuration(interval)}</span>
                            </div>
                        </article>
                    {/each}
                    {#if astronomyTimeline && displayAstronomyIntervals.length === 0}
                        <p class="night-window-list__empty">当天没有满足条件的无月黑夜或银河时刻。</p>
                    {/if}
                </div>
            </section>
        {:else if summaryTab === 'current'}
            <section class="position-cards" aria-label="实时日月位置">
                <article class="position-card position-card--sun">
                    <div class="position-card__heading">
                        <span class="celestial-symbol celestial-symbol--sun" aria-hidden="true">☀</span>
                        <strong>太阳</strong>
                    </div>
                    {#if currentSolarDirection}
                        <div class="position-card__value">{Math.round(currentSolarDirection.azimuth)}° {compassDirection(currentSolarDirection.azimuth)}</div>
                        <div class="position-card__meta">高度角 {currentSolarDirection.altitude.toFixed(1)}° · {currentSolarDirection.altitude >= 0 ? 'Daytime' : 'Nighttime'}</div>
                    {:else}
                        <div class="position-card__value">--</div>
                    {/if}
                    <div class="position-card__events">
                        <span>日出 {eventDisplayData.sunrise.time}</span>
                        <span>{eventDisplayData.sunrise.azimuth}</span>
                        <span>日落 {eventDisplayData.sunset.time}</span>
                        <span>{eventDisplayData.sunset.azimuth}</span>
                    </div>
                </article>

                <article class="position-card position-card--moon">
                    <div class="position-card__heading">
                        <span class="celestial-symbol celestial-symbol--moon" aria-hidden="true">◐</span>
                        <strong>月亮</strong>
                    </div>
                    {#if currentMoonInfo}
                        <div class="position-card__value">{Math.round(currentMoonInfo.azimuth)}° {compassDirection(currentMoonInfo.azimuth)}</div>
                        <div class="position-card__meta">高度角 {currentMoonInfo.altitude.toFixed(1)}° · {moonPhaseName(currentMoonInfo.phase)} · {Math.round(currentMoonInfo.illuminationFraction * 100)}%</div>
                    {:else}
                        <div class="position-card__value">--</div>
                    {/if}
                    <div class="position-card__events">
                        <span>月升 {eventDisplayData.moonrise.time}</span>
                        <span>{eventDisplayData.moonrise.azimuth}</span>
                        <span>月落 {eventDisplayData.moonset.time}</span>
                        <span>{eventDisplayData.moonset.azimuth}</span>
                    </div>
                </article>
            </section>
        {:else}
            <section class="module-about" aria-label="数据说明">
                <div class="module-about__title">方向线与时间轴</div>
                <p>太阳事件线使用实线，月升/月落事件线使用虚线。每个事件包含前 30 分钟、事件时刻和后 30 分钟三个方位。</p>
                <div class="sun-path-legend sun-path-legend--module" aria-label="地图图例">
                    <div class="sun-path-legend__title">地图图例</div>
                    <div class="sun-path-legend__items">
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
                    <div class="sun-path-legend__items sun-path-legend__items--lines">
                        <span class="legend-item">
                            <span class="legend-line legend-line--before" aria-hidden="true"></span>
                            太阳前 30 分钟
                        </span>
                        <span class="legend-item">
                            <span class="legend-line legend-line--event" aria-hidden="true"></span>
                            太阳事件时刻
                        </span>
                        <span class="legend-item">
                            <span class="legend-line legend-line--after" aria-hidden="true"></span>
                            太阳后 30 分钟
                        </span>
                        <span class="legend-item">
                            <span class="legend-line legend-line--moon-before" aria-hidden="true"></span>
                            月亮前 30 分钟
                        </span>
                        <span class="legend-item">
                            <span class="legend-line legend-line--moon-event" aria-hidden="true"></span>
                            月亮事件时刻
                        </span>
                        <span class="legend-item">
                            <span class="legend-line legend-line--moon-after" aria-hidden="true"></span>
                            月亮后 30 分钟
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
            </section>
        {/if}
    </section>

    <p class="panel-note">
        方向线表示天文方位，不代表山体、建筑或云层遮挡条件下的实际可见性。关闭面板后，方向线会保留在地图上；重新打开插件时会接管并更新同一组图层。
    </p>
    </div>
</section>

<script lang="ts">
    import bcast from '@windy/broadcast';
    import { getElevation, getTimezoneInfo } from '@windy/fetch';
    import { getMyLatestPos } from '@windy/geolocation';
    import { centerMap, map } from '@windy/map';
    import { isMobileOrTablet } from '@windy/rootScope';
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
        MOON_LINE_COLORS,
        moonPhaseName,
        splitPolylineAtDateLine,
        coordinatesFromLocation,
        type AstronomyInterval,
        type AstronomyTimeline,
        type Coordinates,
        type CurrentMoonInfo,
        type SolarDirection,
        type SolarEvent,
        type SolarPath,
        type SolarSampleKind,
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
    const GUANGZHOU: Coordinates = { lat: 23.05, lon: 113.37 };
    type DirectionEvent = SolarEvent | 'all';
    type SummaryTab = 'diagram' | 'current' | 'about';
    type EventDisplay = { time: string; azimuth: string };
    const celestialEvents: SolarEvent[] = ['sunrise', 'sunset', 'moonrise', 'moonset'];
    const eventOptions: { value: DirectionEvent; label: string }[] = [
        { value: 'all', label: '全部' },
        { value: 'sunrise', label: '日出' },
        { value: 'sunset', label: '日落' },
        { value: 'moonrise', label: '月升' },
        { value: 'moonset', label: '月落' },
    ];
    const EMPTY_EVENT_DISPLAY: Record<SolarEvent, EventDisplay> = {
        sunrise: { time: '--:--', azimuth: '--°' },
        sunset: { time: '--:--', azimuth: '--°' },
        moonrise: { time: '--:--', azimuth: '--°' },
        moonset: { time: '--:--', azimuth: '--°' },
    };
    const defaultLocation = (): Coordinates => {
        const latestPosition = getMyLatestPos();
        const latestCoordinates = coordinatesFromLocation(latestPosition);
        return latestCoordinates && latestPosition.source !== 'fallback' ? latestCoordinates : { ...GUANGZHOU };
    };

    let selectedLocation: Coordinates = {
        ...defaultLocation(),
    };
    let selectedDate = dateInputForInstant(new Date(), systemTimeZone);
    let selectedEvent: DirectionEvent = 'sunset';
    let timeZone = systemTimeZone;
    let elevationM = 0;
    let solarPaths: SolarPath[] = [];
    let activeSolarPath: SolarPath | null = null;
    let astronomyTimeline: AstronomyTimeline | null = null;
    let currentSolarDirection: SolarDirection | null = null;
    let currentMoonInfo: CurrentMoonInfo | null = null;
    let currentInstant = new Date();
    let timelineLeadText = '正在计算…';
    let moonPhaseLabelText = '月相计算中';
    let moonShadowCenterValue = 24;
    let summaryTab: SummaryTab = 'diagram';
    let eventDisplayData: Record<SolarEvent, EventDisplay> = { ...EMPTY_EVENT_DISPLAY };
    let displayAstronomyIntervals: AstronomyInterval[] = [];
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
        void refreshPaths(refreshKey);
    }

    $: activeSolarPath = selectedEvent === 'all'
        ? null
        : solarPaths.find(path => path.event === selectedEvent) || null;

    $: eventDisplayData = celestialEvents.reduce<Record<SolarEvent, EventDisplay>>((result, event) => {
        const path = solarPaths.find(candidate => candidate.event === event);
        if (path?.status === 'ok') {
            const eventSample = path.samples.find(sample => sample.kind === 'event');
            result[event] = {
                time: formatLocalClock(path.eventTime, timeZone),
                azimuth: eventSample ? `${Math.round(eventSample.azimuth)}° ${compassDirection(eventSample.azimuth)}` : '--°',
            };
        }
        return result;
    }, {
        sunrise: { ...EMPTY_EVENT_DISPLAY.sunrise },
        sunset: { ...EMPTY_EVENT_DISPLAY.sunset },
        moonrise: { ...EMPTY_EVENT_DISPLAY.moonrise },
        moonset: { ...EMPTY_EVENT_DISPLAY.moonset },
    });

    $: {
        const selectedDayReference = dateInputForInstant(currentInstant, timeZone) === selectedDate
            ? currentInstant.getTime()
            : dateInputToUtcNoon(selectedDate, timeZone).getTime();
        const preferredInterval = (kind: AstronomyInterval['kind']): AstronomyInterval | null => {
            const candidates = (astronomyTimeline?.intervals || []).filter(interval => interval.kind === kind);
            if (candidates.length === 0) {
                return null;
            }
            return candidates.find(interval =>
                interval.start.getTime() <= selectedDayReference && interval.end.getTime() >= selectedDayReference,
            ) || candidates.find(interval => interval.start.getTime() >= selectedDayReference) || candidates.at(-1) || null;
        };
        displayAstronomyIntervals = (['moonless-night', 'milky-way'] as const)
            .map(preferredInterval)
            .filter((interval): interval is AstronomyInterval => interval !== null);
    }

    $: if (isMounted) {
        setUrl(name, { lat: selectedLocation.lat, lon: selectedLocation.lon });
    }

    const eventDisplayName = (event: DirectionEvent): string => {
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

    const makeRefreshKey = (location: Coordinates, dateInput: string, event: DirectionEvent): string =>
        `${dateInput}|${event}|${location.lat}|${location.lon}`;

    const lineColorForEvent = (event: DirectionEvent, kind: SolarSampleKind): string =>
        event === 'moonrise' || event === 'moonset' ? MOON_LINE_COLORS[kind] : LINE_COLORS[kind];

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

    const drawMapFeatures = (paths: SolarPath[]) => {
        removeMapFeatures();

        const availablePaths = paths.filter(
            (path): path is Extract<SolarPath, { status: 'ok' }> => path.status === 'ok',
        );
        if (availablePaths.length === 0) {
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

        for (const path of availablePaths) {
            const isMoonEvent = path.event === 'moonrise' || path.event === 'moonset';
            for (const sample of path.samples) {
                const pathSegments = splitPolylineAtDateLine([
                    selectedLocation,
                    sample.point200,
                    sample.point400,
                ]);
                for (const segment of pathSegments) {
                    const line = new L.Polyline(segment.map(toLatLng), {
                        color: lineColorForEvent(path.event, sample.kind),
                        weight: 3,
                        opacity: isMoonEvent ? 0.82 : 0.95,
                        lineCap: 'round',
                        lineJoin: 'round',
                        ...(isMoonEvent ? { dashArray: '9 6' } : {}),
                    }).addTo(layerGroup);
                    lines.push(line);
                }

                const innerMarker = new L.Marker(toLatLng(sample.point200), {
                    icon: markerIcon('inner'),
                }).addTo(layerGroup);
                innerMarker.bindTooltip(`${eventDisplayName(path.event)} · ${sample.label} · 200 km`, { direction: 'top', offset: [0, -6] });
                markers.push(innerMarker);

                const outerMarker = new L.Marker(toLatLng(sample.point400), {
                    icon: markerIcon('outer'),
                }).addTo(layerGroup);
                outerMarker.bindTooltip(`${eventDisplayName(path.event)} · ${sample.label} · 400 km`, { direction: 'top', offset: [0, -6] });
                markers.push(outerMarker);
            }
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

    const refreshPaths = async (key: string) => {
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

            const nextPaths = celestialEvents.map(eventName => {
                const eventDate = eventName === 'moonrise' || eventName === 'moonset'
                    ? dateInputToUtcMidnight(dateInput, context.timeZone)
                    : dateInputToUtcNoon(dateInput, context.timeZone);
                return calculateSolarPath({
                    date: eventDate,
                    dateInput,
                    timeZone: context.timeZone,
                    location,
                    event: eventName,
                    elevationM: context.elevationM,
                });
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

            solarPaths = nextPaths;
            astronomyTimeline = nextTimeline;
            const selectedPaths = event === 'all'
                ? nextPaths
                : nextPaths.filter(path => path.event === event);
            status = selectedPaths.some(path => path.status === 'ok') ? 'ready' : 'empty';
            drawMapFeatures(selectedPaths);
        } catch (error) {
            if (requestId !== latestRequestId || key !== refreshKey) {
                return;
            }

            status = 'error';
            solarPaths = [];
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

    const setLocation = (latLon: LatLon, reopenWhenClosed = true) => {
        const nextLocation = coordinatesFromLocation(latLon);
        if (!nextLocation) {
            return;
        }

        selectedLocation = nextLocation;
        const nextKey = makeRefreshKey(nextLocation, selectedDate, selectedEvent);
        refreshKey = nextKey;

        if (isMounted) {
            return;
        }

        setUrl(name, nextLocation);
        void refreshPaths(nextKey);
        if (reopenWhenClosed) {
            bcast.emit('rqstOpen', name, nextLocation);
        }
    };

    const timelineEventLabel = (item: { kind: string; label: string }): string =>
        item.kind === 'dawn' || item.kind === 'dusk' ? '蓝调' : item.label;

    const formatInterval = (interval: AstronomyInterval): string =>
        `${formatLocalClock(interval.start, timeZone)} ~ ${formatLocalClock(interval.end, timeZone)}`;

    const formatIntervalDuration = (interval: AstronomyInterval): string =>
        formatRemaining(interval.end.getTime() - interval.start.getTime());

    const formatRemaining = (milliseconds: number): string => {
        const totalMinutes = Math.max(1, Math.round(milliseconds / 60_000));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return hours > 0 ? `${hours}小时${minutes}分钟` : `${minutes}分钟`;
    };

    $: moonPhaseLabelText = astronomyTimeline
        ? moonPhaseName(astronomyTimeline.moonIllumination.phase)
        : currentMoonInfo
            ? moonPhaseName(currentMoonInfo.phase)
            : '月相计算中';

    $: moonShadowCenterValue = (() => {
        const fraction = astronomyTimeline?.moonIllumination.fraction ?? currentMoonInfo?.illuminationFraction ?? 0;
        const waxing = astronomyTimeline?.moonIllumination.waxing ?? currentMoonInfo?.waxing ?? true;
        return 24 + (waxing ? -1 : 1) * fraction * 36;
    })();

    $: timelineLeadText = (() => {
        if (!astronomyTimeline) {
            return '正在计算…';
        }
        const next = astronomyTimeline.items.find(item => item.time && item.time.getTime() > currentInstant.getTime());
        if (!next?.time) {
            return '今日天文时段已结束';
        }
        return `距离${timelineEventLabel(next)}开始还有 ${formatRemaining(next.time.getTime() - currentInstant.getTime())}`;
    })();

    export const onopen = (params?: LatLon) => {
        const nextLocation = params ? coordinatesFromLocation(params) || { ...GUANGZHOU } : defaultLocation();
        setLocation(nextLocation, false);
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
        max-width: none;
        max-height: 100%;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 12px 16px calc(20px + env(safe-area-inset-bottom, 0px));
        color: var(--panel-text);
        background: var(--panel-bg);
        font-size: 14px;
        line-height: 1.5;
    }

    .mobile-scroll-content {
        width: 100%;
    }

    :global(.plugin-mobile-bottom-small#plugin-windy-plugin-sun-path) {
        width: 100%;
        height: min(575px, 72vh);
        max-height: min(575px, 72vh);
        padding: 0;
        margin: 0;
    }

    .sun-path-panel.mobile_ui {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 0;
        height: min(575px, 72vh);
        max-height: min(575px, 72vh);
        height: min(575px, 72dvh);
        max-height: min(575px, 72dvh);
        margin-top: -4pt;
        padding: 0;
        overflow: hidden;
    }

    .sun-path-panel.mobile_ui .mobile-scroll-content {
        box-sizing: border-box;
        width: 100%;
        height: 0;
        min-height: 0;
        flex: 1 1 auto;
        overflow-x: hidden;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior-y: contain;
        touch-action: pan-y;
        padding: 10px 12px calc(150px + env(safe-area-inset-bottom, 0px));
    }

    .sun-path-panel.mobile_ui .panel-intro,
    .sun-path-panel.mobile_ui .location-summary,
    .sun-path-panel.mobile_ui .panel-note {
        display: none;
    }

    .sun-path-panel.mobile_ui .control-grid {
        order: -2;
        grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.5fr);
        gap: 6px;
        margin: 0 0 6px;
    }

    .sun-path-panel.mobile_ui .control-field > .control-label,
    .sun-path-panel.mobile_ui .event-selector > .control-label {
        display: none;
    }

    .sun-path-panel.mobile_ui .status-region--event-details {
        display: none;
    }

    .sun-path-panel.mobile_ui .map-bottom-module {
        order: -1;
        margin-top: 0;
        margin-bottom: 8px;
    }

    .sun-path-panel.mobile_ui .summary-tabs button {
        min-height: 44px;
        padding: 0 5px;
    }

    .sun-path-panel.mobile_ui .module-about {
        padding: 10px;
    }

    .sun-path-panel.mobile_ui .position-cards {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 4px;
        padding: 4px;
    }

    .sun-path-panel.mobile_ui .position-card {
        padding: 6px;
    }

    .sun-path-panel.mobile_ui .position-card__heading {
        gap: 5px;
    }

    .sun-path-panel.mobile_ui .position-card__heading strong {
        font-size: 12px;
    }

    .sun-path-panel.mobile_ui .position-card__value {
        margin-top: 6px;
        font-size: 15px;
    }

    .sun-path-panel.mobile_ui .position-card__meta {
        min-height: 0;
        font-size: 10px;
        line-height: 1.35;
    }

    .sun-path-panel.mobile_ui .position-card__events {
        display: none;
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

    .sun-path-panel.mobile_ui > .panel-title {
        flex: 0 0 46px;
        justify-content: space-between;
        min-height: 46px;
        margin: 0;
        padding: 0 16px 0 18px;
        border-bottom: 1px solid var(--panel-border);
        background: var(--panel-bg) !important;
    }

    .sun-path-panel.mobile_ui > .panel-title > span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .panel-close {
        display: grid;
        flex: 0 0 36px;
        place-items: center;
        width: 36px;
        height: 36px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        color: var(--panel-muted);
        background: transparent;
        font: inherit;
        font-size: 28px;
        line-height: 1;
        cursor: pointer;
    }

    .panel-close:hover {
        color: var(--panel-text);
        background: var(--panel-surface-hover);
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
        margin: 8px 0 12px;
        padding: 10px;
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
        gap: 8px;
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
        min-width: 0;
        max-width: 100%;
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
        grid-template-columns: repeat(5, minmax(0, 1fr));
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
        gap: 8px;
        margin-top: 12px;
        padding: 10px 0;
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
        min-height: 32px;
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
        margin-top: 8px;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        overflow: hidden;
    }

    .sample-row {
        display: grid;
        grid-template-columns: 8px minmax(0, 1fr) auto;
        gap: 5px 10px;
        align-items: center;
        padding: 8px 10px;
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

    .legend-line--moon-before {
        background: #b9a5ff;
        background-image: linear-gradient(90deg, #b9a5ff 0 55%, transparent 55% 100%);
        background-size: 8px 3px;
    }

    .legend-line--moon-event {
        background: #5c91ff;
        background-image: linear-gradient(90deg, #5c91ff 0 55%, transparent 55% 100%);
        background-size: 8px 3px;
    }

    .legend-line--moon-after {
        background: #294da8;
        background-image: linear-gradient(90deg, #294da8 0 55%, transparent 55% 100%);
        background-size: 8px 3px;
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

    .map-bottom-module {
        flex: 0 0 auto;
        margin-top: 18px;
        overflow: hidden;
        border: 1px solid var(--panel-border);
        border-radius: 8px;
        background: rgba(5, 10, 20, 0.38);
    }

    .summary-tabs {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        border-bottom: 1px solid var(--panel-border);
        background: rgba(255, 255, 255, 0.04);
    }

    .summary-tabs button {
        min-height: 44px;
        padding: 8px 5px;
        border: 0;
        border-bottom: 2px solid transparent;
        color: var(--panel-muted);
        background: transparent;
        font: inherit;
        cursor: pointer;
    }

    .summary-tabs button + button {
        border-left: 1px solid rgba(255, 255, 255, 0.08);
    }

    .summary-tabs button:hover,
    .summary-tabs button.active {
        color: var(--panel-text);
        background: rgba(99, 185, 238, 0.14);
    }

    .summary-tabs button.active {
        border-bottom-color: var(--panel-accent);
    }

    .astronomy-panel {
        --astronomy-bg: #1d263d;
        --astronomy-muted: #a8b1c1;
        --astronomy-text: #f2f4fa;
        --astronomy-sun: #ff9138;
        --astronomy-moon: #4e91ed;
        --astronomy-blue-hour: #c4b5fd;

        padding: 8px 8px 10px;
        color: var(--astronomy-text);
        background: var(--astronomy-bg);
    }

    .astronomy-panel__heading {
        position: relative;
        min-height: 44px;
    }

    .astronomy-panel__lead {
        min-width: 0;
        padding: 0 48px;
        text-align: center;
    }

    .astronomy-panel__lead strong {
        display: block;
        margin-top: 2px;
        overflow-wrap: anywhere;
        color: var(--astronomy-text);
        font-size: 14px;
    }

    .astronomy-panel__lead strong::first-letter {
        color: var(--astronomy-text);
    }

    .astronomy-panel__lead > span {
        display: block;
        margin-top: 2px;
        color: var(--astronomy-muted);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
    }

    .orbit-badge {
        display: grid;
        justify-items: center;
        gap: 2px;
        color: var(--astronomy-muted);
        font-size: 9px;
        text-align: center;
    }

    .orbit-moon {
        display: block;
        width: 40px;
        height: 40px;
        border-radius: 50%;
    }

    .orbit-moon {
        overflow: hidden;
        background: #182033;
    }

    .orbit-badge--moon {
        position: absolute;
        top: 0;
        right: 0;
    }

    .orbit-moon__shadow {
        fill: #111727;
    }

    .orbit-badge__caption {
        max-width: 64px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .timeline-events {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 0;
        margin-top: 8px;
        padding: 7px 0 6px;
        border-top: 1px solid rgba(255, 255, 255, 0.12);
        border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    }

    .timeline-event {
        min-width: 0;
        padding: 0 2px;
        color: var(--astronomy-muted);
        font-size: 11px;
        line-height: 1.2;
        text-align: center;
    }

    .timeline-event__label {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .timeline-event strong {
        display: block;
        margin-top: 3px;
        color: var(--astronomy-text);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
    }

    .timeline-event:not(.item-moon) .timeline-event__label,
    .timeline-event:not(.item-moon) strong {
        color: var(--astronomy-sun);
    }

    .timeline-event.item-blue-hour .timeline-event__label,
    .timeline-event.item-blue-hour strong {
        color: var(--astronomy-blue-hour);
    }

    .timeline-event.item-moon .timeline-event__label {
        color: #91bfff;
    }

    .timeline-event.item-moon strong {
        color: #91bfff;
    }

    .timeline-event--missing {
        opacity: 0.55;
    }

    .position-cards {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        padding: 8px;
    }

    .position-card {
        min-width: 0;
        padding: 10px;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        background: var(--panel-surface);
    }

    .position-card__heading {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .position-card__heading strong {
        display: block;
        margin-top: 2px;
        color: var(--panel-text);
        font-size: 13px;
    }

    .position-card__value {
        margin-top: 12px;
        color: #ffffff;
        font-size: 18px;
        font-variant-numeric: tabular-nums;
        font-weight: 700;
    }

    .position-card__meta {
        min-height: 34px;
        margin-top: 4px;
        color: var(--panel-muted);
        font-size: 11px;
        line-height: 1.55;
    }

    .position-card__events {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 5px 8px;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid var(--panel-border);
        color: var(--panel-muted);
        font-size: 11px;
        font-variant-numeric: tabular-nums;
    }

    .position-card__events span:nth-child(even) {
        color: var(--panel-text);
        text-align: right;
    }

    .night-window-list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
        margin-top: 8px;
    }

    .night-window {
        min-width: 0;
        padding: 8px 10px;
        border: 1px solid rgba(115, 143, 214, 0.32);
        border-radius: 6px;
        background: rgba(11, 18, 43, 0.72);
    }

    .night-window--milky-way {
        border-color: rgba(143, 118, 219, 0.42);
        background: rgba(29, 22, 63, 0.72);
    }

    .night-window__body {
        display: grid;
        gap: 2px;
        min-width: 0;
    }

    .night-window__body strong {
        overflow: hidden;
        color: var(--astronomy-text);
        font-size: 12px;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .night-window__body span {
        overflow: hidden;
        color: var(--astronomy-muted);
        font-size: 10px;
        font-variant-numeric: tabular-nums;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .night-window-list__empty {
        grid-column: 1 / -1;
        margin: 0;
        color: var(--astronomy-muted);
        font-size: 12px;
    }

    .module-about {
        padding: 14px;
        color: var(--panel-muted);
        background: rgba(0, 0, 0, 0.14);
        font-size: 12px;
    }

    .module-about__title {
        margin-bottom: 6px;
        color: var(--panel-text);
        font-weight: 600;
    }

    .module-about p {
        margin: 6px 0 0;
    }

    .sun-path-legend {
        margin-top: 12px;
        padding: 10px;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        background: var(--panel-bg) !important;
        color: var(--panel-text) !important;
    }

    .sun-path-legend--module {
        margin: 0;
        border: 0;
        border-radius: 0;
        background: transparent !important;
    }

    .sun-path-legend__title {
        margin-bottom: 8px;
        color: var(--panel-text) !important;
        font-weight: 600;
    }

    .sun-path-legend__items {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 14px;
    }

    .sun-path-legend__items--lines {
        margin-top: 8px;
    }

    .sun-path-legend .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--panel-muted) !important;
        white-space: nowrap;
    }

    .panel-note {
        margin-top: 12px;
        font-size: 12px;
    }

    @media (max-width: 520px) {
        .sun-path-panel {
            display: flex;
            flex-direction: column;
            max-width: none;
            padding-right: 14px;
            padding-left: 14px;
        }

        .map-bottom-module {
            order: -1;
            margin-top: 0;
            margin-bottom: 16px;
        }

        .sun-path-panel.mobile_ui .control-grid {
            grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.5fr);
        }

        .segmented-control--events {
            grid-template-columns: repeat(5, minmax(0, 1fr));
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
            grid-template-columns: repeat(6, minmax(0, 1fr));
            margin-top: 6px;
        }

        .timeline-event {
            padding: 0 1px;
            font-size: 10px;
        }

        .timeline-event strong {
            font-size: 11px;
        }

        .celestial-grid {
            grid-template-columns: 1fr;
        }

        .astronomy-panel {
            padding-right: 10px;
            padding-left: 10px;
        }

        .astronomy-panel__lead {
            padding-right: 48px;
            padding-left: 48px;
        }

        .orbit-moon {
            width: 40px;
            height: 40px;
        }

        .position-cards {
            grid-template-columns: 1fr;
        }

        .night-window-list {
            grid-template-columns: 1fr;
        }
    }

    @media (max-width: 360px) {
        .sun-path-panel.mobile_ui .control-grid {
            gap: 6px;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .segmented-control button,
        .text-button {
            transition: none;
        }
    }
</style>

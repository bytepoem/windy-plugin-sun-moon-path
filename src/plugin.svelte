<section
    class="sun-path-panel"
    class:plugin__content={!isMobileOrTablet}
    class:mobile_ui={isMobileOrTablet}
>
    {#if !isMobileOrTablet}
        <div
            class="plugin__title plugin__title--chevron-back panel-title"
            on:click={() => bcast.emit('rqstOpen', 'menu')}
        >
            {title}
        </div>
    {/if}

    <div class="mobile-scroll-content">
    <div class="panel-intro">
        <p>{text.panelIntro}</p>
    </div>

    <div class="control-grid">
        <label class="control-field">
            <span class="control-label">{text.dateLabel}</span>
            <span class="date-control">
                <span class="date-control__text">{formatDateControlLabel(selectedDate)}</span>
                <input type="date" bind:value={selectedDate} aria-label={text.dateLabel} />
            </span>
        </label>

        <fieldset class="event-selector">
            <legend class="control-label">{text.eventSelectorLabel}</legend>
            <div class="segmented-control segmented-control--events" role="group" aria-label={text.eventSelectorLabel}>
                {#each eventOptions as option}
                    <button
                        type="button"
                        class:active={selectedEvent === option.value}
                        aria-pressed={selectedEvent === option.value}
                        aria-label={text.events[option.value]}
                        on:click={() => (selectedEvent = option.value)}
                    >
                        {#if option.value === 'all'}
                            <span class="event-button__text">{text.events.all}</span>
                        {:else}
                            <span
                                class:event-button__icon--moon={option.value === 'moonrise' || option.value === 'moonset'}
                                class:event-button__icon--sun={option.value === 'sunrise' || option.value === 'sunset'}
                                class="event-button__icon"
                                aria-hidden="true"
                            >
                                {#if option.value === 'sunrise' || option.value === 'sunset'}
                                    <svg viewBox="0 0 24 24" focusable="false">
                                        <circle cx="12" cy="12" r="4.2"></circle>
                                        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"></path>
                                    </svg>
                                {:else}
                                    <svg viewBox="0 0 24 24" focusable="false">
                                        <path d="M19.6 15.2A8.4 8.4 0 0 1 8.8 4.4A8.6 8.6 0 1 0 19.6 15.2Z"></path>
                                    </svg>
                                {/if}
                            </span>
                            <span
                                class:event-button__arrow--down={option.value === 'sunset' || option.value === 'moonset'}
                                class="event-button__arrow"
                                aria-hidden="true"
                            >
                                <svg viewBox="0 0 16 16" focusable="false">
                                    <path d="M8 13V3M4.2 6.8 8 3l3.8 3.8"></path>
                                </svg>
                            </span>
                        {/if}
                    </button>
                {/each}
            </div>
        </fieldset>

        <button
            type="button"
            class="language-toggle"
            aria-label={text.languageToggleLabel}
            on:click={toggleLanguage}
        >
            <span class="language-toggle__option" class:active={uiLanguage === 'zh'}>中</span>
            <span class="language-toggle__option" class:active={uiLanguage === 'en'}>EN</span>
        </button>
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
                    {text.retry}
                </button>
            </div>
        {:else if selectedEvent !== 'all' && activeSolarPath?.status === 'unavailable'}
            <div class="status-message status-message--muted">
                {unavailableMessage(activeSolarPath.event, activeSolarPath.reason)}
            </div>
        {:else if selectedEvent !== 'all' && activeSolarPath?.status === 'ok'}
            <div class="event-summary">
                <div>
                    <span class="control-label">{eventDisplayName(selectedEvent, text)}{text.eventTimeSuffix}</span>
                    <strong>{formatLocalDateTime(activeSolarPath.eventTime, timeZone)}</strong>
                </div>
                <div class="event-summary__meta">
                    <span>{timeZone}</span>
                    {#if elevationM > 0}
                        <span>海拔 {Math.round(elevationM)} m</span>
                    {/if}
                </div>
            </div>

            <div class="sample-list" aria-label={`${eventDisplayName(selectedEvent, text)}方向线数据`}>
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
                            {Math.round(sample.azimuth)}° {compassDirectionLabel(sample.azimuth, uiLanguage)}
                        </span>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <section class="map-bottom-module" aria-label="Sun Position 风格日月面板">
        <nav class="summary-tabs" role="tablist" aria-label="日月信息视图">
            <button type="button" class:active={summaryTab === 'diagram'} on:click={() => (summaryTab = 'diagram')}>{text.eventTab}</button>
            <button type="button" class:active={summaryTab === 'about'} on:click={() => (summaryTab = 'about')}>{text.aboutTab}</button>
        </nav>

        <div class="summary-panel-frame">
            {#if summaryTab === 'diagram'}
                <section class="astronomy-panel" aria-label="今日天文时段">
                    <div class="astronomy-panel__heading">
                        <div class="astronomy-panel__lead">
                            <strong>
                                <span>{timelineLeadLabel}</span>
                                {#if timelineLeadTime}
                                    <span>{timelineLeadTime}</span>
                                {/if}
                            </strong>
                        </div>
                        <div class="live-positions" aria-label={text.currentDirectionsLabel}>
                            <div class="live-position live-position--sun" aria-label={text.sun}>
                                <span class="live-position__icon live-position__icon--sun" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" focusable="false">
                                        <circle cx="12" cy="12" r="4.2"></circle>
                                        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"></path>
                                    </svg>
                                </span>
                                {#if currentSolarDirection}
                                    <strong>{Math.round(currentSolarDirection.azimuth)}° {compassDirectionLabel(currentSolarDirection.azimuth, uiLanguage)}</strong>
                                    <em class="live-position__metric">
                                        <span>{text.altitude} {currentSolarDirection.altitude.toFixed(1)}°</span>
                                        <span class="live-position__event-azimuths">
                                            {#if sunriseAzimuthLabel}
                                                <span>↑{sunriseAzimuthLabel}</span>
                                            {/if}
                                            {#if sunsetAzimuthLabel}
                                                <span>↓{sunsetAzimuthLabel}</span>
                                            {/if}
                                        </span>
                                    </em>
                                {:else}
                                    <strong>--</strong>
                                {/if}
                            </div>
                            <div class="live-position live-position--moon" aria-label={text.moon}>
                                <span class="live-position__icon live-position__icon--moon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" focusable="false">
                                        <path d="M19.6 15.2A8.4 8.4 0 0 1 8.8 4.4A8.6 8.6 0 1 0 19.6 15.2Z"></path>
                                    </svg>
                                </span>
                                {#if currentMoonInfo}
                                    <strong>{Math.round(currentMoonInfo.azimuth)}° {compassDirectionLabel(currentMoonInfo.azimuth, uiLanguage)}</strong>
                                    <em class="live-position__metric">
                                        <span>{text.altitude} {currentMoonInfo.altitude.toFixed(1)}°</span>
                                        <span class="live-position__event-azimuths">
                                            {#if moonriseAzimuthLabel}
                                                <span>↑{moonriseAzimuthLabel}</span>
                                            {/if}
                                            {#if moonsetAzimuthLabel}
                                                <span>↓{moonsetAzimuthLabel}</span>
                                            {/if}
                                        </span>
                                    </em>
                                {:else}
                                    <strong>--</strong>
                                {/if}
                            </div>
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
                            {#if moonIlluminationPercentText}
                                <span class="orbit-badge__percent">{moonIlluminationPercentText}</span>
                            {/if}
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
                                <span class="timeline-event__label">{timelineEventLabel(item, text)}</span>
                                <strong>{item.time ? formatLocalClock(item.time, timeZone) : '--:--'}</strong>
                            </div>
                        {/each}
                    </div>

                    <div class="night-window-list" aria-label="夜间观测时段">
                        {#each displayAstronomyIntervals as interval}
                            <article class:night-window--milky-way={interval.kind === 'milky-way'} class="night-window">
                                <div class="night-window__body">
                                    <strong>{intervalDisplayLabel(interval, text)}</strong>
                                    <span>{formatInterval(interval)} · {formatIntervalDuration(interval, uiLanguage)}</span>
                                </div>
                            </article>
                        {/each}
                        {#if astronomyTimeline && displayAstronomyIntervals.length === 0}
                            <p class="night-window-list__empty">{text.noNightWindow}</p>
                        {/if}
                    </div>
                </section>
            {:else}
                <section class="module-about" aria-label="数据说明">
                    <p>{text.aboutDescription}</p>
                    <div class="sun-path-legend sun-path-legend--module" aria-label="地图图例">
                        <div class="sun-path-legend__items">
                            <span class="legend-item">
                                <span class="legend-dot legend-dot--origin" aria-hidden="true"></span>
                                {text.legend.origin}
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
                                {text.legend.sunBefore}
                            </span>
                            <span class="legend-item">
                                <span class="legend-line legend-line--event" aria-hidden="true"></span>
                                {text.legend.sunEvent}
                            </span>
                            <span class="legend-item">
                                <span class="legend-line legend-line--after" aria-hidden="true"></span>
                                {text.legend.sunAfter}
                            </span>
                            <span class="legend-item">
                                <span class="legend-line legend-line--moon-before" aria-hidden="true"></span>
                                {text.legend.moonBefore}
                            </span>
                            <span class="legend-item">
                                <span class="legend-line legend-line--moon-event" aria-hidden="true"></span>
                                {text.legend.moonEvent}
                            </span>
                            <span class="legend-item">
                                <span class="legend-line legend-line--moon-after" aria-hidden="true"></span>
                                {text.legend.moonAfter}
                            </span>
                            <span class="legend-item">
                                <span class="legend-line legend-line--current" aria-hidden="true"></span>
                                {text.legend.currentSun}
                            </span>
                            <span class="legend-item">
                                <span class="legend-line legend-line--moon" aria-hidden="true"></span>
                                {text.legend.currentMoon}
                            </span>
                        </div>
                    </div>
                </section>
            {/if}
        </div>
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
        addDaysToDateInput,
        dateInputForInstant,
        dateInputToUtcMidnight,
        dateInputToUtcNoon,
        formatLocalClock,
        formatLocalDateTime,
        LINE_COLORS,
        MOON_LINE_COLORS,
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
    type SummaryTab = 'diagram' | 'about';
    type UiLanguage = 'zh' | 'en';
    const celestialEvents: SolarEvent[] = ['sunrise', 'sunset', 'moonrise', 'moonset'];
    const eventOptions: { value: DirectionEvent }[] = [
        { value: 'all' },
        { value: 'sunrise' },
        { value: 'sunset' },
        { value: 'moonrise' },
        { value: 'moonset' },
    ];
    const translations: Record<UiLanguage, {
        dateLabel: string;
        eventSelectorLabel: string;
        languageToggleLabel: string;
        panelIntro: string;
        eventTab: string;
        aboutTab: string;
        retry: string;
        eventTimeSuffix: string;
        now: string;
        currentDirectionsLabel: string;
        sun: string;
        moon: string;
        altitude: string;
        calculating: string;
        noNightWindow: string;
        timelineEnded: string;
        timelinePrefix: string;
        timelineStartSuffix: string;
        moonPhaseLoading: string;
        aboutDescription: string;
        events: Record<DirectionEvent, string>;
        timeline: Record<string, string>;
        intervals: Record<AstronomyInterval['kind'], string>;
        legend: Record<string, string>;
        phases: string[];
    }> = {
        zh: {
            dateLabel: '观测日期',
            eventSelectorLabel: '选择日月事件',
            languageToggleLabel: '切换到英文',
            panelIntro: '日月关键时刻、事件前后 30 分钟方位线和夜间观测时段。',
            eventTab: '事件',
            aboutTab: '说明',
            retry: '重试',
            eventTimeSuffix: '时间',
            now: '现在',
            currentDirectionsLabel: '当前太阳和月亮方位',
            sun: '太阳',
            moon: '月亮',
            altitude: '∠',
            calculating: '正在计算…',
            noNightWindow: '当天没有满足条件的无月黑夜或银河时刻。',
            timelineEnded: '今日天文时段已结束',
            timelinePrefix: '距离',
            timelineStartSuffix: '开始还有',
            moonPhaseLoading: '月相计算中',
            aboutDescription: '太阳事件线使用实线，月升/月落事件线使用虚线。每个事件包含前 30 分钟、事件时刻和后 30 分钟三个方位。',
            events: {
                all: '全部',
                sunrise: '日出',
                sunset: '日落',
                moonrise: '月升',
                moonset: '月落',
            },
            timeline: {
                dawn: '蓝调',
                sunrise: '日出',
                sunset: '日落',
                moonrise: '月升',
                moonset: '月落',
            },
            intervals: {
                'moonless-night': '无月黑夜',
                'milky-way': '银河时刻',
            },
            legend: {
                origin: '用户位置',
                sunBefore: '太阳前 30 分钟',
                sunEvent: '太阳事件时刻',
                sunAfter: '太阳后 30 分钟',
                moonBefore: '月亮前 30 分钟',
                moonEvent: '月亮事件时刻',
                moonAfter: '月亮后 30 分钟',
                currentSun: '当前太阳方位',
                currentMoon: '当前月亮方位',
            },
            phases: ['新月', '娥眉月', '上弦月', '盈凸月', '满月', '亏凸月', '下弦月', '残月'],
        },
        en: {
            dateLabel: 'Date',
            eventSelectorLabel: 'Choose event',
            languageToggleLabel: 'Switch to Chinese',
            panelIntro: 'Key sun and moon times, direction lines 30 minutes before and after each event, and night observing windows.',
            eventTab: 'Events',
            aboutTab: 'About',
            retry: 'Retry',
            eventTimeSuffix: ' time',
            now: 'Now',
            currentDirectionsLabel: 'Current sun and moon directions',
            sun: 'Sun',
            moon: 'Moon',
            altitude: '∠',
            calculating: 'Calculating…',
            noNightWindow: 'No qualifying moonless night or Milky Way window today.',
            timelineEnded: 'Today’s astronomy windows have ended',
            timelinePrefix: '',
            timelineStartSuffix: 'starts in',
            moonPhaseLoading: 'Calculating phase',
            aboutDescription: 'Solar event lines are solid; moonrise and moonset lines are dashed. Each event includes directions 30 minutes before, at the event, and 30 minutes after.',
            events: {
                all: 'All',
                sunrise: 'Sunrise',
                sunset: 'Sunset',
                moonrise: 'Moonrise',
                moonset: 'Moonset',
            },
            timeline: {
                dawn: 'Blue',
                sunrise: 'Sunrise',
                sunset: 'Sunset',
                moonrise: 'Moonrise',
                moonset: 'Moonset',
            },
            intervals: {
                'moonless-night': 'Moonless night',
                'milky-way': 'Milky Way',
            },
            legend: {
                origin: 'Observer',
                sunBefore: 'Sun -30 min',
                sunEvent: 'Sun event',
                sunAfter: 'Sun +30 min',
                moonBefore: 'Moon -30 min',
                moonEvent: 'Moon event',
                moonAfter: 'Moon +30 min',
                currentSun: 'Current sun',
                currentMoon: 'Current moon',
            },
            phases: ['New', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full', 'Waning gibbous', 'Last quarter', 'Waning crescent'],
        },
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
    let uiLanguage: UiLanguage = 'zh';
    let text = translations.zh;
    let timeZone = systemTimeZone;
    let elevationM = 0;
    let solarPaths: SolarPath[] = [];
    let activeSolarPath: SolarPath | null = null;
    let astronomyTimeline: AstronomyTimeline | null = null;
    let currentSolarDirection: SolarDirection | null = null;
    let currentMoonInfo: CurrentMoonInfo | null = null;
    let currentInstant = new Date();
    let timelineLeadLabel = '正在计算…';
    let timelineLeadTime = '';
    let sunriseAzimuthLabel = '';
    let sunsetAzimuthLabel = '';
    let moonriseAzimuthLabel = '';
    let moonsetAzimuthLabel = '';
    let moonShadowCenterValue = 24;
    let summaryTab: SummaryTab = 'diagram';
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

    $: text = translations[uiLanguage];

    $: refreshKey = `${selectedDate}|${selectedEvent}|${selectedLocation.lat}|${selectedLocation.lon}`;

    $: if (isMounted && refreshKey) {
        void refreshPaths(refreshKey);
    }

    $: activeSolarPath = selectedEvent === 'all'
        ? null
        : solarPaths.find(path => path.event === selectedEvent) || null;

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

    const eventDisplayName = (event: DirectionEvent, labels = text): string => {
        return labels.events[event] || event;
    };

    const toggleLanguage = () => {
        uiLanguage = uiLanguage === 'zh' ? 'en' : 'zh';
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

    const compassDirectionLabel = (azimuth: number, language = uiLanguage): string => {
        if (language === 'zh') {
            return compassDirection(azimuth);
        }
        const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        return labels[Math.round(((azimuth % 360) + 360) % 360 / 45) % labels.length];
    };

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
                innerMarker.bindTooltip(`${eventDisplayName(path.event, text)} · ${sample.label} · 200 km`, { direction: 'top', offset: [0, -6] });
                markers.push(innerMarker);

                const outerMarker = new L.Marker(toLatLng(sample.point400), {
                    icon: markerIcon('outer'),
                }).addTo(layerGroup);
                outerMarker.bindTooltip(`${eventDisplayName(path.event, text)} · ${sample.label} · 400 km`, { direction: 'top', offset: [0, -6] });
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
        const nameForEvent = eventDisplayName(event, text);
        if (uiLanguage === 'en') {
            const body = event === 'moonrise' || event === 'moonset' ? 'moon' : 'sun';
            if (reason === 'always-up') {
                return `The ${body} stays above the horizon today; no ${nameForEvent} time is available.`;
            }
            if (reason === 'always-down') {
                return `The ${body} stays below the horizon today; no ${nameForEvent} time is available.`;
            }
            return `No ${nameForEvent} time is available today.`;
        }
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

    const timelineEventLabel = (item: { kind: string; label: string }, labels = text): string => {
        if (item.kind === 'dawn' || item.kind === 'dusk') {
            return labels.timeline.dawn;
        }
        return labels.timeline[item.kind] || item.label;
    };

    const eventAzimuthLabel = (paths: SolarPath[], event: SolarEvent): string => {
        const path = paths.find(
            (item): item is Extract<SolarPath, { status: 'ok' }> => item.event === event && item.status === 'ok',
        );
        const eventSample = path?.samples.find(sample => sample.kind === 'event');
        return eventSample ? `${Math.round(eventSample.azimuth)}°` : '';
    };

    $: sunriseAzimuthLabel = eventAzimuthLabel(solarPaths, 'sunrise');
    $: sunsetAzimuthLabel = eventAzimuthLabel(solarPaths, 'sunset');
    $: moonriseAzimuthLabel = eventAzimuthLabel(solarPaths, 'moonrise');
    $: moonsetAzimuthLabel = eventAzimuthLabel(solarPaths, 'moonset');

    const formatInterval = (interval: AstronomyInterval): string =>
        `${formatLocalClock(interval.start, timeZone)} ~ ${formatLocalClock(interval.end, timeZone)}`;

    const intervalDisplayLabel = (interval: AstronomyInterval, labels = text): string =>
        labels.intervals[interval.kind] || interval.label;

    const formatIntervalDuration = (interval: AstronomyInterval, language = uiLanguage): string =>
        formatRemaining(interval.end.getTime() - interval.start.getTime(), language);

    const formatDateControlLabel = (dateInput: string): string => {
        const [year, month, day] = dateInput.split('-').map(value => Number.parseInt(value, 10));
        return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
            ? `${month}/${day}`
            : dateInput;
    };

    const formatRemaining = (milliseconds: number, language = uiLanguage): string => {
        const totalMinutes = Math.max(1, Math.round(milliseconds / 60_000));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (language === 'en') {
            return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        }
        return hours > 0 ? `${hours}小时${minutes}分钟` : `${minutes}分钟`;
    };

    const formatCompactRemaining = (milliseconds: number, language = uiLanguage): string => {
        const totalMinutes = Math.max(1, Math.round(milliseconds / 60_000));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (language === 'en') {
            return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        }
        return hours > 0 ? `${hours}h${minutes}m` : `${minutes}m`;
    };

    $: moonIlluminationPercentText = (() => {
        const fraction = currentMoonInfo?.illuminationFraction ?? astronomyTimeline?.moonIllumination.fraction;
        return typeof fraction === 'number' && Number.isFinite(fraction)
            ? `${(fraction * 100).toFixed(1)}%`
            : '';
    })();

    $: moonShadowCenterValue = (() => {
        const fraction = currentMoonInfo?.illuminationFraction ?? astronomyTimeline?.moonIllumination.fraction ?? 0;
        const waxing = currentMoonInfo?.waxing ?? astronomyTimeline?.moonIllumination.waxing ?? true;
        return 24 + (waxing ? -1 : 1) * fraction * 36;
    })();

    const nextWindowParts = (item: { kind: string; label: string; time?: Date | null }, language = uiLanguage): { label: string; time: string } => {
        if (!item.time) {
            return { label: language === 'en' ? 'Ended' : '已结束', time: '' };
        }
        if (language === 'en') {
            return {
                label: 'Next',
                time: formatCompactRemaining(item.time.getTime() - currentInstant.getTime(), language),
            };
        }
        return {
            label: '倒计时',
            time: formatCompactRemaining(item.time.getTime() - currentInstant.getTime(), language),
        };
    };

    $: {
        if (!astronomyTimeline) {
            timelineLeadLabel = text.calculating;
            timelineLeadTime = '';
        } else {
            const next = astronomyTimeline.items.find(item => item.time && item.time.getTime() > currentInstant.getTime());
            const nextDayTimeline = next
                ? null
                : calculateAstronomyTimeline({
                    dateInput: addDaysToDateInput(selectedDate, 1),
                    timeZone,
                    location: selectedLocation,
                    elevationM,
                });
            const nextItem = next || nextDayTimeline?.items.find(item => item.time);
            const parts = nextItem?.time
                ? nextWindowParts(nextItem, uiLanguage)
                : { label: uiLanguage === 'en' ? 'Ended' : '已结束', time: '' };
            timelineLeadLabel = parts.label;
            timelineLeadTime = parts.time;
        }
    }

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
        --summary-panel-height: 150px;

        box-sizing: border-box;
        width: 100%;
        max-width: none;
        max-height: 100%;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 10px 12px calc(12px + env(safe-area-inset-bottom, 0px));
        color: var(--panel-text);
        background: var(--panel-bg);
        font-size: 14px;
        line-height: 1.5;
    }

    .mobile-scroll-content {
        width: 100%;
    }

    :global(.plugin-mobile-bottom-small#plugin-windy-plugin-sun-path) {
        height: fit-content !important;
        max-height: min(430px, 52vh) !important;
        max-height: min(430px, 52dvh) !important;
        min-height: 0;
        padding: 0;
        margin: 0;
        overflow: visible !important;
    }

    :global(#plugin-windy-plugin-sun-path.plugin-mobile-bottom-small > .closing-x) {
        z-index: 1000 !important;
        pointer-events: auto;
    }

    .sun-path-panel.mobile_ui {
        --summary-panel-height: clamp(144px, 16.5svh, 150px);

        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 0;
        height: fit-content !important;
        max-height: min(430px, 52vh);
        max-height: min(430px, 52dvh);
        min-height: 0;
        margin: 0;
        padding: 0;
        overflow: hidden;
    }

    .sun-path-panel.mobile_ui .mobile-scroll-content {
        box-sizing: border-box;
        width: 100%;
        height: fit-content;
        min-height: 0;
        max-height: min(430px, 52vh);
        max-height: min(430px, 52dvh);
        flex: 0 1 auto;
        overflow-x: hidden;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior-y: contain;
        touch-action: pan-y;
        padding: 8px 8px 0;
    }

    .panel-intro,
    .location-summary,
    .panel-note {
        display: none;
    }

    .control-field > .control-label,
    .event-selector > .control-label {
        display: none;
    }

    .status-region--event-details {
        display: none;
    }

    .sun-path-panel.mobile_ui .map-bottom-module {
        margin-top: 0;
    }

    .sun-path-panel.mobile_ui .summary-tabs button {
        min-height: 36px;
        padding: 0 5px;
    }

    .sun-path-panel.mobile_ui .module-about {
        padding: 6px 10px 10px;
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
        grid-template-columns: minmax(76px, 0.52fr) minmax(0, 2fr) 52px;
        align-items: stretch;
        gap: 6px;
        margin: 0 0 6px;
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

    .date-control {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        height: 38px;
        min-height: 38px;
        padding: 0 11px;
        overflow: hidden;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        color: var(--panel-text);
        background: #0e161f;
        font-size: 14px;
        cursor: pointer;
    }

    .date-control__text {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    input[type='date'] {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        max-width: 100%;
        min-height: 38px;
        padding: 0 8px;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        color: var(--panel-text);
        background: #0e161f;
        font: inherit;
        font-size: 14px;
        color-scheme: dark;
    }

    .date-control input[type='date'] {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        min-height: 0;
        padding: 0;
        border: 0;
        opacity: 0;
        appearance: none;
        -webkit-appearance: none;
        cursor: pointer;
    }

    .segmented-control {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        min-height: 38px;
        overflow: hidden;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        background: #0e161f;
    }

    .segmented-control button,
    .text-button,
    .language-toggle {
        min-height: 36px;
        padding: 0 4px;
        border: 0;
        color: var(--panel-muted);
        background: transparent;
        font: inherit;
        font-size: 14px;
        cursor: pointer;
        transition: color 160ms ease, background 160ms ease;
    }

    .segmented-control button + button {
        border-left: 1px solid var(--panel-border);
    }

    .segmented-control button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 2px;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .event-button__text {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .event-button__icon,
    .event-button__arrow {
        display: inline-grid;
        flex: 0 0 auto;
        place-items: center;
        color: currentColor;
        line-height: 1;
    }

    .event-button__icon svg {
        display: block;
        width: 16px;
        height: 16px;
    }

    .event-button__icon--sun svg {
        fill: #ffb347;
        stroke: #ffb347;
        stroke-width: 1.6;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .event-button__icon--moon svg {
        fill: #f5efcf;
        stroke: #f5efcf;
        stroke-width: 1.6;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .event-button__arrow svg {
        display: block;
        width: 12px;
        height: 12px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .event-button__arrow--down {
        transform: rotate(180deg);
    }

    .segmented-control button:hover,
    .segmented-control button.active {
        color: var(--panel-text);
        background: rgba(73, 169, 232, 0.22);
    }

    .language-toggle {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-items: center;
        gap: 2px;
        width: 100%;
        padding: 2px;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        background: #0e161f;
        font-size: 12px;
        font-weight: 700;
    }

    .language-toggle:hover {
        background: rgba(73, 169, 232, 0.12);
    }

    .language-toggle__option {
        display: grid;
        place-items: center;
        min-width: 0;
        min-height: 30px;
        border-radius: 5px;
        color: var(--panel-muted);
        line-height: 1;
        white-space: nowrap;
        transition: color 160ms ease, background 160ms ease;
    }

    .language-toggle__option.active {
        color: #07131c;
        background: #67c5ff;
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
        min-height: 0;
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
        margin-top: 0;
        overflow: hidden;
        border: 1px solid var(--panel-border);
        border-radius: 8px;
        background: rgba(5, 10, 20, 0.38);
    }

    .summary-tabs {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        border-bottom: 1px solid var(--panel-border);
        background: rgba(255, 255, 255, 0.04);
    }

    .summary-tabs button {
        min-height: 36px;
        padding: 0 5px;
        border: 0;
        border-bottom: 2px solid transparent;
        color: var(--panel-muted);
        background: transparent;
        font: inherit;
        font-size: 15px;
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

    .summary-panel-frame {
        height: var(--summary-panel-height);
        overflow: hidden;
        background: #1d263d;
    }

    .astronomy-panel {
        --astronomy-bg: #1d263d;
        --astronomy-muted: #a8b1c1;
        --astronomy-text: #f2f4fa;
        --astronomy-sun: #ff9138;
        --astronomy-moon: #4e91ed;
        --astronomy-blue-hour: #c4b5fd;

        box-sizing: border-box;
        height: 100%;
        min-height: 100%;
        overflow-y: auto;
        padding: 6px 10px 9px;
        color: var(--astronomy-text);
        background: var(--astronomy-bg);
    }

    .astronomy-panel__heading {
        display: grid;
        grid-template-columns: minmax(110px, 122px) minmax(0, 1fr) minmax(110px, 122px);
        align-items: center;
        gap: 6px;
        min-height: 42px;
    }

    .astronomy-panel__lead {
        min-width: 0;
        text-align: left;
    }

    .astronomy-panel__lead strong {
        display: grid;
        gap: 1px;
        overflow-wrap: anywhere;
        color: var(--astronomy-text);
        font-size: 13px;
        line-height: 1.2;
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

    .live-positions {
        display: grid;
        grid-template-columns: 13px max-content max-content;
        justify-self: center;
        align-self: center;
        column-gap: 2px;
        row-gap: 3px;
        min-width: 0;
        align-content: center;
        justify-content: center;
        justify-items: start;
    }

    .live-position {
        display: contents;
        min-width: 0;
        color: var(--astronomy-muted);
        font-size: 10.8px;
        line-height: 1.15;
        white-space: nowrap;
    }

    .live-position__icon {
        display: inline-grid;
        align-self: center;
        flex: 0 0 auto;
        place-items: center;
        width: 13px;
        height: 13px;
        color: var(--astronomy-muted);
        transform: translateY(-0.5px);
    }

    .live-position__icon svg {
        display: block;
        width: 13px;
        height: 13px;
    }

    .live-position__icon--sun svg {
        fill: #ffb347;
        stroke: #ffb347;
        stroke-width: 1.7;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .live-position__icon--moon svg {
        fill: #f5efcf;
        stroke: #f5efcf;
        stroke-width: 1.7;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .live-position span {
        color: var(--astronomy-muted);
        white-space: nowrap;
    }

    .live-position strong,
    .live-position em {
        min-width: 0;
        overflow: visible;
        text-overflow: clip;
        white-space: nowrap;
        font-style: normal;
        font-variant-numeric: tabular-nums;
    }

    .live-position strong {
        color: var(--astronomy-text);
        font-weight: 700;
    }

    .live-position__metric {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 5px;
    }

    .live-position__event-azimuths {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        color: var(--astronomy-muted);
        font-size: 1em;
        line-height: 1;
    }

    .orbit-badge {
        display: flex;
        justify-self: stretch;
        align-items: center;
        justify-content: flex-end;
        gap: 4px;
        width: 100%;
        min-width: 0;
        color: var(--astronomy-muted);
        font-size: 10px;
        font-variant-numeric: tabular-nums;
        text-align: center;
    }

    .orbit-moon {
        flex: 0 0 auto;
        display: block;
        width: 36px;
        height: 36px;
        border-radius: 50%;
    }

    .orbit-moon {
        overflow: hidden;
        background: #182033;
    }

    .orbit-badge--moon {
        align-self: center;
    }

    .orbit-badge__percent {
        min-width: 0;
        overflow: visible;
        color: var(--astronomy-muted);
        white-space: nowrap;
    }

    .orbit-moon__shadow {
        fill: #111727;
    }

    .timeline-events {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 0;
        margin-top: 6px;
        padding: 6px 0 5px;
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

    .night-window-list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
        margin-top: 6px;
    }

    .night-window {
        min-width: 0;
        padding: 6px 8px;
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
        overflow: visible;
        color: var(--astronomy-text);
        font-size: 12px;
        text-overflow: clip;
        white-space: normal;
        line-height: 1.2;
    }

    .night-window__body span {
        overflow: visible;
        color: var(--astronomy-muted);
        font-size: 10px;
        font-variant-numeric: tabular-nums;
        text-overflow: clip;
        white-space: normal;
        line-height: 1.25;
    }

    .night-window-list__empty {
        grid-column: 1 / -1;
        margin: 0;
        color: var(--astronomy-muted);
        font-size: 12px;
    }

    .module-about {
        box-sizing: border-box;
        height: 100%;
        overflow-y: auto;
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

    .module-about p:first-child {
        margin-top: 0;
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
            margin-top: 0;
        }

        .sun-path-panel.mobile_ui .control-grid {
            grid-template-columns: 76px minmax(0, 1fr) 52px;
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

        .astronomy-panel__heading {
            grid-template-columns: minmax(78px, 82px) minmax(0, 1fr) minmax(78px, 82px);
            gap: 4px;
        }

        .astronomy-panel__lead {
            padding-right: 0;
            padding-left: 0;
        }

        .astronomy-panel__lead strong {
            font-size: 11px;
            line-height: 1.2;
        }

        .astronomy-panel__lead > span {
            font-size: 11px;
        }

        .live-positions {
            grid-template-columns: 12px max-content max-content;
            justify-self: center;
            column-gap: 2px;
            row-gap: 3px;
        }

        .live-position {
            font-size: 9px;
            line-height: 1.14;
        }

        .live-position__metric {
            gap: 3px;
        }

        .live-position__event-azimuths {
            gap: 2px;
        }

        .live-position__icon {
            width: 12px;
            height: 12px;
        }

        .live-position__icon svg {
            width: 12px;
            height: 12px;
        }

        .orbit-moon {
            width: 32px;
            height: 32px;
        }

        .orbit-badge {
            gap: 3px;
            font-size: 9px;
        }

        .night-window-list {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 5px;
        }

        .night-window {
            padding: 5px 7px;
        }

        .night-window__body {
            gap: 1px;
        }
    }

    @media (max-width: 360px) {
        .sun-path-panel.mobile_ui {
            --summary-panel-height: 150px;
        }

        .sun-path-panel.mobile_ui .control-grid {
            grid-template-columns: 68px minmax(0, 1fr) 48px;
            gap: 5px;
        }

        .segmented-control button {
            font-size: 11px;
        }
    }

    @media (max-height: 740px) {
        .sun-path-panel.mobile_ui {
            --summary-panel-height: 146px;
        }

        .astronomy-panel {
            padding-top: 6px;
            padding-bottom: 10px;
        }

        .astronomy-panel__heading {
            min-height: 40px;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .segmented-control button,
        .text-button {
            transition: none;
        }
    }
</style>

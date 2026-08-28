<script lang="ts">
    import { createEventDispatcher, tick } from 'svelte';

    import CelestialIcon from './CelestialIcon.svelte';
    import { buildCelestialCurves, type CelestialCurveSegment } from './celestialCurve';
    import WeatherIcon from './WeatherIcon.svelte';
    import WeatherMetricIcon from './WeatherMetricIcon.svelte';
    import {
        buildWeatherDateGroups,
        findCurrentTimePosition,
        findWeatherDateSelection,
        formatWeatherHour,
        weatherConditionLabel,
        weatherMetricTone,
        weatherMetricValue,
        type WeatherDateGroup,
        type WeatherLoadStatus,
        type WeatherMetric,
        type WeatherModel,
        type WeatherPoint,
    } from './weather';

    import type { Coordinates } from './solar';

    export let points: WeatherPoint[] = [];
    export let model: WeatherModel = 'ecmwf';
    export let status: WeatherLoadStatus = 'idle';
    export let errorMessage = '';
    export let atmosphereStatus: WeatherLoadStatus = 'idle';
    export let atmosphereErrorMessage = '';
    export let language: 'zh' | 'en' = 'zh';
    export let timeZone = 'UTC';
    export let currentTimestamp = Date.now();
    export let selectedDate = '';
    export let dataKey = '';
    export let location: Coordinates;

    const dispatch = createEventDispatcher<{
        modelchange: WeatherModel;
        retry: void;
        atmosphereretry: void;
    }>();

    const LABEL_WIDTH = 64;
    const COLUMN_WIDTH = 36;
    const CELESTIAL_CHART_HEIGHT = 72;
    const CELESTIAL_HORIZON_Y = 64;
    const metricRows: WeatherMetric[] = [
        'totalCloudPercent',
        'highCloudPercent',
        'mediumCloudPercent',
        'lowCloudPercent',
        'temperatureC',
        'dewPointC',
        'humidityPercent',
        'precipMm',
        'windKmh',
        'windDirectionDeg',
        'visibilityKm',
        'aod550',
    ];

    const translations = {
        zh: {
            modelLabel: '预报模型',
            rangeLabel: '模式预报 · 前6小时至未来5天',
            date: '日期',
            time: '时间',
            weather: '天气',
            loading: '正在加载天气模式数据…',
            updating: '正在更新',
            empty: '当前模式没有返回可用天气数据。',
            retry: '重试',
            now: '当前时间',
            sun: '太阳',
            moon: '月亮',
            celestialCurve: '太阳和月亮升起降落曲线',
            pointCount: '个时次',
            hourStep: '小时间隔',
            openMeteoUpdating: 'Open-Meteo 更新中',
            openMeteoRetry: 'Open-Meteo · 重试',
            selectedDateOutsideRange: (date: string) => `所选日期 ${date} 不在当前五天预报范围内，表格仍显示当前预报。`,
            selectedDateMissing: (date: string) => `所选日期 ${date} 暂无可用预报时次，表格仍显示当前预报。`,
            metrics: {
                totalCloudPercent: ['云量', '%'],
                highCloudPercent: ['高云', '%'],
                mediumCloudPercent: ['中云', '%'],
                lowCloudPercent: ['低云', '%'],
                temperatureC: ['气温', '°C'],
                dewPointC: ['露点', '°C'],
                humidityPercent: ['湿度', '%'],
                aod550: ['AOD', 'OM · 550nm'],
                visibilityKm: ['能见度', 'OM · km'],
                precipMm: ['降水', 'mm'],
                windKmh: ['风速', 'km/h'],
                windDirectionDeg: ['风向', ''],
            },
        },
        en: {
            modelLabel: 'Forecast model',
            rangeLabel: 'Model forecast · past 6h to next 5d',
            date: 'Date',
            time: 'Time',
            weather: 'Weather',
            loading: 'Loading forecast data…',
            updating: 'Updating',
            empty: 'No weather data is available for this model.',
            retry: 'Retry',
            now: 'Current time',
            sun: 'Sun',
            moon: 'Moon',
            celestialCurve: 'Sun and moon rise and set curves',
            pointCount: 'steps',
            hourStep: 'hour interval',
            openMeteoUpdating: 'Updating Open-Meteo',
            openMeteoRetry: 'Open-Meteo · Retry',
            selectedDateOutsideRange: (date: string) => `Selected date ${date} is outside the current five-day forecast. The table still shows the current forecast.`,
            selectedDateMissing: (date: string) => `No forecast steps are available for selected date ${date}. The table still shows the current forecast.`,
            metrics: {
                totalCloudPercent: ['Clouds', '%'],
                highCloudPercent: ['High', '%'],
                mediumCloudPercent: ['Medium', '%'],
                lowCloudPercent: ['Low', '%'],
                temperatureC: ['Temp.', '°C'],
                dewPointC: ['Dew point', '°C'],
                humidityPercent: ['Humidity', '%'],
                aod550: ['AOD', 'OM · 550nm'],
                visibilityKm: ['Visibility', 'OM · km'],
                precipMm: ['Precip.', 'mm'],
                windKmh: ['Wind', 'km/h'],
                windDirectionDeg: ['Direction', ''],
            },
        },
    } as const;

    let tableScroller: HTMLDivElement | null = null;
    let dateGroups: WeatherDateGroup[] = [];
    let nowPosition: number | null = null;
    let positionedKey = '';
    let scrollKey = '';

    $: text = translations[language];
    $: dateGroups = buildWeatherDateGroups(points, timeZone, language);
    $: selectedDateSelection = findWeatherDateSelection(points, timeZone, selectedDate);
    $: celestialCurves = buildCelestialCurves(points.map(point => point.timestamp), location);
    $: celestialChartWidth = points.length * COLUMN_WIDTH;
    $: nowPosition = findCurrentTimePosition(points, currentTimestamp);
    $: nowLineLeft = nowPosition === null ? null : LABEL_WIDTH + (nowPosition + 0.5) * COLUMN_WIDTH;
    $: stepValues = points
        .slice(1)
        .map((point, index) => Math.round((point.timestamp - points[index].timestamp) / 3_600_000))
        .filter(step => step > 0);
    $: stepRange = stepValues.length > 0
        ? `${Math.min(...stepValues)}${Math.min(...stepValues) === Math.max(...stepValues) ? '' : `-${Math.max(...stepValues)}`}`
        : '';
    $: selectedDateLabel = formatSelectedDateLabel(selectedDate);
    $: selectedDateNotice = selectedDateSelection.coverage === 'before-range'
        || selectedDateSelection.coverage === 'after-range'
        ? text.selectedDateOutsideRange(selectedDateLabel)
        : selectedDateSelection.coverage === 'missing'
            ? text.selectedDateMissing(selectedDateLabel)
            : '';
    $: selectedDateStartIndex = selectedDateSelection.startIndex;
    $: selectedDateEndIndex = selectedDateStartIndex === null
        ? null
        : selectedDateStartIndex + selectedDateSelection.length - 1;
    $: scrollKey = `${dataKey}|${model}|${selectedDate}|${timeZone}|${points[0]?.timestamp || 0}|${points.at(-1)?.timestamp || 0}|${points.length}`;
    $: if (scrollKey && scrollKey !== positionedKey) {
        positionedKey = scrollKey;
        void positionRelevantDate();
    }

    const positionRelevantDate = async () => {
        await tick();
        if (!tableScroller) {
            return;
        }
        const selectedDateContainsNow = selectedDateStartIndex !== null
            && selectedDateEndIndex !== null
            && nowPosition !== null
            && nowPosition >= selectedDateStartIndex
            && nowPosition <= selectedDateEndIndex;
        const targetLeft = selectedDateStartIndex !== null
            ? selectedDateContainsNow && nowLineLeft !== null
                ? nowLineLeft
                : LABEL_WIDTH + (selectedDateStartIndex + 0.5) * COLUMN_WIDTH
            : nowLineLeft;
        if (targetLeft !== null) {
            tableScroller.scrollLeft = Math.max(0, targetLeft - tableScroller.clientWidth / 3);
        }
    };

    const isSelectedDateIndex = (
        index: number,
        startIndex: number | null,
        endIndex: number | null,
    ): boolean => startIndex !== null
        && endIndex !== null
        && index >= startIndex
        && index <= endIndex;

    const formatSelectedDateLabel = (dateInput: string): string => {
        const [year, month, day] = dateInput.split('-').map(value => Number.parseInt(value, 10));
        if (![year, month, day].every(Number.isFinite)) {
            return dateInput;
        }
        return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
        }).format(Date.UTC(year, month - 1, day, 12));
    };

    const selectModel = (nextModel: WeatherModel) => {
        if (nextModel !== model) {
            dispatch('modelchange', nextModel);
        }
    };

    const handleTableKeydown = (event: KeyboardEvent) => {
        if (!tableScroller || !['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) {
            return;
        }
        event.preventDefault();
        if (event.key === 'Home' || event.key === 'End') {
            tableScroller.scrollLeft = event.key === 'Home' ? 0 : tableScroller.scrollWidth;
            return;
        }
        const direction = event.key === 'ArrowLeft' || event.key === 'PageUp' ? -1 : 1;
        const distance = event.key.startsWith('Page') ? tableScroller.clientWidth * 0.8 : COLUMN_WIDTH;
        tableScroller.scrollBy({ left: direction * distance, behavior: 'smooth' });
    };

    const metricValueText = (metric: WeatherMetric, value: number | null): string => {
        if (value === null || (metric === 'precipMm' && value === 0)) {
            return '-';
        }
        if (metric === 'precipMm') {
            return value.toFixed(1);
        }
        if (metric === 'aod550') {
            return value.toFixed(2);
        }
        if (metric === 'visibilityKm') {
            return value.toFixed(1);
        }
        return String(Math.round(value));
    };

    const metricAriaLabel = (metric: WeatherMetric): string => {
        if (metric === 'aod550') {
            return language === 'zh'
                ? 'AOD 550 纳米，Open-Meteo，数据源 CAMS'
                : 'AOD at 550 nanometres, Open-Meteo, sourced from CAMS';
        }
        if (metric === 'visibilityKm') {
            return language === 'zh'
                ? '能见度，单位千米，Open-Meteo'
                : 'Visibility in kilometres, Open-Meteo';
        }
        return `${text.metrics[metric][0]}${text.metrics[metric][1] ? ` ${text.metrics[metric][1]}` : ''}`;
    };

    const cloudBarStyle = (metric: WeatherMetric, value: number | null): string =>
        metric.endsWith('CloudPercent') && value !== null ? `--weather-value: ${value}%` : '';

    const celestialX = (position: number): number => (position + 0.5) * COLUMN_WIDTH;

    const celestialY = (altitudeDeg: number): number => {
        const normalizedAltitude = Math.min(90, Math.max(0, altitudeDeg)) / 90;
        return CELESTIAL_HORIZON_Y - normalizedAltitude * (CELESTIAL_HORIZON_Y - 6);
    };

    const celestialPath = (segment: CelestialCurveSegment): string =>
        segment.points
            .map((point, index) => `${index === 0 ? 'M' : 'L'}${celestialX(point.position).toFixed(1)},${celestialY(point.altitudeDeg).toFixed(1)}`)
            .join(' ');

    const formatCelestialEventTime = (timestamp: number): string =>
        new Intl.DateTimeFormat('en-GB', {
            timeZone,
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        }).format(timestamp);
</script>

<section class="weather-panel" aria-label={language === 'zh' ? '天气模式预报' : 'Weather model forecast'}>
    <header class="weather-toolbar">
        <div class="weather-model-control" role="group" aria-label={text.modelLabel}>
            <button
                type="button"
                class:active={model === 'ecmwf'}
                aria-pressed={model === 'ecmwf'}
                on:click={() => selectModel('ecmwf')}
            >
                EC
            </button>
            <button
                type="button"
                class:active={model === 'gfs'}
                aria-pressed={model === 'gfs'}
                on:click={() => selectModel('gfs')}
            >
                GFS
            </button>
            <button
                type="button"
                class:active={model === 'icon'}
                aria-pressed={model === 'icon'}
                on:click={() => selectModel('icon')}
            >
                ICON
            </button>
        </div>
        <div class="weather-meta" aria-live="polite">
            <strong>{text.rangeLabel}</strong>
            {#if atmosphereStatus === 'error'}
                <button
                    type="button"
                    class="weather-source-retry"
                    title={atmosphereErrorMessage}
                    aria-label={`${atmosphereErrorMessage} ${text.openMeteoRetry}`}
                    on:click={() => dispatch('atmosphereretry')}
                >{text.openMeteoRetry}</button>
            {:else if points.length > 0}
                <span>
                    {points.length} {text.pointCount}{stepRange ? ` · ${stepRange} ${text.hourStep}` : ''}{atmosphereStatus === 'loading' ? ` · ${text.openMeteoUpdating}` : ''}
                </span>
            {:else if atmosphereStatus === 'loading'}
                <span>{text.openMeteoUpdating}</span>
            {/if}
        </div>
        {#if status === 'loading' && points.length > 0}
            <span class="weather-updating">{text.updating}</span>
        {/if}
    </header>

    {#if selectedDateNotice && points.length > 0}
        <div class="weather-date-notice" role="status">{selectedDateNotice}</div>
    {/if}

    {#if status === 'loading' && points.length === 0}
        <div class="weather-state" aria-live="polite">
            <span class="weather-spinner" aria-hidden="true"></span>
            <span>{text.loading}</span>
        </div>
    {:else if status === 'error' && points.length === 0}
        <div class="weather-state weather-state--error" role="alert">
            <span>{errorMessage}</span>
            <button type="button" on:click={() => dispatch('retry')}>{text.retry}</button>
        </div>
    {:else if status === 'empty' || points.length === 0}
        <div class="weather-state" aria-live="polite">{text.empty}</div>
    {:else}
        <div class="weather-table-frame">
        <!-- svelte-ignore a11y-no-noninteractive-tabindex a11y-no-noninteractive-element-interactions -->
        <div
            class="weather-table-scroll"
            bind:this={tableScroller}
            role="region"
            aria-label={language === 'zh' ? '逐时天气数据表' : 'Hourly weather data table'}
            tabindex="0"
            on:keydown={handleTableKeydown}
        >
            <div
                class="weather-grid"
                role="table"
                aria-rowcount={metricRows.length + 4}
                aria-colcount={points.length + 1}
                style={`--weather-columns: ${points.length}`}
            >
                <div class="weather-row" role="row">
                    <div class="weather-cell weather-label weather-label--date" role="columnheader">{text.date}</div>
                    {#each dateGroups as group}
                        <div
                            class="weather-cell weather-date-group"
                            class:weather-date-group--selected={group.key === selectedDate}
                            role="columnheader"
                            style={`grid-column: ${group.startIndex + 2} / span ${group.length}`}
                        >
                            {group.label}
                        </div>
                    {/each}
                </div>

                <div class="weather-row" role="row">
                    <div class="weather-cell weather-label weather-label--time" role="columnheader">{text.time}</div>
                    {#each points as point, index}
                        <div
                            class="weather-cell weather-time"
                            class:weather-time--selected={isSelectedDateIndex(index, selectedDateStartIndex, selectedDateEndIndex)}
                            role="columnheader"
                            data-weather-ts={point.timestamp}
                        >
                            {formatWeatherHour(point.timestamp, timeZone)}
                        </div>
                    {/each}
                </div>

                <div class="weather-row" role="row">
                    <div class="weather-cell weather-label weather-label--weather" role="rowheader">{text.weather}</div>
                    {#each points as point, index}
                        <div
                            class="weather-cell weather-icon-cell"
                            class:weather-icon-cell--selected={isSelectedDateIndex(index, selectedDateStartIndex, selectedDateEndIndex)}
                            role="cell"
                        >
                            <WeatherIcon
                                code={point.iconCode}
                                isDay={point.isDay}
                                label={weatherConditionLabel(point.iconCode, language)}
                            />
                        </div>
                    {/each}
                </div>

                {#each metricRows as metric}
                    <div class="weather-row" role="row">
                        <div
                            class="weather-cell weather-label weather-metric-label"
                            role="rowheader"
                            aria-label={metricAriaLabel(metric)}
                        >
                            <span class="weather-metric-label__name">
                                <WeatherMetricIcon {metric} size={10} />
                                <span>{text.metrics[metric][0]}</span>
                            </span>
                            {#if text.metrics[metric][1]}
                                <small>{text.metrics[metric][1]}</small>
                            {/if}
                        </div>
                        {#each points as point, index}
                            {@const value = weatherMetricValue(point, metric)}
                            {@const tone = weatherMetricTone(metric, value)}
                            <div
                                class="weather-cell weather-value-cell"
                                class:weather-value-cell--selected={isSelectedDateIndex(index, selectedDateStartIndex, selectedDateEndIndex)}
                                class:weather-value-cell--cloud={metric.endsWith('CloudPercent')}
                                class:weather-value-cell--wind={metric === 'windDirectionDeg'}
                                class:tone-good={tone === 'good'}
                                class:tone-warning={tone === 'warning'}
                                class:tone-orange={tone === 'orange'}
                                class:tone-danger={tone === 'danger'}
                                class:tone-cold={tone === 'cold'}
                                class:tone-cool={tone === 'cool'}
                                class:tone-mild={tone === 'mild'}
                                class:tone-freezing={tone === 'freezing'}
                                class:tone-neutral={tone === 'neutral'}
                                class:tone-unknown={tone === 'unknown'}
                                role="cell"
                                style={cloudBarStyle(metric, value)}
                            >
                                {#if metric === 'windDirectionDeg' && value !== null}
                                    <svg
                                        class="weather-wind-arrow"
                                        viewBox="0 0 24 24"
                                        aria-label={`${Math.round(value)}°`}
                                        style={`transform: rotate(${value}deg)`}
                                    >
                                        <path d="M12 2 18 20 12 16 6 20Z"></path>
                                    </svg>
                                {:else}
                                    <span>{metricValueText(metric, value)}</span>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/each}

                <div class="weather-row" role="row">
                    <div class="weather-cell weather-label weather-celestial-label" role="rowheader">
                        <span><CelestialIcon body="sun" size={12} />{text.sun}</span>
                        <span><CelestialIcon body="moon" size={12} />{text.moon}</span>
                    </div>
                    <div
                        class="weather-celestial-chart"
                        role="cell"
                        style={`grid-column: 2 / span ${points.length}; width: ${celestialChartWidth}px`}
                    >
                        <svg
                            viewBox={`0 0 ${celestialChartWidth} ${CELESTIAL_CHART_HEIGHT}`}
                            aria-label={text.celestialCurve}
                            role="img"
                        >
                            {#if selectedDateStartIndex !== null && selectedDateSelection.length > 0}
                                <rect
                                    class="weather-selected-date-chart"
                                    x={selectedDateStartIndex * COLUMN_WIDTH}
                                    y="0"
                                    width={selectedDateSelection.length * COLUMN_WIDTH}
                                    height={CELESTIAL_CHART_HEIGHT}
                                ></rect>
                            {/if}
                            <line class="weather-celestial-horizon" x1="0" y1={CELESTIAL_HORIZON_Y} x2={celestialChartWidth} y2={CELESTIAL_HORIZON_Y}></line>
                            {#each celestialCurves as curve}
                                {#each curve.segments as segment}
                                    <path
                                        class:weather-celestial-path--sun={curve.body === 'sun'}
                                        class:weather-celestial-path--moon={curve.body === 'moon'}
                                        class="weather-celestial-path"
                                        d={celestialPath(segment)}
                                    ></path>
                                {/each}
                                {#each curve.events as event}
                                    {@const eventX = celestialX(event.position)}
                                    {@const labelY = curve.body === 'sun' ? 60 : 45}
                                    {@const alignRight = event.position > points.length - 2}
                                    <line
                                        class:weather-celestial-event--sun={curve.body === 'sun'}
                                        class:weather-celestial-event--moon={curve.body === 'moon'}
                                        class="weather-celestial-event-tick"
                                        x1={eventX}
                                        y1={labelY + 3}
                                        x2={eventX}
                                        y2={CELESTIAL_HORIZON_Y}
                                    ></line>
                                    <CelestialIcon
                                        body={curve.body}
                                        size={9}
                                        x={eventX + (alignRight ? -42 : 3)}
                                        y={labelY - 8}
                                    />
                                    <text
                                        class:weather-celestial-event--sun={curve.body === 'sun'}
                                        class:weather-celestial-event--moon={curve.body === 'moon'}
                                        class="weather-celestial-event-label"
                                        x={eventX + (alignRight ? -3 : 15)}
                                        y={labelY}
                                        text-anchor={alignRight ? 'end' : 'start'}
                                    >{event.kind === 'rise' ? '↑' : '↓'}{formatCelestialEventTime(event.timestamp)}</text>
                                {/each}
                            {/each}
                        </svg>
                    </div>
                </div>

                {#if nowLineLeft !== null}
                    <div
                        class="weather-now-line"
                        style={`left: ${nowLineLeft}px`}
                        aria-label={text.now}
                    ></div>
                {/if}
            </div>
        </div>
            <div class="weather-table-right-edge" aria-hidden="true"></div>
        </div>
    {/if}
</section>

<style>
    .weather-panel {
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        height: 100%;
        min-height: 0;
        color: #f3f6f8;
        background: #1d263d;
    }

    .weather-toolbar {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 8px;
        min-height: 36px;
        padding: 4px 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.14);
        background: #171f32;
    }

    .weather-model-control {
        display: grid;
        grid-template-columns: repeat(3, minmax(44px, 1fr));
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.22);
        border-radius: 6px;
        background: rgba(0, 0, 0, 0.18);
    }

    .weather-model-control button {
        min-width: 44px;
        min-height: 28px;
        padding: 0 7px;
        border: 0;
        color: #b8c3cc;
        background: transparent;
        font: inherit;
        font-size: 10.8px;
        font-weight: 700;
        cursor: pointer;
    }

    .weather-model-control button + button {
        border-left: 1px solid rgba(255, 255, 255, 0.16);
    }

    .weather-model-control button:hover,
    .weather-model-control button.active {
        color: #ffffff;
        background: #287bc1;
    }

    .weather-model-control button:focus-visible,
    .weather-source-retry:focus-visible,
    .weather-state button:focus-visible,
    .weather-table-scroll:focus-visible {
        outline: 2px solid #8ed0ff;
        outline-offset: -2px;
    }

    .weather-meta {
        display: grid;
        align-content: center;
        min-width: 0;
        min-height: 28px;
        line-height: 1.2;
    }

    .weather-meta strong {
        overflow: hidden;
        color: #eef4fb;
        font-size: 10.8px;
        font-weight: 650;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .weather-meta span,
    .weather-updating {
        color: #aeb9c9;
        font-size: 10px;
    }

    .weather-source-retry {
        overflow: hidden;
        min-width: 0;
        padding: 0;
        border: 0;
        color: #ffd38a;
        background: transparent;
        font: inherit;
        font-size: 10px;
        text-align: left;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;
    }

    .weather-updating {
        white-space: nowrap;
    }

    .weather-date-notice {
        padding: 5px 8px;
        border-bottom: 1px solid rgba(255, 205, 112, 0.28);
        color: #ffd790;
        background: rgba(91, 60, 14, 0.42);
        font-size: 10px;
        line-height: 1.3;
    }

    .weather-state {
        display: flex;
        flex: 1 1 auto;
        align-items: center;
        justify-content: center;
        gap: 10px;
        min-height: 240px;
        padding: 20px;
        color: #c8d1dd;
        text-align: center;
    }

    .weather-state--error {
        color: #ffd4d4;
    }

    .weather-state button {
        min-height: 36px;
        padding: 0 14px;
        border: 1px solid rgba(255, 255, 255, 0.24);
        border-radius: 5px;
        color: #ffffff;
        background: #a83c47;
        font: inherit;
        cursor: pointer;
    }

    .weather-spinner {
        width: 18px;
        height: 18px;
        border: 2px solid rgba(255, 255, 255, 0.22);
        border-top-color: #8ed0ff;
        border-radius: 50%;
        animation: weather-spin 800ms linear infinite;
    }

    .weather-table-frame {
        position: relative;
        flex: 1 1 auto;
        min-height: 0;
        overflow: hidden;
    }

    .weather-table-scroll {
        width: 100%;
        height: 100%;
        overflow: auto;
        overscroll-behavior: none;
        scrollbar-color: #64748b #111827;
        touch-action: pan-x pan-y;
        -webkit-overflow-scrolling: touch;
    }

    .weather-table-scroll::before {
        position: sticky;
        top: 0;
        left: 0;
        z-index: 4;
        display: block;
        width: calc(100% + 2px);
        height: 60px;
        margin-bottom: -60px;
        transform: translateY(-2px);
        background: linear-gradient(to bottom, #343b4d 0 28px, #273249 28px 60px);
        pointer-events: none;
        content: '';
    }

    .weather-table-right-edge {
        display: none;
    }

    .weather-grid {
        --label-width: 64px;
        --column-width: 36px;

        position: relative;
        display: grid;
        grid-template-columns: var(--label-width) repeat(var(--weather-columns), var(--column-width));
        width: max-content;
        min-width: 100%;
        background: #20283c;
    }

    .weather-row {
        display: contents;
    }

    .weather-cell {
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        min-width: 0;
        border-right: 1px solid rgba(6, 10, 20, 0.8);
        border-bottom: 1px solid rgba(255, 255, 255, 0.14);
        font-variant-numeric: tabular-nums;
    }

    .weather-label {
        position: sticky;
        left: 0;
        z-index: 8;
        justify-content: center;
        padding: 0 6px;
        color: #cbd4e0;
        background: #171d2c;
        font-size: 10.8px;
        text-align: center;
    }

    .weather-label--date,
    .weather-date-group {
        position: sticky;
        top: 0;
        z-index: 6;
        min-height: 26px;
        color: #eaf0f8;
        background: #343b4d;
        font-size: 10.8px;
        white-space: nowrap;
    }

    .weather-label--date {
        z-index: 10;
    }

    .weather-date-group--selected {
        color: #ffffff;
        background: #245f91;
    }

    .weather-label--time,
    .weather-time {
        position: sticky;
        top: 26px;
        z-index: 5;
        min-height: 32px;
        color: #f2f5f8;
        background: #273249;
        font-size: 10.8px;
    }

    .weather-label--time {
        z-index: 10;
    }

    .weather-label--weather,
    .weather-icon-cell {
        min-height: 36px;
    }

    .weather-icon-cell {
        background: #303746;
    }

    .weather-time--selected,
    .weather-icon-cell--selected,
    .weather-value-cell--selected {
        box-shadow: inset 0 0 0 999px rgba(55, 150, 218, 0.12);
    }

    .weather-selected-date-chart {
        fill: rgba(55, 150, 218, 0.12);
    }

    .weather-metric-label,
    .weather-value-cell {
        min-height: 32px;
    }

    .weather-metric-label {
        display: grid;
        align-content: center;
        justify-items: center;
        padding-right: 2px;
        padding-left: 2px;
        line-height: 1.1;
    }

    .weather-metric-label__name {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        max-width: 100%;
        gap: 2px;
        white-space: nowrap;
    }

    .weather-metric-label small {
        margin-top: 1px;
        color: #8490a3;
        font-size: 8px;
    }

    .weather-value-cell {
        position: relative;
        overflow: hidden;
        color: #f5f7fa;
        background: #2d3545;
        font-size: 10.8px;
    }

    .weather-value-cell > span,
    .weather-wind-arrow {
        position: relative;
        z-index: 1;
    }

    .weather-value-cell--cloud::before {
        position: absolute;
        right: 0;
        bottom: 0;
        left: 0;
        height: var(--weather-value);
        background: #f7f7f7;
        content: '';
    }

    .weather-value-cell--cloud {
        color: #f5f7fb;
        background: #454545;
        text-shadow: 0 1px 1px #111827, 0 0 2px #111827;
    }

    .tone-good {
        color: #101624;
        background: var(--weather-tone-good, #60e37c);
    }

    .tone-warning {
        color: #101624;
        background: var(--weather-tone-warning, #ffe082);
    }

    .tone-orange {
        color: #101624;
        background: var(--weather-tone-orange, #ff8248);
    }

    .tone-danger {
        color: #101624;
        background: var(--weather-tone-danger, #ff5a5f);
    }

    .tone-cold {
        color: #07164e;
        background: var(--weather-tone-cold, #405cf2);
    }

    .tone-cool {
        color: #101624;
        background: var(--weather-tone-cool, #9092ba);
    }

    .tone-mild {
        color: #101624;
        background: var(--weather-tone-mild, #aff5c0);
    }

    .tone-freezing {
        color: #101624;
        background: var(--weather-tone-freezing, #f7f7f7);
    }

    .tone-neutral {
        background: #303746;
    }

    .tone-unknown {
        color: #8791a2;
        background: #272d3d;
    }

    .weather-wind-arrow {
        width: 20px;
        height: 20px;
        transform-origin: center;
    }

    .weather-wind-arrow path {
        fill: #eef4fb;
        stroke: rgba(0, 0, 0, 0.28);
        stroke-width: 0.8;
    }

    .weather-celestial-label,
    .weather-celestial-chart {
        min-height: 72px;
    }

    .weather-celestial-label {
        display: grid;
        align-content: center;
        gap: 8px;
    }

    .weather-celestial-label span {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        white-space: nowrap;
    }

    .weather-celestial-chart {
        overflow: hidden;
        border-bottom: 1px solid rgba(255, 255, 255, 0.14);
        background: #20263a;
    }

    .weather-celestial-chart svg {
        display: block;
        width: 100%;
        height: 72px;
    }

    .weather-celestial-horizon {
        stroke: rgba(255, 255, 255, 0.13);
        stroke-width: 1;
    }

    .weather-celestial-path {
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 2;
    }

    .weather-celestial-path--sun,
    .weather-celestial-event--sun {
        stroke: #ffb000;
    }

    .weather-celestial-path--moon,
    .weather-celestial-event--moon {
        stroke: #f7f8fb;
    }

    .weather-celestial-event-tick {
        stroke-width: 1;
    }

    .weather-celestial-event-label {
        font-size: 8px;
        font-weight: 700;
        paint-order: stroke;
        stroke: #20263a;
        stroke-width: 2px;
        stroke-linejoin: round;
    }

    .weather-celestial-event-label.weather-celestial-event--sun {
        fill: #ffb000;
    }

    .weather-celestial-event-label.weather-celestial-event--moon {
        fill: #f7f8fb;
    }

    .weather-now-line {
        position: absolute;
        top: 26px;
        bottom: 0;
        z-index: 7;
        width: 2px;
        pointer-events: none;
        background: #ffffff;
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.32);
    }

    @keyframes weather-spin {
        to {
            transform: rotate(360deg);
        }
    }

    @media (max-width: 520px) {
        .weather-table-right-edge {
            position: absolute;
            top: 0;
            right: 0;
            z-index: 11;
            display: block;
            width: 2px;
            height: 58px;
            background: linear-gradient(to bottom, #343b4d 0 26px, #273249 26px 58px);
            pointer-events: none;
        }

        .weather-table-scroll {
            scrollbar-width: none;
        }

        .weather-table-scroll::-webkit-scrollbar {
            width: 0;
            height: 0;
        }

        .weather-toolbar {
            grid-template-columns: auto minmax(0, 1fr);
            gap: 8px;
            min-height: 36px;
            padding: 4px 6px;
        }

        .weather-model-control {
            grid-template-columns: repeat(3, 44px);
        }

        .weather-updating {
            display: none;
        }

        .weather-meta strong {
            font-size: 10.8px;
        }

        .weather-grid {
            --label-width: 64px;
            --column-width: 36px;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .weather-spinner {
            animation: none;
        }
    }
</style>

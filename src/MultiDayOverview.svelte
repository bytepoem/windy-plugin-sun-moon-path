<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { formatDisplayDate, formatDisplayDateTime } from './dateDisplay';
    import { maximumSelectableDate, minimumSelectableDate } from './dateSelection';
    import { onPluginDestroy as onDestroy } from './pluginLifecycle';
    import { messages } from './locales/MultiDayOverview';
    import { labels, messages as comparisonMessages } from './locales/FavoriteComparison';
    import { translations } from './pluginTranslations';
    import { translations as weatherText } from './locales/WeatherTable';
    import { messages as horizonText } from './locales/EventHorizon';
    import { messages as settingsMessages } from './locales/PluginSettings';
    import { UI_LANGUAGES, type UiLanguage } from './uiLanguage';
    import {
        createMultiDayCalculator, isValidMultiDayRange, type MultiDayRow, type MultiDayTarget, type MultiDayInterval,
    } from './multiDayPlanner';
    import {
        addDaysToDateInput, dateInputForInstant, dateInputToUtcNoon, formatLocalClock, type Coordinates,
    } from './solar';
    import { comparisonIntervalLabels } from './favoriteComparisonPeriod';
    import MultiDayWeather from './MultiDayWeather.svelte';
    import MultiDayWeekTable from './MultiDayWeekTable.svelte';
    import WeatherSupplementStatus from './WeatherSupplementStatus.svelte';
    import { multiDayWeatherMetrics } from './multiDayWeatherPresentation';
    import type { WeatherLoadStatus, WeatherModel, WeatherPoint, WeatherSource } from './weather';
    import type { SnowDisplayPreference } from './pluginPreferences';
    import type { UnitPreferences } from './unitPreferences';

    export let active = false;
    export let contextReady = false;
    export let contextError = false;
    export let location: Coordinates;
    export let locationName: string;
    export let timeZone: string;
    export let elevationM: number;
    export let startDate: string;
    export let currentInstant = new Date();
    export let language: UiLanguage;
    export let points: WeatherPoint[];
    export let weatherStatus: WeatherLoadStatus;
    export let aodStatus: WeatherLoadStatus = 'idle';
    export let visibilityStatus: WeatherLoadStatus = 'idle';
    export let snowStatus: WeatherLoadStatus = 'idle';
    export let snowDisplay: SnowDisplayPreference = 'auto';
    export let mode: 'week' | 'month' = 'week';
    export let source: WeatherSource;
    export let model: WeatherModel;
    export let units: UnitPreferences;
    const dispatch = createEventDispatcher<{
        select: { timestamp: number; date: string };
        retry: void; contextretry: void; sourcechange: WeatherSource; modelchange: WeatherModel;
        atmosphereretry: 'aod' | 'visibility' | 'snow';
    }>();
    const sourceOptions: WeatherSource[] = ['windy', 'open-meteo'];
    const modelOptions: WeatherModel[] = ['ecmwf', 'gfs', 'icon'];
    // The input already names a civil date at the site. UTC only reads its
    // weekday without shifting it into the browser's own time zone.
    const weekdayIndex = (date: string) => new Date(date + 'T12:00:00Z').getUTCDay();
    const isWeekend = (date: string) => [0, 6].includes(weekdayIndex(date));
    let dateOrientation: 'vertical' | 'horizontal' = 'horizontal';
    let target: MultiDayTarget = 'moonless-night';
    let rows: MultiDayRow[] = [];
    let selectedDate = '';
    let selectedWeekDate = '';
    let building = false;
    let failed = false;
    let buildKey = '';
    let revision = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    let invalidRange = false;
    let lastValidStartDate = dateInputForInstant(new Date(), timeZone);
    // The shared date/time control is another input boundary. Validate it here
    // as well as local controls, before any range formatting or calculation.
    $: minimumDate = minimumSelectableDate(currentInstant);
    $: if (!isValidMultiDayRange(lastValidStartDate, 30, minimumDate)) {
        lastValidStartDate = minimumDate;
    }
    $: if (isValidMultiDayRange(startDate, 30, minimumDate)) {
        // A new valid shared date resolves the rejected input. Restoring the
        // last valid date after rejection must retain its validation message.
        if (startDate !== lastValidStartDate) { invalidRange = false; }
        lastValidStartDate = startDate;
    } else {
        startDate = lastValidStartDate;
        invalidRange = true;
    }
    $: text = messages[language];
    $: common = labels[language];
    $: pluginText = translations[language];
    $: count = mode === 'week' ? 7 : 30;
    $: metrics = multiDayWeatherMetrics(rows.flatMap(row => row.windows[target]), points, source, snowDisplay);
    $: requestBuild(active && contextReady, `${location.lat}|${location.lon}|${timeZone}|${elevationM}|${startDate}|${count}`);
    $: selectedRow = rows.find(row => row.date === selectedDate) ?? rows[0];
    $: selectedWeekRow = rows.find(row => row.date === selectedWeekDate);
    $: maxDuration = Math.max(1, ...rows.map(row => durationMs(row.windows[target])));
    $: forecastFirst = points.length ? Math.min(...points.map(point => point.timestamp)) : null;
    $: forecastLast = points.length ? Math.max(...points.map(point => point.timestamp)) : null;
    $: weekdayOffset = weekdayIndex(startDate);
    $: weekdayLabels = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(UI_LANGUAGES[language].locale,
        { weekday:'short', timeZone:'UTC' }).format(new Date(Date.UTC(2024, 0, 7 + index))));

    const stop = () => {
        revision += 1;
        if (timer !== null) { clearTimeout(timer); timer = null; }
    };
    /** One civil date per turn keeps input responsive. A hidden tab, changed
     * context or teardown invalidates pending work before it can publish rows.
     */
    function requestBuild(enabled: boolean, key: string) {
        if (!enabled || disposed) {
            stop();
            if (!contextReady) { rows = []; buildKey = ''; }
            return;
        }
        // Hiding a complete range must preserve the keyed DOM (including open
        // details and scroll). Interrupted ranges resume from their last row.
        const sameRange = key === buildKey;
        if (sameRange && rows.length === count && !failed) { return; }
        stop();
        buildKey = key;
        if (!sameRange) { rows = []; }
        building = true;
        failed = false;
        const current = revision;
        const calculate = createMultiDayCalculator({ ...location }, timeZone, elevationM);
        const rangeStart = startDate;
        const rangeCount = count;
        const next = () => {
            timer = null;
            if (disposed || current !== revision) { return; }
            try {
                rows = [...rows, calculate(addDaysToDateInput(rangeStart, rows.length))];
                if (rows.length < rangeCount) { timer = setTimeout(next, 0); }
                else { building = false; }
            } catch {
                failed = true;
                building = false;
            }
        };
        timer = setTimeout(next, 0);
    }
    onDestroy(() => { disposed = true; stop(); });

    const durationMs = (intervals: MultiDayInterval[]) => intervals.reduce((total, interval) => total + interval.end.getTime() - interval.start.getTime(), 0);
    const duration = (intervals: MultiDayInterval[]) => {
        const minutes = Math.round(durationMs(intervals) / 60_000);
        return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    };
    $: dateLabel = (date: string, weekday = false) => {
        const label = formatDisplayDate(date);
        const weekdayLabel = weekday ? new Intl.DateTimeFormat(UI_LANGUAGES[language].locale, {
            timeZone: 'UTC', weekday: 'short',
        }).format(new Date(date + 'T12:00:00Z')) : '';
        return weekdayLabel ? `${label} ${weekdayLabel}` : label;
    };
    $: intervalLabel = (interval: MultiDayInterval, date: string) => {
        const value = comparisonIntervalLabels({ start:interval.start.getTime(), end:interval.end.getTime() }, timeZone, date, common.shortDate);
        return `${value.start} – ${value.end}`;
    };
    $: sunTime = (row: MultiDayRow, kind: 'sunrise' | 'sunset') => {
        const time = row.timeline.items.find(item => item.kind === kind)?.time;
        return time ? formatLocalClock(time, timeZone) : horizonText[language].noEventThisDay;
    };
    const continues = (interval: MultiDayInterval, date: string) => target !== 'sunset'
        && (interval.start.getTime() === dateInputToUtcNoon(date, timeZone).getTime()
            || interval.end.getTime() === dateInputToUtcNoon(addDaysToDateInput(date, 1), timeZone).getTime());
    const openDay = (row: MultiDayRow, interval?: MultiDayInterval) => dispatch('select', {
        date: row.date, timestamp: interval?.start.getTime() ?? dateInputToUtcNoon(row.date, timeZone).getTime(),
    });
    const showSelectedWeek = () => {
        if (!selectedRow) { return; }
        invalidRange = !isValidMultiDayRange(selectedRow.date, 30, minimumDate);
        if (!invalidRange) { startDate = selectedRow.date; mode = 'week'; }
    };
    /** Reject the whole proposed range before changing reactive rendering inputs. */
    const changeRange = (date: string) => {
        invalidRange = !isValidMultiDayRange(date, 30, minimumDate);
        if (!invalidRange) { startDate = date; }
    };
    // Retain the forecast's actual year independently of the browsed range.
    $: forecastRangeLabel = forecastFirst !== null && forecastLast !== null
        ? `${formatDisplayDateTime(forecastFirst, timeZone, true)} – ${formatDisplayDateTime(forecastLast, timeZone, true)}` : '';
</script>

<section class="multi-day" aria-label={text.overview} aria-busy={building || !contextReady}>
    <div class="location"><strong>{locationName}</strong><span>{timeZone}</span></div>
    <div class="toolbar">
        <div class="segments" role="group" aria-label={text.overview}>
            <button class:active={mode === 'week'} aria-pressed={mode === 'week'} on:click={() => mode = 'week'}>{text.week}</button>
            <button class:active={mode === 'month'} aria-pressed={mode === 'month'} on:click={() => mode = 'month'}>{text.month}</button>
        </div>
        <label>{common.target}<select bind:value={target}><option value="moonless-night">{common.moonless}</option><option value="milky-way">{common.milkyWay}</option><option value="sunset">{common.sunset}</option></select></label>
    </div>
    <div class="planning-controls">
      <div class="range-controls">
        <button aria-label={common.start} disabled={!isValidMultiDayRange(addDaysToDateInput(startDate, -count), 30, minimumDate)} on:click={() => changeRange(addDaysToDateInput(startDate, -count))}>‹</button>
        <div class="range-date">
            <span aria-hidden="true">{formatDisplayDate(startDate, true)}</span>
            <input type="date" aria-label={common.dateControl} value={startDate} min={minimumDate} max={maximumSelectableDate(30)} aria-invalid={invalidRange}
                on:change={event => {
                    changeRange(event.currentTarget.value);
                    event.currentTarget.value = startDate;
                }} />
        </div>
        <span>– {dateLabel(addDaysToDateInput(startDate, count - 1))}</span>
        <button aria-label={common.end} disabled={!isValidMultiDayRange(addDaysToDateInput(startDate, count), 30, minimumDate)} on:click={() => changeRange(addDaysToDateInput(startDate, count))}>›</button>
      </div>
      {#if mode === 'week'}
        <div class="segments date-orientation" role="group" aria-label={common.dateControl}>
            <button type="button" class:active={dateOrientation === 'vertical'} aria-pressed={dateOrientation === 'vertical'} on:click={() => dateOrientation = 'vertical'}>{text.vertical}</button>
            <button type="button" class:active={dateOrientation === 'horizontal'} aria-pressed={dateOrientation === 'horizontal'} on:click={() => dateOrientation = 'horizontal'}>{text.horizontal}</button>
        </div>
        <div class="forecast-controls">
            <div class="forecast-options source-options" role="group" aria-label={comparisonMessages[language].weatherSource}>
                {#each sourceOptions as provider}
                    <button type="button" class:active={source === provider} aria-pressed={source === provider}
                        on:click={() => { if (source !== provider) { dispatch('sourcechange', provider); } }}
                    >{provider === 'windy' ? 'Windy' : 'Open-Meteo'}</button>
                {/each}
            </div>
            <div class="forecast-options" role="group" aria-label={common.modelLabel}>
                {#each modelOptions as nextModel}
                    <button type="button" class:active={model === nextModel} aria-pressed={model === nextModel}
                        on:click={() => { if (model !== nextModel) { dispatch('modelchange', nextModel); } }}
                    >{nextModel === 'ecmwf' ? 'EC' : nextModel.toUpperCase()}</button>
                {/each}
            </div>
        </div>
      {/if}
    </div>
    {#if invalidRange}<p role="alert">{common.invalidPeriod}</p>{/if}
    <div class="overview-meta">
        {#if mode === 'week'}
            <p>{text.range}: {weatherStatus === 'ready' && forecastRangeLabel ? forecastRangeLabel : weatherStatus === 'error' ? common.atmosphereError : weatherStatus === 'empty' ? common.missing : weatherText[language].loading}</p>
            {#if weatherStatus === 'error' || weatherStatus === 'empty'}<button on:click={() => dispatch('retry')}>{pluginText.retry}</button>{/if}
        {/if}
        <details class="overview-notes"><summary>{settingsMessages[language].userGuide}</summary>
            <p>{text.nightRule}</p><p>{text.monthRule}</p><p>{common.precipitationRule}</p>
            {#if mode === 'week' && snowDisplay !== 'hidden'}<p>{text.snowRule}</p>{/if}
        </details>
    </div>
    {#if mode === 'week'}
        <WeatherSupplementStatus
            {language}
            aod={aodStatus}
            visibility={source === 'windy' ? visibilityStatus : 'idle'}
            snow={source === 'windy' && snowDisplay !== 'hidden' ? snowStatus : 'idle'}
            on:retry={event => dispatch('atmosphereretry', event.detail)}
        />
    {/if}
    {#if failed || contextError}
        <p role="alert">{pluginText.astronomyLoadError}</p><button on:click={() => {
            if (contextError) { dispatch('contextretry'); }
            else { buildKey = ''; requestBuild(active && contextReady, `${location.lat}|${location.lon}|${timeZone}|${elevationM}|${startDate}|${count}`); }
        }}>{pluginText.retry}</button>
    {:else if !contextReady || building}<p role="status">{pluginText.calculating} {rows.length}/{count}</p>{/if}
    {#if mode === 'week'}
        <MultiDayWeekTable {rows} {target} orientation={dateOrientation} selectedDate={selectedWeekDate}
            {points} status={weatherStatus} {aodStatus} {visibilityStatus} {snowStatus} {source} {metrics} {language} {timeZone} {units}
            on:select={event => selectedWeekDate = selectedWeekDate === event.detail ? '' : event.detail} />
        <div id="multi-day-week-details">
            {#if selectedWeekRow}
                {@const row = selectedWeekRow}
                {@const intervals = row.windows[target]}
                <div class="day-detail">
                    <strong class:weekend={isWeekend(row.date)}>{dateLabel(row.date, true)} · {intervals.length ? duration(intervals) : common.noWindow}</strong>
                    <small>{pluginText.events.sunrise} {sunTime(row, 'sunrise')} · {pluginText.events.sunset} {sunTime(row, 'sunset')} · {common.moonIllumination} {Math.round(row.timeline.moonIllumination.fraction * 100)}%</small>
                    {#each intervals as interval}
                        <div class="segment"><strong>{intervalLabel(interval, row.date)} · {duration([interval])}</strong>
                            {#if continues(interval, row.date)}<small>{text.continues}</small>{/if}
                            <!-- Single-window metrics already appear in the date matrix. -->
                            <MultiDayWeather {interval} {points} status={weatherStatus} {aodStatus} {visibilityStatus} {snowStatus} {source} {metrics} {language} {timeZone} {units}
                                expanded showCoverage showSummary={intervals.length !== 1} />
                            <button on:click={() => openDay(row, interval)}>{text.single}</button>
                        </div>
                    {:else}<button on:click={() => openDay(row)}>{text.single}</button>{/each}
                </div>
            {/if}
        </div>
    {:else}
        <div class="month-grid" aria-label={text.month}>
            {#each weekdayLabels as weekday, index}<span class="weekday" class:weekend={index === 0 || index === 6}>{weekday}</span>{/each}
            {#each Array(weekdayOffset) as _}<span aria-hidden="true"></span>{/each}
            {#each rows as row (row.date)}
                <button class:active={selectedRow?.date === row.date} class:weekend={isWeekend(row.date)} aria-pressed={selectedRow?.date === row.date}
                    aria-label={`${dateLabel(row.date, true)}: ${row.windows[target].length ? duration(row.windows[target]) : common.noWindow}`}
                    on:click={() => selectedDate = row.date}>
                    <span class="calendar-date">{dateLabel(row.date)}</span><span class="bar" aria-hidden="true"><span style={`width:${durationMs(row.windows[target]) / maxDuration * 100}%`}></span></span>
                </button>
            {/each}
        </div>
        {#if selectedRow}
            <div class="month-detail"><strong>{dateLabel(selectedRow.date, true)} · {selectedRow.windows[target].length ? duration(selectedRow.windows[target]) : common.noWindow}</strong>
                <p>{pluginText.events.sunrise} {sunTime(selectedRow, 'sunrise')} · {pluginText.events.sunset} {sunTime(selectedRow, 'sunset')} · {common.moonIllumination} {Math.round(selectedRow.timeline.moonIllumination.fraction * 100)}%</p>
                {#each selectedRow.windows[target] as interval}<p>{intervalLabel(interval, selectedRow.date)} {continues(interval, selectedRow.date) ? text.continues : ''}</p>{/each}
                <button on:click={showSelectedWeek}>{text.week}</button>
                {#each selectedRow.windows[target] as interval}<button on:click={() => openDay(selectedRow, interval)}>{text.single} · {formatLocalClock(interval.start, timeZone)}</button>
                {:else}<button on:click={() => openDay(selectedRow)}>{text.single}</button>{/each}
            </div>
        {/if}
    {/if}
</section>

<style>
    .multi-day { padding:6px 8px; color:var(--panel-text); font-size:13px; container-type:inline-size; }
    .location, .toolbar, .planning-controls, .forecast-controls, .segments { display:flex; align-items:center; flex-wrap:wrap; gap:4px; }
    .location { justify-content:space-between; gap:2px 6px; margin-bottom:4px; }
    .location strong { flex:1; min-width:0; overflow-wrap:anywhere; }
    .location span, small, p { color:var(--panel-muted); font-size:11px; }
    .toolbar { gap:4px 8px; }
    .date-orientation { gap:0; }
    .date-orientation button { position:relative; border-radius:0; padding-inline:7px; }
    /* Paint the active/focused border above the overlapping neighbour edge. */
    .date-orientation button.active, .date-orientation button:focus-visible { z-index:1; }
    .date-orientation button + button { margin-inline-start:-1px; }
    .date-orientation button:first-child { border-radius:6px 0 0 6px; }
    .date-orientation button:last-child { border-radius:0 6px 6px 0; }
    label { display:flex; align-items:center; flex-wrap:wrap; gap:4px; min-width:0; font-size:inherit; }
    input, select, button { box-sizing:border-box; font:inherit; color:var(--panel-text); background:#0e161f; border:1px solid var(--panel-border); border-radius:6px; min-height:30px; padding:3px 6px; max-width:100%; }
    button, select { cursor:pointer; }
    .active { background:rgba(99,185,238,.14); border-color:var(--panel-accent); }
    .planning-controls { margin-top:4px; gap:4px; }
    /* Include both arrow columns in the range width when the toolbar packs each row. */
    .range-controls {
        display:grid;
        grid-template-columns:28px auto auto 28px;
        align-items:center;
        gap:3px;
        max-width:100%;
    }
    .range-controls button { padding-inline:3px; }
    /* Native focus opens iOS editing; focused segments stay visible for keys. */
    .range-date { position:relative; display:inline-flex; align-items:center; box-sizing:border-box; min-width:124px; min-height:30px; padding:3px 6px; border:1px solid var(--panel-border); border-radius:6px; background:#0e161f; }
    .range-date > span { white-space:nowrap; }
    .range-date input { position:absolute; inset:0; width:100%; height:100%; min-width:0; margin:0; opacity:0; cursor:text; }
    .range-date input:focus { opacity:1; }
    .range-date:focus-within { outline:2px solid var(--panel-accent); outline-offset:2px; }
    .range-controls > span { white-space:nowrap; font-size:12px; }
    .forecast-controls { gap:4px; }
    /* Use the weather table's segmented controls, including its compact typography. */
    .forecast-options { display:grid; grid-template-columns:repeat(3,minmax(44px,1fr)); overflow:hidden; border:1px solid rgba(255,255,255,.22); border-radius:6px; background:rgba(0,0,0,.18); }
    .source-options { grid-template-columns:repeat(2,auto); }
    .forecast-options button { min-width:44px; min-height:28px; padding:0 7px; border:0; border-radius:0; color:var(--panel-muted); background:transparent; font-size:10.8px; font-weight:700; }
    .forecast-options button + button { border-left:1px solid rgba(255,255,255,.16); }
    .forecast-options button:hover, .forecast-options button.active { color:#fff; background:#287bc1; }
    /* Match the compact comparison controls on both mouse and touch devices. */
    select { field-sizing:content; min-width:56px; appearance:none; padding-inline:8px 22px; background-image:linear-gradient(45deg,transparent 50%,#b9c2ce 50%),linear-gradient(135deg,#b9c2ce 50%,transparent 50%); background-position:calc(100% - 11px) 50%,calc(100% - 7px) 50%; background-size:4px 4px; background-repeat:no-repeat; }
    .toolbar select { max-width:220px; }
    .overview-meta { display:flex; align-items:baseline; flex-wrap:wrap; gap:0 8px; margin:3px 0; }
    .overview-meta > p { flex:0 1 auto; }
    .overview-notes { max-width:100%; color:var(--panel-muted); font-size:11px; }
    .overview-notes > summary { cursor:pointer; padding:2px 0; }
    .overview-notes[open] { flex-basis:100%; }
    p { margin:3px 0; overflow-wrap:anywhere; }
    strong { font-weight:500; }
    summary::-webkit-details-marker { display:none; }
    small { display:block; }
    .day-detail { padding:4px; background:rgba(0,0,0,.16); border-radius:6px; margin-bottom:4px; }
    .segment + .segment { border-top:1px solid var(--panel-border); margin-top:4px; padding-top:4px; }
    .segment button { margin-top:4px; }
    .month-grid { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:2px; margin:4px 0; }
    .month-grid button { min-width:0; min-height:36px; padding:3px 1px; overflow-wrap:anywhere; }
    .calendar-date { white-space:nowrap; }
    .weekday { color:var(--panel-muted); font-size:11px; text-align:center; overflow-wrap:anywhere; }
    .weekday.weekend, .weekend .calendar-date, .day-detail > .weekend { color:var(--panel-warning); font-weight:600; }
    /* Underlines keep weekend dates distinct without relying on color alone;
       the blue active border and duration bars retain their original meaning. */
    .weekend .calendar-date { text-decoration:underline; text-decoration-thickness:1px; text-underline-offset:2px; }
    .month-grid button.weekend:not(.active) { background:rgba(246,182,92,.06); }
    .bar { display:block; height:4px; background:rgba(255,255,255,.12); margin-top:4px; }
    .bar span { display:block; height:100%; background:#a3d8f6; }
    .month-detail { border-top:1px solid var(--panel-border); padding-top:4px; }
    .month-detail button { margin:3px 4px 0 0; }
    :focus-visible { outline:2px solid var(--panel-accent); outline-offset:-2px; }
</style>

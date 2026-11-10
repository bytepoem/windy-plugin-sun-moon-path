<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { UI_LANGUAGES } from './uiLanguage';
    import { messages } from './locales/TidePlanning';
    import { onPluginDestroy as onDestroy } from './pluginLifecycle';
    import { addDaysToDateInput, dateInputToUtcMidnight, formatLocalClock, type Coordinates } from './solar';
    import { createTideController, emptyTideState, tideHeightAt, type TideErrorCode } from './openMeteoTide';
    import { layoutTideLabels, TIDE_LABEL_HEIGHT, TIDE_LABEL_TOP_OFFSET, TIDE_LABEL_WIDTH } from './tideChartLabels';
    import type { UiLanguage } from './uiLanguage';

    export let location: Coordinates;
    export let date: string;
    export let timeZone: string;
    export let timestamp: number | null;
    export let now: number;
    export let active: boolean;
    export let ready: boolean;
    export let language: UiLanguage;
    export let events: { kind: string; time: Date | null }[] = [];
    const dispatch = createEventDispatcher<{ time: number }>();
    let state = emptyTideState();
    let view: 'curve' | 'table' = 'curve';
    const controller = createTideController(next => state = next);
    $: controller.update({ location, date, timeZone, now, active, ready });
    onDestroy(() => controller.destroy());
    $: start = dateInputToUtcMidnight(date, timeZone).getTime();
    $: end = dateInputToUtcMidnight(addDaysToDateInput(date, 1), timeZone).getTime();
    $: hourly = state.day?.hourly || [];
    // Merge the curve's extrema into hourly samples. A half-hour plateau peak gets its own row;
    // an extremum on an existing hour annotates that row without duplicating it.
    $: tablePoints = (() => {
        const points = new Map(hourly.filter(point => point.timestamp >= start && point.timestamp < end)
            .map(point => [point.timestamp, { ...point, type: null as 'H' | 'L' | null }]));
        for (const event of state.day?.events || []) {
            if (event.timestamp >= start && event.timestamp < end) { points.set(event.timestamp, event); }
        }
        return [...points.values()].sort((left, right) => left.timestamp - right.timestamp);
    })();
    // Read each column top-to-bottom, then continue with the next column.
    $: tableLayouts = [2, 3].map(columns => {
        const rows = Math.ceil(tablePoints.length / columns);
        return Array.from({ length: columns }, (_, column) => tablePoints.slice(column * rows, (column + 1) * rows));
    });
    $: viewAction = view === 'curve' ? (messages[language].switchToTable) : (messages[language].switchToCurve);
    $: heights = [...hourly, ...(state.day?.events || [])].map(point => point.height);
    $: minimum = heights.length ? Math.min(...heights) - 0.2 : 0;
    $: maximum = heights.length ? Math.max(...heights) + 0.2 : 1;
    const x = (at: number, from: number, to: number) => 42 + (at - from) / (to - from) * 540;
    // Reserve space above peaks and below troughs for their two-line labels.
    const y = (height: number, low: number, high: number) => 164 - (height - low) / (high - low) * 110;
    $: chartEvents = layoutTideLabels((state.day?.events || []).map(event => ({ ...event,
        pointX: x(event.timestamp, start, end), pointY: y(event.height, minimum, maximum) })));
    // Grow only to contain displaced labels, keeping the plot and time-axis scale unchanged.
    $: chartTop = Math.min(36, ...chartEvents.map(event => event.labelY - TIDE_LABEL_TOP_OFFSET - 4));
    $: chartAxisY = Math.max(225, ...chartEvents.map(event => event.labelY - TIDE_LABEL_TOP_OFFSET + TIDE_LABEL_HEIGHT + 24));
    // A new path segment marks a missing hour; the chart must not invent data across gaps.
    $: path = hourly.map((point, index) => `${index === 0 || point.timestamp - hourly[index - 1].timestamp > 3_600_000 ? 'M' : 'L'}${x(point.timestamp, start, end)},${y(point.height, minimum, maximum)}`).join(' ');
    $: selectedEvent = state.day?.events.find(event => event.timestamp === timestamp);
    $: selectedHeight = selectedEvent?.height ?? tideHeightAt(hourly, timestamp);
    $: selectedX = timestamp !== null && timestamp >= start && timestamp < end ? x(timestamp, start, end) : null;
    $: sunEvents = ready ? events.filter(event => ['dawn', 'sunrise', 'sunset', 'dusk'].includes(event.kind)
        && event.time && event.time.getTime() >= start && event.time.getTime() < end) : [];
    const clock = (at: number) => formatLocalClock(new Date(at), timeZone);
    const errorText = (code: TideErrorCode | null) => ({
        quota: messages[language].rateLimitReachedPleaseRetryLater,
        network: messages[language].requestFailedCheckYourNetworkAndRetry,
        data: messages[language].theAPIReturnedUnusableDataPleaseRetry,
    })[code || 'data'];
</script>

<section class="tide-planner" aria-label={messages[language].tidesAndSunlight}>
    <header><strong>{messages[language].waterLevelSunlight}</strong><span>{date}</span></header>
    <div role="status" hidden={ready && (state.status === 'ready' || state.status === 'idle')}>
        {#if !ready}<p>{messages[language].resolvingLocationAndLocalTime}</p>
        {:else if state.status === 'loading'}<p>{messages[language].loadingModelWaterLevels}</p>
        {:else if state.status === 'out-of-range'}<p>{messages[language].chooseADateWithinTenDaysFrom}</p>
        {:else if state.status === 'no-data'}<p>{messages[language].noOceanWaterLevelsForThisLocation}</p>
        {:else if state.status === 'error'}<p class="error">{errorText(state.error)}</p>{/if}
    </div>
    {#if state.status === 'error' || state.status === 'no-data'}
        <button class="retry" type="button" on:click={() => controller.retry()}>{messages[language].retry}</button>
    {/if}
    {#if state.status === 'ready' && state.day}
        <div class="readout">
            <strong>{timestamp === null ? '--:--' : clock(timestamp)}</strong>
            <div class="readout-data">
                <span>{messages[language].modelLevelMSL} {selectedHeight === null ? '—' : `≈ ${selectedHeight.toFixed(2)} m`}</span>
                <button type="button" class="hourly-toggle" aria-label={viewAction} title={viewAction}
                    on:click={() => view = view === 'curve' ? 'table' : 'curve'}>
                    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                        {#if view === 'curve'}
                            <rect x="2" y="2" width="12" height="12" rx="1.5" />
                            <path d="M2 6h12M2 10h12M7 2v12" />
                        {:else}
                            <path d="M2 2v12h12M3 10c2 0 2-6 4-6s2 7 4 7 2-4 3-4" />
                        {/if}
                    </svg>
                </button>
            </div>
        </div>
        {#if view === 'curve'}
            <svg class="tide-chart" viewBox={`0 ${chartTop} 600 ${chartAxisY + 5 - chartTop}`} role="group" aria-label={messages[language].modelWaterLevelsSelectAHighOr}>
                {#each [0, 0.5, 1] as fraction}
                    {@const height = minimum + fraction * (maximum - minimum)}
                    <line x1="42" x2="582" y1={y(height, minimum, maximum)} y2={y(height, minimum, maximum)} class="grid" />
                    <text x="35" y={y(height, minimum, maximum) + 4} text-anchor="end">{height.toFixed(1)}</text>
                {/each}
                {#each sunEvents as event}
                    {@const position = x(event.time?.getTime() || 0, start, end)}
                    <line x1={position} x2={position} y1="54" y2="164" class="sun-line" class:twilight={event.kind === 'dawn' || event.kind === 'dusk'} />
                {/each}
                <path d={path} class="tide-line" />
                {#if selectedX !== null}
                    <line x1={selectedX} x2={selectedX} y1="54" y2="164" class="selected-line" />
                    {#if selectedHeight !== null}<circle cx={selectedX} cy={y(selectedHeight, minimum, maximum)} r="4" class="selected-point" />{/if}
                {/if}
                {#each chartEvents as event}
                    {@const { pointX, pointY, labelX, labelY } = event}
                    {@const label = `${event.type === 'H' ? (messages[language].highLevel) : (messages[language].lowLevel)} ${messages[language].label} ${clock(event.timestamp)} · ${event.height.toFixed(2)} m`}
                    <g class="tide-event" role="button" tabindex="0" aria-label={label}
                        aria-pressed={timestamp === event.timestamp}
                        on:click={() => dispatch('time', event.timestamp)}
                        on:keydown={key => {
                            if (key.key === 'Enter' || key.key === ' ') {
                                key.preventDefault();
                                dispatch('time', event.timestamp);
                            }
                        }}>
                        <title>{label}</title>
                        {#if Math.abs(labelX - pointX) > 1 || Math.abs(labelY - pointY - (event.type === 'H' ? -34 : 26)) > 1}
                            <line class="event-leader" x1={pointX} y1={pointY}
                                x2={Math.max(labelX - TIDE_LABEL_WIDTH / 2, Math.min(labelX + TIDE_LABEL_WIDTH / 2, pointX))}
                                y2={labelY - TIDE_LABEL_TOP_OFFSET + (event.type === 'H' ? TIDE_LABEL_HEIGHT : 0)} />
                        {/if}
                        <circle cx={pointX} cy={pointY} r="3" class="tide-event-point" />
                        <rect class="event-hit-area" x={labelX - TIDE_LABEL_WIDTH / 2} y={labelY - TIDE_LABEL_TOP_OFFSET}
                            width={TIDE_LABEL_WIDTH} height={TIDE_LABEL_HEIGHT} rx="5" />
                        <text class="event-label" x={labelX} y={labelY} text-anchor="middle">
                            <tspan x={labelX}>{messages[language].label} {clock(event.timestamp)}</tspan>
                            <tspan x={labelX} dy="22">{event.height.toFixed(2)} m</tspan>
                        </text>
                    </g>
                {/each}
                {#each [0, 0.25, 0.5, 0.75, 1] as fraction}
                    <text x={42 + fraction * 540} y={chartAxisY} text-anchor={fraction === 0 ? 'start' : fraction === 1 ? 'end' : 'middle'}>{fraction === 1 ? '24:00' : clock(start + (end - start) * fraction)}</text>
                {/each}
            </svg>
        {:else}
            {#each tableLayouts as groups}
                <div class="hourly-columns" class:three-columns={groups.length === 3}>
                    {#each groups as points}
                        <table aria-label={messages[language].hourlyModelLevelsMSL}>
                            <thead><tr><th scope="col">{messages[language].time}</th><th scope="col">{messages[language].levelM}</th></tr></thead>
                            <tbody>
                                {#each points as point}
                                    <tr class:high-water={point.type === 'H'} class:low-water={point.type === 'L'}>
                                        <td>{point.type ? '≈ ' : ''}{clock(point.timestamp)}</td>
                                        <td>
                                            {#if point.type}
                                                <span class="extreme-label"
                                                    title={point.type === 'H' ? (messages[language].estimatedHighLevel) : (messages[language].estimatedLowLevel)}
                                                    aria-label={point.type === 'H' ? (messages[language].estimatedHighLevel) : (messages[language].estimatedLowLevel)}>
                                                    {point.type === 'H' ? (messages[language].h) : (messages[language].l)}
                                                </span>
                                            {/if}
                                            {point.height.toFixed(2)}
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    {/each}
                </div>
            {/each}
        {/if}
    {/if}
    <!-- The shell supplies the same astronomy strip and shared-time actions as the Events tab. -->
    <slot name="astronomy-events" />
    <p class="boundary">{messages[language].modelEstimatesAreForPhotographyReferenceNot}</p>
    <details><summary>{messages[language].waterLevelAndTimeNotes}</summary>
        <p>{messages[language].levelsAreRelativeToGlobalMeanSea}{timeZone}</p>
        {#if state.day}
            <p>{messages[language].modelGrid}{state.day.grid.lat.toFixed(3)}, {state.day.grid.lon.toFixed(3)} · {messages[language].fetched} {new Date(state.day.fetchedAt).toLocaleString(UI_LANGUAGES[language].clockLocale, { timeZone })}</p>
        {/if}
    </details>
    <footer><a href="https://open-meteo.com/en/docs/marine-weather-api" target="_blank" rel="noreferrer">Open-Meteo</a>
        <a href="https://open-meteo.com/en/license" target="_blank" rel="noreferrer">{messages[language].dataAttributionLicence}</a></footer>
</section>

<style>
    .tide-planner { box-sizing: border-box; height: 100%; overflow-y: auto; overscroll-behavior: contain; container-type: inline-size; padding: 8px 12px; display: flex; flex-direction: column; gap: 4px; min-width: 0; color: var(--panel-text); font-size: 12px; line-height: 1.5; }
    .tide-planner > * { flex-shrink: 0; }
    .tide-planner > [hidden] { display: none; }
    header, footer, .readout { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    header, .readout { justify-content: space-between; }
    header span, p { color: var(--panel-muted); }
    header strong { font-size: 12px; }
    p { margin: 0; line-height: 1.6; }
    .retry { align-self: flex-start; }
    button { min-height: 30px; padding: 4px 8px; color: inherit; background: rgba(255, 255, 255, .06); border: 1px solid var(--panel-border); border-radius: 6px; cursor: pointer; font: inherit; }
    button:hover { background: rgba(103, 197, 255, 0.12); }
    button:disabled { opacity: 0.5; cursor: default; }
    button:focus-visible, summary:focus-visible { outline: 2px solid #67c5ff; outline-offset: 2px; }
    .readout { flex-wrap: nowrap; gap: 6px; padding-top: 4px; border-top: 1px solid var(--panel-border); }
    .readout strong { font-size: 16px; line-height: 20px; font-variant-numeric: tabular-nums; }
    .readout-data { display: flex; align-items: center; justify-content: flex-end; gap: 4px; min-width: 0; }
    .hourly-toggle { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 24px; min-height: 24px; padding: 3px; border: 0; color: var(--panel-muted); background: transparent; }
    .hourly-toggle svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.3; }
    .tide-chart { display: block; width: 100%; overflow: visible; }
    .tide-chart text { fill: var(--panel-muted); font-size: 13px; }
    @container (max-width: 400px) { .tide-chart text { font-size: 21px; } }
    .grid { stroke: var(--panel-border); }
    .tide-line { stroke: #67c5ff; stroke-width: 2.5; fill: none; }
    .sun-line { stroke: #f3c36c; stroke-width: 1.5; stroke-dasharray: 4 4; }
    .twilight { stroke: #a8baff; stroke-dasharray: 2 5; }
    .selected-line { stroke: var(--panel-text); stroke-width: 1; }
    .selected-point { fill: #67c5ff; stroke: var(--panel-text); }
    .tide-event-point { fill: var(--panel-text); }
    .event-leader { stroke: var(--panel-muted); stroke-width: 1; opacity: 0.65; pointer-events: none; }
    .tide-event { cursor: pointer; outline: none; }
    .event-hit-area { fill: transparent; stroke: transparent; }
    .tide-chart .event-label { fill: var(--panel-text); font-size: 18px; font-variant-numeric: tabular-nums; paint-order: stroke; stroke: var(--panel-bg, #1e293f); stroke-width: 4px; stroke-linejoin: round; }
    .tide-event:hover .event-label, .tide-event[aria-pressed='true'] .event-label { fill: #67c5ff; }
    .tide-event:focus-visible .event-hit-area { stroke: #67c5ff; stroke-width: 2px; }
    @container (max-width: 400px) { .tide-chart .event-label { font-size: 21px; } }
    .boundary { border-top: 1px solid var(--panel-border); padding-top: 4px; }
    .error { color: #ffb6a7; }
    a { color: #67c5ff; }
    details { margin: 0; }
    summary { cursor: pointer; margin: 0; padding: 3px 0; line-height: 18px; }
    .hourly-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 12px; }
    .hourly-columns.three-columns { display: none; }
    @container (min-width: 400px) {
        .hourly-columns { display: none; }
        .hourly-columns.three-columns { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    table { width: 100%; border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; }
    td, th { padding: 3px 2px; text-align: left; white-space: nowrap; border-bottom: 1px solid var(--panel-border); }
    th { color: var(--panel-muted); font-weight: normal; }
    td:last-child, th:last-child { text-align: right; }
    .high-water { background: rgba(243, 195, 108, 0.08); }
    .low-water { background: rgba(103, 197, 255, 0.08); }
    .extreme-label { display: inline-block; margin-right: 3px; font-size: 10px; font-weight: 600; }
    .high-water .extreme-label { color: #f3c36c; }
    .low-water .extreme-label { color: #67c5ff; }
</style>

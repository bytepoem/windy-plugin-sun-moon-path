<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { onPluginDestroy as onDestroy } from './pluginLifecycle';
    import { addDaysToDateInput, dateInputToUtcMidnight, formatLocalClock, type Coordinates } from './solar';
    import { createTideController, emptyTideState, tideHeightAt, type TideErrorCode } from './openMeteoTide';
    import { layoutTideLabels, TIDE_LABEL_HEIGHT, TIDE_LABEL_TOP_OFFSET, TIDE_LABEL_WIDTH } from './tideChartLabels';

    export let location: Coordinates;
    export let date: string;
    export let timeZone: string;
    export let timestamp: number | null;
    export let now: number;
    export let active: boolean;
    export let ready: boolean;
    export let language: 'zh' | 'en';
    export let events: { kind: string; time: Date | null }[] = [];
    const dispatch = createEventDispatcher<{ time: number }>();
    let state = emptyTideState();
    let view: 'curve' | 'table' = 'curve';
    const controller = createTideController(next => state = next);
    $: controller.update({ location, date, timeZone, now, active, ready });
    onDestroy(() => controller.destroy());
    $: zh = language === 'zh';
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
    $: viewAction = view === 'curve' ? (zh ? '切换为表格' : 'Switch to table') : (zh ? '切换为曲线' : 'Switch to curve');
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
        quota: zh ? '请求过于频繁，请稍后重试。' : 'Rate limit reached. Please retry later.',
        network: zh ? '请求未完成，请检查网络后重试。' : 'Request failed. Check your network and retry.',
        data: zh ? '接口未返回可用数据，请稍后重试。' : 'The API returned unusable data. Please retry later.',
    })[code || 'data'];
</script>

<section class="tide-planner" aria-label={zh ? '潮汐与日出日落' : 'Tides and sunlight'}>
    <header><strong>{zh ? '水位 × 日出日落' : 'Water level × sunlight'}</strong><span>{date}</span></header>
    <div role="status" hidden={ready && (state.status === 'ready' || state.status === 'idle')}>
        {#if !ready}<p>{zh ? '等待地点与当地时间就绪…' : 'Resolving location and local time…'}</p>
        {:else if state.status === 'loading'}<p>{zh ? '正在加载模型水位…' : 'Loading model water levels…'}</p>
        {:else if state.status === 'out-of-range'}<p>{zh ? '请选择机位当地今天起 10 天内的日期，实际覆盖以模型数据为准。' : 'Choose a date within ten days from today at the camera location. Coverage depends on model availability.'}</p>
        {:else if state.status === 'no-data'}<p>{zh ? '此位置或日期暂无海洋水位数据，可选择沿海位置或其他日期。日光时刻仍可使用。' : 'No ocean water levels for this location or date. Try a coastal location or another date. Sunlight events remain available.'}</p>
        {:else if state.status === 'error'}<p class="error">{errorText(state.error)}</p>{/if}
    </div>
    {#if state.status === 'error' || state.status === 'no-data'}
        <button class="retry" type="button" on:click={() => controller.retry()}>{zh ? '重试' : 'Retry'}</button>
    {/if}
    {#if state.status === 'ready' && state.day}
        <div class="readout">
            <strong>{timestamp === null ? '--:--' : clock(timestamp)}</strong>
            <div class="readout-data">
                <span>{zh ? '模型水位（MSL）' : 'Model level (MSL)'} {selectedHeight === null ? '—' : `≈ ${selectedHeight.toFixed(2)} m`}</span>
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
            <svg class="tide-chart" viewBox={`0 ${chartTop} 600 ${chartAxisY + 5 - chartTop}`} role="group" aria-label={zh ? '模型水位曲线，点击高低水位标注选择时间' : 'Model water levels; select a high or low label to change time'}>
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
                    {@const label = `${event.type === 'H' ? (zh ? '高水位' : 'High level') : (zh ? '低水位' : 'Low level')} ${zh ? '约' : '≈'} ${clock(event.timestamp)} · ${event.height.toFixed(2)} m`}
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
                            <tspan x={labelX}>{zh ? '约' : '≈'} {clock(event.timestamp)}</tspan>
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
                        <table aria-label={zh ? '逐小时模型水位（MSL）' : 'Hourly model levels (MSL)'}>
                            <thead><tr><th scope="col">{zh ? '时间' : 'Time'}</th><th scope="col">{zh ? '水位(m)' : 'Level (m)'}</th></tr></thead>
                            <tbody>
                                {#each points as point}
                                    <tr class:high-water={point.type === 'H'} class:low-water={point.type === 'L'}>
                                        <td>{point.type ? '≈ ' : ''}{clock(point.timestamp)}</td>
                                        <td>
                                            {#if point.type}
                                                <span class="extreme-label"
                                                    title={point.type === 'H' ? (zh ? '估算高水位' : 'Estimated high level') : (zh ? '估算低水位' : 'Estimated low level')}
                                                    aria-label={point.type === 'H' ? (zh ? '估算高水位' : 'Estimated high level') : (zh ? '估算低水位' : 'Estimated low level')}>
                                                    {point.type === 'H' ? (zh ? '高' : 'H') : (zh ? '低' : 'L')}
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
    <p class="boundary">{zh ? '模型估算仅供摄影参考，不代表机位水深或通行安全。' : 'Model estimates are for photography reference, not local depth or access safety.'}</p>
    <details><summary>{zh ? '水位与时间说明' : 'Water level and time notes'}</summary>
        <p>{zh ? '水位相对全球平均海平面（MSL），包含潮汐及气压等影响，不是港口潮汐表或浪高。模型分辨率约 8 km，河口与近岸误差可能较大。高低水位时刻由逐小时曲线估算，不能用于航行。所有时刻按机位当地时区显示：' : 'Levels are relative to global mean sea level (MSL), including tides and pressure effects, not port tide tables or wave heights. Resolution is about 8 km, with limited accuracy near coasts and estuaries. High/low times are estimated from hourly samples, not for navigation. All times use the camera location zone: '}{timeZone}</p>
        {#if state.day}
            <p>{zh ? '参考格点：' : 'Model grid: '}{state.day.grid.lat.toFixed(3)}, {state.day.grid.lon.toFixed(3)} · {zh ? '获取于' : 'Fetched'} {new Date(state.day.fetchedAt).toLocaleString(zh ? 'zh-CN' : 'en-GB', { timeZone })}</p>
        {/if}
    </details>
    <footer><a href="https://open-meteo.com/en/docs/marine-weather-api" target="_blank" rel="noreferrer">Open-Meteo</a>
        <a href="https://open-meteo.com/en/license" target="_blank" rel="noreferrer">{zh ? '数据署名与许可' : 'Data attribution & licence'}</a></footer>
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

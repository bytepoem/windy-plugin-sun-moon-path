<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { formatDisplayDate } from './dateDisplay';
    import { labels } from './locales/FavoriteComparison';
    import { messages } from './locales/MultiDayOverview';
    import { messages as horizonText } from './locales/EventHorizon';
    import { translations as weatherText } from './locales/WeatherTable';
    import { translations } from './pluginTranslations';
    import { createMultiDayWeatherPresentation, multiDayMetricTitle, MULTI_DAY_METRICS, type MultiDayMetric } from './multiDayWeatherPresentation';
    import { comparisonInstantLabel } from './favoriteComparisonPeriod';
    import { formatLocalClock } from './solar';
    import { weatherConditionLabel, type WeatherLoadStatus, type WeatherPoint, type WeatherSource } from './weather';
    import WeatherIcon from './WeatherIcon.svelte';
    import WeatherMetricIcon from './WeatherMetricIcon.svelte';
    import { UI_LANGUAGES, type UiLanguage } from './uiLanguage';
    import type { MultiDayRow, MultiDayTarget } from './multiDayPlanner';
    import type { UnitPreferences } from './unitPreferences';

    export let rows: MultiDayRow[];
    export let target: MultiDayTarget;
    export let orientation: 'vertical' | 'horizontal';
    export let selectedDate = '';
    export let points: WeatherPoint[];
    export let status: WeatherLoadStatus;
    export let aodStatus: WeatherLoadStatus;
    export let visibilityStatus: WeatherLoadStatus;
    export let snowStatus: WeatherLoadStatus = 'idle';
    export let source: WeatherSource = 'windy';
    export let metrics: MultiDayMetric[] = MULTI_DAY_METRICS;
    export let language: UiLanguage;
    export let timeZone: string;
    export let units: UnitPreferences;
    const dispatch = createEventDispatcher<{ select: string }>();
    type Field = MultiDayMetric | 'weather' | 'coverage';
    let fields: Field[] = [];
    $: fields = ['weather', ...metrics, 'coverage'];
    $: text = labels[language];
    $: copy = messages[language];
    $: pluginText = translations[language];
    $: useChineseHeadingLines = language === 'zh' || language === 'zh-TW';
    $: fieldLabel = (field: Field) => field === 'weather' ? text.weather
        : field === 'coverage' ? copy.range : multiDayMetricTitle(field, language);
    // Only the rendering axes change. Project each date once, before either
    // table branch, so orientation never changes the data or starts requests.
    $: dates = rows.map(row => {
        const intervals = row.windows[target];
        const weather = intervals.length === 1 ? createMultiDayWeatherPresentation({
            interval:intervals[0], points, status, aodStatus, visibilityStatus, snowStatus, source, metrics, language, units,
        }) : null;
        const weekdayLabel = new Intl.DateTimeFormat(UI_LANGUAGES[language].locale, {
            timeZone:'UTC', weekday:'short',
        }).format(new Date(row.date + 'T12:00:00Z'));
        const label = `${formatDisplayDate(row.date)} ${weekdayLabel}`;
        const weekday = new Date(row.date + 'T12:00:00Z').getUTCDay();
        const clock = (kind: 'sunrise' | 'sunset') => {
            const time = row.timeline.items.find(item => item.kind === kind)?.time;
            return time ? formatLocalClock(time, timeZone) : horizonText[language].noEventThisDay;
        };
        const minutes = Math.round(intervals.reduce((total, interval) => total + interval.end.getTime() - interval.start.getTime(), 0) / 60_000);
        const duration = intervals.length ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : text.noWindow;
        const phase = `${Math.round(row.timeline.moonIllumination.fraction * 100)}%`;
        const coverage = weather?.stateLabel ?? (intervals.length ? `${text.allSegments} · ${intervals.length}` : text.noWindow);
        const period = intervals.map(interval => `${comparisonInstantLabel(interval.start.getTime(), timeZone)} – ${comparisonInstantLabel(interval.end.getTime(), timeZone)}`).join('; ');
        const coverageTitle = weather?.evidence.state === 'partial'
            && weather.evidence.coveredStart !== null && weather.evidence.coveredEnd !== null
            ? `${coverage}: ${comparisonInstantLabel(weather.evidence.coveredStart, timeZone)} – ${comparisonInstantLabel(weather.evidence.coveredEnd, timeZone)}` : coverage;
        const values = Object.fromEntries(fields.map(field => [field, field === 'coverage' ? coverage
            : field === 'weather' ? weather?.available ? text.missing : '—'
                : weather?.hasMetricEvidence(field)
                    ? weather.values[field] : '—'])) as Record<Field, string>;
        return {
            date:row.date, label, weekend:weekday === 0 || weekday === 6, sunrise:clock('sunrise'), sunset:clock('sunset'),
            duration, phase, values, conditions:weather?.available ? weather.conditions : [],
            missingConditions:weather?.available && weather.missingConditions, coverageTitle,
            title:`${label} · ${pluginText.events.sunrise} ${clock('sunrise')} · ${pluginText.events.sunset} ${clock('sunset')} · ${duration} · ${text.moonIllumination} ${phase}${period ? ` · ${period}` : ''}`,
        };
    });
</script>

<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
<div class="week-table-scroll" role="region" aria-label={copy.week} tabindex="0">
    <table class="week-matrix" class:horizontal={orientation === 'horizontal'} class:vertical={orientation === 'vertical'} style={`--date-count:${dates.length};--field-count:${fields.length}`}>
        {#if orientation === 'horizontal'}
            <thead><tr><th class="corner" scope="col"><span class:two-line-heading={useChineseHeadingLines}>{text.dateControl}</span></th>
                {#each dates as date (date.date)}
                    <th class="date-header" class:weekend={date.weekend} scope="col" id={`week-date-${date.date}`}>
                        <button type="button" data-date={date.date} class:selected={selectedDate === date.date} title={date.title} aria-label={date.title} aria-expanded={selectedDate === date.date} aria-controls="multi-day-week-details" on:click={() => dispatch('select', date.date)}>
                            <strong>{date.label}</strong><small>{date.duration} · {date.phase}</small><small>↑{date.sunrise} ↓{date.sunset}</small>
                        </button>
                    </th>
                {/each}
            </tr></thead>
            <tbody>{#each fields as field}
                <tr><th class="field-header" scope="row" id={`week-field-${field}`} title={fieldLabel(field)}>
                    {#if field === 'weather' || field === 'coverage'}<span class:two-line-heading={useChineseHeadingLines && field === 'coverage'}>{fieldLabel(field)}</span>{:else}
                        <span class="metric-heading"><WeatherMetricIcon metric={field} size={14} /><span class="metric-label">{weatherText[language].metrics[field][0]}</span></span>
                    {/if}
                </th>
                    {#each dates as date (date.date)}
                        <td class:weekend={date.weekend} headers={`week-date-${date.date} week-field-${field}`} title={date.coverageTitle}>
                            {#if field === 'weather' && date.conditions.length}
                                <span class="conditions">{#each date.conditions as point}
                                    {@const label = weatherConditionLabel(point.iconCode, language, point.snowCondition, point.snowIntensity)}
                                    <span title={label}><WeatherIcon code={point.iconCode} isDay={point.isDay} snowIntensity={point.snowIntensity} {label} /></span>
                                {/each}{#if date.missingConditions}<span>{text.missing}</span>{/if}</span>
                            {:else}{date.values[field]}{/if}
                        </td>
                    {/each}
                </tr>
            {/each}</tbody>
        {:else}
            <thead><tr><th class="corner" scope="col"><span class:two-line-heading={useChineseHeadingLines}>{text.dateControl}</span></th>
                {#each fields as field}<th class="field-header" scope="col" id={`week-field-${field}`} title={fieldLabel(field)}>
                    {#if field === 'weather' || field === 'coverage'}<span class:two-line-heading={useChineseHeadingLines && field === 'coverage'}>{fieldLabel(field)}</span>{:else}
                        <span class="metric-heading"><WeatherMetricIcon metric={field} size={14} /><span class="metric-label">{weatherText[language].metrics[field][0]}</span></span>
                    {/if}
                </th>{/each}
            </tr></thead>
            <tbody>{#each dates as date (date.date)}
                <tr><th class="date-header" class:weekend={date.weekend} scope="row" id={`week-date-${date.date}`}>
                    <button type="button" data-date={date.date} class:selected={selectedDate === date.date} title={date.title} aria-label={date.title} aria-expanded={selectedDate === date.date} aria-controls="multi-day-week-details" on:click={() => dispatch('select', date.date)}>
                        <strong>{date.label}</strong><small>{date.duration} · {date.phase}</small><small>↑{date.sunrise} ↓{date.sunset}</small>
                    </button>
                </th>
                    {#each fields as field}<td class:weekend={date.weekend} headers={`week-date-${date.date} week-field-${field}`} title={date.coverageTitle}>
                        {#if field === 'weather' && date.conditions.length}
                            <span class="conditions">{#each date.conditions as point}
                                {@const label = weatherConditionLabel(point.iconCode, language, point.snowCondition, point.snowIntensity)}
                                <span title={label}><WeatherIcon code={point.iconCode} isDay={point.isDay} snowIntensity={point.snowIntensity} {label} /></span>
                            {/each}{#if date.missingConditions}<span>{text.missing}</span>{/if}</span>
                        {:else}{date.values[field]}{/if}
                    </td>{/each}
                </tr>
            {/each}</tbody>
        {/if}
    </table>
</div>

<style>
    .week-table-scroll { max-width:100%; overflow-x:auto; overscroll-behavior-x:contain; margin:4px 0; }
    .week-matrix { border-collapse:separate; border-spacing:0; width:100%; table-layout:fixed; font-size:12px; line-height:1.35; font-variant-numeric:tabular-nums; }
    .horizontal { min-width:calc(54px + var(--date-count) * 112px); }
    .vertical { min-width:calc(116px + var(--field-count) * 106px); }
    th, td { padding:3px 5px; border-right:1px solid var(--panel-border); border-bottom:1px solid var(--panel-border); text-align:center; overflow-wrap:anywhere; }
    th { font-weight:normal; background:#1d263d; color:var(--panel-muted); }
    .corner { width:54px; position:sticky; left:0; z-index:2; }
    .horizontal .field-header, .vertical .date-header { position:sticky; left:0; z-index:1; }
    .horizontal .date-header { width:112px; }
    .vertical .corner { width:116px; }
    /* Four-character Chinese headings use two characters per line, preserving word pairs. */
    .two-line-heading { display:inline-block; width:2em; vertical-align:middle; }
    .date-header { padding:0; }
    .date-header button { display:block; width:100%; padding:4px 2px; border:1px solid transparent; border-radius:0; background:transparent; color:var(--panel-text); font:inherit; cursor:pointer; }
    strong, small { display:block; }
    strong { font-size:12px; font-weight:500; }
    small { margin-top:2px; font-size:10px; color:var(--panel-muted); }
    .date-header.weekend button strong { color:var(--panel-warning); font-weight:600; text-decoration:underline; text-underline-offset:2px; }
    .weekend { background:rgba(246,182,92,.06); }
    .date-header.weekend { background:#252a3b; }
    .date-header button.selected { border-color:var(--panel-accent); background:rgba(99,185,238,.14); }
    .conditions { display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:2px; }
    /* Keep short labels visible on touch screens; detailed rules stay in the header tooltip. */
    .metric-heading { display:flex; flex-direction:column; align-items:center; gap:1px; }
    .metric-label { font-size:10px; line-height:1.15; overflow-wrap:anywhere; }
    :focus-visible { outline:2px solid var(--panel-accent); outline-offset:-2px; }
</style>

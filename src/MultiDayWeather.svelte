<script lang="ts">
    import { labels } from './locales/FavoriteComparison';
    import { messages } from './locales/MultiDayOverview';
    import { comparisonInstantLabel } from './favoriteComparisonPeriod';
    import { createMultiDayWeatherPresentation, isSnowAccumulation, multiDayMetricTitle, multiDaySnowPeriod, MULTI_DAY_METRICS, type MultiDayMetric } from './multiDayWeatherPresentation';
    import { weatherConditionLabel, type WeatherPoint, type WeatherLoadStatus, type WeatherSource } from './weather';
    import WeatherIcon from './WeatherIcon.svelte';
    import WeatherMetricIcon from './WeatherMetricIcon.svelte';
    import type { MultiDayInterval } from './multiDayPlanner';
    import type { UnitPreferences } from './unitPreferences';
    import type { UiLanguage } from './uiLanguage';

    export let interval: MultiDayInterval;
    export let points: WeatherPoint[];
    export let status: WeatherLoadStatus;
    export let aodStatus: WeatherLoadStatus = 'idle';
    export let visibilityStatus: WeatherLoadStatus = 'idle';
    export let snowStatus: WeatherLoadStatus = 'idle';
    export let source: WeatherSource = 'windy';
    export let metrics: MultiDayMetric[] = MULTI_DAY_METRICS;
    export let language: UiLanguage;
    export let timeZone: string;
    export let units: UnitPreferences;
    export let expanded = false;
    export let showSummary = true;
    export let showCoverage = false;
    // Keep at most four columns per strip on narrow panels.
    $: metricGroups = Array.from({ length: Math.ceil(metrics.length / 4) }, (_, index) => metrics.slice(index * 4, (index + 1) * 4));
    $: text = labels[language];
    $: metricTitle = (metric: MultiDayMetric) => multiDayMetricTitle(metric, language, source);
    $: presentation = createMultiDayWeatherPresentation({
        interval, points, status, aodStatus, visibilityStatus, snowStatus, source, metrics, language, timeZone, units,
    });
    $: evidence = presentation.evidence;
    $: samples = presentation.samples;
    $: conditions = presentation.conditions;
    $: missingConditions = presentation.missingConditions;
    $: hasWindowEvidence = metrics.some(presentation.hasMetricEvidence);
    $: stateLabel = presentation.stateLabel;
    $: metricValue = presentation.metricValue;

    const accumulationPeriod = (point: WeatherPoint, metric: MultiDayMetric, weatherSource: WeatherSource): [number, number] | null =>
        isSnowAccumulation(metric) ? multiDaySnowPeriod(point, weatherSource)
            : point.precipitationPeriodMs ? [point.timestamp - point.precipitationPeriodMs, point.timestamp] : null;
</script>

<div class="window-weather">
    {#if showSummary && hasWindowEvidence}
        <span class="conditions"><span class="visually-hidden">{text.weather}</span>
            {#each conditions as point}
                {@const label = weatherConditionLabel(point.iconCode, language, point.snowCondition, point.snowIntensity)}
                <span class="condition" title={label}><WeatherIcon code={point.iconCode} isDay={point.isDay} snowIntensity={point.snowIntensity} {label} /></span>
            {/each}
            {#if !conditions.length || missingConditions}<span>{text.missing}</span>{/if}
        </span>
        <div class="metric-tables">
            {#each metricGroups as group}
                <table class="metric-table" aria-label={text.weather}>
                        <thead><tr>{#each group as metric}<th scope="col" title={metricTitle(metric)}><span class="metric-heading"><WeatherMetricIcon {metric} size={14} /></span><span class="visually-hidden">{metricTitle(metric)}</span></th>{/each}</tr></thead>
                        <tbody><tr>{#each group as metric}<td>{presentation.values[metric]}</td>{/each}</tr></tbody>
                </table>
            {/each}
        </div>
    {/if}
    {#if showSummary || showCoverage}
        <small class="coverage-state" class:warning={evidence.state === 'partial' || evidence.reference !== null}>{stateLabel}</small>
        {#if evidence.state === 'partial' && evidence.coveredStart !== null && evidence.coveredEnd !== null}
            <small class="coverage-period">{text.period}: {comparisonInstantLabel(evidence.coveredStart, timeZone)} – {comparisonInstantLabel(evidence.coveredEnd, timeZone)}</small>
        {/if}
    {/if}
    {#if expanded && samples.length && hasWindowEvidence}
        <details><summary>{text.samples} · {samples.length}</summary>
            <p>{evidence.reference ? messages[language].eventForecastRule : text.resolution} {text.precipitationRule}</p>
            <!-- Keyboard users need a focus target to scroll the original-sample table. -->
            <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
            <div class="samples" role="region" aria-label={text.samples} tabindex="0">
                <table><thead><tr><th scope="col">{text.period}</th><th scope="col">{text.weather}</th>{#each metrics as metric}<th scope="col" title={metricTitle(metric)}><span class="metric-heading"><WeatherMetricIcon {metric} size={14} /></span><span class="visually-hidden">{metricTitle(metric)}</span></th>{/each}</tr></thead><tbody>
                    {#each samples as point}
                        {@const instantaneous = presentation.instantPoints.includes(point)}
                        {@const label = weatherConditionLabel(point.iconCode, language, point.snowCondition, point.snowIntensity)}
                        <tr><th scope="row">{comparisonInstantLabel(point.timestamp, timeZone)}</th>
                            <td>{#if instantaneous && point.iconCode !== null}<span class="condition" title={label}><WeatherIcon code={point.iconCode} isDay={point.isDay} snowIntensity={point.snowIntensity} {label} /></span>{:else}{text.missing}{/if}</td>
                            {#each metrics as metric}
                                {@const matches = presentation.samplesForMetric(metric).includes(point)}
                                {@const isAccumulation = metric === 'precipMm' || isSnowAccumulation(metric)}
                                {@const period = isAccumulation && matches ? accumulationPeriod(point, metric, source) : null}
                                <td>{matches ? metricValue(metric, [point]) : text.missing}
                                    {#if isAccumulation && matches}<small>{period ? `${comparisonInstantLabel(period[0], timeZone)} – ${comparisonInstantLabel(period[1], timeZone)}` : text.sourceStep}</small>{/if}
                                </td>
                            {/each}</tr>
                    {/each}
                </tbody></table>
            </div>
        </details>
    {/if}
</div>

<style>
    .window-weather { display:flex; flex-wrap:wrap; align-items:baseline; gap:0 8px; font-size:12px; overflow-wrap:anywhere; container-type:inline-size; }
    .window-weather > span, .window-weather > small { min-width:0; }
    .conditions, .condition { display:inline-flex; align-items:center; flex-wrap:wrap; gap:0 4px; }
    .condition { max-width:100%; }
    .coverage-period, details { flex-basis:100%; min-width:0; }
    small, p { color:var(--panel-muted); font-size:11px; }
    .warning { color:var(--panel-warning); }
    summary { cursor:pointer; padding:3px 0; }
    p { margin:3px 0; }
    .samples { overflow-x:auto; max-width:100%; }
    table { width:100%; border-collapse:collapse; font-size:11px; }
    th, td { padding:5px; text-align:start; border-bottom:1px solid var(--panel-border); font-weight:normal; white-space:nowrap; }
    .metric-tables { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0; width:100%; }
    .conditions, .coverage-state { order:-1; }
    .coverage-state { margin-inline-start:auto; }
    .metric-table { table-layout:fixed; font-size:12px; }
    .metric-table th, .metric-table td { padding:1px 3px; text-align:center; border:1px solid var(--panel-border); white-space:normal; overflow-wrap:anywhere; }
    .metric-table th { background:rgba(255,255,255,.04); color:var(--panel-muted); }
    .metric-heading { display:flex; justify-content:center; }
    .visually-hidden { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; border:0; }
    @container (max-width:560px) { .metric-tables { grid-template-columns:1fr; } }
    small { display:block; }
    :focus-visible { outline:2px solid var(--panel-accent); outline-offset:-2px; }
</style>

<script lang="ts">
    import { comparisonInstantLabel, type ComparisonPeriod } from './favoriteComparisonPeriod';
    import { labels } from './locales/FavoriteComparison';
    import { DEFAULT_UI_LANGUAGE, type UiLanguage } from './uiLanguage';
    import { formatPrecipitationRangeMm, formatWindSpeedRange, type UnitPreferences } from './unitPreferences';
    import type { FavoriteComparisonResult } from './favoriteComparison';

    export let result: FavoriteComparisonResult;
    export let period: ComparisonPeriod | undefined;
    export let language: UiLanguage = DEFAULT_UI_LANGUAGE;
    export let units: UnitPreferences;
    $: text = labels[language];
    $: timeZone = result.prepared.status === 'ready' ? result.prepared.timeZone : 'UTC';
    // Independent atmosphere timestamps are useful in summaries but are not
    // original cloud/wind/precipitation samples from the selected provider.
    $: weatherTimestamps = new Set(result.forecastPoints.map(point => point.timestamp));
    $: rows = [...new Map([...(period?.points ?? []), ...(period?.precipitationPoints ?? [])]
        .filter(point => weatherTimestamps.has(point.timestamp))
        .map(point => [point.timestamp, point])).values()].sort((a, b) => a.timestamp - b.timestamp);
    const range = (value: number) => ({ minimum: value, maximum: value });
</script>

<section aria-label={result.prepared.target.title}>
    <strong>{result.prepared.target.title}</strong>
    <div class="forecast-samples">
        <table>
            <caption>{text.samples} · {rows.length}</caption>
            <thead><tr><th>{text.period}</th><th>{text.cloud}</th><th>{text.wind}</th><th>{text.precipitation}</th></tr></thead>
            <tbody>
                {#each rows as point (point.timestamp)}
                    <tr>
                        <th scope="row">{comparisonInstantLabel(point.timestamp, timeZone)}
                            {#if !period?.points.some(sample => sample.timestamp === point.timestamp)}<small>{text.outsidePeriod}</small>{/if}
                        </th>
                        <td>{period?.points.some(sample => sample.timestamp === point.timestamp) && point.totalCloudPercent !== null ? `${Math.round(point.totalCloudPercent)}%` : text.missing}</td>
                        <td>{period?.points.some(sample => sample.timestamp === point.timestamp) && point.windMs !== null ? formatWindSpeedRange(range(point.windMs), units.wind) : text.missing}</td>
                        <td>
                            {#if period?.precipitationPoints.some(sample => sample.timestamp === point.timestamp) && point.precipMm !== null}
                                {formatPrecipitationRangeMm(range(point.precipMm), units.precipitation)}
                                <small>{point.precipitationPeriodMs ? `${comparisonInstantLabel(point.timestamp - point.precipitationPeriodMs, timeZone)} – ${comparisonInstantLabel(point.timestamp, timeZone)}` : text.sourceStep}</small>
                            {:else}{text.missing}{/if}
                        </td>
                    </tr>
                {:else}
                    <tr><td colspan="4">{period?.coverage === 'error' ? text.weatherError : period?.coverage === 'outside' ? text.outsideForecast : period?.coverage === 'no-window' ? text.noWindow : text.missing}</td></tr>
                {/each}
            </tbody>
        </table>
    </div>
</section>

<style>
    section { margin-top: 10px; }
    .forecast-samples { overflow-x: auto; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    caption { text-align: start; color: var(--panel-muted); }
    th, td { padding: 5px; text-align: start; border-bottom: 1px solid var(--panel-border); }
    th { font-weight: normal; }
    small { display: block; color: var(--panel-muted); font-size: 10px; }
</style>

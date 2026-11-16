import { labels } from './locales/FavoriteComparison';
import { translations as weatherText, messages as weatherMessages } from './locales/WeatherTable';
import { messages as cloudText } from './locales/CloudObstruction';
import { multiDayMetricRange, multiDayPrecipitationPoints, multiDayWindowWeather, type MultiDayInterval } from './multiDayPlanner';
import { formatPrecipitationRangeMm, formatTemperatureRangeC, formatVisibilityRangeKm, formatWindSpeedRange, type UnitPreferences } from './unitPreferences';
import type { WeatherLoadStatus, WeatherMetric, WeatherPoint } from './weather';
import type { UiLanguage } from './uiLanguage';

export type MultiDayMetric = Exclude<WeatherMetric, 'windDirectionDeg'>;
export const MULTI_DAY_METRICS: MultiDayMetric[] = [
    'totalCloudPercent', 'windMs', 'precipMm', 'temperatureC', 'humidityPercent',
    'visibilityKm', 'aod550', 'dewPointC',
];

export const multiDayMetricTitle = (metric: MultiDayMetric, language: UiLanguage): string =>
    `${weatherText[language].metrics[metric][0]}${metric === 'precipMm'
        ? ` · ${labels[language].precipitationRule}` : metric === 'aod550'
            ? ` · ${weatherMessages[language].aODAtNanometresOpenMeteoSourcedFrom}` : ''}`;

/** One projection per window is shared by the date matrix and original-sample
 * details. Display direction cannot change samples, units or channel states.
 */
export const createMultiDayWeatherPresentation = ({ interval, points, status, aodStatus, visibilityStatus, language, units }: {
    interval: MultiDayInterval; points: WeatherPoint[]; status: WeatherLoadStatus;
    aodStatus: WeatherLoadStatus; visibilityStatus: WeatherLoadStatus; language: UiLanguage; units: UnitPreferences;
}) => {
    const text = labels[language];
    const evidence = multiDayWindowWeather(interval, points, status);
    const precipitation = multiDayPrecipitationPoints(interval, points);
    const samples = [...new Map([...evidence.points, ...precipitation].map(point => [point.timestamp, point])).values()]
        .sort((a, b) => a.timestamp - b.timestamp);
    const conditions = [...new Map(evidence.points.filter(point => point.iconCode !== null)
        .map(point => [`${point.iconCode}|${point.isDay}`, point])).values()];
    const missingConditions = evidence.points.some(point => point.iconCode === null);
    const available = evidence.state === 'full' || evidence.state === 'partial';
    // Accumulations cover periods, so valid rain can overlap a short window
    // even when none of the source's instantaneous timestamps falls inside it.
    const precipitationAvailable = status === 'ready' && multiDayMetricRange(precipitation, 'precipMm') !== null;
    const stateLabel = evidence.state === 'loading' ? weatherText[language].loading
        : evidence.state === 'error' ? text.atmosphereError : evidence.state === 'outside' ? text.outsideForecast
        : evidence.state === 'missing' ? text.missing : evidence.state === 'partial' ? text.partial : text.full;
    const formatRange = (metric: MultiDayMetric, range: NonNullable<ReturnType<typeof multiDayMetricRange>>) => {
        const value = { minimum:range.min, maximum:range.max };
        if (metric === 'windMs') { return formatWindSpeedRange(value, units.wind); }
        if (metric === 'precipMm') { return formatPrecipitationRangeMm(value, units.precipitation); }
        if (metric === 'temperatureC' || metric === 'dewPointC') { return formatTemperatureRangeC(value, units.temperature); }
        if (metric === 'visibilityKm') { return formatVisibilityRangeKm(value, units.distance); }
        const format = (number: number) => metric === 'aod550' ? number.toFixed(2) : String(Math.round(number));
        const minimum = format(range.min);
        const maximum = format(range.max);
        return `${minimum === maximum ? minimum : `${minimum}–${maximum}`}${metric === 'aod550' ? '' : '%'}`;
    };
    const metricValue = (metric: MultiDayMetric, selected: WeatherPoint[]): string => {
        const loadStatus = metric === 'aod550' ? aodStatus : metric === 'visibilityKm' ? visibilityStatus : status;
        if (loadStatus === 'idle' || loadStatus === 'loading') { return cloudText[language].loading; }
        if (loadStatus === 'error') { return text.atmosphereError; }
        const range = multiDayMetricRange(selected, metric);
        if (!range) { return text.missing; }
        return `${formatRange(metric, range)}${range.missing ? ` (${text.missing})` : ''}`;
    };
    const values = Object.fromEntries(MULTI_DAY_METRICS.map(metric => [
        metric, metricValue(metric, metric === 'precipMm' ? precipitation : evidence.points),
    ])) as Record<MultiDayMetric, string>;
    return { evidence, precipitation, samples, conditions, missingConditions, available, precipitationAvailable, stateLabel, values, metricValue };
};

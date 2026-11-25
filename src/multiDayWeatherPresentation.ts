import { labels } from './locales/FavoriteComparison';
import { translations as weatherText, messages as weatherMessages, weatherMetricLabel } from './locales/WeatherTable';
import { messages as cloudText } from './locales/CloudObstruction';
import { messages as overviewText } from './locales/MultiDayOverview';
import { translations } from './pluginTranslations';
import { formatLocalClock } from './solar';
import { multiDayMetricRange, multiDayPrecipitationPoints, multiDayWindowWeather, type MultiDayInterval } from './multiDayPlanner';
import { formatPrecipitationRangeMm, formatTemperatureRangeC, formatVisibilityRangeKm, formatWindSpeedRange, type UnitPreferences } from './unitPreferences';
import { weatherMetricValue, type WeatherLoadStatus, type WeatherMetric, type WeatherPoint, type WeatherSource } from './weather';
import { UI_LANGUAGES, type UiLanguage } from './uiLanguage';
import type { SnowDisplayPreference } from './pluginPreferences';

export type MultiDayMetric = Exclude<WeatherMetric, 'windDirectionDeg' | 'snowWaterMm'>;
export const MULTI_DAY_METRICS: MultiDayMetric[] = [
    'totalCloudPercent', 'windMs', 'precipMm', 'temperatureC', 'humidityPercent',
    'visibilityKm', 'aod550', 'dewPointC',
];

const SNOW_METRICS = ['snowfallCm', 'snowDepthCm'] as const;
type SnowMetric = typeof SNOW_METRICS[number];

export const isSnowAccumulation = (metric: MultiDayMetric): boolean =>
    metric === 'snowfallCm';

/** Windy columns anchor the beginning of a period, OM columns anchor its end. */
export const multiDaySnowPeriod = (point: WeatherPoint, source: WeatherSource): [number, number] | null => {
    if (source === 'open-meteo' && point.precipitationPeriodMs) {
        return [point.timestamp - point.precipitationPeriodMs, point.timestamp];
    }
    if (source === 'windy' && point.snowWaterPeriodHours) {
        return [point.timestamp, point.timestamp + point.snowWaterPeriodHours * 3_600_000];
    }
    return null;
};

const snowOverlaps = (interval: MultiDayInterval, point: WeatherPoint, source: WeatherSource): boolean => {
    const period = multiDaySnowPeriod(point, source);
    return period ? period[0] < interval.end.getTime() && period[1] > interval.start.getTime()
        : point.timestamp >= interval.start.getTime() && point.timestamp < interval.end.getTime();
};

export const multiDayWeatherMetrics = (
    intervals: MultiDayInterval[], points: WeatherPoint[], source: WeatherSource, snowDisplay: SnowDisplayPreference,
): MultiDayMetric[] => {
    if (snowDisplay === 'hidden') { return MULTI_DAY_METRICS; }
    const hasPositiveValue = (metric: SnowMetric) => points.some(point => (point[metric] ?? 0) > 0
        && intervals.some(interval => metric === 'snowDepthCm'
            ? point.timestamp >= interval.start.getTime() && point.timestamp < interval.end.getTime()
            : snowOverlaps(interval, point, source)));
    const snow = SNOW_METRICS.filter(metric => snowDisplay === 'always' || hasPositiveValue(metric));
    return MULTI_DAY_METRICS.flatMap(metric => metric === 'precipMm' ? [metric, ...snow] : [metric]);
};

export const multiDayMetricTitle = (metric: MultiDayMetric, language: UiLanguage, source: WeatherSource): string =>
    `${weatherMetricLabel(metric, language, source)}${metric === 'precipMm'
        ? ` · ${labels[language].precipitationRule}` : isSnowAccumulation(metric)
            ? ` · ${overviewText[language].snowRule}` : metric === 'aod550'
            ? ` · ${weatherMessages[language].aODAtNanometresOpenMeteoSourcedFrom}` : ''}`;

/** One projection per window is shared by the date matrix and original-sample
 * details. Display direction cannot change samples, units or channel states.
 */
export const createMultiDayWeatherPresentation = ({
    interval, points, status, aodStatus, visibilityStatus, snowStatus, source, metrics, language, timeZone, units,
}: {
    interval: MultiDayInterval; points: WeatherPoint[]; status: WeatherLoadStatus;
    aodStatus: WeatherLoadStatus; visibilityStatus: WeatherLoadStatus; snowStatus: WeatherLoadStatus; source: WeatherSource;
    metrics: MultiDayMetric[]; language: UiLanguage; timeZone: string; units: UnitPreferences;
}) => {
    const text = labels[language];
    const evidence = multiDayWindowWeather(interval, points, status);
    const { reference } = evidence;
    const instantPoints = reference ? [reference.point] : evidence.points;
    const referenceTime = reference
        ? `${cloudText[language].reference} ${formatLocalClock(new Date(reference.point.timestamp), timeZone)}` : '';
    const referenceOffset = reference ? new Intl.NumberFormat(UI_LANGUAGES[language].locale, {
        style: 'unit', unit: 'minute', signDisplay: 'always',
    }).format(Math.round(reference.offsetMs / 60_000)) : '';
    const precipitation = multiDayPrecipitationPoints(interval, points);
    const snowMetrics = metrics.filter(isSnowAccumulation);
    const snow = snowMetrics.length ? points.filter(point => snowOverlaps(interval, point, source)) : [];
    const snowSamples = snow.filter(point => snowMetrics.some(metric => weatherMetricValue(point, metric) !== null));
    const samples = [...new Map([...instantPoints, ...precipitation, ...snowSamples].map(point => [point.timestamp, point])).values()]
        .sort((a, b) => a.timestamp - b.timestamp);
    const conditions = [...new Map(instantPoints.filter(point => point.iconCode !== null)
        .map(point => [`${point.iconCode}|${point.isDay}|${point.snowCondition}|${point.snowIntensity}`, point])).values()];
    const missingConditions = instantPoints.some(point => point.iconCode === null);
    const hasWindowSamples = evidence.state === 'full' || evidence.state === 'partial';
    const available = hasWindowSamples || reference !== null;
    // Accumulations cover periods, so valid rain can overlap a short window
    // even when none of the source's instantaneous timestamps falls inside it.
    const samplesForMetric = (metric: MultiDayMetric): WeatherPoint[] => {
        if (metric === 'precipMm') { return precipitation; }
        if (isSnowAccumulation(metric)) { return snow; }
        return metric === 'snowDepthCm' ? evidence.points : instantPoints;
    };
    const hasMetricEvidence = (metric: MultiDayMetric): boolean => {
        if (hasWindowSamples) { return true; }
        if (metric === 'precipMm' || isSnowAccumulation(metric)) {
            return status === 'ready' && multiDayMetricRange(samplesForMetric(metric), metric) !== null;
        }
        return reference !== null && metric !== 'snowDepthCm';
    };
    const stateLabel = reference ? `${referenceTime} · ${translations[language].events[reference.event]} ${referenceOffset}`
        : evidence.state === 'loading' ? weatherText[language].loading
        : evidence.state === 'error' ? text.atmosphereError : evidence.state === 'outside' ? text.outsideForecast
        : evidence.state === 'missing' ? text.missing : evidence.state === 'partial' ? text.partial : text.full;
    const formatRange = (metric: MultiDayMetric, range: NonNullable<ReturnType<typeof multiDayMetricRange>>) => {
        const value = { minimum:range.min, maximum:range.max };
        if (metric === 'windMs') { return formatWindSpeedRange(value, units.wind); }
        if (metric === 'precipMm') { return formatPrecipitationRangeMm(value, units.precipitation); }
        if (metric === 'temperatureC' || metric === 'dewPointC') { return formatTemperatureRangeC(value, units.temperature); }
        if (metric === 'visibilityKm') { return formatVisibilityRangeKm(value, units.distance); }
        const snowUnit = metric === 'snowfallCm' || metric === 'snowDepthCm' ? ' cm' : '';
        const format = (number: number) => {
            if (snowUnit) { return number > 0 && number < 0.01 ? '<0.01' : String(Number(number.toFixed(2))); }
            return metric === 'aod550' ? number.toFixed(2) : String(Math.round(number));
        };
        const minimum = format(range.min);
        const maximum = format(range.max);
        return `${minimum === maximum ? minimum : `${minimum}–${maximum}`}${snowUnit || (metric === 'aod550' ? '' : '%')}`;
    };
    const metricValue = (metric: MultiDayMetric, selected: WeatherPoint[]): string => {
        const loadStatus = metric === 'aod550' ? aodStatus : metric === 'visibilityKm' ? visibilityStatus
            : source === 'windy' && metric === 'snowDepthCm' ? snowStatus : status;
        if (loadStatus === 'idle' || loadStatus === 'loading') { return cloudText[language].loading; }
        if (loadStatus === 'error') { return text.atmosphereError; }
        const range = multiDayMetricRange(selected, metric);
        if (!range) { return text.missing; }
        return `${formatRange(metric, range)}${range.missing ? ` (${text.missing})` : ''}`;
    };
    const values = Object.fromEntries(metrics.map(metric => [
        metric, metricValue(metric, samplesForMetric(metric)),
    ])) as Record<MultiDayMetric, string>;
    return { evidence, instantPoints, samples, conditions, missingConditions, available, hasMetricEvidence,
        samplesForMetric, stateLabel, referenceTime, values, metricValue };
};

import { messages } from './locales/weather';
import type { UiLanguage } from './uiLanguage';
export type WeatherModel = 'ecmwf' | 'gfs' | 'icon';
export type WeatherSource = 'windy' | 'open-meteo';

export type WeatherLoadStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export type SnowCondition = 'snow' | 'wetSnow' | 'rainAndSnow' | 'snowGrains' | 'snowShowers';
export type SnowIntensity = 'light' | 'moderate' | 'heavy';
type DailySnowGrade = SnowIntensity | 'trace' | 'snowstorm' | 'heavySnowstorm' | 'extremeSnowstorm';

export type WeatherMetric =
    | 'totalCloudPercent'
    | 'highCloudPercent'
    | 'mediumCloudPercent'
    | 'lowCloudPercent'
    | 'temperatureC'
    | 'dewPointC'
    | 'humidityPercent'
    | 'precipMm'
    | 'snowWaterMm'
    | 'snowfallCm'
    | 'snowDepthCm'
    | 'windMs'
    | 'windGustMs'
    | 'windDirectionDeg'
    | 'aod550'
    | 'visibilityKm';

export type WeatherTone =
    | 'cloud'
    | 'good'
    | 'warning'
    | 'orange'
    | 'danger'
    | 'cold'
    | 'cool'
    | 'mild'
    | 'freezing'
    | 'neutral'
    | 'unknown';

type NumericArray = (number | null | undefined)[];

export interface WeatherForecastPayload {
    header?: { elevation: number; modelElevation?: number };
    data: {
        ts: number[];
        icon: NumericArray;
        isDay: NumericArray;
        temperature: NumericArray;
        precipAmount: NumericArray;
        precipSnowAmount?: NumericArray;
        precipType?: NumericArray;
        wind: NumericArray;
        windGust?: NumericArray;
        windDir: NumericArray;
    };
    meteogram?: {
        ts: number[];
        dewPoint: NumericArray;
        [key: string]: NumericArray;
    };
    sounding?: {
        ts: number[];
        [key: string]: NumericArray;
    };
}

export interface WeatherPoint {
    /** Accumulations end at timestamp; omitted for legacy Windy forecast steps. */
    precipitationPeriodMs?: number;
    timestamp: number;
    iconCode: number | null;
    isDay: boolean;
    totalCloudPercent: number | null;
    highCloudPercent: number | null;
    mediumCloudPercent: number | null;
    lowCloudPercent: number | null;
    temperatureC: number | null;
    dewPointC: number | null;
    humidityPercent: number | null;
    precipMm: number | null;
    snowWaterMm?: number | null;
    snowWaterPeriodHours?: 1 | 3 | null;
    snowfallCm?: number | null;
    snowDepthCm?: number | null;
    snowCondition?: SnowCondition | null;
    snowIntensity?: SnowIntensity | null;
    windMs: number | null;
    windGustMs?: number | null;
    windDirectionDeg: number | null;
    aod550: number | null;
    visibilityKm: number | null;
}

export interface WeatherDateGroup {
    key: string;
    label: string;
    startIndex: number;
    length: number;
}

export type WeatherDateCoverage = 'covered' | 'before-range' | 'after-range' | 'missing' | 'empty';

export interface WeatherDateSelection {
    coverage: WeatherDateCoverage;
    startIndex: number | null;
    length: number;
}

export interface WeatherLoadDecision {
    isMounted: boolean;
    isWeatherTabActive: boolean;
    locationKey: string;
    resolvedContextLocationKey: string;
    requestKey: string;
    loadedKey: string;
    loadingKey: string;
}

export interface WeatherResponseIdentity {
    aborted: boolean;
    requestId: number;
    latestRequestId: number;
    requestKey: string;
    currentRequestKey: string;
}

export const WEATHER_PAST_WINDOW_MS = 6 * 60 * 60 * 1000;
export const WEATHER_FUTURE_WINDOW_MS = 5 * 24 * 60 * 60 * 1000;

export const buildWeatherLocationKey = (location: { lat: number; lon: number }): string =>
    `${location.lat}|${location.lon}`;

export const buildWeatherRequestKey = (
    model: WeatherModel,
    locationKey: string,
    timestamp: number,
    source: WeatherSource = 'windy',
): string => `${source}|${model}|${locationKey}|${Math.floor(timestamp / 3_600_000)}`;

export const shouldLoadWeather = (decision: WeatherLoadDecision): boolean =>
    decision.isMounted
    && decision.isWeatherTabActive
    && decision.resolvedContextLocationKey === decision.locationKey
    && decision.requestKey !== decision.loadedKey
    && decision.requestKey !== decision.loadingKey;

export const isWeatherResponseCurrent = (identity: WeatherResponseIdentity): boolean =>
    !identity.aborted
    && identity.requestId === identity.latestRequestId
    && identity.requestKey === identity.currentRequestKey;

const LOW_CLOUD_KEYS = [
    'cloud-surface',
    'cloud-1000h',
    'cloud-950h',
    'cloud-925h',
    'cloud-900h',
    'cloud-850h',
] as const;

const MEDIUM_CLOUD_KEYS = [
    'cloud-800h',
    'cloud-700h',
    'cloud-600h',
    'cloud-500h',
] as const;

const HIGH_CLOUD_KEYS = [
    'cloud-400h',
    'cloud-300h',
    'cloud-250h',
    'cloud-200h',
    'cloud-150h',
] as const;

const finiteNumber = (value: number | null | undefined): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;

const roundTo = (value: number, decimalPlaces = 0): number => {
    const multiplier = 10 ** decimalPlaces;
    return Math.round(value * multiplier) / multiplier;
};

const clamp = (value: number, minimum: number, maximum: number): number =>
    Math.min(maximum, Math.max(minimum, value));

const kelvinToCelsius = (value: number | null): number | null =>
    value === null ? null : Math.round(value - 273.15);

const normalizePercent = (value: number | null): number | null =>
    value === null ? null : Math.round(clamp(value, 0, 100));

const normalizeDirection = (value: number | null): number | null => {
    if (value === null) {
        return null;
    }
    return Math.round(((value % 360) + 360) % 360);
};

const buildTimestampIndex = (timestamps: number[] | undefined): Map<number, number> =>
    new Map((timestamps || []).map((timestamp, index) => [timestamp, index]));

const valueAtTimestamp = (
    series: { [key: string]: NumericArray } | undefined,
    indexByTimestamp: Map<number, number>,
    key: string,
    timestamp: number,
): number | null => {
    if (!series) {
        return null;
    }
    const index = indexByTimestamp.get(timestamp);
    return index === undefined ? null : finiteNumber(series[key]?.[index]);
};

const aggregateCloudBand = (
    series: WeatherForecastPayload['meteogram'],
    indexByTimestamp: Map<number, number>,
    keys: ReadonlyArray<string>,
    timestamp: number,
): number | null => {
    const values = keys
        .map(key => valueAtTimestamp(series, indexByTimestamp, key, timestamp))
        .filter((value): value is number => value !== null);
    return values.length === 0 ? null : normalizePercent(Math.max(...values));
};

export const combineCloudBands = (
    lowCloudPercent: number | null,
    mediumCloudPercent: number | null,
    highCloudPercent: number | null,
): number | null => {
    if (lowCloudPercent === null || mediumCloudPercent === null || highCloudPercent === null) {
        return null;
    }
    const clearFraction = [lowCloudPercent, mediumCloudPercent, highCloudPercent]
        .map(value => 1 - clamp(value, 0, 100) / 100)
        .reduce((product, value) => product * value, 1);
    return Math.round((1 - clearFraction) * 100);
};

const WINDY_SNOW_CONDITIONS: Partial<Record<number, SnowCondition>> = {
    4: 'snow',
    5: 'wetSnow',
    6: 'rainAndSnow',
};

/** Windy timestamps mark segment starts. The final row follows the preceding step. */
const windySnowPeriodHours = (timestamps: number[], index: number): 1 | 3 | null => {
    const start = timestamps[index];
    const next = timestamps[index + 1];
    const stepMs = next === undefined ? start - timestamps[index - 1] : next - start;
    const hours = stepMs / 3_600_000;
    return hours === 1 || hours === 3 ? hours : null;
};

export const transformWeatherPayload = (
    payload: WeatherForecastPayload,
    now = Date.now(),
): WeatherPoint[] => {
    const minimumTimestamp = now - WEATHER_PAST_WINDOW_MS;
    const maximumTimestamp = now + WEATHER_FUTURE_WINDOW_MS;
    const meteogramIndex = buildTimestampIndex(payload.meteogram?.ts);
    const soundingIndex = buildTimestampIndex(payload.sounding?.ts);

    return payload.data.ts
        .map((timestamp, dataIndex): WeatherPoint | null => {
            if (!Number.isFinite(timestamp) || timestamp < minimumTimestamp || timestamp > maximumTimestamp) {
                return null;
            }

            const lowCloudPercent = aggregateCloudBand(
                payload.meteogram,
                meteogramIndex,
                LOW_CLOUD_KEYS,
                timestamp,
            );
            const mediumCloudPercent = aggregateCloudBand(
                payload.meteogram,
                meteogramIndex,
                MEDIUM_CLOUD_KEYS,
                timestamp,
            );
            const highCloudPercent = aggregateCloudBand(
                payload.meteogram,
                meteogramIndex,
                HIGH_CLOUD_KEYS,
                timestamp,
            );
            const temperature = finiteNumber(payload.data.temperature[dataIndex]);
            const dewPoint = valueAtTimestamp(payload.meteogram, meteogramIndex, 'dewPoint', timestamp);
            const humidity = valueAtTimestamp(payload.sounding, soundingIndex, 'rh-surface', timestamp);
            const precipAmount = finiteNumber(payload.data.precipAmount[dataIndex]);
            const snowWater = finiteNumber(payload.data.precipSnowAmount?.[dataIndex]);
            const precipType = payload.data.precipType?.[dataIndex];
            const wind = finiteNumber(payload.data.wind[dataIndex]);
            const gust = finiteNumber(payload.data.windGust?.[dataIndex]);

            return {
                timestamp,
                iconCode: finiteNumber(payload.data.icon[dataIndex]),
                isDay: (finiteNumber(payload.data.isDay[dataIndex]) || 0) > 0,
                totalCloudPercent: combineCloudBands(
                    lowCloudPercent,
                    mediumCloudPercent,
                    highCloudPercent,
                ),
                highCloudPercent,
                mediumCloudPercent,
                lowCloudPercent,
                temperatureC: kelvinToCelsius(temperature),
                dewPointC: kelvinToCelsius(dewPoint),
                humidityPercent: normalizePercent(humidity),
                precipMm: precipAmount === null ? null : roundTo(Math.max(0, precipAmount), 1),
                snowWaterMm: snowWater !== null && snowWater >= 0 ? snowWater : null,
                snowWaterPeriodHours: windySnowPeriodHours(payload.data.ts, dataIndex),
                snowCondition: precipType == null ? null : WINDY_SNOW_CONDITIONS[precipType] ?? null,
                // Windy's point forecast already returns metres per second. Normalize once
                // to the table's 0.1 m/s precision so values, thresholds, and colors agree.
                windMs: wind === null ? null : roundTo(Math.max(0, wind), 1),
                windGustMs: gust === null || gust < 0 ? null : roundTo(gust, 1),
                windDirectionDeg: normalizeDirection(finiteNumber(payload.data.windDir[dataIndex])),
                aod550: null,
                visibilityKm: null,
            };
        })
        .filter((point): point is WeatherPoint => point !== null)
        .sort((left, right) => left.timestamp - right.timestamp);
};

const dateParts = (timestamp: number, timeZone: string): { key: string; month: string; day: string } => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(timestamp);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return {
        key: `${values.year}-${values.month}-${values.day}`,
        month: values.month,
        day: values.day,
    };
};

export const buildWeatherDateGroups = (
    points: WeatherPoint[],
    timeZone: string,
    language: UiLanguage,
): WeatherDateGroup[] => {
    const groups: WeatherDateGroup[] = [];
    for (const [index, point] of points.entries()) {
        const parts = dateParts(point.timestamp, timeZone);
        const currentGroup = groups.at(-1);
        if (currentGroup?.key === parts.key) {
            currentGroup.length += 1;
            continue;
        }
        groups.push({
            key: parts.key,
            label: messages[language].dateGroup(Number(parts.month), Number(parts.day)),
            startIndex: index,
            length: 1,
        });
    }
    return groups;
};

/**
 * Resolves a plain observation date against forecast timestamps in the observer's time zone.
 * The result only describes the data already present; it never implies that an out-of-range
 * astronomy date has corresponding weather coverage.
 */
export const findWeatherDateSelection = (
    points: WeatherPoint[],
    timeZone: string,
    selectedDate: string,
): WeatherDateSelection => {
    if (points.length === 0) {
        return { coverage: 'empty', startIndex: null, length: 0 };
    }

    const dateKeys = points.map(point => dateParts(point.timestamp, timeZone).key);
    const startIndex = dateKeys.indexOf(selectedDate);
    if (startIndex >= 0) {
        return {
            coverage: 'covered',
            startIndex,
            length: dateKeys.lastIndexOf(selectedDate) - startIndex + 1,
        };
    }

    if (selectedDate < dateKeys[0]) {
        return { coverage: 'before-range', startIndex: null, length: 0 };
    }
    if (selectedDate > dateKeys.at(-1)!) {
        return { coverage: 'after-range', startIndex: null, length: 0 };
    }
    return { coverage: 'missing', startIndex: null, length: 0 };
};

export const formatWeatherHour = (timestamp: number, timeZone: string): string =>
    new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        hourCycle: 'h23',
    }).format(timestamp);

export const findCurrentTimePosition = (points: WeatherPoint[], now = Date.now()): number | null => {
    if (points.length === 0 || now < points[0].timestamp || now > points.at(-1)!.timestamp) {
        return null;
    }
    const exactIndex = points.findIndex(point => point.timestamp === now);
    if (exactIndex >= 0) {
        return exactIndex;
    }
    const nextIndex = points.findIndex(point => point.timestamp > now);
    if (nextIndex <= 0) {
        return null;
    }
    const previous = points[nextIndex - 1].timestamp;
    const next = points[nextIndex].timestamp;
    return next === previous ? nextIndex - 1 : nextIndex - 1 + (now - previous) / (next - previous);
};

export const weatherMetricValue = (point: WeatherPoint, metric: WeatherMetric): number | null =>
    point[metric] ?? null;

export const weatherMetricTone = (metric: WeatherMetric, value: number | null): WeatherTone => {
    if (value === null) {
        return 'unknown';
    }
    if (metric.endsWith('CloudPercent')) {
        return 'cloud';
    }
    if (metric === 'temperatureC') {
        if (value < 0) {
            return 'freezing';
        }
        if (value < 8) {
            return 'cool';
        }
        if (value < 15) {
            return 'cold';
        }
        if (value < 21) {
            return 'mild';
        }
        if (value < 27) {
            return 'good';
        }
        if (value < 33) {
            return 'warning';
        }
        if (value < 38) {
            return 'orange';
        }
        return 'danger';
    }
    if (metric === 'dewPointC') {
        return value >= 320 / 9 ? 'danger' : value >= 100 / 3 ? 'warning' : 'good';
    }
    if (metric === 'humidityPercent') {
        return value >= 85 ? 'danger' : value >= 75 ? 'orange' : value >= 60 ? 'warning' : 'good';
    }
    if (metric === 'precipMm') {
        return value > 2.5 ? 'danger' : value >= 1 ? 'orange' : value > 0 ? 'warning' : 'neutral';
    }
    if (metric === 'windMs') {
        return value > 9 ? 'danger' : value > 4.5 ? 'warning' : 'good';
    }
    if (metric === 'visibilityKm') {
        return value < 1
            ? 'danger'
            : value < 3
                ? 'orange'
                : value < 5
                    ? 'warning'
                    : value < 10
                        ? 'mild'
                        : 'good';
    }
    if (metric === 'aod550') {
        return value <= 0.1
            ? 'good'
            : value <= 0.2
                ? 'warning'
                : value <= 0.4
                    ? 'orange'
                    : 'danger';
    }
    return 'neutral';
};

export const snowGradeLabel = (grade: DailySnowGrade, language: UiLanguage): string =>
    messages[language].snowGrades[grade];

export const weatherConditionLabel = (
    iconCode: number | null,
    language: UiLanguage,
    snowCondition?: SnowCondition | null,
    snowIntensity?: SnowIntensity | null,
): string => {
    if (snowIntensity) {
        const intensity = snowGradeLabel(snowIntensity, language);
        return snowCondition === 'snowShowers' ? `${messages[language].snowConditions.snowShowers} · ${intensity}` : intensity;
    }
    if (snowCondition) {
        return messages[language].snowConditions[snowCondition];
    }
    const labels = messages[language].conditions;
    return iconCode === null || !labels[iconCode] ? labels[0] : labels[iconCode];
};

// GB/T 28592—2012, table 2. All thresholds are 24-hour snow water equivalent in mm.
export const DAILY_SNOW_GRADES: ReadonlyArray<{ minimumMm: number; grade: DailySnowGrade; tone: WeatherTone }> = [
    { minimumMm: 30, grade: 'extremeSnowstorm', tone: 'danger' },
    { minimumMm: 20, grade: 'heavySnowstorm', tone: 'orange' },
    { minimumMm: 10, grade: 'snowstorm', tone: 'warning' },
    { minimumMm: 5, grade: 'heavy', tone: 'cold' },
    { minimumMm: 2.5, grade: 'moderate', tone: 'cool' },
    { minimumMm: 0.1, grade: 'light', tone: 'freezing' },
    { minimumMm: 0, grade: 'trace', tone: 'neutral' },
];

/** Windy accumulations start at the timestamp, Open-Meteo's end there. Both cover the same 24-hour window. */
export const summarizeSnowWater24h = (points: WeatherPoint[], startIndex: number | null, source: WeatherSource) => {
    if (startIndex === null || !points[startIndex]) { return null; }
    const start = points[startIndex].timestamp;
    const hour = 3_600_000;
    const end = start + 24 * hour;
    const hourly = source === 'open-meteo';
    let cursor = start;
    let waterMm: number | null = 0;
    let snowfallCm: number | null = hourly ? 0 : null;
    for (let index = startIndex + Number(hourly); cursor < end; index++) {
        const point = points[index];
        const step = hourly ? point?.precipitationPeriodMs : (point?.snowWaterPeriodHours ?? 0) * hour;
        if (!point || !step || (hourly && step !== hour) || point.timestamp !== cursor + (hourly ? step : 0)) {
            return null;
        }
        cursor += step;
        waterMm = waterMm === null || point.snowWaterMm == null ? null : waterMm + point.snowWaterMm;
        snowfallCm = snowfallCm === null || point.snowfallCm == null ? null : snowfallCm + point.snowfallCm;
    }
    if (cursor !== end || (waterMm === null && snowfallCm === null)) { return null; }
    const amountMm = waterMm === null ? null : roundTo(waterMm, 2);
    const classification = amountMm !== null && amountMm > 0
        ? DAILY_SNOW_GRADES.find(({ minimumMm }) => amountMm >= minimumMm)
        : undefined;
    return {
        start, end, amountMm,
        snowfallCm: snowfallCm === null ? null : roundTo(snowfallCm, 2),
        grade: classification?.grade ?? null,
        tone: classification?.tone ?? 'neutral',
    };
};

export type WeatherModel = 'ecmwf' | 'gfs' | 'icon';

export type WeatherLoadStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export type WeatherMetric =
    | 'totalCloudPercent'
    | 'highCloudPercent'
    | 'mediumCloudPercent'
    | 'lowCloudPercent'
    | 'temperatureC'
    | 'dewPointC'
    | 'humidityPercent'
    | 'precipMm'
    | 'windMs'
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
    data: {
        ts: number[];
        icon: NumericArray;
        isDay: NumericArray;
        temperature: NumericArray;
        precipAmount: NumericArray;
        wind: NumericArray;
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
    windMs: number | null;
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
): string => `${model}|${locationKey}|${Math.floor(timestamp / 3_600_000)}`;

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
            const wind = finiteNumber(payload.data.wind[dataIndex]);

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
                // Windy's point forecast already returns metres per second. Normalize once
                // to the table's 0.1 m/s precision so values, thresholds, and colors agree.
                windMs: wind === null ? null : roundTo(Math.max(0, wind), 1),
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
    language: 'zh' | 'en',
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
            label: language === 'zh'
                ? `${Number(parts.month)}.${Number(parts.day)}`
                : `${Number(parts.month)}/${Number(parts.day)}`,
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
    point[metric];

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

export const weatherConditionLabel = (
    iconCode: number | null,
    language: 'zh' | 'en',
): string => {
    const labels = language === 'zh'
        ? ['未知', '晴', '大部晴朗', '多云', '阴', '局部有雨', '多云有雨', '阴有雨', '局部有雪', '多云有雪', '阴有雪', '雨夹雪', '雨夹雪', '雨夹雪', '雷雨', '雷雪', '雷雨夹雪', '雾', '阵雨', '阵雨', '阵雨', '雷阵雨', '晴雾', '雷暴', '局部雷暴']
        : ['Unknown', 'Clear', 'Mostly clear', 'Partly cloudy', 'Overcast', 'Mostly clear with rain', 'Cloudy with rain', 'Overcast with rain', 'Mostly clear with snow', 'Cloudy with snow', 'Overcast with snow', 'Rain and snow', 'Rain and snow', 'Rain and snow', 'Thunderstorm', 'Thunder snow', 'Thunder rain and snow', 'Fog', 'Showers', 'Showers', 'Showers', 'Thunder showers', 'Clear with fog', 'Thunderstorm', 'Partly cloudy thunderstorm'];
    return iconCode === null || !labels[iconCode] ? labels[0] : labels[iconCode];
};

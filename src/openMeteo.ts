import type { Coordinates } from './solar';
import { WEATHER_PAST_WINDOW_MS, WEATHER_FUTURE_WINDOW_MS, type WeatherModel, type WeatherPoint } from './weather';

const AIR_QUALITY_API_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const FORECAST_API_URL = 'https://api.open-meteo.com/v1/forecast';
const PAST_HOURS = 6;
const FORECAST_HOURS = 121;

type FetchLike = typeof fetch;

type HourlyPayload = {
    [key: string]: unknown;
    time?: unknown;
    aerosol_optical_depth?: unknown;
    visibility?: unknown;
};

type OpenMeteoPayload = {
    hourly?: HourlyPayload;
};

export type OpenMeteoAtmospherePoint = {
    timestamp: number;
    aod550: number | null;
    visibilityKm: number | null;
};

export type OpenMeteoFetchOptions = {
    location: Coordinates;
    signal?: AbortSignal;
    fetcher?: FetchLike;
    /** Windy retains its independent best-match visibility supplement. */
    includeVisibility?: boolean;
};

const buildUrl = (baseUrl: string, location: Coordinates, variable: string): URL => {
    const url = new URL(baseUrl);
    url.searchParams.set('latitude', String(location.lat));
    url.searchParams.set('longitude', String(location.lon));
    url.searchParams.set('hourly', variable);
    url.searchParams.set('past_hours', String(PAST_HOURS));
    url.searchParams.set('forecast_hours', String(FORECAST_HOURS));
    url.searchParams.set('timeformat', 'unixtime');
    return url;
};

const fetchPayload = async (url: URL, signal: AbortSignal | undefined, fetcher: FetchLike): Promise<OpenMeteoPayload> => {
    const response = await fetcher(url, { signal });
    if (!response.ok) {
        throw new Error(`Open-Meteo HTTP ${response.status}`);
    }
    return response.json() as Promise<OpenMeteoPayload>;
};

const numericArray = (value: unknown): (number | null)[] =>
    Array.isArray(value)
        ? value.map(item => typeof item === 'number' && Number.isFinite(item) ? item : null)
        : [];

const seriesByTimestamp = (
    payload: OpenMeteoPayload,
    field: 'aerosol_optical_depth' | 'visibility',
    transform: (value: number) => number,
): Map<number, number | null> => {
    const timestamps = numericArray(payload.hourly?.time);
    const values = numericArray(payload.hourly?.[field]);
    return new Map(timestamps.flatMap((timestamp, index) => {
        if (timestamp === null) {
            return [];
        }
        const value = values[index];
        return [[timestamp * 1000, value === null || value === undefined ? null : transform(value)]];
    }));
};

export const fetchOpenMeteoAtmosphere = async ({
    location,
    signal,
    fetcher = fetch,
    includeVisibility = true,
}: OpenMeteoFetchOptions): Promise<OpenMeteoAtmospherePoint[]> => {
    const [airQuality, forecast] = await Promise.all([
        fetchPayload(
            buildUrl(AIR_QUALITY_API_URL, location, 'aerosol_optical_depth'),
            signal,
            fetcher,
        ),
        includeVisibility ? fetchPayload(
            buildUrl(FORECAST_API_URL, location, 'visibility'),
            signal,
            fetcher,
        ) : Promise.resolve({} as OpenMeteoPayload),
    ]);
    const aodByTimestamp = seriesByTimestamp(airQuality, 'aerosol_optical_depth', value => value);
    const visibilityByTimestamp = seriesByTimestamp(
        forecast,
        'visibility',
        value => Math.round(value / 100) / 10,
    );
    const timestamps = [...new Set([...aodByTimestamp.keys(), ...visibilityByTimestamp.keys()])]
        .sort((left, right) => left - right);

    return timestamps.map(timestamp => ({
        timestamp,
        aod550: aodByTimestamp.get(timestamp) ?? null,
        visibilityKm: visibilityByTimestamp.get(timestamp) ?? null,
    }));
};

export const buildOpenMeteoRequestKey = (locationKey: string, timestamp: number): string =>
    `${locationKey}|${Math.floor(timestamp / 3_600_000)}`;

export const mergeOpenMeteoAtmosphere = (
    weatherPoints: WeatherPoint[],
    atmospherePoints: OpenMeteoAtmospherePoint[],
    includeVisibility = true,
): WeatherPoint[] => {
    const atmosphereByTimestamp = new Map(atmospherePoints.map(point => [point.timestamp, point]));
    return weatherPoints.map(point => {
        const atmosphere = atmosphereByTimestamp.get(point.timestamp);
        return {
            ...point,
            aod550: atmosphere?.aod550 ?? null,
            visibilityKm: includeVisibility ? atmosphere?.visibilityKm ?? null : point.visibilityKm,
        };
    });
};

export const OPEN_METEO_MODELS: Record<WeatherModel, string> = {
    ecmwf: 'ecmwf_ifs', gfs: 'gfs_global', icon: 'icon_global',
};

/** Translate WMO conditions to the existing presentation icons, never pass through numeric codes. */
export const wmoWeatherIcon = (code: number | null): number | null => {
    if (code === null) { return null; }
    if (code >= 0 && code <= 3) { return [1, 2, 3, 4][code] ?? null; }
    if ([45, 48].includes(code)) { return 17; }
    if ([51, 53, 55, 61, 63, 65].includes(code)) { return 7; }
    if ([56, 57, 66, 67].includes(code)) { return 13; }
    if ([71, 73, 75, 77, 85, 86].includes(code)) { return 10; }
    if ([80, 81, 82].includes(code)) { return 20; }
    if ([95, 96, 99].includes(code)) { return 14; }
    return null;
};

/** Fetch one explicitly selected global model. Units and timestamps match the shared weather view. */
export const fetchOpenMeteoWeather = async ({
    location, model, requestedAt = Date.now(), signal, fetcher = fetch,
}: OpenMeteoFetchOptions & { model: WeatherModel; requestedAt?: number }): Promise<WeatherPoint[]> => {
    const url = buildUrl(FORECAST_API_URL, location, [
        'temperature_2m', 'dew_point_2m', 'relative_humidity_2m', 'precipitation',
        'wind_speed_10m', 'wind_direction_10m', 'cloud_cover', 'cloud_cover_low',
        'cloud_cover_mid', 'cloud_cover_high', 'visibility', 'weather_code', 'is_day',
    ].join(','));
    url.searchParams.set('models', OPEN_METEO_MODELS[model]);
    url.searchParams.set('wind_speed_unit', 'ms');
    const payload = await fetchPayload(url, signal, fetcher);
    const hourly = payload.hourly;
    const times = numericArray(hourly?.time);
    const value = (field: string, index: number): number | null => {
        const series = hourly?.[field];
        const item = Array.isArray(series) ? series[index] : null;
        return typeof item === 'number' && Number.isFinite(item) ? item : null;
    };
    return times.flatMap((time, index): WeatherPoint[] => {
        if (time === null) { return []; }
        const timestamp = time * 1000;
        if (timestamp < requestedAt - WEATHER_PAST_WINDOW_MS || timestamp > requestedAt + WEATHER_FUTURE_WINDOW_MS) { return []; }
        const visibility = value('visibility', index);
        return [{
            timestamp, precipitationPeriodMs: 3_600_000,
            iconCode: wmoWeatherIcon(value('weather_code', index)),
            isDay: value('is_day', index) === 1,
            totalCloudPercent: value('cloud_cover', index),
            lowCloudPercent: value('cloud_cover_low', index),
            mediumCloudPercent: value('cloud_cover_mid', index),
            highCloudPercent: value('cloud_cover_high', index),
            temperatureC: value('temperature_2m', index),
            dewPointC: value('dew_point_2m', index),
            humidityPercent: value('relative_humidity_2m', index),
            precipMm: value('precipitation', index),
            windMs: value('wind_speed_10m', index),
            windDirectionDeg: value('wind_direction_10m', index),
            visibilityKm: visibility === null ? null : Math.round(visibility / 100) / 10,
            aod550: null,
        }];
    }).sort((a, b) => a.timestamp - b.timestamp);
};

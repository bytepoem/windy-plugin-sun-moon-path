import type { Coordinates } from './solar';
import type { WeatherPoint } from './weather';

const AIR_QUALITY_API_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const FORECAST_API_URL = 'https://api.open-meteo.com/v1/forecast';
const PAST_HOURS = 6;
const FORECAST_HOURS = 121;

type FetchLike = typeof fetch;

type HourlyPayload = {
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
}: OpenMeteoFetchOptions): Promise<OpenMeteoAtmospherePoint[]> => {
    const [airQuality, forecast] = await Promise.all([
        fetchPayload(
            buildUrl(AIR_QUALITY_API_URL, location, 'aerosol_optical_depth'),
            signal,
            fetcher,
        ),
        fetchPayload(
            buildUrl(FORECAST_API_URL, location, 'visibility'),
            signal,
            fetcher,
        ),
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
): WeatherPoint[] => {
    const atmosphereByTimestamp = new Map(atmospherePoints.map(point => [point.timestamp, point]));
    return weatherPoints.map(point => {
        const atmosphere = atmosphereByTimestamp.get(point.timestamp);
        return {
            ...point,
            aod550: atmosphere?.aod550 ?? null,
            visibilityKm: atmosphere?.visibilityKm ?? null,
        };
    });
};

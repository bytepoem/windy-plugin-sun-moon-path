import { describe, expect, it, vi } from 'vitest';

import {
    buildOpenMeteoRequestKey,
    fetchOpenMeteoAtmosphere,
    fetchOpenMeteoWeather,
    wmoWeatherIcon,
    mergeOpenMeteoAtmosphere,
} from './openMeteo';
import type { WeatherPoint } from './weather';

const response = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
});

const weatherPoint = (timestamp: number): WeatherPoint => ({
    timestamp,
    iconCode: 1,
    isDay: true,
    totalCloudPercent: 10,
    highCloudPercent: 10,
    mediumCloudPercent: 10,
    lowCloudPercent: 10,
    temperatureC: 20,
    dewPointC: 10,
    humidityPercent: 50,
    precipMm: 0,
    windMs: 5,
    windDirectionDeg: 180,
    aod550: null,
    visibilityKm: null,
});

describe('Open-Meteo atmosphere data', () => {
    it('keeps model visibility, including null, when only enriching AOD', () => {
        const points = [weatherPoint(1), { ...weatherPoint(2), visibilityKm: 8 }];
        const supplement = points.map(point => ({ timestamp: point.timestamp, aod550: 0.1, visibilityKm: 99 }));
        expect(mergeOpenMeteoAtmosphere(points, supplement, false).map(point => point.visibilityKm)).toEqual([null, 8]);
    });

    it('only calls CAMS when the selected weather model owns visibility', async () => {
        const fetcher = vi.fn().mockResolvedValue(response({ hourly: { time: [1], aerosol_optical_depth: [0.2] } }));
        const points = await fetchOpenMeteoAtmosphere({ location: { lat: 1, lon: 2 }, fetcher, includeVisibility: false });
        expect(fetcher).toHaveBeenCalledOnce();
        expect(String(fetcher.mock.calls[0][0])).toContain('air-quality-api');
        expect(points).toEqual([{ timestamp: 1000, aod550: 0.2, visibilityKm: null }]);
    });

    it.each([['ecmwf', 'ecmwf_ifs'], ['gfs', 'gfs_global'], ['icon', 'icon_global']] as const)(
        'loads %s hourly data with explicit units, preserving missing fields', async (model, modelId) => {
            const now = Date.UTC(2026, 8, 8);
            const fetcher = vi.fn().mockResolvedValue(response({ hourly: {
                time: [now / 1000, now / 1000 + 3600], temperature_2m: [12.5, null],
                cloud_cover: [35, 0], cloud_cover_low: [10, 0], cloud_cover_mid: [20, 0], cloud_cover_high: [30, 0],
                visibility: [null, 12300], wind_speed_10m: [2.5, 0], weather_code: [0, 95], is_day: [1, 0], precipitation: [0, 2],
            } }));
            const signal = new AbortController().signal;
            const points = await fetchOpenMeteoWeather({ location: { lat: 1, lon: 2 }, model, requestedAt: now, signal, fetcher });
            const url = new URL(String(fetcher.mock.calls[0][0]));
            expect(url.searchParams.get('models')).toBe(modelId);
            expect(url.searchParams.get('wind_speed_unit')).toBe('ms');
            expect(fetcher.mock.calls[0][1]).toEqual({ signal });
            expect(points[0]).toMatchObject({ timestamp: now, temperatureC: 12.5, totalCloudPercent: 35, windMs: 2.5, visibilityKm: null, iconCode: 1, precipMm: 0, precipitationPeriodMs: 3600000 });
            expect(points[1]).toMatchObject({ timestamp: now + 3600000, temperatureC: null, visibilityKm: 12.3, iconCode: 14, isDay: false });
        },
    );

    it('rejects failed model requests without another provider request', async () => {
        const fetcher = vi.fn().mockResolvedValue(response({}, 429));
        await expect(fetchOpenMeteoWeather({ location: { lat: 1, lon: 2 }, model: 'icon', fetcher })).rejects.toThrow('429');
        expect(fetcher).toHaveBeenCalledOnce();
        expect(wmoWeatherIcon(999)).toBeNull();
        expect(wmoWeatherIcon(null)).toBeNull();
    });
    it('requests AOD550 and visibility with the plugin forecast window', async () => {
        const requestedUrls: URL[] = [];
        const fetcher = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input));
            requestedUrls.push(url);
            return response({ hourly: { time: [], [url.searchParams.get('hourly')!]: [] } });
        }) as typeof fetch;

        await fetchOpenMeteoAtmosphere({
            location: { lat: 23.1291, lon: 113.2644 },
            fetcher,
        });

        expect(requestedUrls).toHaveLength(2);
        expect(requestedUrls.map(url => url.origin)).toEqual([
            'https://air-quality-api.open-meteo.com',
            'https://api.open-meteo.com',
        ]);
        expect(requestedUrls.map(url => url.searchParams.get('hourly'))).toEqual([
            'aerosol_optical_depth',
            'visibility',
        ]);
        for (const url of requestedUrls) {
            expect(url.searchParams.get('latitude')).toBe('23.1291');
            expect(url.searchParams.get('longitude')).toBe('113.2644');
            expect(url.searchParams.get('past_hours')).toBe('6');
            expect(url.searchParams.get('forecast_hours')).toBe('121');
            expect(url.searchParams.get('timeformat')).toBe('unixtime');
        }
    });

    it('aligns both APIs by timestamp and converts visibility to kilometres', async () => {
        const startSeconds = Date.UTC(2026, 7, 23, 0) / 1000;
        const fetcher = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input));
            return url.hostname.startsWith('air-quality')
                ? response({
                    hourly: {
                        time: [startSeconds, startSeconds + 3600],
                        aerosol_optical_depth: [0.12, null],
                    },
                })
                : response({
                    hourly: {
                        time: [startSeconds + 3600, startSeconds + 7200],
                        visibility: [8400, 12150],
                    },
                });
        }) as typeof fetch;

        await expect(fetchOpenMeteoAtmosphere({
            location: { lat: 23.1291, lon: 113.2644 },
            fetcher,
        })).resolves.toEqual([
            { timestamp: startSeconds * 1000, aod550: 0.12, visibilityKm: null },
            { timestamp: (startSeconds + 3600) * 1000, aod550: null, visibilityKm: 8.4 },
            { timestamp: (startSeconds + 7200) * 1000, aod550: null, visibilityKm: 12.2 },
        ]);
    });

    it('keeps values aligned when an invalid timestamp appears in a payload', async () => {
        const startSeconds = Date.UTC(2026, 7, 23, 0) / 1000;
        const fetcher = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input));
            return url.hostname.startsWith('air-quality')
                ? response({
                    hourly: {
                        time: [startSeconds, null, startSeconds + 7200],
                        aerosol_optical_depth: [0.1, 9.9, 0.3],
                    },
                })
                : response({ hourly: { time: [], visibility: [] } });
        }) as typeof fetch;

        await expect(fetchOpenMeteoAtmosphere({
            location: { lat: 23.1291, lon: 113.2644 },
            fetcher,
        })).resolves.toEqual([
            { timestamp: startSeconds * 1000, aod550: 0.1, visibilityKm: null },
            { timestamp: (startSeconds + 7200) * 1000, aod550: 0.3, visibilityKm: null },
        ]);
    });

    it('forwards one abort signal to both requests and surfaces HTTP failures', async () => {
        const controller = new AbortController();
        const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
            expect(init?.signal).toBe(controller.signal);
            return response({}, 503);
        }) as typeof fetch;

        await expect(fetchOpenMeteoAtmosphere({
            location: { lat: 23.1291, lon: 113.2644 },
            signal: controller.signal,
            fetcher,
        })).rejects.toThrow('Open-Meteo HTTP 503');
        expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('merges only exact timestamps and leaves unavailable metrics unknown', () => {
        const start = Date.UTC(2026, 7, 23, 0);
        expect(mergeOpenMeteoAtmosphere(
            [weatherPoint(start), weatherPoint(start + 3600_000)],
            [{ timestamp: start, aod550: 0.18, visibilityKm: 9.6 }],
        )).toEqual([
            expect.objectContaining({ timestamp: start, aod550: 0.18, visibilityKm: 9.6 }),
            expect.objectContaining({ timestamp: start + 3600_000, aod550: null, visibilityKm: null }),
        ]);
    });

    it('keys requests by location and clock hour without a weather model', () => {
        const now = Date.UTC(2026, 7, 23, 4, 59);
        expect(buildOpenMeteoRequestKey('23.1291|113.2644', now)).toBe(
            buildOpenMeteoRequestKey('23.1291|113.2644', now + 30_000),
        );
        expect(buildOpenMeteoRequestKey('23.1291|113.2644', now)).not.toBe(
            buildOpenMeteoRequestKey('23.1291|113.2644', now + 3600_000),
        );
        expect(buildOpenMeteoRequestKey('23.1291|113.2644', now)).not.toBe(
            buildOpenMeteoRequestKey('31.2304|121.4737', now),
        );
    });
});

import { describe, expect, it, vi } from 'vitest';
import { createWeatherProvider, type WeatherRequest } from './weatherProvider';
import type { WeatherForecastPayload } from './weather';

const requestedAt = Date.UTC(2026, 8, 11);
const request: WeatherRequest = {
    location: { lat: 30, lon: 110 },
    model: 'gfs',
    requestedAt,
    signal: new AbortController().signal,
};

describe('shared weather provider', () => {
    it('normalizes Windy weather while retaining the original cloud profile', async () => {
        const payload: WeatherForecastPayload = {
            data: {
                ts: [requestedAt],
                temperature: [293.15],
                icon: [1],
                isDay: [1],
                precipAmount: [0],
                wind: [2],
                windDir: [90],
            },
        };
        const windy = vi.fn(async () => payload);
        const openMeteo = vi.fn(async () => []);
        const provider = createWeatherProvider({ windy, openMeteo });
        const result = await provider.weather({ ...request, source: 'windy' });
        expect(result.points[0].temperatureC).toBe(20);
        expect(result.cloudForecast).toBe(payload);
        expect(windy).toHaveBeenCalledWith(expect.objectContaining(request));
        expect(openMeteo).not.toHaveBeenCalled();
    });

    it('never exposes Open-Meteo as a cloud payload and fetches cloud geometry only from Windy', async () => {
        const windy = vi.fn(async (): Promise<WeatherForecastPayload> => ({
            data: {
                ts: [],
                temperature: [],
                icon: [],
                isDay: [],
                precipAmount: [],
                wind: [],
                windDir: [],
            },
        }));
        const openMeteo = vi.fn(async () => []);
        const provider = createWeatherProvider({ windy, openMeteo });
        expect(await provider.weather({ ...request, source: 'open-meteo' })).toEqual({
            points: [],
            cloudForecast: null,
        });
        expect(windy).not.toHaveBeenCalled();
        await provider.clouds(request);
        expect(windy).toHaveBeenCalledWith(request);
        expect(openMeteo).toHaveBeenCalledTimes(1);
    });
});

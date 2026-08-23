import { describe, expect, it } from 'vitest';

import {
    WEATHER_FUTURE_WINDOW_MS,
    WEATHER_PAST_WINDOW_MS,
    buildWeatherLocationKey,
    buildWeatherRequestKey,
    buildWeatherDateGroups,
    combineCloudBands,
    findCurrentTimePosition,
    formatWeatherHour,
    isWeatherResponseCurrent,
    shouldLoadWeather,
    transformWeatherPayload,
    weatherConditionLabel,
    weatherMetricTone,
    type WeatherForecastPayload,
} from './weather';

const HOUR = 60 * 60 * 1000;

const makePayload = (timestamps: number[]): WeatherForecastPayload => ({
    data: {
        ts: [...timestamps],
        icon: timestamps.map((_, index) => index + 1),
        isDay: timestamps.map((_, index) => index % 2),
        temperature: timestamps.map((_, index) => 273.15 + 20 + index),
        precipAmount: timestamps.map((_, index) => index === 0 ? 0 : 0.45),
        wind: timestamps.map(() => 5),
        windDir: timestamps.map((_, index) => index === 0 ? -10 : 370),
    },
    meteogram: {
        ts: [...timestamps],
        dewPoint: timestamps.map((_, index) => 273.15 + 10 + index),
        'cloud-surface': timestamps.map(() => 10),
        'cloud-1000h': timestamps.map(() => 20),
        'cloud-950h': timestamps.map(() => 30),
        'cloud-925h': timestamps.map(() => 25),
        'cloud-900h': timestamps.map(() => 15),
        'cloud-850h': timestamps.map(() => 5),
        'cloud-800h': timestamps.map(() => 40),
        'cloud-700h': timestamps.map(() => 50),
        'cloud-600h': timestamps.map(() => 45),
        'cloud-500h': timestamps.map(() => 35),
        'cloud-400h': timestamps.map(() => 60),
        'cloud-300h': timestamps.map(() => 70),
        'cloud-250h': timestamps.map(() => 65),
        'cloud-200h': timestamps.map(() => 55),
        'cloud-150h': timestamps.map(() => 45),
    },
    sounding: {
        ts: [...timestamps],
        'rh-surface': timestamps.map((_, index) => 64 + index),
    },
});

describe('weather forecast transformation', () => {
    it('converts units and aggregates pressure-level cloud coverage', () => {
        const now = Date.UTC(2026, 7, 19, 6);
        const points = transformWeatherPayload(makePayload([now]), now);

        expect(points).toEqual([
            expect.objectContaining({
                timestamp: now,
                iconCode: 1,
                isDay: false,
                temperatureC: 20,
                dewPointC: 10,
                humidityPercent: 64,
                precipMm: 0,
                windKmh: 18,
                windDirectionDeg: 350,
                lowCloudPercent: 30,
                mediumCloudPercent: 50,
                highCloudPercent: 70,
                totalCloudPercent: 90,
            }),
        ]);
    });

    it('clips data to six hours in the past and five days in the future', () => {
        const now = Date.UTC(2026, 7, 19, 6);
        const timestamps = [
            now - WEATHER_PAST_WINDOW_MS - 1,
            now - WEATHER_PAST_WINDOW_MS,
            now,
            now + WEATHER_FUTURE_WINDOW_MS,
            now + WEATHER_FUTURE_WINDOW_MS + 1,
        ];

        expect(transformWeatherPayload(makePayload(timestamps), now).map(point => point.timestamp)).toEqual([
            now - WEATHER_PAST_WINDOW_MS,
            now,
            now + WEATHER_FUTURE_WINDOW_MS,
        ]);
    });

    it('aligns meteogram and sounding values by timestamp instead of array position', () => {
        const now = Date.UTC(2026, 7, 19, 6);
        const payload = makePayload([now, now + 3 * HOUR]);
        payload.meteogram!.ts.reverse();
        payload.meteogram!.dewPoint.reverse();
        payload.sounding!.ts.reverse();
        payload.sounding!['rh-surface'].reverse();

        const points = transformWeatherPayload(payload, now);

        expect(points[0].dewPointC).toBe(10);
        expect(points[0].humidityPercent).toBe(64);
        expect(points[1].dewPointC).toBe(11);
        expect(points[1].humidityPercent).toBe(65);
    });

    it('keeps missing cloud groups unknown instead of treating them as clear sky', () => {
        const now = Date.UTC(2026, 7, 19, 6);
        const payload = makePayload([now]);
        for (const key of ['cloud-400h', 'cloud-300h', 'cloud-250h', 'cloud-200h', 'cloud-150h']) {
            delete payload.meteogram![key];
        }

        const [point] = transformWeatherPayload(payload, now);

        expect(point.highCloudPercent).toBeNull();
        expect(point.totalCloudPercent).toBeNull();
    });

    it('combines independent cloud bands without exceeding 100 percent', () => {
        expect(combineCloudBands(24, 41, 0)).toBe(55);
        expect(combineCloudBands(100, 100, 100)).toBe(100);
        expect(combineCloudBands(null, 20, 30)).toBeNull();
    });

    it('groups timestamps by the observer time zone across midnight', () => {
        const timestamps = [
            Date.UTC(2026, 7, 19, 15),
            Date.UTC(2026, 7, 19, 16),
            Date.UTC(2026, 7, 20, 0),
        ];
        const points = transformWeatherPayload(makePayload(timestamps), timestamps[0]);

        expect(buildWeatherDateGroups(points, 'Asia/Shanghai', 'zh')).toEqual([
            { key: '2026-08-19', label: '8月19日', startIndex: 0, length: 1 },
            { key: '2026-08-20', label: '8月20日', startIndex: 1, length: 2 },
        ]);
        expect(formatWeatherHour(timestamps[1], 'Asia/Shanghai')).toBe('00');
        expect(formatWeatherHour(timestamps[1] + 28 * 60 * 1000, 'Asia/Shanghai')).toBe('00');
    });

    it('calculates the current marker between unequal forecast intervals', () => {
        const start = Date.UTC(2026, 7, 19, 0);
        const timestamps = [start, start + HOUR, start + 4 * HOUR];
        const points = transformWeatherPayload(makePayload(timestamps), start + 2 * HOUR);

        expect(findCurrentTimePosition(points, start + 2 * HOUR)).toBeCloseTo(1 + 1 / 3);
        expect(findCurrentTimePosition(points, start - HOUR)).toBeNull();
    });

    it('provides localized labels for Windy weather icon codes', () => {
        expect(weatherConditionLabel(1, 'zh')).toBe('晴');
        expect(weatherConditionLabel(14, 'en')).toBe('Thunderstorm');
        expect(weatherConditionLabel(null, 'zh')).toBe('未知');
    });

    it('uses the Fahrenheit reference colors after converting them to Celsius', () => {
        const fahrenheitToCelsius = (value: number) => (value - 32) * 5 / 9;

        expect(weatherMetricTone('dewPointC', 25)).toBe('good');
        expect(weatherMetricTone('dewPointC', fahrenheitToCelsius(85))).toBe('good');
        expect(weatherMetricTone('dewPointC', fahrenheitToCelsius(92))).toBe('warning');
        expect(weatherMetricTone('dewPointC', fahrenheitToCelsius(96))).toBe('danger');
        expect(weatherMetricTone('windKmh', 16.2)).toBe('good');
        expect(weatherMetricTone('windKmh', 16.3)).toBe('warning');
        expect(weatherMetricTone('windKmh', 32.5)).toBe('danger');
    });

    it('keys weather requests by model, location, and clock hour', () => {
        const locationKey = buildWeatherLocationKey({ lat: 23.05, lon: 113.37 });
        const now = Date.UTC(2026, 7, 20, 3, 59);

        expect(buildWeatherRequestKey('ecmwf', locationKey, now)).not.toBe(
            buildWeatherRequestKey('icon', locationKey, now),
        );
        expect(buildWeatherRequestKey('ecmwf', locationKey, now)).not.toBe(
            buildWeatherRequestKey('gfs', locationKey, now),
        );
        expect(buildWeatherRequestKey('ecmwf', locationKey, now)).not.toBe(
            buildWeatherRequestKey('ecmwf', locationKey, now + HOUR),
        );
        expect(buildWeatherRequestKey('ecmwf', locationKey, now)).not.toBe(
            buildWeatherRequestKey('ecmwf', buildWeatherLocationKey({ lat: 31.23, lon: 121.47 }), now),
        );
    });

    it('loads only for the active tab after the current location timezone resolves', () => {
        const base = {
            isMounted: true,
            isWeatherTabActive: true,
            locationKey: '23.05|113.37',
            resolvedContextLocationKey: '23.05|113.37',
            requestKey: 'ecmwf|23.05|113.37|1',
            loadedKey: '',
            loadingKey: '',
        };

        expect(shouldLoadWeather(base)).toBe(true);
        expect(shouldLoadWeather({ ...base, isWeatherTabActive: false })).toBe(false);
        expect(shouldLoadWeather({ ...base, resolvedContextLocationKey: '' })).toBe(false);
        expect(shouldLoadWeather({ ...base, resolvedContextLocationKey: '31.23|121.47' })).toBe(false);
        expect(shouldLoadWeather({ ...base, loadedKey: base.requestKey })).toBe(false);
        expect(shouldLoadWeather({ ...base, loadingKey: base.requestKey })).toBe(false);
    });

    it('rejects aborted, stale-model, stale-location, and stale-hour responses', () => {
        const current = {
            aborted: false,
            requestId: 4,
            latestRequestId: 4,
            requestKey: 'ecmwf|23.05|113.37|10',
            currentRequestKey: 'ecmwf|23.05|113.37|10',
        };

        expect(isWeatherResponseCurrent(current)).toBe(true);
        expect(isWeatherResponseCurrent({ ...current, aborted: true })).toBe(false);
        expect(isWeatherResponseCurrent({ ...current, requestId: 3 })).toBe(false);
        expect(isWeatherResponseCurrent({ ...current, currentRequestKey: 'icon|23.05|113.37|10' })).toBe(false);
        expect(isWeatherResponseCurrent({ ...current, currentRequestKey: 'gfs|23.05|113.37|10' })).toBe(false);
        expect(isWeatherResponseCurrent({ ...current, currentRequestKey: 'ecmwf|31.23|121.47|10' })).toBe(false);
        expect(isWeatherResponseCurrent({ ...current, currentRequestKey: 'ecmwf|23.05|113.37|11' })).toBe(false);
    });
});

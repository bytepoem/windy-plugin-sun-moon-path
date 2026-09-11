import { describe, expect, it, vi } from 'vitest';
import {
    createForecastController,
    emptyForecastState,
    type ForecastInput,
} from './forecastController';
import type { OpenMeteoAtmospherePoint } from './openMeteo';
import { transformWeatherPayload, type WeatherForecastPayload } from './weather';
import type { WeatherRequest, WeatherResult } from './weatherProvider';

const now = Date.UTC(2026, 8, 11, 5);
const payload: WeatherForecastPayload = {
    data: {
        ts: [now],
        temperature: [293.15],
        icon: [1],
        isDay: [1],
        precipAmount: [0],
        wind: [2],
        windDir: [90],
    },
};
const result: WeatherResult = {
    points: transformWeatherPayload(payload, now),
    cloudForecast: payload,
};
const base: ForecastInput = {
    location: { lat: 30, lon: 110 },
    model: 'ecmwf',
    source: 'windy',
    requestedAt: now,
    contextReady: true,
    visible: true,
    cloudsVisible: false,
};

const deferred = <Value>() => {
    let resolve!: (value: Value) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<Value>((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
};
const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

const harness = () => {
    const requests: {
        request: WeatherRequest;
        task: ReturnType<typeof deferred<WeatherResult>>;
    }[] = [];
    const cloudRequests: {
        request: WeatherRequest;
        task: ReturnType<typeof deferred<WeatherForecastPayload>>;
    }[] = [];
    const atmosphereRequests: {
        request: WeatherRequest & { includeVisibility: boolean };
        task: ReturnType<typeof deferred<OpenMeteoAtmospherePoint[]>>;
    }[] = [];
    let state = emptyForecastState();
    const changed = vi.fn(next => {
        state = next;
    });
    const controller = createForecastController(
        {
            weather: request => {
                const task = deferred<WeatherResult>();
                requests.push({ request, task });
                return task.promise;
            },
            clouds: request => {
                const task = deferred<WeatherForecastPayload>();
                cloudRequests.push({ request, task });
                return task.promise;
            },
            atmosphere: request => {
                const task = deferred<OpenMeteoAtmospherePoint[]>();
                atmosphereRequests.push({ request, task });
                return task.promise;
            },
        },
        changed,
    );
    return { controller, requests, cloudRequests, atmosphereRequests, changed, state: () => state };
};

describe('forecast session behavior', () => {
    it('waits for visibility and resolved location context, then deduplicates the same key', () => {
        const h = harness();
        h.controller.update({ ...base, contextReady: false });
        h.controller.update({ ...base, visible: false });
        expect(h.requests).toHaveLength(0);
        h.controller.update(base);
        h.controller.update({ ...base, requestedAt: now + 5000 });
        expect(h.requests).toHaveLength(1);
        expect(h.atmosphereRequests).toHaveLength(1);
        expect(h.state().weatherStatus).toBe('loading');
    });

    it('returns loading immediately so reactive callers can render model and source transitions', async () => {
        const h = harness();
        expect(h.controller.update(base).weatherStatus).toBe('loading');
        h.requests[0].task.resolve(result);
        await flush();
        expect(h.controller.update(base).weatherStatus).toBe('ready');
        const modelChange = h.controller.update({ ...base, model: 'gfs' });
        expect(modelChange.weatherStatus).toBe('loading');
        expect(modelChange.points).toEqual([]);
        const sourceChange = h.controller.update({ ...base, source: 'open-meteo' });
        expect(sourceChange.weatherStatus).toBe('loading');
        expect(sourceChange.atmosphereStatus).toBe('loading');
    });

    it('discards a previous location even if its provider ignores abort', async () => {
        const h = harness();
        h.controller.update(base);
        h.controller.update({ ...base, location: { lat: 40, lon: 120 } });
        expect(h.requests[0].request.signal.aborted).toBe(true);
        h.requests[1].task.resolve(result);
        await flush();
        const current = h.state();
        h.requests[0].task.reject(new Error('old failure'));
        h.atmosphereRequests[0].task.resolve([{ timestamp: now, aod550: 9, visibilityKm: 1 }]);
        await flush();
        expect(h.state()).toBe(current);
        expect(h.state().weatherStatus).toBe('ready');
        expect(h.state().points[0].aod550).toBeNull();
    });

    it('does not let an old same-key retry settle the new request', async () => {
        const h = harness();
        h.controller.update(base);
        h.controller.retry('weather');
        h.requests[0].task.resolve(result);
        await flush();
        expect(h.state().weatherStatus).toBe('loading');
        h.controller.update(base);
        expect(h.requests).toHaveLength(2);
        h.requests[1].task.resolve(result);
        await flush();
        expect(h.state().weatherStatus).toBe('ready');
    });

    it('retains failure until explicit retry instead of starting a request loop', async () => {
        const h = harness();
        h.controller.update(base);
        h.requests[0].task.reject(new Error('unavailable'));
        await flush();
        h.controller.update(base);
        expect(h.requests).toHaveLength(1);
        expect(h.state().weatherError).toBe('unavailable');
        h.controller.retry('weather');
        expect(h.requests).toHaveLength(2);
        expect(h.state().weatherError).toBe('');
    });

    it('reuses Windy weather payload for clouds and routes cloud retry to weather', async () => {
        const h = harness();
        h.controller.update({ ...base, cloudsVisible: true });
        h.requests[0].task.resolve(result);
        await flush();
        expect(h.state().cloudForecast).toBe(payload);
        expect(h.cloudRequests).toHaveLength(0);
        h.controller.retry('clouds');
        expect(h.requests).toHaveLength(2);
    });

    it('keeps independent Windy cloud failures separate from Open-Meteo weather', async () => {
        const h = harness();
        h.controller.update({ ...base, source: 'open-meteo', cloudsVisible: true });
        h.requests[0].task.resolve({ ...result, cloudForecast: null });
        h.cloudRequests[0].task.reject(new Error('cloud unavailable'));
        await flush();
        expect(h.state().weatherStatus).toBe('ready');
        expect(h.state().cloudStatus).toBe('error');
        expect(h.state().cloudForecast).toBeNull();
        h.controller.retry('clouds');
        expect(h.requests).toHaveLength(1);
        expect(h.cloudRequests).toHaveLength(2);
    });

    it('invalidates all channels when the source changes and rejects late cloud results', async () => {
        const h = harness();
        h.controller.update({ ...base, source: 'open-meteo', cloudsVisible: true });
        h.controller.update({ ...base, cloudsVisible: true });
        expect(h.cloudRequests[0].request.signal.aborted).toBe(true);
        expect(h.atmosphereRequests[0].request.signal.aborted).toBe(true);
        h.cloudRequests[0].task.resolve(payload);
        await flush();
        expect(h.state().cloudForecast).toBeNull();
        expect(h.atmosphereRequests[1].request.includeVisibility).toBe(true);
    });

    it('reuses atmosphere across model switches but refreshes it in the next hour', async () => {
        const h = harness();
        h.controller.update(base);
        h.atmosphereRequests[0].task.resolve([{ timestamp: now, aod550: 0.2, visibilityKm: 12 }]);
        await flush();
        h.controller.update({ ...base, model: 'gfs' });
        h.requests[1].task.resolve(result);
        await flush();
        expect(h.atmosphereRequests).toHaveLength(1);
        expect(h.state().points[0]).toMatchObject({ aod550: 0.2, visibilityKm: 12 });
        h.controller.update({ ...base, model: 'gfs', requestedAt: now + 3_600_000 });
        expect(h.atmosphereRequests).toHaveLength(2);
        expect(h.state().points).toEqual([]);
    });

    it('preserves Open-Meteo visibility while adding independent aerosol evidence', async () => {
        const h = harness();
        h.controller.update({ ...base, source: 'open-meteo' });
        h.requests[0].task.resolve({
            points: [{ ...result.points[0], visibilityKm: 23 }],
            cloudForecast: null,
        });
        h.atmosphereRequests[0].task.resolve([{ timestamp: now, aod550: 0.3, visibilityKm: 99 }]);
        await flush();
        expect(h.atmosphereRequests[0].request.includeVisibility).toBe(false);
        expect(h.state().points[0]).toMatchObject({ visibilityKm: 23, aod550: 0.3 });
    });

    it('suspends pending mobile details and reloads on expansion, retaining completed results', async () => {
        const h = harness();
        h.controller.update(base);
        h.requests[0].task.resolve(result);
        await flush();
        h.controller.suspendDetails();
        h.controller.update({ ...base, visible: false });
        expect(h.atmosphereRequests[0].request.signal.aborted).toBe(true);
        expect(h.state().weatherStatus).toBe('ready');
        h.controller.update(base);
        expect(h.requests).toHaveLength(1);
        expect(h.atmosphereRequests).toHaveLength(2);
    });

    it('refreshes the same location only after context becomes ready again', async () => {
        const h = harness();
        h.controller.update(base);
        h.controller.invalidate();
        h.controller.retry('weather');
        h.requests[0].task.resolve(result);
        await flush();
        expect(h.state().points).toEqual([]);
        expect(h.requests).toHaveLength(1);
        h.controller.update(base);
        expect(h.requests).toHaveLength(2);
    });

    it('aborts every channel and suppresses all notifications after destroy', async () => {
        const h = harness();
        h.controller.update({ ...base, source: 'open-meteo', cloudsVisible: true });
        h.controller.destroy();
        const notifications = h.changed.mock.calls.length;
        h.requests[0].task.resolve(result);
        h.atmosphereRequests[0].task.reject(new Error('late failure'));
        h.cloudRequests[0].task.resolve(payload);
        await flush();
        expect(
            [h.requests[0], h.atmosphereRequests[0], h.cloudRequests[0]].every(
                item => item.request.signal.aborted,
            ),
        ).toBe(true);
        h.controller.update(base);
        h.controller.retry('weather');
        h.controller.invalidate();
        h.controller.suspendDetails();
        expect(h.changed).toHaveBeenCalledTimes(notifications);
        expect(h.requests).toHaveLength(1);
    });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTideController, emptyTideState, estimateTideEvents, fetchTideForecast,
    parseTideForecast, selectTideDay, tideHeightAt, type TideForecast, type TideInput } from './openMeteoTide';

const HOUR = 3_600_000;
const now = Date.parse('2026-10-15T00:00:00Z');
const input: TideInput = { location: { lat: 22.6, lon: 113.65 }, date: '2026-10-15',
    timeZone: 'Asia/Shanghai', active: true, ready: true, now };
const payload = (heights: (number | null)[]) => ({ latitude: 22.625, longitude: 113.708,
    hourly_units: { time: 'unixtime', sea_level_height_msl: 'm' },
    hourly: { time: heights.map((_, index) => now / 1000 + index * 3600), sea_level_height_msl: heights } });
const forecast = parseTideForecast(payload([-1, 0, 1, 0, -1]), now);
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const harness = () => {
    let state = emptyTideState();
    const changed = vi.fn(next => { state = next; });
    const request = vi.fn().mockResolvedValue(forecast);
    const controller = createTideController(changed, request);
    return { controller, request, changed, state: () => state };
};
afterEach(() => { vi.useRealTimers(); });

describe('Open-Meteo water level contract', () => {
    it('keeps negative heights and UTC timestamps, leaving null hours as gaps', () => {
        const parsed = parseTideForecast(payload([-1, null, 1]), now);
        expect(parsed.hourly).toEqual([{ timestamp: now, height: -1 }, { timestamp: now + 2 * HOUR, height: 1 }]);
        expect(tideHeightAt(parsed.hourly, now + HOUR)).toBeNull();
        expect(estimateTideEvents(parsed.hourly)).toEqual([]);
        expect(parseTideForecast(payload([null, null]), now).hourly).toEqual([]);
    });

    it('rejects mismatched arrays, wrong units, invalid values and duplicate timestamps', () => {
        const data = payload([1, 2]);
        expect(() => parseTideForecast({ ...data, hourly: { ...data.hourly, time: [now / 1000] } }, now)).toThrow('data');
        expect(() => parseTideForecast({ ...data, hourly_units: { ...data.hourly_units, sea_level_height_msl: 'ft' } }, now)).toThrow('data');
        expect(() => parseTideForecast({ ...data, hourly: { ...data.hourly, sea_level_height_msl: ['', 2] } }, now)).toThrow('data');
        expect(() => parseTideForecast({ ...data, hourly: { ...data.hourly, time: [now / 1000, now / 1000] } }, now)).toThrow('data');
    });

    it('requests only public model water levels, with enough UTC padding and no credential headers', async () => {
        const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => payload([1, 2]) });
        await fetchTideForecast(input.location, new AbortController().signal, fetcher);
        const [url, options] = fetcher.mock.calls[0];
        expect(new URL(url).origin).toBe('https://marine-api.open-meteo.com');
        expect(Object.fromEntries(new URL(url).searchParams)).toMatchObject({ hourly: 'sea_level_height_msl',
            timeformat: 'unixtime', timezone: 'GMT', cell_selection: 'sea', past_days: '1', forecast_days: '11' });
        expect(options).toMatchObject({ credentials: 'omit', redirect: 'error' });
        expect(options.headers).toBeUndefined();
    });

    it('handles rate limits without leaking the response body', async () => {
        await expect(fetchTideForecast(input.location, new AbortController().signal,
            vi.fn().mockResolvedValue({ ok: false, status: 429 }))).rejects.toMatchObject({ code: 'quota', message: 'quota' });
    });

    it('cleans up timers and parent listeners on timeout and cancellation', async () => {
        vi.useFakeTimers();
        const parent = new AbortController();
        const remove = vi.spyOn(parent.signal, 'removeEventListener');
        const fetcher = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
            options.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }));
        const task = fetchTideForecast(input.location, parent.signal, fetcher);
        const assertion = expect(task).rejects.toMatchObject({ code: 'network' });
        await vi.advanceTimersByTimeAsync(15_000);
        await assertion;
        expect(vi.getTimerCount()).toBe(0);
        expect(remove).toHaveBeenCalled();
        const cancelled = fetchTideForecast(input.location, parent.signal, fetcher);
        parent.abort();
        expect(vi.getTimerCount()).toBe(0);
        await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
    });
});

describe('estimated levels and local day boundaries', () => {
    it('finds peaks and plateau midpoints without inventing endpoint events', () => {
        expect(estimateTideEvents(forecast.hourly)).toEqual([{ timestamp: now + 2 * HOUR, height: 1, type: 'H' }]);
        const plateau = parseTideForecast(payload([0, -1, -1, 0, 1]), now);
        expect(estimateTideEvents(plateau.hourly)).toEqual([{ timestamp: now + 1.5 * HOUR, height: -1, type: 'L' }]);
        expect(estimateTideEvents(parseTideForecast(payload([1, 1, 1]), now).hourly)).toEqual([]);
        expect(tideHeightAt(forecast.hourly, now + HOUR / 2)).toBe(-0.5);
        expect(tideHeightAt(forecast.hourly, now - 1)).toBeNull();
    });

    it.each([
        ['2026-11-01', 'America/New_York', '2026-11-01T04:00Z', 25],
        ['2026-03-08', 'America/New_York', '2026-03-08T05:00Z', 23],
        ['2026-10-15', 'Asia/Kathmandu', '2026-10-14T18:15Z', 24],
    ])('clips %s in %s by actual instants and retains both curve boundaries', (date, zone, start, hours) => {
        const first = Date.parse(String(start));
        const hourly = Array.from({ length: 30 }, (_, index) => ({ timestamp: Math.floor(first / HOUR) * HOUR + (index - 1) * HOUR, height: index }));
        const day = selectTideDay({ ...forecast, hourly }, String(date), String(zone));
        expect(day.hourly[0].timestamp).toBe(first);
        expect(day.hourly.at(-1)!.timestamp).toBe(first + Number(hours) * HOUR);
        expect(day.events).toEqual([]);
    });
});

describe('visible view request ownership', () => {
    it('waits for an active resolved view, reuses the forecast across dates, and retries explicitly', async () => {
        const h = harness();
        h.controller.update({ ...input, active: false });
        h.controller.update({ ...input, ready: false });
        expect(h.request).not.toHaveBeenCalled();
        h.controller.update(input);
        h.controller.update(input);
        await flush();
        expect(h.state().status).toBe('ready');
        h.controller.update({ ...input, date: '2026-10-16' });
        await flush();
        expect(h.state().status).toBe('no-data');
        h.controller.update(input);
        expect(h.request).toHaveBeenCalledTimes(1);
        h.controller.retry();
        await flush();
        expect(h.request).toHaveBeenCalledTimes(2);
        h.controller.destroy();
    });

    it.each(['location', 'date', 'hidden', 'unready', 'destroy'])('cancels and ignores late responses after %s changes', async action => {
        const h = harness();
        let resolve!: (value: TideForecast) => void;
        h.request.mockReturnValueOnce(new Promise<TideForecast>(done => { resolve = done; }));
        h.controller.update(input);
        const signal = h.request.mock.calls[0][1] as AbortSignal;
        if (action === 'location') { h.controller.update({ ...input, location: { lat: 24, lon: 118 } }); }
        if (action === 'date') { h.controller.update({ ...input, date: '2026-10-16' }); }
        if (action === 'hidden') { h.controller.update({ ...input, active: false }); }
        if (action === 'unready') { h.controller.update({ ...input, ready: false }); }
        if (action === 'destroy') { h.controller.destroy(); }
        await flush();
        const count = h.changed.mock.calls.length;
        expect(signal.aborted).toBe(true);
        resolve(forecast);
        await flush();
        expect(h.changed.mock.calls.length).toBe(count);
        h.controller.destroy();
    });

    it('restarts an interrupted request on re-entry but does not loop on an error', async () => {
        const h = harness();
        h.request.mockReturnValueOnce(new Promise(() => {}));
        h.controller.update(input);
        h.controller.update({ ...input, active: false });
        h.request.mockRejectedValueOnce(new Error());
        h.controller.update(input);
        await flush();
        expect(h.state().status).toBe('error');
        h.controller.update({ ...input, now: now + 5000 });
        h.controller.update({ ...input, active: false });
        h.controller.update(input);
        expect(h.request).toHaveBeenCalledTimes(2);
        h.controller.retry();
        await flush();
        expect(h.state().status).toBe('ready');
        h.controller.destroy();
    });

    it('does not request outside the local forecast window and invalidates yesterday at midnight', async () => {
        const h = harness();
        h.controller.update({ ...input, date: '2026-10-25' });
        expect(h.state().status).toBe('out-of-range');
        expect(h.request).not.toHaveBeenCalled();
        h.controller.update(input);
        await flush();
        h.controller.update({ ...input, now: Date.parse('2026-10-16T00:01+08:00') });
        expect(h.state().status).toBe('out-of-range');
        expect(h.state().day).toBeNull();
        h.controller.destroy();
    });

    it('refreshes an expired coordinate forecast when reopening', async () => {
        const h = harness();
        h.controller.update(input);
        await flush();
        h.controller.update({ ...input, active: false });
        h.controller.update({ ...input, now: now + 8 * HOUR });
        await flush();
        expect(h.request).toHaveBeenCalledTimes(2);
        h.controller.destroy();
    });
});

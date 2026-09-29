import { describe, expect, it, vi } from 'vitest';
import { assessRainbowConditions, createRainbowConditionsLoader, fetchRainbowConditions, rainbowSamples, type RainbowConditions } from './rainbowConditions';

const location = { lat: 30, lon: 120 };
const source = { altitude: 20, azimuth: 270 };
const timestamp = Date.UTC(2026, 8, 29, 8, 15);
const end = Date.UTC(2026, 8, 29, 9);
const samplePoints = rainbowSamples(location, source, 'ecmwf');
const evidence = (rainMm: number | null, directWm2: number | null) => samplePoints.map(sample => ({ ...sample, rainMm, directWm2 }));
const request = { location, source, model: 'ecmwf' as const, timestamp };
const payload = () => samplePoints.map(() => ({
    hourly_units: { time: 'unixtime', rain: 'mm', showers: 'mm', direct_normal_irradiance: 'W/m²' },
    hourly: { time: [end / 1000], rain: [0.1], showers: [0.2], direct_normal_irradiance: [150] },
}));

describe('rainbow condition sampling and assessment', () => {
    it('samples the forward visible bow at model-scaled distances across the dateline', () => {
        expect(samplePoints).toHaveLength(9);
        expect(samplePoints.every(point => point.lon > location.lon)).toBe(true);
        expect(samplePoints.map(point => point.distanceKm)).toEqual([9, 18, 27, 9, 18, 27, 9, 18, 27]);
        const samples = rainbowSamples({ lat: 0, lon: 179.99 }, source, 'gfs');
        expect(samples.every(point => point.lon >= -180 && point.lon <= 180)).toBe(true);
        expect(samples[2].distanceKm).toBe(66);
    });

    it('excludes night and bows with no above-horizon extent without claiming absence below', () => {
        for (const altitude of [-10, 0, 42, 60, NaN]) {
            expect(rainbowSamples(location, { ...source, altitude }, 'icon')).toEqual([]);
        }
    });

    it('requires complete data, including light data where rain is zero', () => {
        expect(assessRainbowConditions(evidence(null, 200), end).level).toBe('insufficient');
        expect(assessRainbowConditions(evidence(0, null), end).level).toBe('insufficient');
        expect(assessRainbowConditions(evidence(1, 200).slice(1), end).level).toBe('insufficient');
        expect(assessRainbowConditions(evidence(0, 200), end).level).toBe('unfavourable');
    });

    it('never combines rain and sunlight at different sample points', () => {
        const samples = evidence(0, 300);
        samples[0] = { ...samples[0], rainMm: 1, directWm2: 0 };
        expect(assessRainbowConditions(samples, end)).toMatchObject({ level: 'mixed', wetCount: 1, litWetCount: 0 });
        samples[0].directWm2 = 120;
        expect(assessRainbowConditions(samples, end)).toMatchObject({ level: 'favourable', wetCount: 1, litWetCount: 1 });
    });
});

describe('rainbow forecast data contract', () => {
    it('requests one explicit model and batch; sums rain and showers in the containing hour', async () => {
        const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => payload() });
        const signal = new AbortController().signal;
        const result = await fetchRainbowConditions({ ...request, signal, fetcher });
        expect(result).toMatchObject({ start: end - 3_600_000, end, level: 'favourable', litWetCount: 9 });
        expect(result.samples[0].rainMm).toBeCloseTo(0.3);
        const url = fetcher.mock.calls[0][0] as URL;
        expect(url.searchParams.get('latitude')?.split(',')).toHaveLength(9);
        expect(url.searchParams.get('models')).toBe('ecmwf_ifs');
        expect(url.searchParams.get('hourly')).toBe('rain,showers,direct_normal_irradiance');
        expect(fetcher.mock.calls[0][1]).toEqual({ signal });
    });

    it('does not interpolate absent timestamps or convert missing fields into dry weather', async () => {
        for (const data of [payload().map(point => ({ ...point, hourly: { ...point.hourly, time: [end / 1000 - 3600] } })),
            payload().map(point => ({ ...point, hourly: { ...point.hourly, showers: [null] } })),
            payload().map(point => ({ ...point, hourly_units: { ...point.hourly_units, rain: 'inch' } })),
            payload().map(point => ({ ...point, hourly: { ...point.hourly, rain: [-1] } }))]) {
            const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => data });
            expect((await fetchRainbowConditions({ ...request, signal: new AbortController().signal, fetcher })).level).toBe('insufficient');
        }
    });

    it('honours exact hour boundaries and rejects incomplete batches and HTTP errors', async () => {
        const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => payload() });
        const signal = new AbortController().signal;
        expect((await fetchRainbowConditions({ ...request, timestamp: end, signal, fetcher })).end).toBe(end);
        fetcher.mockResolvedValueOnce({ ok: true, json: async () => payload().slice(1) });
        await expect(fetchRainbowConditions({ ...request, signal, fetcher })).rejects.toThrow('Incomplete');
        fetcher.mockResolvedValueOnce({ ok: false, status: 429 });
        await expect(fetchRainbowConditions({ ...request, signal, fetcher })).rejects.toThrow('429');
    });
});

describe('rainbow request lifetime', () => {
    it('aborts and suppresses late responses after a context change or close', async () => {
        for (const operation of ['reset', 'destroy'] as const) {
            let resolve!: (value: RainbowConditions) => void;
            const fetcher = vi.fn((_input: Parameters<typeof fetchRainbowConditions>[0]) =>
                new Promise<RainbowConditions>(done => { resolve = done; }));
            const publish = vi.fn();
            const loader = createRainbowConditionsLoader(publish, fetcher);
            const pending = loader.load(request);
            loader[operation]();
            const count = publish.mock.calls.length;
            expect(fetcher.mock.calls[0][0].signal.aborted).toBe(true);
            resolve(assessRainbowConditions(evidence(1, 200), end));
            await pending;
            expect(publish).toHaveBeenCalledTimes(count);
        }
    });

    it('keeps a newer result when an older request ignores abort and finishes later', async () => {
        const pending: { signal: AbortSignal; resolve: (value: RainbowConditions) => void }[] = [];
        const fetcher = vi.fn((input: Parameters<typeof fetchRainbowConditions>[0]) =>
            new Promise<RainbowConditions>(resolve => { pending.push({ signal: input.signal, resolve }); }));
        const publish = vi.fn();
        const loader = createRainbowConditionsLoader(publish, fetcher);
        const oldRequest = loader.load(request);
        const newRequest = loader.load({ ...request, model: 'gfs' });
        expect(pending[0].signal.aborted).toBe(true);
        const newer = assessRainbowConditions(evidence(0, 200), end);
        pending[1].resolve(newer);
        await newRequest;
        pending[0].resolve(assessRainbowConditions(evidence(1, 200), end));
        await oldRequest;
        expect(publish.mock.calls.at(-1)?.[0]).toEqual({ status: 'ready', result: newer });
    });

    it('exposes failure and permits a successful retry', async () => {
        const result = assessRainbowConditions(evidence(0, 200), end);
        const fetcher = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(result);
        const publish = vi.fn();
        const loader = createRainbowConditionsLoader(publish, fetcher);
        await loader.load(request);
        expect(publish.mock.calls.at(-1)?.[0].status).toBe('error');
        await loader.load(request);
        expect(publish.mock.calls.at(-1)?.[0]).toEqual({ status: 'ready', result });
    });
});

import { describe, expect, it, vi } from 'vitest';
import { assessTerrain, assessVisibility, createRainbowSightlineLoader, fetchRainbowTerrain, fetchRainbowVisibility,
    terrainElevationAngle, terrainPlan, visibilityPlan, type SightlineRequest, type TerrainResult } from './rainbowSightlines';

const request: SightlineRequest = {
    location: { lat: 30, lon: 120 }, source: { azimuth: 270, altitude: 20 }, model: 'ecmwf',
    timestamp: Date.UTC(2026, 8, 29, 8, 15), cameraHeightM: 2, signal: new AbortController().signal,
};
const end = Date.UTC(2026, 8, 29, 9);

describe('terrain screening', () => {
    it('samples the visible bow including both horizon crossings and the top', () => {
        const plan = terrainPlan(request.location, request.source);
        expect(plan.directions).toHaveLength(7);
        expect(plan.points).toHaveLength(112);
        expect(plan.directions[0].altitude).toBeCloseTo(0);
        expect(plan.directions[3].altitude).toBeCloseTo(22);
        expect(plan.directions[6].altitude).toBeCloseTo(0);
        expect(terrainPlan(request.location, { ...request.source, altitude: 50 }).directions).toEqual([]);
    });

    it('accounts for curvature, negative elevations and raised cameras', () => {
        expect(terrainElevationAngle(0, 0, 30)).toBeLessThan(-0.1);
        expect(terrainElevationAngle(-400, -300, 1)).toBeGreaterThan(5);
        expect(terrainElevationAngle(100, 100, 1)).toBeLessThan(terrainElevationAngle(2, 100, 1));
    });

    it('detects a ridge and keeps missing terrain unknown instead of claiming clearance', () => {
        const plan = terrainPlan(request.location, request.source);
        const heights: (number | null)[] = [100, ...plan.points.map(() => 100)];
        let result = assessTerrain(plan, heights, 2);
        expect(result.directions.every(direction => direction.complete && !direction.potentialObstruction)).toBe(true);
        heights[1] = 500;
        result = assessTerrain(plan, heights, 2);
        expect(result.directions[0]).toMatchObject({ potentialObstruction: true, ridgeDistanceKm: 0.1 });
        heights[2] = null;
        expect(assessTerrain(plan, heights, 2).directions[0]).toMatchObject({ complete: false, potentialObstruction: true });
        heights[0] = null;
        expect(assessTerrain(plan, heights, 2).directions.every(direction => !direction.complete && direction.horizonAltitude === null)).toBe(true);
    });

    it('batches elevation requests below the API limit and preserves the observer datum', async () => {
        const fetcher = vi.fn(async (url: URL) => {
            const count = url.searchParams.get('latitude')!.split(',').length;
            return { ok: true, json: async () => ({ elevation: Array(count).fill(-20) }) } as Response;
        });
        const result = await fetchRainbowTerrain({ ...request, fetcher: fetcher as unknown as typeof fetch });
        expect(fetcher.mock.calls.map(([url]) => url.searchParams.get('latitude')!.split(',').length)).toEqual([100, 13]);
        expect(result.observerElevationM).toBe(-18);
        expect(result.directions.every(direction => direction.complete)).toBe(true);
    });

    it('preserves partial evidence on batch failure and stops dispatching when aborted', async () => {
        const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ elevation: Array(100).fill(100) }) })
            .mockResolvedValueOnce({ ok: false });
        const result = await fetchRainbowTerrain({ ...request, fetcher });
        expect(result.directions[0].complete).toBe(true);
        expect(result.directions.at(-1)?.complete).toBe(false);
        const controller = new AbortController();
        fetcher.mockImplementation(async () => {
            controller.abort();
            return { ok: true, json: async () => ({ elevation: Array(100).fill(100) }) };
        });
        fetcher.mockClear();
        await expect(fetchRainbowTerrain({ ...request, signal: controller.signal, fetcher })).rejects.toThrow();
        expect(fetcher).toHaveBeenCalledTimes(1);
    });
});

describe('visibility along candidate routes', () => {
    it('includes the observer and interior points, without mixing directions or points beyond a target', () => {
        const plan = visibilityPlan(request.location, request.source, request.model);
        expect(plan.points[0]).toMatchObject({ ...request.location, distanceKm: 0 });
        expect(plan.points.some(point => point.distanceKm === 4.5)).toBe(true);
        const values: (number | null)[] = plan.points.map(() => 30);
        const target = plan.candidates[0];
        const far = plan.points.findIndex(point => point.bearing === target.bearing && point.distanceKm === 27);
        values[far] = 1;
        let result = assessVisibility(plan, values, end);
        expect(result.routes[0]).toMatchObject({ minimumKm: 30, lowVisibility: false });
        expect(result.routes[2]).toMatchObject({ minimumKm: 1, lowVisibility: true });
        expect(result.routes[5].lowVisibility).toBe(false);
        values[0] = 0;
        result = assessVisibility(plan, values, end);
        expect(result.routes.every(route => route.lowVisibility)).toBe(true);
        values[0] = null;
        expect(assessVisibility(plan, values, end).routes.every(route => !route.complete)).toBe(true);
    });

    it('reads only the exact forecast time and metre units; negative or missing data stay unavailable', async () => {
        const plan = visibilityPlan(request.location, request.source, request.model);
        const payload = () => plan.points.map(() => ({ hourly_units: { time: 'unixtime', visibility: 'm' },
            hourly: { time: [end / 1000], visibility: [4200] } }));
        const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => payload() });
        const result = await fetchRainbowVisibility({ ...request, fetcher });
        expect(result.timestamp).toBe(end);
        expect(result.routes.every(route => route.minimumKm === 4.2 && route.complete && route.lowVisibility)).toBe(true);
        const url = fetcher.mock.calls[0][0] as URL;
        expect(url.searchParams.get('models')).toBe('ecmwf_ifs');
        expect(fetcher.mock.calls[0][1].signal).toBe(request.signal);
        for (const body of [payload().map(point => ({ ...point, hourly: { ...point.hourly, time: [end / 1000 - 3600] } })),
            payload().map(point => ({ ...point, hourly_units: { ...point.hourly_units, visibility: 'km' } })),
            payload().map(point => ({ ...point, hourly: { ...point.hourly, visibility: [-1] } }))]) {
            fetcher.mockResolvedValueOnce({ ok: true, json: async () => body });
            expect((await fetchRainbowVisibility({ ...request, fetcher })).routes.every(route => !route.complete && route.minimumKm === null)).toBe(true);
        }
    });

    it('rejects malformed batches and HTTP failure without changing models', async () => {
        const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => [] }).mockResolvedValueOnce({ ok: false });
        await expect(fetchRainbowVisibility({ ...request, fetcher })).rejects.toThrow('Incomplete');
        await expect(fetchRainbowVisibility({ ...request, fetcher })).rejects.toThrow('failed');
        expect(fetcher).toHaveBeenCalledTimes(2);
    });
});

describe('sightline request ownership', () => {
    it('keeps terrain results if visibility fails', async () => {
        const publish = vi.fn();
        const terrain = { observerElevationM: 102, directions: [] };
        const loader = createRainbowSightlineLoader(publish, {
            terrain: vi.fn().mockResolvedValue(terrain), visibility: vi.fn().mockRejectedValue(new Error('network')),
        });
        await loader.load(request);
        expect(publish.mock.calls.at(-1)?.[0]).toEqual({ status: 'ready', terrain, visibility: null });
    });

    it('aborts both branches and rejects late completion on reset or close', async () => {
        for (const action of ['reset', 'destroy'] as const) {
            let finish!: (result: TerrainResult) => void;
            const terrain = vi.fn((_input: SightlineRequest) => new Promise<TerrainResult>(resolve => { finish = resolve; }));
            const visibility = vi.fn().mockResolvedValue({ timestamp: end, routes: [] });
            const publish = vi.fn();
            const loader = createRainbowSightlineLoader(publish, { terrain, visibility });
            const pending = loader.load(request);
            loader[action]();
            expect(terrain.mock.calls[0][0].signal.aborted).toBe(true);
            expect(visibility.mock.calls[0][0].signal.aborted).toBe(true);
            const count = publish.mock.calls.length;
            finish({ observerElevationM: 2, directions: [] });
            await pending;
            expect(publish).toHaveBeenCalledTimes(count);
        }
    });
});

import { describe, expect, it, vi } from 'vitest';

import {
    createFavoriteComparisonPlanner,
    type FavoriteComparisonPlannerPort,
    type FavoriteComparisonTarget,
} from './favoriteComparison';
import type { LightPollutionPoint } from './lightPollution';
import type { WeatherPoint } from './weather';

const lightPollution = (estimatedBortle: number): LightPollutionPoint => ({
    sqm: 21.4,
    brightnessRatio: 1.2,
    estimatedBortle,
    observingConditions: {
        milkyWay: 'complex-structure',
        zodiacalLight: 'clearly-visible',
        andromedaGalaxy: 'very-obvious',
        triangulumGalaxy: 'averted-visible',
        groundVisibility: 'faint-distant-large-objects',
    },
    year: 2025,
});

const weatherPoint = (timestamp: number): WeatherPoint => ({
    timestamp,
    iconCode: 1,
    isDay: false,
    totalCloudPercent: 20,
    highCloudPercent: 10,
    mediumCloudPercent: 5,
    lowCloudPercent: 8,
    temperatureC: 18,
    dewPointC: 12,
    humidityPercent: 72,
    precipMm: 0.2,
    windKmh: 11,
    windDirectionDeg: 120,
    aod550: null,
    visibilityKm: null,
});

const targets: FavoriteComparisonTarget[] = [
    {
        id: 'a',
        title: '地点 A',
        location: { lat: 23.1, lon: 113.3 },
        knownElevationM: 18,
        knownLightPollution: lightPollution(3.1),
    },
    {
        id: 'b',
        title: '地点 B',
        location: { lat: 31.2, lon: 121.5 },
    },
];

const fiveTargets: FavoriteComparisonTarget[] = Array.from({ length: 5 }, (_, index) => ({
    id: `target-${index + 1}`,
    title: `地点 ${index + 1}`,
    location: { lat: 23 + index, lon: 113 + index },
}));

const createPort = (): FavoriteComparisonPlannerPort => ({
    getTimeZone: vi.fn().mockResolvedValue('Asia/Shanghai'),
    getElevation: vi.fn().mockResolvedValue(35),
    getAtmosphere: vi.fn().mockResolvedValue([
        { timestamp: Date.UTC(2026, 7, 27, 16), aod550: 0.12, visibilityKm: 26 },
    ]),
    getLightPollution: vi.fn().mockResolvedValue(lightPollution(2.5)),
    getWeather: vi.fn().mockResolvedValue([
        weatherPoint(Date.UTC(2026, 7, 27, 16)),
        weatherPoint(Date.UTC(2026, 7, 27, 17)),
        weatherPoint(Date.UTC(2026, 7, 27, 18)),
        weatherPoint(Date.UTC(2026, 7, 27, 19)),
        weatherPoint(Date.UTC(2026, 7, 27, 20)),
        weatherPoint(Date.UTC(2026, 7, 27, 21)),
    ]),
});

describe('favorite comparison planner', () => {
    it('prepares fixed context once and only reloads Windy data when the model changes', async () => {
        const port = createPort();
        const planner = createFavoriteComparisonPlanner(port);
        const signal = new AbortController().signal;
        const requestedAt = Date.UTC(2026, 7, 27, 17);
        const session = await planner.prepare({
            targets,
            dateInput: '2026-08-28',
            requestedAt,
            signal,
        });

        expect(port.getTimeZone).toHaveBeenCalledTimes(2);
        expect(port.getElevation).toHaveBeenCalledTimes(1);
        expect(port.getLightPollution).toHaveBeenCalledTimes(1);
        expect(port.getAtmosphere).toHaveBeenCalledTimes(2);

        const ecResults = await session.loadModel('ecmwf', signal);
        const gfsResults = await session.loadModel('gfs', signal);

        expect(port.getWeather).toHaveBeenCalledTimes(4);
        expect(port.getAtmosphere).toHaveBeenCalledTimes(2);
        expect(ecResults).toHaveLength(2);
        expect(gfsResults).toHaveLength(2);
        expect(ecResults[0].prepared.status).toBe('ready');
        expect(ecResults[0].windows).toHaveLength(2);
        expect(ecResults[0].dateSelection.coverage).toBe('covered');
    });

    it('keeps one location failure independent from the other locations', async () => {
        const port = createPort();
        vi.mocked(port.getTimeZone)
            .mockRejectedValueOnce(new Error('timezone unavailable'))
            .mockResolvedValueOnce('Asia/Shanghai');
        vi.mocked(port.getWeather).mockRejectedValueOnce(new Error('forecast unavailable'));
        const planner = createFavoriteComparisonPlanner(port);
        const signal = new AbortController().signal;
        const session = await planner.prepare({
            targets,
            dateInput: '2026-08-28',
            requestedAt: Date.UTC(2026, 7, 27, 17),
            signal,
        });
        const results = await session.loadModel('icon', signal);

        expect(results[0].prepared.status).toBe('error');
        expect(results[0].weatherStatus).toBe('error');
        expect(results[1].prepared.status).toBe('ready');
        expect(results[1].weatherStatus).toBe('error');
        expect(results[1].windows).toHaveLength(2);
    });

    it('does not treat atmosphere-only points as a successful Windy forecast', async () => {
        const port = createPort();
        vi.mocked(port.getWeather).mockResolvedValue([]);
        const planner = createFavoriteComparisonPlanner(port);
        const signal = new AbortController().signal;
        const session = await planner.prepare({
            targets,
            dateInput: '2026-08-28',
            requestedAt: Date.UTC(2026, 7, 27, 17),
            signal,
        });
        const results = await session.loadModel('ecmwf', signal);

        expect(results.map(result => result.weatherStatus)).toEqual(['empty', 'empty']);
    });

    it('accepts two to five targets and rejects requests outside that boundary', async () => {
        const planner = createFavoriteComparisonPlanner(createPort());
        await expect(planner.prepare({
            targets: targets.slice(0, 1),
            dateInput: '2026-08-28',
            requestedAt: Date.UTC(2026, 7, 27, 17),
            signal: new AbortController().signal,
        })).rejects.toBeInstanceOf(RangeError);

        await expect(planner.prepare({
            targets: fiveTargets,
            dateInput: '2026-08-28',
            requestedAt: Date.UTC(2026, 7, 27, 17),
            signal: new AbortController().signal,
        })).resolves.toMatchObject({ preparedTargets: expect.arrayContaining([]) });

        await expect(planner.prepare({
            targets: [...fiveTargets, {
                id: 'target-6',
                title: '地点 6',
                location: { lat: 28, lon: 118 },
            }],
            dateInput: '2026-08-28',
            requestedAt: Date.UTC(2026, 7, 27, 17),
            signal: new AbortController().signal,
        })).rejects.toBeInstanceOf(RangeError);
    });

    it('loads at most two locations concurrently during preparation and model requests', async () => {
        const port = createPort();
        const prepareResolvers: ((value: string) => void)[] = [];
        vi.mocked(port.getTimeZone).mockImplementation(() => new Promise(resolve => {
            prepareResolvers.push(resolve);
        }));
        const planner = createFavoriteComparisonPlanner(port);
        const signal = new AbortController().signal;
        const preparePromise = planner.prepare({
            targets: fiveTargets,
            dateInput: '2026-08-28',
            requestedAt: Date.UTC(2026, 7, 27, 17),
            signal,
        });

        await vi.waitFor(() => expect(port.getTimeZone).toHaveBeenCalledTimes(2));
        prepareResolvers.splice(0).reverse().forEach(resolve => resolve('Asia/Shanghai'));
        await vi.waitFor(() => expect(port.getTimeZone).toHaveBeenCalledTimes(4));
        prepareResolvers.splice(0).reverse().forEach(resolve => resolve('Asia/Shanghai'));
        await vi.waitFor(() => expect(port.getTimeZone).toHaveBeenCalledTimes(5));
        prepareResolvers.splice(0).forEach(resolve => resolve('Asia/Shanghai'));
        const session = await preparePromise;
        expect(session.preparedTargets.map(prepared => prepared.target.id)).toEqual(
            fiveTargets.map(target => target.id),
        );

        const weatherResolvers: ((value: WeatherPoint[]) => void)[] = [];
        vi.mocked(port.getWeather).mockImplementation(() => new Promise(resolve => {
            weatherResolvers.push(resolve);
        }));
        const modelPromise = session.loadModel('ecmwf', signal);

        await vi.waitFor(() => expect(port.getWeather).toHaveBeenCalledTimes(2));
        weatherResolvers.splice(0).reverse().forEach(resolve => resolve([]));
        await vi.waitFor(() => expect(port.getWeather).toHaveBeenCalledTimes(4));
        weatherResolvers.splice(0).reverse().forEach(resolve => resolve([]));
        await vi.waitFor(() => expect(port.getWeather).toHaveBeenCalledTimes(5));
        weatherResolvers.splice(0).forEach(resolve => resolve([]));
        const modelResults = await modelPromise;
        expect(modelResults.map(result => result.prepared.target.id)).toEqual(
            fiveTargets.map(target => target.id),
        );
    });

    it('shares the two-location limit across overlapping comparison batches', async () => {
        const port = createPort();
        const timeZoneResolvers: (() => void)[] = [];
        let activeTimeZones = 0;
        let peakActiveTimeZones = 0;
        vi.mocked(port.getTimeZone).mockImplementation(() => new Promise(resolve => {
            activeTimeZones += 1;
            peakActiveTimeZones = Math.max(peakActiveTimeZones, activeTimeZones);
            timeZoneResolvers.push(() => {
                activeTimeZones -= 1;
                resolve('Asia/Shanghai');
            });
        }));
        const planner = createFavoriteComparisonPlanner(port);
        const comparisonInput = {
            targets: fiveTargets,
            dateInput: '2026-08-28',
            requestedAt: Date.UTC(2026, 7, 27, 17),
        };
        const firstPrepare = planner.prepare({
            ...comparisonInput,
            signal: new AbortController().signal,
        });
        const secondPrepare = planner.prepare({
            ...comparisonInput,
            signal: new AbortController().signal,
        });

        await vi.waitFor(() => expect(port.getTimeZone).toHaveBeenCalledTimes(2));
        expect(peakActiveTimeZones).toBe(2);
        let expectedCalls = 2;
        while (expectedCalls < 10) {
            timeZoneResolvers.splice(0).reverse().forEach(resolve => resolve());
            expectedCalls = Math.min(10, expectedCalls + 2);
            await vi.waitFor(() => expect(port.getTimeZone).toHaveBeenCalledTimes(expectedCalls));
            expect(peakActiveTimeZones).toBe(2);
        }
        timeZoneResolvers.splice(0).forEach(resolve => resolve());
        await Promise.all([firstPrepare, secondPrepare]);
        expect(peakActiveTimeZones).toBe(2);
    });

    it('does not start model requests when the model signal is already aborted', async () => {
        const port = createPort();
        const planner = createFavoriteComparisonPlanner(port);
        const session = await planner.prepare({
            targets,
            dateInput: '2026-08-28',
            requestedAt: Date.UTC(2026, 7, 27, 17),
            signal: new AbortController().signal,
        });
        const controller = new AbortController();
        controller.abort();

        await expect(session.loadModel('ecmwf', controller.signal)).rejects.toMatchObject({
            name: 'AbortError',
        });
        expect(port.getWeather).not.toHaveBeenCalled();
    });
});

import { describe, expect, it, vi } from 'vitest';

import {
    buildObservationWindows,
    createObservationPlanner,
    ObservationPlannerError,
    selectObservationPaths,
} from './observationPlanner';
import type { AstronomyTimeline, SolarPath } from './solar';
import type { WeatherPoint } from './weather';

const location = { lat: 23.1291, lon: 113.2644 };

const weatherPoint = (timestamp: number, overrides: Partial<WeatherPoint> = {}): WeatherPoint => ({
    timestamp,
    iconCode: null,
    isDay: false,
    totalCloudPercent: null,
    highCloudPercent: null,
    mediumCloudPercent: null,
    lowCloudPercent: null,
    temperatureC: null,
    dewPointC: null,
    humidityPercent: null,
    precipMm: null,
    windKmh: null,
    windDirectionDeg: null,
    aod550: null,
    visibilityKm: null,
    ...overrides,
});

describe('observation planner', () => {
    it('reuses location context across dates and computes all events once per plan', async () => {
        const getTimeZone = vi.fn().mockResolvedValue('Asia/Shanghai');
        const getElevation = vi.fn().mockResolvedValue(12);
        const planner = createObservationPlanner({ getTimeZone, getElevation });

        const first = await planner.plan({ location, dateInput: '2026-08-24' });
        const second = await planner.plan({ location, dateInput: '2026-08-25' });

        expect(getTimeZone).toHaveBeenCalledOnce();
        expect(getElevation).toHaveBeenCalledOnce();
        expect(first.paths.map(path => path.event)).toEqual(['sunrise', 'sunset', 'moonrise', 'moonset']);
        expect(second.timeZone).toBe('Asia/Shanghai');
        expect(second.elevationM).toBe(12);
    });

    it('lets later known elevation override a pending context request', async () => {
        let resolveTimeZone: (value: string) => void = () => undefined;
        const getTimeZone = vi.fn(() => new Promise<string>(resolve => {
            resolveTimeZone = resolve;
        }));
        const getElevation = vi.fn().mockResolvedValue(99);
        const planner = createObservationPlanner({ getTimeZone, getElevation });

        const first = planner.plan({ location, dateInput: '2026-08-24' });
        const second = planner.plan({ location, dateInput: '2026-08-25', knownElevationM: 18 });
        resolveTimeZone('Asia/Shanghai');

        const [firstPlan, secondPlan] = await Promise.all([first, second]);
        expect(getTimeZone).toHaveBeenCalledOnce();
        expect(getElevation).toHaveBeenCalledOnce();
        expect(firstPlan.elevationM).toBe(99);
        expect(secondPlan.elevationM).toBe(18);
    });

    it('lets later known elevation replace a cached elevation', async () => {
        const getTimeZone = vi.fn().mockResolvedValue('Asia/Shanghai');
        const getElevation = vi.fn().mockResolvedValue(99);
        const planner = createObservationPlanner({ getTimeZone, getElevation });

        await planner.plan({ location, dateInput: '2026-08-24' });
        const updated = await planner.plan({ location, dateInput: '2026-08-25', knownElevationM: 18 });

        expect(getTimeZone).toHaveBeenCalledOnce();
        expect(getElevation).toHaveBeenCalledOnce();
        expect(updated.elevationM).toBe(18);
    });

    it('reports invalid time zones through a stable error code', async () => {
        const planner = createObservationPlanner({
            getTimeZone: async () => 'Not/A_Timezone',
            getElevation: async () => 0,
        });

        await expect(planner.plan({ location, dateInput: '2026-08-24' })).rejects.toEqual(
            expect.objectContaining<Partial<ObservationPlannerError>>({ code: 'TIME_ZONE_INVALID' }),
        );
    });

    it('selects an event without recalculating the complete plan', () => {
        const paths = [
            { status: 'unavailable', event: 'sunrise', reason: 'not-available' },
            { status: 'unavailable', event: 'sunset', reason: 'not-available' },
        ] satisfies SolarPath[];

        expect(selectObservationPaths(paths, 'all')).toBe(paths);
        expect(selectObservationPaths(paths, 'sunset')).toEqual([paths[1]]);
    });

    it('builds factual evidence for the preferred astronomy windows', () => {
        const start = new Date('2026-08-24T12:00:00Z');
        const end = new Date('2026-08-24T15:00:00Z');
        const timeline = {
            dayStart: new Date('2026-08-24T00:00:00Z'),
            dayEnd: new Date('2026-08-25T00:00:00Z'),
            items: [],
            tracks: [],
            moonIllumination: { fraction: 0.25, phase: 0.2, waxing: true },
            intervals: [
                { kind: 'moonless-night', label: 'Moonless', start, end },
                { kind: 'milky-way', label: 'Milky Way', start, end },
            ],
        } satisfies AstronomyTimeline;
        const points = [
            weatherPoint(start.getTime(), { totalCloudPercent: 20, precipMm: 0, visibilityKm: 12, aod550: 0.08 }),
            weatherPoint(end.getTime(), { totalCloudPercent: 60, precipMm: 1.2, visibilityKm: 8, aod550: 0.16 }),
            weatherPoint(end.getTime() + 1, { totalCloudPercent: 100 }),
        ];

        const windows = buildObservationWindows({
            timeline,
            weatherPoints: points,
            lightPollution: {
                year: 2025,
                sqm: 20.5,
                brightnessRatio: 1,
                estimatedBortle: 5,
                observingConditions: {
                    milkyWay: 'broad-structure',
                    zodiacalLight: 'zenith-visible',
                    andromedaGalaxy: 'very-obvious',
                    triangulumGalaxy: 'averted-barely-visible',
                    groundVisibility: 'distant-large-objects',
                },
            },
            referenceTime: start.getTime(),
        });

        expect(windows[0].interval).toEqual(timeline.intervals[0]);
        expect(windows[0].evidence).toMatchObject({
            weatherSampleCount: 2,
            weatherCoverage: 'full',
            totalCloudPercent: { minimum: 20, maximum: 60 },
            precipitationMm: { minimum: 0, maximum: 1.2 },
            visibilityKm: { minimum: 8, maximum: 12 },
            aod550: { minimum: 0.08, maximum: 0.16 },
            moonIlluminationFraction: 0.25,
            sqm: 20.5,
            estimatedBortle: 5,
        });
    });

    it('uses forecast cells whose represented time range overlaps a short window', () => {
        const timeline = {
            dayStart: new Date('2026-08-24T00:00:00Z'),
            dayEnd: new Date('2026-08-25T00:00:00Z'),
            items: [],
            tracks: [],
            moonIllumination: { fraction: 0.1, phase: 0.1, waxing: true },
            intervals: [{
                kind: 'moonless-night',
                label: 'Moonless',
                start: new Date('2026-08-24T02:13:00Z'),
                end: new Date('2026-08-24T04:48:00Z'),
            }],
        } satisfies AstronomyTimeline;
        const points = [
            weatherPoint(new Date('2026-08-24T02:00:00Z').getTime(), { totalCloudPercent: 20 }),
            weatherPoint(new Date('2026-08-24T05:00:00Z').getTime(), { totalCloudPercent: 60 }),
            weatherPoint(new Date('2026-08-24T08:00:00Z').getTime(), { totalCloudPercent: 100 }),
        ];

        const [window] = buildObservationWindows({
            timeline,
            weatherPoints: points,
            lightPollution: null,
            referenceTime: timeline.dayStart.getTime(),
        });

        expect(window.evidence.weatherSampleCount).toBe(2);
        expect(window.evidence.weatherCoverage).toBe('full');
        expect(window.evidence.totalCloudPercent).toEqual({ minimum: 20, maximum: 60 });
    });

    it('marks an observing window as partially covered at a forecast boundary', () => {
        const interval = {
            kind: 'moonless-night' as const,
            label: 'Moonless',
            start: new Date('2026-08-24T02:13:00Z'),
            end: new Date('2026-08-24T04:48:00Z'),
        };
        const timeline = {
            dayStart: new Date('2026-08-24T00:00:00Z'),
            dayEnd: new Date('2026-08-25T00:00:00Z'),
            items: [],
            tracks: [],
            moonIllumination: { fraction: 0.1, phase: 0.1, waxing: true },
            intervals: [interval],
        } satisfies AstronomyTimeline;
        const points = [
            weatherPoint(new Date('2026-08-24T04:00:00Z').getTime(), { totalCloudPercent: 20 }),
            weatherPoint(new Date('2026-08-24T07:00:00Z').getTime(), { totalCloudPercent: 60 }),
        ];

        const [window] = buildObservationWindows({
            timeline,
            weatherPoints: points,
            lightPollution: null,
            referenceTime: timeline.dayStart.getTime(),
        });

        expect(window.evidence.weatherSampleCount).toBe(1);
        expect(window.evidence.weatherCoverage).toBe('partial');
        expect(window.evidence.totalCloudPercent).toEqual({ minimum: 20, maximum: 20 });
    });

    it('keeps missing moon illumination distinct from a new moon', () => {
        const windows = buildObservationWindows({
            timeline: null,
            weatherPoints: [],
            lightPollution: null,
            referenceTime: Date.now(),
        });

        expect(windows[0].evidence.moonIlluminationFraction).toBeNull();
        expect(windows[0].evidence.weatherCoverage).toBe('none');
    });
});

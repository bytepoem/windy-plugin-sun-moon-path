import { describe, expect, it } from 'vitest';

import {
    calculateCurrentSolarDirection,
    calculateSolarPath,
    CURRENT_DIRECTION_LENGTH_KM,
    dateInputToUtcNoon,
    destinationPoint,
    distanceKm,
    normalizeAzimuth,
    splitPolylineAtDateLine,
} from './solar';

describe('solar path geometry', () => {
    it('creates the current solar direction endpoint at 600 km', () => {
        const origin = { lat: 23.1291, lon: 113.2644 };
        const direction = calculateCurrentSolarDirection({
            date: new Date('2026-08-15T10:30:00.000Z'),
            location: origin,
        });

        expect(direction.azimuth).toBeGreaterThan(0);
        expect(direction.azimuth).toBeLessThan(360);
        expect(distanceKm(origin, direction.endpoint)).toBeCloseTo(CURRENT_DIRECTION_LENGTH_KM, 5);
    });

    it('anchors calendar dates at local noon before calculating solar events', () => {
        expect(dateInputToUtcNoon('2026-08-15', 'Asia/Shanghai').toISOString()).toBe(
            '2026-08-15T04:00:00.000Z',
        );
        expect(dateInputToUtcNoon('2026-01-15', 'America/New_York').toISOString()).toBe(
            '2026-01-15T17:00:00.000Z',
        );
    });

    it('normalizes azimuth into the north-based 0..360 range', () => {
        expect(normalizeAzimuth(-15)).toBe(345);
        expect(normalizeAzimuth(360)).toBe(0);
        expect(normalizeAzimuth(725)).toBe(5);
    });

    it('creates a geodesic destination at the requested distance', () => {
        const origin = { lat: 23.05, lon: 113.37 };
        const point = destinationPoint(origin, 270, 200);

        expect(distanceKm(origin, point)).toBeCloseTo(200, 5);
        expect(point.lat).toBeCloseTo(origin.lat, 1);
        expect(point.lon).toBeLessThan(origin.lon);
    });

    it('wraps a destination longitude across the international date line', () => {
        const origin = { lat: 0, lon: 179.5 };
        const point = destinationPoint(origin, 90, 200);

        expect(point.lon).toBeLessThan(-178);
        expect(distanceKm(origin, point)).toBeCloseTo(200, 5);
    });

    it('splits a short line at the international date line', () => {
        const segments = splitPolylineAtDateLine([
            { lat: 0, lon: 179.5 },
            { lat: 0.2, lon: -179.5 },
            { lat: 0.4, lon: -178.5 },
        ]);

        expect(segments).toHaveLength(2);
        expect(segments[0].at(-1)?.lon).toBe(180);
        expect(segments[1][0].lon).toBe(-180);
        expect(segments[1].at(-1)?.lon).toBe(-178.5);

        const boundarySegment = splitPolylineAtDateLine([
            { lat: 0, lon: 179.5 },
            { lat: 0.2, lon: -180 },
        ]);

        expect(boundarySegment).toHaveLength(1);
        expect(boundarySegment[0].at(-1)?.lon).toBe(180);

        const sameBoundarySegment = splitPolylineAtDateLine([
            { lat: 0, lon: 180 },
            { lat: 0.2, lon: -180 },
        ]);

        expect(sameBoundarySegment).toHaveLength(1);
        expect(sameBoundarySegment[0]).toEqual([
            { lat: 0, lon: 180 },
            { lat: 0.2, lon: 180 },
        ]);
    });

    it('creates three ordered event samples and two distance points per line', () => {
        const result = calculateSolarPath({
            date: dateInputToUtcNoon('2026-08-15', 'Asia/Shanghai'),
            location: { lat: 23.05, lon: 113.37 },
            event: 'sunset',
        });

        expect(result.status).toBe('ok');
        if (result.status !== 'ok') {
            return;
        }

        expect(result.samples.map(sample => sample.offsetMinutes)).toEqual([-30, 0, 30]);
        expect(result.samples.map(sample => sample.kind)).toEqual(['before', 'event', 'after']);

        for (const sample of result.samples) {
            expect(distanceKm({ lat: 23.05, lon: 113.37 }, sample.point200)).toBeCloseTo(200, 5);
            expect(distanceKm({ lat: 23.05, lon: 113.37 }, sample.point400)).toBeCloseTo(400, 5);
            expect(sample.time.getTime()).toBe(
                result.eventTime.getTime() + sample.offsetMinutes * 60_000,
            );
        }
    });

    it('reports unavailable events in polar conditions', () => {
        const result = calculateSolarPath({
            date: dateInputToUtcNoon('2026-06-21', 'UTC'),
            location: { lat: 89.9, lon: 0 },
            event: 'sunset',
        });

        expect(result.status).toBe('unavailable');
        if (result.status === 'unavailable') {
            expect(['always-up', 'always-down', 'not-available']).toContain(result.reason);
        }
    });

    it('calculates events in both hemispheres', () => {
        const northern = calculateSolarPath({
            date: dateInputToUtcNoon('2026-06-21', 'UTC'),
            location: { lat: 40, lon: -74 },
            event: 'sunrise',
        });
        const southern = calculateSolarPath({
            date: dateInputToUtcNoon('2026-06-21', 'UTC'),
            location: { lat: -40, lon: 151 },
            event: 'sunrise',
        });

        expect(northern.status).toBe('ok');
        expect(southern.status).toBe('ok');
    });
});

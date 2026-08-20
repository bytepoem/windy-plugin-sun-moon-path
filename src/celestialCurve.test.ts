import { describe, expect, it } from 'vitest';

import { buildCelestialCurve, buildCelestialCurves, findTimestampPosition } from './celestialCurve';

const HOUR = 60 * 60 * 1000;

describe('celestial rise and set curves', () => {
    it('aligns samples with unequal forecast intervals', () => {
        const start = Date.UTC(2026, 7, 20, 0);
        const timestamps = [start, start + HOUR, start + 4 * HOUR];

        expect(findTimestampPosition(timestamps, start + 2 * HOUR)).toBeCloseTo(1 + 1 / 3);
        expect(findTimestampPosition(timestamps, start - HOUR)).toBeNull();
    });

    it('builds visible sun and moon segments with horizon events', () => {
        const start = Date.UTC(2026, 7, 20, 0);
        const timestamps = Array.from({ length: 25 }, (_, index) => start + index * 3 * HOUR);
        const curves = buildCelestialCurves(timestamps, { lat: 23.05, lon: 113.37 });

        expect(curves.map(curve => curve.body)).toEqual(['sun', 'moon']);
        for (const curve of curves) {
            expect(curve.segments.length).toBeGreaterThan(0);
            expect(curve.events.some(event => event.kind === 'rise')).toBe(true);
            expect(curve.events.some(event => event.kind === 'set')).toBe(true);
            expect(curve.segments.flatMap(segment => segment.points).every(point =>
                point.position >= 0
                && point.position <= timestamps.length - 1
                && point.altitudeDeg >= 0
                && point.altitudeDeg <= 90,
            )).toBe(true);
        }
    });

    it('returns no horizon events during a polar-day window', () => {
        const start = Date.UTC(2026, 5, 20, 0);
        const timestamps = Array.from({ length: 9 }, (_, index) => start + index * 3 * HOUR);
        const curve = buildCelestialCurve({
            body: 'sun',
            timestamps,
            location: { lat: 80, lon: 0 },
        });

        expect(curve.events).toEqual([]);
        expect(curve.segments).toHaveLength(1);
    });
});

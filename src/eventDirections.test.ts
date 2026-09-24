import { describe, expect, it } from 'vitest';
import { cloudGalacticCenterPosition } from './cloudGeometry';
import { galacticCenterEvents } from './cloudTimeline';
import { galacticDirectionPaths, selectDirectionPaths } from './eventDirections';
import { buildDirectionLineFitBounds } from './mapView';
import { calculateSolarPath } from './solar';

const location = { lat: 23.1291, lon: 113.2644 };

describe('galactic event direction lines', () => {
    it('samples rise and set at minus 30, zero and plus 30 minutes, including below-horizon bearings', () => {
        const events = galacticCenterEvents('2026-09-24', 'Asia/Shanghai', location);
        const paths = galacticDirectionPaths(events, location, 'zh');
        expect(paths.map(path => path.event)).toEqual(['milkywayrise', 'milkywayset']);
        for (const path of paths) {
            expect(path.status).toBe('ok');
            if (path.status !== 'ok') {throw new Error('Expected a horizon crossing');}
            expect(path.samples.map(sample => (sample.time.getTime() - path.eventTime.getTime()) / 60_000))
                .toEqual([-30, 0, 30]);
            for (const sample of path.samples) {
                expect(sample.azimuth).toBeCloseTo(cloudGalacticCenterPosition(sample.time.getTime(), location).azimuth, 8);
                for (const point of [sample.point200, sample.point400, sample.point600]) {
                    expect(Number.isFinite(point.lat + point.lon)).toBe(true);
                }
            }
            const below = path.samples.find(sample => sample.kind === (path.event === 'milkywayrise' ? 'before' : 'after'))!;
            expect(cloudGalacticCenterPosition(below.time.getTime(), location).altitude).toBeLessThan(0);
            expect(buildDirectionLineFitBounds({ location, paths: [path], showExtendedDistanceMarker: false })).not.toBeNull();
        }
    });

    it('keeps offsets across midnight instead of clipping them to the selected day', () => {
        const timestamp = Date.parse('2026-09-24T16:05:00Z');
        const [rise] = galacticDirectionPaths([{ type: 'milkywayrise', timestamp }], location, 'en');
        if (rise.status !== 'ok') {throw new Error('Expected rise samples');}
        expect(rise.samples[0].time.toISOString()).toBe('2026-09-24T15:35:00.000Z');
        expect(rise.samples[2].time.toISOString()).toBe('2026-09-24T16:35:00.000Z');
        expect(rise.eventLabel).toBe('GC rise');
    });

    it('selects only the requested triplet and removes unavailable galactic rays', () => {
        const solar = [calculateSolarPath({ date: new Date('2026-09-24T04:00:00Z'), location, event: 'sunset' })];
        const galactic = galacticDirectionPaths(galacticCenterEvents('2026-09-24', 'Asia/Shanghai', location), location, 'en');
        expect(selectDirectionPaths(solar, galactic, 'milkywayset').map(path => path.event)).toEqual(['milkywayset']);
        expect(selectDirectionPaths(solar, galactic, 'sunset')).toEqual(solar);
        expect(selectDirectionPaths(solar, galactic, 'all')).toEqual(solar);
        const polarLocation = { lat: 80, lon: 0 };
        const unavailable = galacticDirectionPaths(galacticCenterEvents('2026-09-24', 'UTC', polarLocation), polarLocation, 'en');
        const selected = selectDirectionPaths(solar, unavailable, 'milkywayset');
        expect(selected[0].status).toBe('unavailable');
        expect(buildDirectionLineFitBounds({ location: polarLocation, paths: selected, showExtendedDistanceMarker: true })).toBeNull();
    });
});

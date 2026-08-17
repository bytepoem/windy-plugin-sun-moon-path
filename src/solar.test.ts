import { describe, expect, it } from 'vitest';

import {
    calculateAstronomyTimeline,
    calculateCurrentMoonInfo,
    calculateCurrentSolarDirection,
    calculateSolarPath,
    CURRENT_DIRECTION_LENGTH_KM,
    CURRENT_DIRECTION_LENGTH_KM as CURRENT_MOON_DIRECTION_LENGTH_KM,
    coordinatesFromLocation,
    dateInputToUtcMidnight,
    dateInputToUtcNoon,
    destinationPoint,
    distanceKm,
    formatLocalClock,
    LINE_COLORS,
    localDayProgress,
    MOON_LINE_COLORS,
    normalizeAzimuth,
    splitPolylineAtDateLine,
} from './solar';

describe('solar path geometry', () => {
    it('accepts both Windy lon and Leaflet lng map click coordinates', () => {
        expect(coordinatesFromLocation({ lat: '23.05', lon: '113.37' })).toEqual({
            lat: 23.05,
            lon: 113.37,
        });
        expect(coordinatesFromLocation({ lat: 23.05, lng: 113.37 })).toEqual({
            lat: 23.05,
            lon: 113.37,
        });
        expect(coordinatesFromLocation({ lat: 0, lng: 0 })).toEqual({ lat: 0, lon: 0 });
        expect(coordinatesFromLocation({ lat: 91, lon: 0 })).toBeNull();
    });

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

    it('creates three ordered event samples and three distance points per line', () => {
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
            expect(distanceKm({ lat: 23.05, lon: 113.37 }, sample.point600)).toBeCloseTo(600, 5);
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

    it('calculates local moonrise and moonset samples', () => {
        const location = { lat: 23.05, lon: 113.37 };
        const moonrise = calculateSolarPath({
            date: dateInputToUtcMidnight('2026-08-15', 'Asia/Shanghai'),
            dateInput: '2026-08-15',
            timeZone: 'Asia/Shanghai',
            location,
            event: 'moonrise',
        });
        const moonset = calculateSolarPath({
            date: dateInputToUtcMidnight('2026-08-15', 'Asia/Shanghai'),
            dateInput: '2026-08-15',
            timeZone: 'Asia/Shanghai',
            location,
            event: 'moonset',
        });

        expect(moonrise.status).toBe('ok');
        expect(moonset.status).toBe('ok');
        if (moonrise.status !== 'ok' || moonset.status !== 'ok') {
            return;
        }

        expect(moonrise.samples.map(sample => sample.offsetMinutes)).toEqual([-30, 0, 30]);
        expect(moonset.samples.map(sample => sample.offsetMinutes)).toEqual([-30, 0, 30]);
        expect(moonrise.eventTime.getUTCHours()).toBe(0);
        expect(moonset.eventTime.getUTCHours()).toBe(12);

        for (const sample of moonrise.samples) {
            expect(distanceKm(location, sample.point200)).toBeCloseTo(200, 5);
            expect(distanceKm(location, sample.point400)).toBeCloseTo(400, 5);
            expect(distanceKm(location, sample.point600)).toBeCloseTo(600, 5);
        }
    });

    it('returns current moon position and illumination', () => {
        const origin = { lat: 23.1291, lon: 113.2644 };
        const moon = calculateCurrentMoonInfo({
            date: new Date('2026-08-15T10:30:00.000Z'),
            location: origin,
        });

        expect(moon.body).toBe('moon');
        expect(moon.azimuth).toBeGreaterThan(0);
        expect(moon.azimuth).toBeLessThan(360);
        expect(distanceKm(origin, moon.endpoint)).toBeCloseTo(CURRENT_MOON_DIRECTION_LENGTH_KM, 5);
        expect(moon.illuminationFraction).toBeGreaterThanOrEqual(0);
        expect(moon.illuminationFraction).toBeLessThanOrEqual(1);
        expect(moon.distanceKm).toBeGreaterThan(300_000);
        expect(moon.distanceKm).toBeLessThan(450_000);
    });

    it('builds the six-item astronomy timeline for a local civil day', () => {
        const timeline = calculateAstronomyTimeline({
            dateInput: '2026-08-15',
            timeZone: 'Asia/Shanghai',
            location: { lat: 23.05, lon: 113.37 },
        });

        expect(timeline.items.map(item => item.kind)).toEqual([
            'dawn',
            'sunrise',
            'moonrise',
            'sunset',
            'dusk',
            'moonset',
        ]);
        expect(timeline.items.every(item => item.time instanceof Date)).toBe(true);
        expect(timeline.dayEnd.getTime() - timeline.dayStart.getTime()).toBe(24 * 60 * 60 * 1000);
        expect(timeline.tracks.map(track => track.body)).toEqual(['sun', 'moon']);
        for (const track of timeline.tracks) {
            expect(track.points.length).toBeGreaterThan(0);
            expect(track.points.every(point => point.time >= timeline.dayStart && point.time <= timeline.dayEnd)).toBe(true);
            expect(track.points.every(point => point.azimuth >= 0 && point.azimuth < 360)).toBe(true);
        }
        expect(timeline.moonIllumination.fraction).toBeGreaterThanOrEqual(0);
        expect(timeline.moonIllumination.fraction).toBeLessThanOrEqual(1);
        expect(timeline.moonIllumination.phase).toBeGreaterThanOrEqual(0);
        expect(timeline.moonIllumination.phase).toBeLessThan(1);
        expect(timeline.intervals.some(interval => interval.kind === 'moonless-night')).toBe(true);
        expect(timeline.intervals.some(interval => interval.kind === 'milky-way')).toBe(true);

        const moonlessNights = timeline.intervals.filter(interval => interval.kind === 'moonless-night');
        for (const milkyWay of timeline.intervals.filter(interval => interval.kind === 'milky-way')) {
            expect(moonlessNights.some(moonlessNight =>
                milkyWay.start.getTime() >= moonlessNight.start.getTime() &&
                milkyWay.end.getTime() <= moonlessNight.end.getTime(),
            )).toBe(true);
        }
    });

    it('keeps the galactic center visible until it reaches the horizon', () => {
        const timeline = calculateAstronomyTimeline({
            dateInput: '2026-08-16',
            timeZone: 'Asia/Shanghai',
            location: { lat: 22.9377, lon: 113.3842 },
        });
        const milkyWay = timeline.intervals.find(interval =>
            interval.kind === 'milky-way' && formatLocalClock(interval.start, 'Asia/Shanghai') === '21:11',
        );

        expect(milkyWay).toBeDefined();
        if (!milkyWay) {
            return;
        }

        const endMinutes = Number(formatLocalClock(milkyWay.end, 'Asia/Shanghai').slice(0, 2)) * 60 +
            Number(formatLocalClock(milkyWay.end, 'Asia/Shanghai').slice(3));
        expect(endMinutes).toBeGreaterThanOrEqual(90);
        expect(endMinutes).toBeLessThan(120);
    });

    it('matches the reference astronomy window at high latitude', () => {
        const timeline = calculateAstronomyTimeline({
            dateInput: '2026-08-16',
            timeZone: 'Asia/Shanghai',
            location: { lat: 47.8406, lon: 88.149 },
        });
        const findWindow = (kind: 'moonless-night' | 'milky-way') => timeline.intervals.find(interval =>
            interval.kind === kind && formatLocalClock(interval.start, 'Asia/Shanghai') === '23:22',
        );
        const moonlessNight = findWindow('moonless-night');
        const milkyWay = findWindow('milky-way');

        expect(moonlessNight).toBeDefined();
        expect(milkyWay).toBeDefined();
        if (!moonlessNight || !milkyWay) {
            return;
        }

        expect(formatLocalClock(moonlessNight.end, 'Asia/Shanghai')).toBe('05:01');
        expect(formatLocalClock(milkyWay.end, 'Asia/Shanghai')).toBe('01:48');
    });

    it('maps local civil time to a fixed 24-hour timeline', () => {
        expect(localDayProgress(new Date('2026-08-15T04:00:00.000Z'), '2026-08-15', 'Asia/Shanghai')).toBeCloseTo(0.5, 8);
        expect(localDayProgress(new Date('2026-08-15T15:59:59.000Z'), '2026-08-15', 'Asia/Shanghai')).toBeCloseTo(0.999988, 5);
        expect(localDayProgress(new Date('2026-03-08T19:00:00.000Z'), '2026-03-08', 'America/Los_Angeles')).toBeCloseTo(0.5, 8);
    });

    it('uses different event palettes for sun and moon lines', () => {
        expect(MOON_LINE_COLORS.before).not.toBe(LINE_COLORS.before);
        expect(MOON_LINE_COLORS.event).not.toBe(LINE_COLORS.event);
        expect(MOON_LINE_COLORS.after).not.toBe(LINE_COLORS.after);
    });
});

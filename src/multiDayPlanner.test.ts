import { describe, expect, it } from 'vitest';
import { createMultiDayCalculator, isValidMultiDayRange, MULTI_DAY_EVENTS, multiDayMetricRange, multiDayPrecipitationPoints, multiDayWindowWeather, nightBucketIntervals } from './multiDayPlanner';
import { addDaysToDateInput, dateInputToUtcNoon, type AstronomyInterval } from './solar';
import { maximumSelectableDate } from './dateSelection';
import type { WeatherPoint } from './weather';

const interval = (start: string, end: string): AstronomyInterval => ({
    kind: 'moonless-night', label: '', start: new Date(start), end: new Date(end),
});
const point = (hour: number, cloud: number | null = 20): WeatherPoint => ({
    timestamp: Date.UTC(2027, 5, 12, hour), totalCloudPercent: cloud, windMs: 3,
    iconCode: null, isDay: false, highCloudPercent: null, mediumCloudPercent: null, lowCloudPercent: null,
    temperatureC: null, dewPointC: null, humidityPercent: null, precipMm: null, windDirectionDeg: null,
    aod550: null, visibilityKm: null,
});

describe('night ownership', () => {
    it.each([7, 30])('finishes the final permitted %i-day range including its adjacent timeline', count => {
        const start = maximumSelectableDate(count);
        const last = addDaysToDateInput(start, count - 1);
        expect(isValidMultiDayRange(start, count, '2025-01-01')).toBe(true);
        expect(isValidMultiDayRange(addDaysToDateInput(start, 1), count, '2025-01-01')).toBe(false);
        expect(() => createMultiDayCalculator({ lat: 23.1, lon: 113.3 }, 'Asia/Shanghai', 0)(last)).not.toThrow();
    });
    it('rejects invalid dates and complete ranges outside the daily calculator domain', () => {
        for (const date of ['', '0099-01-01', '0100-01-01', '9999-12-31', '2027-02-29', '2027-13-01']) {
            expect(isValidMultiDayRange(date, 30)).toBe(false);
        }
        expect(isValidMultiDayRange('2027-06-12', 30)).toBe(true);
        expect(isValidMultiDayRange('2028-02-29', 7)).toBe(true);
        expect(isValidMultiDayRange('0100-01-03', 30)).toBe(false);
        expect(isValidMultiDayRange('2024-12-31', 30, '2025-01-01')).toBe(false);
        expect(isValidMultiDayRange('2025-01-01', 30, '2025-01-01')).toBe(true);
    });
    it('assigns a cross-midnight window once and keeps separated segments', () => {
        const first = interval('2027-06-12T22:00Z', '2027-06-13T01:00Z');
        const second = interval('2027-06-13T03:00Z', '2027-06-13T04:00Z');
        const result = nightBucketIntervals([first, first, second], '2027-06-12', 'UTC');
        expect(result.map(value => [value.start.toISOString(), value.end.toISOString()])).toEqual([
            ['2027-06-12T22:00:00.000Z', '2027-06-13T01:00:00.000Z'],
            ['2027-06-13T03:00:00.000Z', '2027-06-13T04:00:00.000Z'],
        ]);
        expect(nightBucketIntervals([first, second], '2027-06-13', 'UTC')).toEqual([]);
        expect(first.end.toISOString()).toBe('2027-06-13T01:00:00.000Z');
    });
    it('clips a continuous polar window at noon without overlap between dates', () => {
        const long = interval('2027-06-11T00:00Z', '2027-06-15T00:00Z');
        const a = nightBucketIntervals([long], '2027-06-12', 'UTC')[0];
        const b = nightBucketIntervals([long], '2027-06-13', 'UTC')[0];
        expect(a.end).toEqual(b.start);
        expect(a.end.getTime() - a.start.getTime()).toBe(24 * 3_600_000);
    });
    it('uses local noons rather than adding 24 hours across DST', () => {
        const long = interval('2027-03-12T00:00Z', '2027-03-17T00:00Z');
        const result = nightBucketIntervals([long], '2027-03-13', 'America/New_York')[0];
        expect(result.end.getTime() - result.start.getTime()).toBe(23 * 3_600_000);
    });
    it('uses the same noon moon phase and solar events as the existing daily calculator', () => {
        const calculate = createMultiDayCalculator({ lat: 37.37, lon: 97.37 }, 'Asia/Shanghai', 0);
        const row = calculate('2027-06-12');
        const start = dateInputToUtcNoon(row.date, 'Asia/Shanghai').getTime();
        const end = dateInputToUtcNoon('2027-06-13', 'Asia/Shanghai').getTime();
        expect(row.timeline.moonIllumination.fraction).toBeGreaterThanOrEqual(0);
        expect(row.timeline.items.find(item => item.kind === 'sunset')?.time).toBeInstanceOf(Date);
        for (const target of ['moonless-night', 'milky-way'] as const) {
            expect(row.windows[target].every(value => value.start.getTime() >= start && value.end.getTime() <= end)).toBe(true);
        }
        for (const event of MULTI_DAY_EVENTS) {
            const time = row.timeline.items.find(item => item.kind === event)?.time;
            expect(time).toBeInstanceOf(Date);
            const timestamp = time!.getTime();
            expect(row.windows[event]).toEqual([{
                start: new Date(timestamp - 3_600_000), end: new Date(timestamp + 3_600_000), event,
            }]);
        }
    });
});

describe('target-only forecast evidence', () => {
    const window = interval('2027-06-12T21:00Z', '2027-06-13T00:00Z');
    it('uses start-inclusive/end-exclusive samples, retaining provider resolution', () => {
        const points = [point(20, 100), point(21, 30), point(23, 40), point(24, 99)];
        const result = multiDayWindowWeather(window, points, 'ready');
        expect(result.state).toBe('full');
        expect(result.points.map(value => value.totalCloudPercent)).toEqual([30, 40]);
        expect(multiDayMetricRange(result.points, 'totalCloudPercent')).toEqual({ min: 30, max: 40, missing: false });
    });
    it('does not extend the final forecast sample to cover the rest of the night', () => {
        const result = multiDayWindowWeather(window, [point(20), point(21), point(22)], 'ready');
        expect(result.state).toBe('partial');
        expect(result.coveredEnd).toBe(point(22).timestamp);
    });
    it('distinguishes outside, missing, loading and failed requests', () => {
        expect(multiDayWindowWeather(window, [point(1), point(2)], 'ready').state).toBe('outside');
        expect(multiDayWindowWeather(window, [], 'empty').state).toBe('missing');
        expect(multiDayWindowWeather(window, [], 'loading').state).toBe('loading');
        expect(multiDayWindowWeather(window, [], 'error').state).toBe('error');
        expect(multiDayWindowWeather(window, [point(20), point(25)], 'ready').state).toBe('missing');
    });
    it('keeps the original window empty and separately references the nearest real step at Woyimoke', () => {
        const sunset = { event: 'sunset' as const, start: new Date('2026-11-24T09:37Z'), end: new Date('2026-11-24T11:37Z') };
        const before = { ...point(15), timestamp: Date.parse('2026-11-24T09:00Z') };
        const after = { ...point(18), timestamp: Date.parse('2026-11-24T12:00Z') };
        expect(multiDayWindowWeather(sunset, [after, before], 'ready')).toMatchObject({
            state: 'missing', points: [], reference: { event: 'sunset', point: after, offsetMs: 83 * 60_000 },
        });
        const inside = { ...before, timestamp: sunset.start.getTime() };
        expect(multiDayWindowWeather(sunset, [before, inside, after], 'ready')).toMatchObject({ points: [inside], reference: null });
        expect(multiDayWindowWeather(sunset, [before, after], 'loading').reference).toBeNull();
        expect(multiDayWindowWeather(sunset, [before, after], 'error').reference).toBeNull();
        expect(multiDayWindowWeather(sunset, [after], 'ready').reference).toBeNull();
    });
    it('uses the earlier point on a 90-minute tie and leaves larger gaps empty', () => {
        const moonrise = { event: 'moonrise' as const, start: new Date('2027-06-12T12:30Z'), end: new Date('2027-06-12T14:30Z') };
        expect(multiDayWindowWeather(moonrise, [point(15), point(12)], 'ready').reference?.point).toEqual(point(12));
        expect(multiDayWindowWeather(moonrise, [point(11), point(16)], 'ready').reference).toBeNull();
        expect(multiDayWindowWeather({ start: moonrise.start, end: moonrise.end }, [point(12), point(15)], 'ready').reference).toBeNull();
    });
    it('preserves missing metrics instead of treating them as zero', () => {
        expect(multiDayMetricRange([point(21, null)], 'totalCloudPercent')).toBeNull();
        expect(multiDayMetricRange([point(21, 0), point(22, null)], 'totalCloudPercent')).toEqual({ min: 0, max: 0, missing: true });
    });
    it('retains overlapping rainfall accumulations and excludes periods merely touching the window', () => {
        const points = [20, 21, 22, 23, 24, 25].map(hour => ({ ...point(hour), precipitationPeriodMs:3_600_000, precipMm:hour }));
        expect(multiDayPrecipitationPoints(window, points).map(value => value.precipMm)).toEqual([22, 23, 24]);
        expect(multiDayPrecipitationPoints(window, points.map(({ precipitationPeriodMs: _, ...value }) => value))
            .map(value => value.precipMm)).toEqual([21, 22, 23]);
    });
});

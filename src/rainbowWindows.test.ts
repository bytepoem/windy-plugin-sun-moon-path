import { describe, expect, it } from 'vitest';
import { cloudBodyPosition } from './cloudGeometry';
import { rainbowWindows } from './rainbowWindows';
import { dateInputToUtcMidnight } from './solar';

describe('daily rainbow geometry windows', () => {
    const location = { lat: 23.1, lon: 113.3 };

    it.each(['sun', 'moon'] as const)('matches the %s map geometry and nests primary windows in secondary windows', body => {
        const result = rainbowWindows('2026-10-01', 'Asia/Shanghai', location, body);
        expect(result.primary.length).toBeGreaterThan(0);
        for (const window of result.primary) {
            expect(window.end).toBeGreaterThan(window.start);
            expect(result.secondary.some(secondary => secondary.start <= window.start && secondary.end >= window.end)).toBe(true);
            for (const time of [window.start + 30_000, (window.start + window.end) / 2, window.end - 30_000]) {
                const altitude = cloudBodyPosition(body, time, location).altitude;
                expect(altitude).toBeGreaterThanOrEqual(0);
                expect(altitude).toBeLessThan(42);
            }
        }
    });

    it('returns no sunbow in polar night and a full civil day in low polar sunlight', () => {
        expect(rainbowWindows('2026-12-21', 'UTC', { lat: 89, lon: 0 }, 'sun').primary).toEqual([]);
        const result = rainbowWindows('2026-06-21', 'UTC', { lat: 89, lon: 0 }, 'sun');
        expect(result.primary).toEqual([{
            start: Date.parse('2026-06-21T00:00:00Z'), end: Date.parse('2026-06-22T00:00:00Z'),
        }]);
    });

    it.each([
        ['2026-03-08', 23], ['2026-11-01', 25],
    ] as const)('uses the complete %s civil day across daylight-saving changes', (date, hours) => {
        const zone = 'America/New_York';
        const start = dateInputToUtcMidnight(date, zone).getTime();
        const result = rainbowWindows(date, zone, { lat: 40.7, lon: -74 }, 'moon');
        expect(result.dayEnd - start).toBe(hours * 3_600_000);
        for (const window of [...result.primary, ...result.secondary]) {
            expect(window.start).toBeGreaterThanOrEqual(start);
            expect(window.end).toBeLessThanOrEqual(result.dayEnd);
        }
    });

    it('clips windows to the selected date at the international date line', () => {
        const date = '2026-10-01';
        const zone = 'Pacific/Kiritimati';
        const result = rainbowWindows(date, zone, { lat: 1.87, lon: -157.4 }, 'sun');
        expect(result.primary.length).toBe(2);
        expect(result.primary[0].start).toBeGreaterThanOrEqual(Date.parse('2026-09-30T10:00:00Z'));
        expect(result.dayEnd).toBe(Date.parse('2026-10-01T10:00:00Z'));
    });
});

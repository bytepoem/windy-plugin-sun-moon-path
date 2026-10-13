import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cloudTimeInstant } from './cloudGeometry';
import { galacticCenterEvents } from './cloudTimeline';
import {
    dateInputForInstant,
    dateInputToUtcMidnight,
    dateInputToUtcNoon,
    formatLocalClock,
    localDayProgress,
} from './solar';

describe('civil time on Chromium with an h24 default for hour12: false', () => {
    beforeEach(() => {
        const NativeDateTimeFormat = Intl.DateTimeFormat;
        // Reproduce the reported Chromium 121 behavior while retaining native time-zone/DST data.
        // Explicit hour12 overrides hourCycle; without it, h23 must still produce hours 00..23.
        vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function (locales, options) {
            return new NativeDateTimeFormat(locales, options?.hour12 === false
                ? { ...options, hour12: undefined, hourCycle: 'h24' }
                : options);
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each([
        ['Asia/Shanghai', '2026-10-12T16:00:00.000Z', '2026-10-13T04:00:00.000Z'],
        ['America/New_York', '2026-10-13T04:00:00.000Z', '2026-10-13T16:00:00.000Z'],
        ['Asia/Kathmandu', '2026-10-12T18:15:00.000Z', '2026-10-13T06:15:00.000Z'],
        ['Pacific/Kiritimati', '2026-10-12T10:00:00.000Z', '2026-10-12T22:00:00.000Z'],
        ['UTC', '2026-10-13T00:00:00.000Z', '2026-10-13T12:00:00.000Z'],
    ])('resolves local midnight and noon in %s', (timeZone, midnight, noon) => {
        expect(dateInputToUtcMidnight('2026-10-13', timeZone).toISOString()).toBe(midnight);
        expect(dateInputToUtcNoon('2026-10-13', timeZone).toISOString()).toBe(noon);
    });

    it.each([
        ['2026-10-12T16:00:00Z', 0],
        ['2026-10-12T16:30:00Z', 1 / 48],
        ['2026-10-13T04:00:00Z', 0.5],
        ['2026-10-13T15:59:00Z', 1439 / 1440],
        ['2026-10-13T16:00:00Z', 1],
    ] as const)('keeps day progress on the correct civil date at %s', (instant, progress) => {
        expect(localDayProgress(new Date(instant), '2026-10-13', 'Asia/Shanghai')).toBeCloseTo(progress, 8);
    });

    it.each([
        ['2026-09-06', '2026-09-07', 'America/Santiago', '2026-09-06T04:00:00.000Z', 23],
        ['2026-11-01', '2026-11-02', 'America/Havana', '2026-11-01T04:00:00.000Z', 25],
    ] as const)('preserves skipped/repeated midnight boundaries in %s (%s, %s)',
        (date, nextDate, timeZone, expectedStart, hours) => {
            const start = dateInputToUtcMidnight(date, timeZone);
            const end = dateInputToUtcMidnight(nextDate, timeZone);
            expect(start.toISOString()).toBe(expectedStart);
            expect(dateInputForInstant(start, timeZone)).toBe(date);
            expect(end.getTime() - start.getTime()).toBe(hours * 3_600_000);
        });

    it('calculates the first-render galactic events within the selected Shanghai day', () => {
        const events = galacticCenterEvents('2026-10-13', 'Asia/Shanghai', { lat: 23.13, lon: 113.26 });
        expect(events.map(event => event.type).sort()).toEqual(['milkywayrise', 'milkywayset']);
        for (const event of events) {
            expect(dateInputForInstant(new Date(event.timestamp), 'Asia/Shanghai')).toBe('2026-10-13');
        }
    });

    it('keeps explicit planning clocks at 00:00 instead of moving them to another day', () => {
        const midnight = new Date('2026-10-12T16:00:00.000Z');
        expect(formatLocalClock(midnight, 'Asia/Shanghai')).toBe('00:00');
        expect(cloudTimeInstant('2026-10-13', '00:00', 'Asia/Shanghai')).toBe(midnight.getTime());
        expect(cloudTimeInstant('2026-03-08', '02:30', 'America/New_York')).toBeNull();
        expect(cloudTimeInstant('2026-11-01', '01:30', 'America/New_York'))
            .toBe(Date.parse('2026-11-01T05:30:00.000Z'));
    });
});

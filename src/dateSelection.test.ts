import { describe, expect, it } from 'vitest';
import { isSelectableDate, maximumSelectableDate, minimumSelectableDate, parseCalendarDate, resolveCivilMinute } from './dateSelection';

describe('shared date selection policy and civil conversion', () => {
    it('uses the previous browser-local year and advances at New Year', () => {
        expect(minimumSelectableDate(new Date(2026, 11, 31, 23, 59))).toBe('2025-01-01');
        expect(minimumSelectableDate(new Date(2027, 0, 1))).toBe('2026-01-01');
        expect(isSelectableDate('2024-12-31', '2025-01-01')).toBe(false);
        expect(isSelectableDate('2025-01-01', '2025-01-01')).toBe(true);
        expect(isSelectableDate('2025-12-31', '2026-01-01')).toBe(false);
    });

    it('validates leap days and reserves the complete astronomy scan at the upper bound', () => {
        expect(parseCalendarDate('2028-02-29')).toEqual([2028, 2, 29]);
        for (const date of ['', '2027-02-29', '2026-02-30', '2026-00-01', '2026-13-01', '10000-01-01']) {
            expect(parseCalendarDate(date)).toBeNull();
        }
        expect(maximumSelectableDate()).toBe('9999-12-28');
        expect(maximumSelectableDate(30)).toBe('9999-11-28');
        expect(maximumSelectableDate(7)).toBe('9999-12-21');
        expect(isSelectableDate('9999-12-29', '2025-01-01')).toBe(false);
        expect(isSelectableDate('9999-12-31', '2025-01-01', '9999-12-31')).toBe(true);
    });

    it('keeps DST gaps invalid and lets callers choose the repeated-time rule', () => {
        for (const rule of ['earlier', 'reject'] as const) {
            expect(resolveCivilMinute('2026-03-08T02:30', 'America/New_York', rule)).toBeNull();
            expect(resolveCivilMinute('2026-10-04T02:15', 'Australia/Lord_Howe', rule)).toBeNull();
        }
        expect(resolveCivilMinute('2026-11-01T01:30', 'America/New_York', 'earlier')).toBe(Date.parse('2026-11-01T05:30:00Z'));
        expect(resolveCivilMinute('2026-11-01T01:30', 'America/New_York', 'reject')).toBeNull();
        expect(resolveCivilMinute('2026-04-05T01:45', 'Australia/Lord_Howe', 'reject')).toBeNull();
        expect(resolveCivilMinute('2026-11-17T00:15', 'Asia/Kathmandu', 'reject')).toBe(Date.parse('2026-11-16T18:30:00Z'));
    });

    it('rejects invalid date/time/zone values instead of normalizing them or throwing', () => {
        for (const value of ['', '2026-02-30T12:00', '2026-11-17T24:00', '2026-11-17T12:60', '2026-11-17T12:00:01']) {
            expect(resolveCivilMinute(value, 'UTC', 'earlier')).toBeNull();
        }
        expect(resolveCivilMinute('2026-11-17T12:00', 'invalid/zone', 'earlier')).toBeNull();
    });
});

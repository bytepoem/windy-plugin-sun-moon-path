import { describe, expect, it } from 'vitest';
import { formatDisplayDate, formatDisplayDateTime } from './dateDisplay';

describe('fixed month/day display', () => {
    it('retains full years while using month/day for compact civil dates', () => {
        expect(formatDisplayDate('2026-11-12')).toBe('11/12');
        expect(formatDisplayDate('2026-02-03')).toBe('2/3');
        expect(formatDisplayDate('2026-11-12', true)).toBe('2026-11-12');
    });

    it('keeps the observing time zone when an instant crosses midnight or a year boundary', () => {
        const instant = Date.parse('2026-12-31T20:15:00Z');
        expect(formatDisplayDateTime(instant, 'Asia/Shanghai')).toBe('1/1 04:15');
        expect(formatDisplayDateTime(instant, 'Asia/Shanghai', true)).toBe('2027-01-01 04:15');
        expect(formatDisplayDateTime(instant, 'America/Los_Angeles')).toBe('12/31 12:15');
        expect(formatDisplayDateTime(new Date('2026-11-12T00:00:00Z'), 'UTC')).toBe('11/12 00:00');
    });
});

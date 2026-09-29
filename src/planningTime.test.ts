import { describe, expect, it } from 'vitest';
import { resolvePlanningTime } from './planningTime';

const input = {
    selectedDate: '2026-09-28', timeZone: 'Asia/Shanghai', now: new Date('2026-09-28T09:27:35Z'),
    ready: true, events: [{ kind: 'sunset', time: new Date('2026-09-28T10:17:43Z') }],
};

describe('shared planning time', () => {
    it('preserves the exact host instant including repeated daylight-saving clock times', () => {
        const timestamp = Date.parse('2026-11-01T06:30:27Z');
        const selection = { mode: 'windy', timestamp } as const;
        expect(resolvePlanningTime({ ...input, timeZone: 'America/New_York', selection }))
            .toEqual({ clock: '01:30', timestamp });
        expect(resolvePlanningTime({ ...input, selection }))
            .toEqual({ clock: '14:30', timestamp });
        expect(resolvePlanningTime({ ...input, selection, ready: false }).timestamp).toBeNull();
    });
    it('keeps exact event seconds, allows manual preview and jumps back to the same event', () => {
        const event = resolvePlanningTime({ ...input, selection: { mode: 'event', event: 'sunset' } });
        expect(event).toEqual({ clock: '18:17', timestamp: Date.parse('2026-09-28T10:17:43Z') });
        const manual = resolvePlanningTime({ ...input, selection: { mode: 'clock', clock: '20:30' } });
        expect(manual.timestamp).toBe(Date.parse('2026-09-28T12:30:00Z'));
        expect(resolvePlanningTime({ ...input, selection: { mode: 'event', event: 'sunset' } })).toEqual(event);
    });

    it('reinterprets a manual clock on the selected date and location time zone', () => {
        const selection = { mode: 'clock', clock: '20:30' } as const;
        expect(resolvePlanningTime({ ...input, selectedDate: '2026-09-29', selection }).timestamp)
            .toBe(Date.parse('2026-09-29T12:30:00Z'));
        expect(resolvePlanningTime({ ...input, timeZone: 'America/New_York', selection }).timestamp)
            .toBe(Date.parse('2026-09-29T00:30:00Z'));
    });

    it('never exposes a timestamp before the current location/date snapshot is ready', () => {
        for (const selection of [{ mode: 'clock', clock: '20:30' }, { mode: 'event', event: 'sunset' }, { mode: 'current' }] as const) {
            expect(resolvePlanningTime({ ...input, ready: false, selection }).timestamp).toBeNull();
        }
        expect(resolvePlanningTime({ ...input, selection: { mode: 'event', event: 'moonrise' } }))
            .toEqual({ clock: '', timestamp: null });
        expect(resolvePlanningTime({ ...input, selection: { mode: 'clock', clock: '' } }).timestamp).toBeNull();
    });

    it('rejects a skipped daylight-saving time instead of shifting the preview', () => {
        expect(resolvePlanningTime({ ...input, selectedDate: '2026-03-08', timeZone: 'America/New_York',
            selection: { mode: 'clock', clock: '02:30' } }).timestamp).toBeNull();
    });

    it('uses now on today, and the same local clock on another selected date', () => {
        expect(resolvePlanningTime({ ...input, selection: { mode: 'current' } }).timestamp).toBe(input.now.getTime());
        expect(resolvePlanningTime({ ...input, selectedDate: '2026-09-29', selection: { mode: 'current' } }))
            .toEqual({ clock: '17:27', timestamp: Date.parse('2026-09-29T09:27:00Z') });
    });
});

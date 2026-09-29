import { describe, expect, it } from 'vitest';
import { loadRainbowPreferences, restoreRainbowPreferences, saveRainbowPreferences } from './rainbowPreferences';

describe('rainbow preferences', () => {
    it('restores display controls after a new load, including deselected switches', () => {
        let stored = '';
        const storage = { getItem: () => stored, setItem: (_: string, value: string) => { stored = value; } };
        const preferences = { body: 'moon' as const, secondary: true, fullCircle: true };
        saveRainbowPreferences(storage, preferences);
        expect(loadRainbowPreferences(storage)).toEqual(preferences);
        saveRainbowPreferences(storage, { ...preferences, secondary: false, fullCircle: false });
        expect(loadRainbowPreferences(storage)).toEqual({ ...preferences, secondary: false, fullCircle: false });
    });

    it('discards previously saved clocks and validates display preferences independently', () => {
        for (const clock of ['05:30', '23:59', '24:00', '', 530]) {
            expect(restoreRainbowPreferences({ clock, body: 'moon', secondary: 'true', fullCircle: true, azimuth: 90 }))
                .toEqual({ body: 'moon', secondary: false, fullCircle: true });
        }
        expect(restoreRainbowPreferences({ clock: '23:59', body: 'unknown' }).body).toBe('sun');
        expect(restoreRainbowPreferences([])).toEqual(restoreRainbowPreferences(null));
    });

    it('handles missing, corrupt and inaccessible storage', () => {
        for (const value of [null, '{']) {
            expect(loadRainbowPreferences({ getItem: () => value, setItem: () => {} }))
                .toEqual(restoreRainbowPreferences(null));
        }
        const blocked = { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('quota'); } };
        expect(loadRainbowPreferences(blocked)).toEqual(restoreRainbowPreferences(null));
        expect(() => saveRainbowPreferences(blocked, restoreRainbowPreferences(null))).not.toThrow();
    });
});

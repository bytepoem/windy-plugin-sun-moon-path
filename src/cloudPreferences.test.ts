import { describe, expect, it } from 'vitest';
import { createCloudSettings } from './cloudProfile';
import { loadCloudPreferences, restoreCloudPreferences, saveCloudPreferences } from './cloudPreferences';

describe('cloud preferences', () => {
    it('round trips independent manual heights and switches without retaining transient fields', () => {
        let stored = '';
        const storage = { getItem: () => stored, setItem: (_: string, value: string) => { stored = value; } };
        const settings = createCloudSettings();
        settings.view = 'layers';
        settings.body = 'milkyway';
        settings.overlay = 'cbase';
        settings.threshold = 35;
        settings.syncMap = false;
        settings.single = { mode: 'manual', heightM: 1234.5 };
        settings.layers.high = { enabled: false, mode: 'manual', heightM: 9000 };
        settings.clock = '23:59';
        saveCloudPreferences(storage, settings);
        const restored = loadCloudPreferences(storage);
        expect(restored).toEqual({ ...settings, clock: '' });
        expect(JSON.parse(stored)).not.toHaveProperty('clock');
        expect(JSON.parse(stored)).not.toHaveProperty('cameraOffsetM');
    });

    it('rejects corrupt values without losing independent valid preferences', () => {
        const restored = restoreCloudPreferences({
            view: 'unknown', body: 'moon', threshold: 101, syncMap: 'false',
            single: { mode: 'manual', heightM: -1 },
            layers: { low: null, medium: { heightM: 30001 }, high: { enabled: false, heightM: 6000 } },
        });
        expect(restored.view).toBe('single');
        expect(restored.body).toBe('moon');
        expect(restored.threshold).toBe(10);
        expect(restored.syncMap).toBe(true);
        expect(restored.single.heightM).toBeUndefined();
        expect(restored.layers.medium.heightM).toBeUndefined();
        expect(restored.layers.high).toEqual({ enabled: false, mode: 'auto', heightM: 6000 });
    });

    it('keeps controls usable with invalid JSON or blocked storage', () => {
        expect(loadCloudPreferences({ getItem: () => '{', setItem: () => {} })).toEqual(createCloudSettings());
        const blocked = { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('blocked'); } };
        expect(loadCloudPreferences(blocked)).toEqual(createCloudSettings());
        expect(() => saveCloudPreferences(blocked, createCloudSettings())).not.toThrow();
    });
});

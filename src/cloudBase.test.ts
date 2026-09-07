import { describe, expect, it } from 'vitest';
import { resolveSingleLayer, selectCloudBase } from './cloudBase';
import { createCloudSettings } from './cloudProfile';
import type { WeatherForecastPayload } from './weather';

const hour = 3_600_000;
const payload = (): WeatherForecastPayload => ({
    header: { elevation: 3656, modelElevation: 4163 },
    data: { ts: [hour], icon: [], isDay: [], temperature: [], precipAmount: [], wind: [], windDir: [] },
    meteogram: { ts: [0, 3 * hour, 6 * hour], dewPoint: [], cloudBase: [1946, null, 0] },
});

describe('single forecast cloud base', () => {
    it('converts AGL using model terrain and aligns to meteogram timestamps', () => {
        expect(selectCloudBase(payload(), hour)).toMatchObject({ timestamp: 0, heightAglM: 1946, layer: { heightM: 6109 } });
    });
    it('keeps missing steps missing instead of looking for a nearby valid height', () => {
        expect(selectCloudBase(payload(), 3 * hour)).toMatchObject({ heightAglM: null, layer: null });
        const p = payload();
        delete p.meteogram!.cloudBase;
        expect(selectCloudBase(p, 0)?.layer).toBeNull();
    });
    it('preserves zero AGL but only draws valid positive AMSL geometry', () => {
        expect(selectCloudBase(payload(), 6 * hour)).toMatchObject({ heightAglM: 0, layer: { heightM: 4163 } });
        const p = payload();
        p.header!.modelElevation = 0;
        expect(selectCloudBase(p, 6 * hour)).toMatchObject({ heightAglM: 0, layer: null });
    });
    it('requires model elevation and never substitutes the location elevation', () => {
        const p = payload();
        delete p.header!.modelElevation;
        expect(selectCloudBase(p, 0)).toMatchObject({ heightAglM: 1946, layer: null });
    });
    it('rejects sentinels, invalid heights and unsafe sums', () => {
        for (const value of [-1, NaN, Infinity, 100000, 29000]) {
            const p = payload();
            p.meteogram!.cloudBase[0] = value;
            expect(selectCloudBase(p, 0)?.layer).toBeNull();
        }
    });
    it('does not extrapolate, bridge long gaps or mutate timestamp order', () => {
        expect(selectCloudBase(payload(), -1)).toBeNull();
        expect(selectCloudBase(payload(), 7 * hour)).toBeNull();
        expect(selectCloudBase(payload(), NaN)).toBeNull();
        const p = payload();
        p.meteogram!.ts = [12 * hour, 0];
        p.meteogram!.cloudBase = [200, 100];
        expect(selectCloudBase(p, 6 * hour)).toBeNull();
        expect(selectCloudBase(p, 0)?.heightAglM).toBe(100);
        expect(p.meteogram!.ts).toEqual([12 * hour, 0]);
    });
    it('defaults to one reference, preserving independent manual heights', () => {
        const settings = createCloudSettings();
        expect(settings.view).toBe('single');
        expect(resolveSingleLayer(settings.single, null)).toEqual([]);
        settings.single = { mode: 'manual', heightM: 6000 };
        settings.layers.low.heightM = 1000;
        expect(resolveSingleLayer(settings.single, null)).toMatchObject([{ heightM: 6000 }]);
        settings.single.heightM = undefined;
        expect(resolveSingleLayer(settings.single, selectCloudBase(payload(), 0))).toEqual([]);
        expect(settings.layers.low.heightM).toBe(1000);
    });
});

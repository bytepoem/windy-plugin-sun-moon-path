import { describe, expect, it } from 'vitest';
import { resolveCloudLayers, resolveSingleLayer, selectCloudBase } from './cloudBase';
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


describe('cloud height source selection', () => {
    it('assigns a forecast base to exactly one band using AGL, including boundary heights', () => {
        for (const [agl, band] of [[0, 'low'], [1999, 'low'], [2000, 'medium'], [5999, 'medium'], [6000, 'high']] as const) {
            const p = payload();
            p.meteogram!.cloudBase[0] = agl;
            const settings = createCloudSettings();
            settings.view = 'layers';
            settings.layeredSource = 'base';
            const base = selectCloudBase(p, 0);
            expect(resolveCloudLayers(settings, base, null)).toMatchObject([{ band, heightM: 4163 + agl }]);
            settings.layers[band].enabled = false;
            expect(resolveCloudLayers(settings, base, null)).toEqual([]);
        }
    });

    it('uses the lowest profile layer in single view and all layers in layered view', () => {
        const settings = createCloudSettings();
        const profile = { timestamp: 0, coverage: { low: 'missing', medium: 'sampled', high: 'sampled' } as const,
            layers: [9000, 3500].map(heightM => ({ heightM, topM: heightM, band: 'high' as const, cloudPercent: 50, baseMinimumM: null })) };
        for (const source of ['cloud', 'dewpoint'] as const) {
            settings.view = 'single';
            settings.singleSource = source;
            expect(resolveCloudLayers(settings, selectCloudBase(payload(), 0), profile)).toMatchObject([{ heightM: 3500 }]);
            expect(resolveCloudLayers(settings, selectCloudBase(payload(), 0), null)).toEqual([]);
            settings.view = 'layers';
            settings.layeredSource = source;
            expect(resolveCloudLayers(settings, null, profile)).toHaveLength(2);
        }
        settings.layeredSource = 'base';
        expect(resolveCloudLayers(settings, null, profile)).toEqual([]);
    });

    it('preserves manual heights and disabled bands independently of failed forecasts', () => {
        const settings = createCloudSettings();
        settings.single.mode = 'manual';
        settings.single.heightM = 2300;
        settings.singleSource = 'dewpoint';
        expect(resolveCloudLayers(settings, null, null)).toMatchObject([{ heightM: 2300 }]);
        settings.view = 'layers';
        settings.layers.medium = { mode: 'manual', heightM: 4500, enabled: true };
        expect(resolveCloudLayers(settings, null, null)).toMatchObject([{ heightM: 4500, band: 'medium' }]);
        settings.layers.medium.enabled = false;
        expect(resolveCloudLayers(settings, null, null)).toEqual([]);
        expect(settings.single.heightM).toBe(2300);
    });
});

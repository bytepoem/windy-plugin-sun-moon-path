import { describe, expect, it } from 'vitest';
import { extractCloudForecast, selectCloudProfile } from './cloudProfile';
import type { WeatherForecastPayload } from './weather';

const hour = 3_600_000;
const fixture = (): WeatherForecastPayload => ({
    header: { elevation: 100, modelElevation: 100 },
    data: { ts: [0, 3 * hour], icon: [], isDay: [], temperature: [], precipAmount: [], wind: [], windDir: [] },
    sounding: {
        ts: [0, 3 * hour],
        'gh-1000h': [50, 50], 'cloud-1000h': [100, 100],
        'gh-975h': [200, 200], 'cloud-975h': [0, 0],
        'gh-950h': [500, 500], 'cloud-950h': [40, 0],
        'gh-925h': [750, 750], 'cloud-925h': [60, 0],
        'gh-900h': [1_000, 1_000], 'cloud-900h': [0, 0],
        'gh-850h': [1_500, 1_500], 'cloud-850h': [30, 0],
        'gh-700h': [3_000, 3_000], 'cloud-700h': [0, 80],
        'gh-600h': [4_500, 4_500], 'cloud-600h': [20, 90],
        'gh-500h': [5_800, 5_800], 'cloud-500h': [0, 0],
        'gh-300h': [9_000, 9_000], 'cloud-300h': [70, 10],
        cloudBase: [13_000, null],
    },
});

describe('cloud profile extraction', () => {
    it('uses model-grid terrain rather than the higher observing-point elevation', () => {
        const payload = fixture();
        payload.header = { elevation: 1600, modelElevation: 100 };
        const profile = extractCloudForecast(payload, 10).profiles[0];
        expect(profile.layers[0]).toMatchObject({ heightM: 500, band: 'low' });
        expect(profile.layers.find(layer => layer.heightM === 1500)?.band).toBe('low');
    });

    it('classifies heights relative to model terrain and excludes its underground levels', () => {
        const payload = fixture();
        payload.header = { elevation: 100, modelElevation: 2700 };
        const forecast = extractCloudForecast(payload, 10);
        expect(forecast.profiles[0].layers[0]).toMatchObject({ heightM: 4500, band: 'low' });
        expect(forecast.profiles[0].layers.every(layer => layer.heightM > 2700)).toBe(true);
        delete payload.header.modelElevation;
        expect(extractCloudForecast(payload, 10).profiles).toEqual([]);
    });

    it('uses actual per-level heights, excludes underground levels, and keeps disconnected layers', () => {
        const forecast = extractCloudForecast(fixture(), 10);
        const profile = forecast.profiles[0];
        expect(profile.layers.map(layer => layer.heightM)).toEqual([500, 1_500, 4_500, 9_000]);
        expect(profile.layers[0]).toMatchObject({ band: 'low', baseMinimumM: 200, topM: 750, cloudPercent: 60 });
        expect(profile.layers[2]).toMatchObject({ band: 'medium', baseMinimumM: 3_000 });
        expect(profile.coverage).toEqual({ low: 'sampled', medium: 'sampled', high: 'sampled' });
        expect(profile.layers.some(layer => layer.heightM === 13_000)).toBe(false);
    });

    it('does not bridge a missing cloud observation or invent a base interval', () => {
        const payload = fixture();
        payload.sounding!['cloud-925h'] = [null, null];
        payload.sounding!['cloud-900h'] = [60, 60];
        const layers = extractCloudForecast(payload, 10).profiles[0].layers;
        expect(layers[0].topM).toBe(500);
        expect(layers[1]).toMatchObject({ heightM: 1_000, baseMinimumM: null });
    });

    it('distinguishes no samples from no detected layer and tolerates missing payloads', () => {
        const payload = fixture();
        payload.sounding!['cloud-300h'] = [null, null];
        const profile = extractCloudForecast(payload, 100).profiles[0];
        expect(profile.coverage.low).toBe('sampled');
        expect(profile.coverage.high).toBe('missing');
        expect(profile.layers).toEqual([]);
        expect(extractCloudForecast(null, 10).profiles).toEqual([]);
        delete payload.header;
        expect(extractCloudForecast(payload, 10).profiles).toEqual([]);
    });

    it('does not bridge a pressure level whose height is unknown', () => {
        const payload = fixture();
        payload.sounding!['gh-925h'] = [null, null];
        payload.sounding!['cloud-900h'] = [60, 60];
        const layers = extractCloudForecast(payload, 10).profiles[0].layers;
        expect(layers[0].topM).toBe(500);
        expect(layers[1]).toMatchObject({ heightM: 1_000, baseMinimumM: null });
    });

    it('keeps a continuous cloud crossing a band boundary as one layer', () => {
        const payload = fixture();
        payload.sounding!['cloud-700h'] = [70, 80];
        const layers = extractCloudForecast(payload, 10).profiles[0].layers;
        expect(layers.find(layer => layer.heightM === 1_500)?.topM).toBe(4_500);
        expect(layers.filter(layer => layer.band === 'medium')).toEqual([]);
    });

    it('rejects invalid detection thresholds', () => {
        for (const threshold of [NaN, 0, -10, 101]) {expect(extractCloudForecast(fixture(), threshold).profiles).toEqual([]);}
    });
});

describe('cloud profile time selection', () => {
    it('matches actual timestamps rather than interpolating cloud formation', () => {
        const forecast = extractCloudForecast(fixture(), 10);
        expect(selectCloudProfile(forecast, hour)?.timestamp).toBe(0);
        expect(selectCloudProfile(forecast, 2 * hour)?.timestamp).toBe(3 * hour);
        expect(selectCloudProfile(forecast, -1)).toBeNull();
        expect(selectCloudProfile(forecast, 4 * hour)).toBeNull();
    });
    it('rejects large missing time gaps', () => {
        const forecast = extractCloudForecast(fixture(), 10);
        forecast.profiles[1].timestamp = 12 * hour;
        expect(selectCloudProfile(forecast, 6 * hour)).toBeNull();
    });
});

describe('temperature/dew-point cloud estimates', () => {
    const sounding = () => {
        const payload = fixture();
        for (const key of Object.keys(payload.sounding!).filter(key => key.startsWith('gh-'))) {
            const level = key.slice(3);
            payload.sounding![`temp-${level}`] = [270, 270];
            payload.sounding![`dewPoint-${level}`] = [260, 260];
        }
        for (const level of ['950h', '925h', '850h', '300h']) {
            payload.sounding![`dewPoint-${level}`] = [269, 269];
        }
        return payload;
    };

    it('finds separate moist layers from paired Kelvin values without using cloud cover', () => {
        const payload = sounding();
        const layers = extractCloudForecast(payload, 2, 'dewpoint').profiles[0].layers;
        expect(layers.map(layer => layer.heightM)).toEqual([500, 1500, 9000]);
        expect(layers[0]).toMatchObject({ baseMinimumM: 200, topM: 750, dewPointSpreadC: 1 });
        expect(layers[2].band).toBe('high');
        expect(extractCloudForecast(payload, 0, 'dewpoint').profiles[0].layers).toEqual([]);
    });

    it('breaks continuity at missing temperature, dew point or height without fabricating a lower bound', () => {
        for (const key of ['temp-925h', 'dewPoint-925h', 'gh-925h']) {
            const payload = sounding();
            payload.sounding![key] = [null, null];
            payload.sounding!['dewPoint-900h'] = [269, 269];
            const layers = extractCloudForecast(payload, 2, 'dewpoint').profiles[0].layers;
            expect(layers[0].topM).toBe(500);
            expect(layers[1]).toMatchObject({ heightM: 1000, baseMinimumM: null });
        }
    });

    it('keeps absent height fields as gaps and includes an exact decimal threshold', () => {
        const payload = sounding();
        delete payload.sounding!['gh-925h'];
        payload.sounding!['dewPoint-900h'] = [269.9, 269.9];
        const layers = extractCloudForecast(payload, 1, 'dewpoint').profiles[0].layers;
        expect(layers[0].topM).toBe(500);
        expect(layers[1]).toMatchObject({ heightM: 1000, baseMinimumM: null });
        expect(extractCloudForecast(payload, 0.1, 'dewpoint').profiles[0].layers[0].heightM).toBe(1000);
    });

    it('never substitutes cloud cover for unavailable thermodynamic fields', () => {
        const profile = extractCloudForecast(fixture(), 2, 'dewpoint').profiles[0];
        expect(profile.layers).toEqual([]);
        expect(profile.coverage).toEqual({ low: 'missing', medium: 'missing', high: 'missing' });
        for (const value of [NaN, -1, 10.1, Infinity]) {
            expect(extractCloudForecast(sounding(), value, 'dewpoint').profiles).toEqual([]);
        }
    });
});

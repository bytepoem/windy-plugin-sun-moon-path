import { bandFor, CLOUD_BANDS, type CloudLayer, type CloudProfile, type CloudSettings } from './cloudProfile';
import type { WeatherForecastPayload } from './weather';

export type CloudBaseSample = {
    timestamp: number;
    heightAglM: number | null;
    layer: CloudLayer | null;
};
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export const validReferenceHeight = (height: unknown): height is number => finite(height) && height > 0 && height <= 30_000;

/** Read the dedicated AGL field at its own forecast step; never replace missing data with a profile estimate.
 * Geometry uses AMSL, so conversion requires this model's terrain, not the observation-point elevation.
 * Keep zero AGL as valid meteorological data even when the resulting shell cannot be drawn.
 */
export const selectCloudBase = (payload: WeatherForecastPayload | null, timestamp: number): CloudBaseSample | null => {
    const series = payload?.meteogram;
    const times = series?.ts.filter(finite).sort((a, b) => a - b);
    if (!series || !times?.length || !finite(timestamp) || timestamp < times[0] || timestamp > times[times.length - 1]) {return null;}
    const selected = times.reduce((best, time) => Math.abs(time - timestamp) < Math.abs(best - timestamp) ? time : best);
    if (Math.abs(selected - timestamp) > 90 * 60_000) {return null;}
    const value = series.cloudBase?.[series.ts.indexOf(selected)];
    const heightAglM = finite(value) && value >= 0 && value <= 30_000 ? value : null;
    const terrain = payload?.header?.modelElevation;
    const heightM = heightAglM !== null && finite(terrain) ? terrain + heightAglM : null;
    const layer: CloudLayer | null = validReferenceHeight(heightM) ? {
        heightM, topM: heightM, baseMinimumM: null, cloudPercent: 0,
        // Classification uses AGL, while geometry retains AMSL. One base fills exactly one band.
        band: bandFor(heightAglM as number),
    } : null;
    return { timestamp: selected, heightAglM, layer };
};

/** Single manual input belongs to its own mode and survives forecast failure and mode changes. */
export const resolveSingleLayer = (settings: CloudSettings['single'], sample: CloudBaseSample | null): CloudLayer[] => {
    if (settings.mode === 'auto') {return sample?.layer ? [sample.layer] : [];}
    const heightM = settings.heightM;
    return validReferenceHeight(heightM)
        ? [{ heightM, topM: heightM, baseMinimumM: null, cloudPercent: 0, band: 'low' }] : [];
};

/** Resolve one selected source without fallbacks. Disabled bands never promote a higher single layer. */
export const resolveCloudLayers = (
    settings: CloudSettings, base: CloudBaseSample | null, profile: CloudProfile | null,
): CloudLayer[] => {
    const single = settings.view === 'single';
    const source = single ? settings.singleSource : settings.layeredSource;
    const automatic = source === 'base' ? (base?.layer ? [base.layer] : []) : profile?.layers ?? [];
    if (single) {
        if (settings.single.mode === 'manual') { return resolveSingleLayer(settings.single, null); }
        const lowest = automatic.reduce<CloudLayer | null>((best, layer) =>
            !best || layer.heightM < best.heightM ? layer : best, null);
        // Single-reference table and map deliberately share one color, regardless of category.
        return lowest ? [{ ...lowest, band: 'low' }] : [];
    }
    return CLOUD_BANDS.flatMap(band => {
        const row = settings.layers[band];
        if (!row.enabled) { return []; }
        if (row.mode === 'auto') { return automatic.filter(layer => layer.band === band); }
        return validReferenceHeight(row.heightM)
            ? [{ band, heightM: row.heightM, topM: row.heightM, baseMinimumM: null, cloudPercent: 0 }] : [];
    });
};

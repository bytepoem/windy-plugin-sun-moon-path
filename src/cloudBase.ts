import type { CloudLayer, CloudSettings } from './cloudProfile';
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
        // Single-reference rendering uses one consistent color; this is not a low-cloud classification.
        band: 'low',
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

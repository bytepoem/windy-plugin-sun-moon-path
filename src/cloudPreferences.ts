import { CLOUD_BANDS, createCloudSettings, type CloudSettings } from './cloudProfile';

const STORAGE_KEY = 'sun-moon-path:cloud-preferences:v1';
type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>;
const record = (value: unknown): Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const height = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 30_000 ? value : undefined;

/** Restore only user preferences; timestamps, forecast results and unused geometry fields stay at defaults. */
export const restoreCloudPreferences = (value: unknown): CloudSettings => {
    const source = record(value);
    const result = createCloudSettings();
    if (source.view === 'single' || source.view === 'layers') { result.view = source.view; }
    if (source.body === 'auto' || source.body === 'sun' || source.body === 'moon' || source.body === 'milkyway') {
        result.body = source.body;
    }
    if (source.overlay === 'clouds' || source.overlay === 'lclouds' || source.overlay === 'mclouds'
        || source.overlay === 'hclouds' || source.overlay === 'cbase') { result.overlay = source.overlay; }
    if (typeof source.threshold === 'number' && Number.isFinite(source.threshold)
        && source.threshold >= 1 && source.threshold <= 100) { result.threshold = source.threshold; }
    if (typeof source.syncMap === 'boolean') { result.syncMap = source.syncMap; }
    const single = record(source.single);
    if (single.mode === 'auto' || single.mode === 'manual') { result.single.mode = single.mode; }
    result.single.heightM = height(single.heightM);
    const layers = record(source.layers);
    for (const band of CLOUD_BANDS) {
        const layer = record(layers[band]);
        if (layer.mode === 'auto' || layer.mode === 'manual') { result.layers[band].mode = layer.mode; }
        if (typeof layer.enabled === 'boolean') { result.layers[band].enabled = layer.enabled; }
        result.layers[band].heightM = height(layer.heightM);
    }
    return result;
};

export const loadCloudPreferences = (storage: StorageAccess): CloudSettings => {
    try {
        return restoreCloudPreferences(JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null'));
    } catch {
        return createCloudSettings();
    }
};

/** Persist canonical metres, never the current display unit or automatically detected cloud heights. */
export const saveCloudPreferences = (storage: StorageAccess, settings: CloudSettings): void => {
    const { view, body, overlay, threshold, syncMap, single, layers } = restoreCloudPreferences(settings);
    try {
        storage.setItem(STORAGE_KEY, JSON.stringify({ view, body, overlay, threshold, syncMap, single, layers }));
    } catch {
        // Browser storage can be unavailable; in-memory controls remain usable.
    }
};

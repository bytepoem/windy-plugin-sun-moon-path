const STORAGE_KEY = 'sun-moon-path:rainbow-preferences:v1';
type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>;

interface RainbowPreferences {
    body: 'sun' | 'moon';
    clock: string;
    secondary: boolean;
    fullCircle: boolean;
}

/** Restore independent user controls, never saved coordinates or calculated sky directions. */
export const restoreRainbowPreferences = (value: unknown): RainbowPreferences => {
    const source = value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown> : {};
    return {
        body: source.body === 'moon' ? 'moon' : 'sun',
        clock: typeof source.clock === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(source.clock) ? source.clock : '16:00',
        secondary: source.secondary === true,
        fullCircle: source.fullCircle === true,
    };
};

export const loadRainbowPreferences = (storage: StorageAccess): RainbowPreferences => {
    try {
        return restoreRainbowPreferences(JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null'));
    } catch {
        return restoreRainbowPreferences(null);
    }
};

export const saveRainbowPreferences = (storage: StorageAccess, preferences: RainbowPreferences): void => {
    try {
        storage.setItem(STORAGE_KEY, JSON.stringify(restoreRainbowPreferences(preferences)));
    } catch {
        // Denied storage or quota exhaustion must not disable the planning controls.
    }
};

const STORAGE_KEY = 'sun-moon-path:rainbow-preferences:v1';
type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>;

interface RainbowPreferences {
    body: 'sun' | 'moon';
    secondary: boolean;
    fullCircle: boolean;
}

/** Restore independent user controls, never saved coordinates or calculated sky directions. */
export const restoreRainbowPreferences = (value: unknown): RainbowPreferences => {
    const source = value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown> : {};
    return {
        body: source.body === 'moon' ? 'moon' : 'sun',
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

import { DEFAULT_INITIAL_OVERLAY, normalizeInitialOverlayPreference, type InitialOverlayPreference, type WindyOverlay } from './initialOverlay';
import { DEFAULT_RADAR_OPACITY_PERCENT, normalizeRadarOpacityPercent, normalizeRadarProvider, type RadarProvider } from './radarOverlay';
import { LOCATION_PROVIDERS, type LocationProvider, type LocationProviderApiKeys } from './locationProvider';
import type { UiLanguage } from './pluginTranslations';

export type MobileNonFullscreenPanelMode = 'collapsed' | 'compact';
export const DEFAULT_DIRECTION_LINE_OPACITY_PERCENT = 100;

// Keep established storage keys and parsing semantics so upgrades and rollback need no migration.
const SHOW_600_STORAGE_KEY = 'windy-plugin-sun-moon-path:show-600km';
const UI_LANGUAGE_STORAGE_KEY = 'windy-plugin-sun-moon-path:ui-language';
const MOBILE_PANEL_MODE_STORAGE_KEY = 'windy-plugin-sun-moon-path:mobile-panel-mode';
const HIDE_LOCATION_SEARCH_STORAGE_KEY = 'windy-plugin-sun-moon-path:hide-location-search';
const DIRECTION_LINE_OPACITY_STORAGE_KEY = 'windy-plugin-sun-moon-path:direction-line-opacity';
const INITIAL_OVERLAY_STORAGE_KEY = 'windy-plugin-sun-moon-path:initial-overlay';
const RADAR_PROVIDER_STORAGE_KEY = 'windy-plugin-sun-moon-path:radar-provider';
const RADAR_OPACITY_STORAGE_KEY = 'windy-plugin-sun-moon-path:radar-opacity';
const REMOVED_RADAR_CREDENTIAL_STORAGE_KEYS = [
    'windy-plugin-sun-moon-path:xweather-client-id',
    'windy-plugin-sun-moon-path:xweather-client-secret',
] as const;
const LOCATION_PROVIDER_STORAGE_KEY = 'windy-plugin-sun-moon-path:location-provider';
const LOCATION_PROVIDER_API_KEY_STORAGE_KEYS: Record<LocationProvider, string> = {
    amap: 'windy-plugin-sun-moon-path:amap-api-key',
    baidu: 'windy-plugin-sun-moon-path:baidu-api-key',
    tencent: 'windy-plugin-sun-moon-path:tencent-api-key',
};

export const loadLanguagePreference = (): UiLanguage => {
    try {
        return localStorage.getItem(UI_LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : 'zh';
    } catch {
        return 'zh';
    }
};

export const saveLanguagePreference = (value: UiLanguage) => {
    try {
        localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, value);
    } catch {
        // Storage can be unavailable in hardened browser modes; the language still works for this session.
    }
};

export const loadMobilePanelModePreference = (): MobileNonFullscreenPanelMode => {
    try {
        return localStorage.getItem(MOBILE_PANEL_MODE_STORAGE_KEY) === 'collapsed'
            ? 'collapsed'
            : 'compact';
    } catch {
        return 'compact';
    }
};

export const saveMobilePanelModePreference = (value: MobileNonFullscreenPanelMode) => {
    try {
        localStorage.setItem(MOBILE_PANEL_MODE_STORAGE_KEY, value);
    } catch {
        // Storage can be unavailable in hardened browser modes; the panel mode still works for this session.
    }
};

export const loadHideLocationSearchPreference = (): boolean => {
    try {
        return localStorage.getItem(HIDE_LOCATION_SEARCH_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
};

export const saveHideLocationSearchPreference = (value: boolean) => {
    try {
        localStorage.setItem(HIDE_LOCATION_SEARCH_STORAGE_KEY, String(value));
    } catch {
        // Storage can be unavailable in hardened browser modes; the setting still works for this session.
    }
};

export const loadInitialOverlayPreference = (availableInitialOverlays: readonly WindyOverlay[]): InitialOverlayPreference => {
    try {
        return normalizeInitialOverlayPreference(
            localStorage.getItem(INITIAL_OVERLAY_STORAGE_KEY),
            availableInitialOverlays,
        );
    } catch {
        return DEFAULT_INITIAL_OVERLAY;
    }
};

export const saveInitialOverlayPreference = (value: InitialOverlayPreference) => {
    try {
        localStorage.setItem(INITIAL_OVERLAY_STORAGE_KEY, value);
    } catch {
        // Storage can be unavailable in hardened browser modes; the setting still works for this session.
    }
};

export const loadRadarProvider = (): RadarProvider => {
    try {
        return normalizeRadarProvider(localStorage.getItem(RADAR_PROVIDER_STORAGE_KEY));
    } catch {
        return 'none';
    }
};

export const loadRadarOpacityPreference = (): number => {
    try {
        const storedValue = localStorage.getItem(RADAR_OPACITY_STORAGE_KEY);
        return storedValue === null
            ? DEFAULT_RADAR_OPACITY_PERCENT
            : normalizeRadarOpacityPercent(Number(storedValue));
    } catch {
        return DEFAULT_RADAR_OPACITY_PERCENT;
    }
};

/** Remove credentials persisted by the retired radar provider. */
export const clearRemovedRadarCredentials = () => {
    try {
        REMOVED_RADAR_CREDENTIAL_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
    } catch {
        // Feature removal remains effective when browser storage is unavailable.
    }
};

export const loadExtendedDistancePreference = (): boolean => {
    try {
        return localStorage.getItem(SHOW_600_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
};

export const saveExtendedDistancePreference = (value: boolean) => {
    try {
        localStorage.setItem(SHOW_600_STORAGE_KEY, String(value));
    } catch {
        // Storage can be unavailable in hardened browser modes; the setting still works for this session.
    }
};

export const normalizeDirectionLineOpacityPercent = (value: number): number =>
    Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : DEFAULT_DIRECTION_LINE_OPACITY_PERCENT;


export const loadDirectionLineOpacityPreference = (): number => {
    try {
        const storedValue = localStorage.getItem(DIRECTION_LINE_OPACITY_STORAGE_KEY);
        return storedValue === null
            ? DEFAULT_DIRECTION_LINE_OPACITY_PERCENT
            : normalizeDirectionLineOpacityPercent(Number(storedValue));
    } catch {
        return DEFAULT_DIRECTION_LINE_OPACITY_PERCENT;
    }
};

export const saveDirectionLineOpacityPreference = (value: number) => {
    try {
        localStorage.setItem(DIRECTION_LINE_OPACITY_STORAGE_KEY, String(value));
    } catch {
        // Storage can be unavailable in hardened browser modes; the setting still works for this session.
    }
};

export const loadLocationSearchProvider = (): LocationProvider => {
    try {
        const value = localStorage.getItem(LOCATION_PROVIDER_STORAGE_KEY);
        return LOCATION_PROVIDERS.includes(value as LocationProvider) ? value as LocationProvider : 'amap';
    } catch {
        return 'amap';
    }
};

export const loadLocationApiKeys = (): LocationProviderApiKeys => {
    try {
        return Object.fromEntries(LOCATION_PROVIDERS.map(providerOption => [
            providerOption,
            localStorage.getItem(LOCATION_PROVIDER_API_KEY_STORAGE_KEYS[providerOption])?.trim() || '',
        ])) as LocationProviderApiKeys;
    } catch {
        return { amap: '', baidu: '', tencent: '' };
    }
};

/** Return persistence success for the key-save indicator; callers still update in-memory state. */
const write = (key: string, value: string): boolean => {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
};

export const saveRadarOpacityPreference = (value: number): void => {
    write(RADAR_OPACITY_STORAGE_KEY, String(value));
};
export const saveRadarProvider = (value: RadarProvider): void => {
    write(RADAR_PROVIDER_STORAGE_KEY, value);
};
export const saveLocationSearchProvider = (value: LocationProvider): void => {
    write(LOCATION_PROVIDER_STORAGE_KEY, value);
};
export const writeLocationApiKey = (provider: LocationProvider, value: string): boolean =>
    write(LOCATION_PROVIDER_API_KEY_STORAGE_KEYS[provider], value);

export const removeLocationApiKey = (provider: LocationProvider): void => {
    try {
        localStorage.removeItem(LOCATION_PROVIDER_API_KEY_STORAGE_KEYS[provider]);
    } catch {
        // Clearing the session key remains effective even when persistence is unavailable.
    }
};

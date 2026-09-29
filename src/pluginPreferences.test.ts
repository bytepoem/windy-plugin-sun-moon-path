import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    clearRemovedRadarCredentials,
    loadDirectionLineOpacityPreference,
    loadExtendedDistancePreference,
    loadHideLocationSearchPreference,
    loadInitialOverlayPreference,
    loadLanguagePreference,
    loadPlanningViewPreference,
    savePlanningViewPreference,
    loadLocationApiKeys,
    loadLocationSearchProvider,
    loadMobilePanelModePreference,
    loadRadarOpacityPreference,
    loadRadarProvider,
    removeLocationApiKey,
    saveDirectionLineOpacityPreference,
    saveExtendedDistancePreference,
    saveHideLocationSearchPreference,
    saveInitialOverlayPreference,
    saveLanguagePreference,
    saveLocationSearchProvider,
    saveMobilePanelModePreference,
    saveRadarOpacityPreference,
    saveRadarProvider,
    writeLocationApiKey,
} from './pluginPreferences';

const prefix = 'windy-plugin-sun-moon-path:';
const storage = (initial: Record<string, string> = {}) => {
    const entries = new Map(Object.entries(initial).map(([key, value]) => [prefix + key, value]));
    vi.stubGlobal('localStorage', {
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => entries.set(key, value),
        removeItem: (key: string) => entries.delete(key),
    });
    return entries;
};
afterEach(() => vi.unstubAllGlobals());

describe('existing plugin preferences', () => {
    it('distinguishes a first visit from either confirmed language without saving on read', () => {
        const entries = storage();
        expect(loadLanguagePreference()).toBeNull();
        expect(entries.has(prefix + 'ui-language')).toBe(false);
        for (const language of ['zh', 'en'] as const) {
            saveLanguagePreference(language);
            expect(loadLanguagePreference()).toBe(language);
        }
        storage({ 'ui-language': '' });
        expect(loadLanguagePreference()).toBeNull();
    });

    it('remembers either planning dropdown choice and handles unavailable or invalid storage', () => {
        storage();
        expect(loadPlanningViewPreference()).toBe('obstruction');
        savePlanningViewPreference('rainbow');
        expect(loadPlanningViewPreference()).toBe('rainbow');
        savePlanningViewPreference('obstruction');
        expect(loadPlanningViewPreference()).toBe('obstruction');
        storage({ 'planning-view': 'invalid' });
        expect(loadPlanningViewPreference()).toBe('obstruction');
        vi.stubGlobal('localStorage', {
            getItem: () => { throw Error('blocked'); },
            setItem: () => { throw Error('blocked'); },
        });
        expect(loadPlanningViewPreference()).toBe('obstruction');
        expect(() => savePlanningViewPreference('rainbow')).not.toThrow();
    });
    it('preserves defaults for a new installation', () => {
        storage();
        expect(loadLanguagePreference()).toBeNull();
        expect(loadMobilePanelModePreference()).toBe('compact');
        expect(loadHideLocationSearchPreference()).toBe(false);
        expect(loadExtendedDistancePreference()).toBe(false);
        expect(loadDirectionLineOpacityPreference()).toBe(100);
        expect(loadRadarOpacityPreference()).toBe(90);
        expect(loadRadarProvider()).toBe('none');
        expect(loadInitialOverlayPreference(['satellite', 'clouds'])).toBe('satellite');
        expect(loadLocationSearchProvider()).toBe('amap');
        expect(loadLocationApiKeys()).toEqual({ amap: '', baidu: '', tencent: '' });
    });

    it('writes the established keys so old and new plugin versions share preferences', () => {
        const entries = storage();
        saveLanguagePreference('en');
        saveMobilePanelModePreference('collapsed');
        saveHideLocationSearchPreference(true);
        saveExtendedDistancePreference(true);
        saveDirectionLineOpacityPreference(37);
        saveRadarOpacityPreference(62);
        saveRadarProvider('rainviewer');
        saveInitialOverlayPreference('clouds');
        saveLocationSearchProvider('tencent');
        expect(Object.fromEntries(entries)).toEqual(
            Object.fromEntries(
                Object.entries({
                    'ui-language': 'en',
                    'mobile-panel-mode': 'collapsed',
                    'hide-location-search': 'true',
                    'show-600km': 'true',
                    'direction-line-opacity': '37',
                    'radar-opacity': '62',
                    'radar-provider': 'rainviewer',
                    'initial-overlay': 'clouds',
                    'location-provider': 'tencent',
                }).map(([key, value]) => [prefix + key, value]),
            ),
        );
        expect(loadLanguagePreference()).toBe('en');
        expect(loadMobilePanelModePreference()).toBe('collapsed');
        expect(loadInitialOverlayPreference(['satellite', 'clouds'])).toBe('clouds');
        expect(loadRadarProvider()).toBe('rainviewer');
    });

    it('keeps normalization and unknown-value behavior unchanged', () => {
        storage({
            'ui-language': 'fr',
            'mobile-panel-mode': 'fullscreen',
            'direction-line-opacity': '130',
            'radar-opacity': '-20',
            'radar-provider': 'removed',
            'location-provider': 'unknown',
            'initial-overlay': 'removed',
        });
        expect(loadLanguagePreference()).toBeNull();
        expect(loadMobilePanelModePreference()).toBe('compact');
        expect(loadDirectionLineOpacityPreference()).toBe(100);
        expect(loadRadarOpacityPreference()).toBe(0);
        expect(loadRadarProvider()).toBe('none');
        expect(loadLocationSearchProvider()).toBe('amap');
        expect(loadInitialOverlayPreference(['satellite'])).toBe('satellite');
        saveInitialOverlayPreference('keep-current');
        expect(loadInitialOverlayPreference(['satellite'])).toBe('keep-current');
    });

    it('reports persistence failure without throwing when browser storage is blocked', () => {
        const denied = () => {
            throw new Error('storage denied');
        };
        vi.stubGlobal('localStorage', { getItem: denied, setItem: denied, removeItem: denied });
        expect(loadLanguagePreference()).toBeNull();
        expect(loadLocationApiKeys()).toEqual({ amap: '', baidu: '', tencent: '' });
        expect(writeLocationApiKey('amap', 'test-only-placeholder')).toBe(false);
        expect(() => {
            saveLanguagePreference('en');
            saveRadarProvider('rainviewer');
            saveRadarOpacityPreference(50);
            saveLocationSearchProvider('baidu');
            removeLocationApiKey('amap');
            clearRemovedRadarCredentials();
        }).not.toThrow();
    });

    it('trims loaded keys and removes only the selected or retired credentials', () => {
        const entries = storage({
            'amap-api-key': ' test-only-placeholder ',
            'xweather-client-id': 'test-retired',
            'xweather-client-secret': 'test-retired',
        });
        expect(loadLocationApiKeys().amap).toBe('test-only-placeholder');
        expect(writeLocationApiKey('baidu', 'test-only-other')).toBe(true);
        clearRemovedRadarCredentials();
        expect(entries.has(prefix + 'xweather-client-id')).toBe(false);
        expect(entries.has(prefix + 'xweather-client-secret')).toBe(false);
        expect(loadLocationApiKeys().amap).toBe('test-only-placeholder');
        removeLocationApiKey('amap');
        expect(loadLocationApiKeys()).toEqual({ amap: '', baidu: 'test-only-other', tencent: '' });
    });
});

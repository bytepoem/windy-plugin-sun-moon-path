import { describe, expect, it, vi } from 'vitest';

import {
    FAVORITE_METRICS_CACHE_VERSION,
    FAVORITE_METRICS_STORAGE_KEY,
    createFavoriteMetricsCache,
    favoriteMetricsLocationKey,
    loadMissingFavoriteMetrics,
    type FavoriteLocationMetrics,
    type FavoriteMetricTarget,
} from './favoriteMetrics';
import {
    estimateEquivalentBortle,
    estimateObservingConditions,
    type LightPollutionPoint,
} from './lightPollution';

const location = { lat: 23.1234564, lon: 113.1234564 };

const lightPollutionPoint = (sqm = 18.73): LightPollutionPoint => ({
    year: 2025,
    sqm,
    brightnessRatio: 20.4,
    estimatedBortle: estimateEquivalentBortle(sqm),
    observingConditions: estimateObservingConditions(sqm),
});

const memoryStorage = (initial: Record<string, string> = {}) => {
    const values = new Map(Object.entries(initial));
    return {
        getItem: vi.fn((key: string) => values.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
            values.set(key, value);
        }),
        removeItem: vi.fn((key: string) => {
            values.delete(key);
        }),
        value: (key: string) => values.get(key),
    };
};

describe('favorite location metrics cache', () => {
    it('persists readable versioned JSON and restores derived light-pollution details', () => {
        const storage = memoryStorage();
        const cache = createFavoriteMetricsCache(storage);

        cache.set(location, {
            elevationM: 42.4,
            lightPollution: lightPollutionPoint(),
        });

        expect(JSON.parse(storage.value(FAVORITE_METRICS_STORAGE_KEY) || '')).toEqual({
            version: FAVORITE_METRICS_CACHE_VERSION,
            locations: {
                '23.123456,113.123456': {
                    elevationM: 42.4,
                    lightPollution: {
                        year: 2025,
                        sqm: 18.73,
                        brightnessRatio: 20.4,
                    },
                },
            },
        });

        const restored = createFavoriteMetricsCache(storage).get(location);
        expect(restored.elevationM).toBe(42.4);
        expect(restored.lightPollution).toEqual(lightPollutionPoint());
    });

    it('keeps elevation but ignores light-pollution data from another atlas year', () => {
        const key = favoriteMetricsLocationKey(location);
        const storage = memoryStorage({
            [FAVORITE_METRICS_STORAGE_KEY]: JSON.stringify({
                version: FAVORITE_METRICS_CACHE_VERSION,
                locations: {
                    [key]: {
                        elevationM: 12,
                        lightPollution: {
                            year: 2024,
                            sqm: 20.1,
                            brightnessRatio: 3,
                            estimatedBortle: 5,
                        },
                    },
                },
            }),
        });

        expect(createFavoriteMetricsCache(storage).get(location)).toEqual({ elevationM: 12 });
    });

    it('clears an incompatible cache document instead of interpreting shifted fields', () => {
        const storage = memoryStorage({
            [FAVORITE_METRICS_STORAGE_KEY]: JSON.stringify({ version: 2, locations: {} }),
        });

        expect(createFavoriteMetricsCache(storage).get(location)).toEqual({});
        expect(storage.removeItem).toHaveBeenCalledWith(FAVORITE_METRICS_STORAGE_KEY);
    });

    it('ignores an out-of-range light-pollution record without blocking valid elevation', () => {
        const key = favoriteMetricsLocationKey(location);
        const storage = memoryStorage({
            [FAVORITE_METRICS_STORAGE_KEY]: JSON.stringify({
                version: FAVORITE_METRICS_CACHE_VERSION,
                locations: {
                    [key]: {
                        elevationM: 23,
                        lightPollution: {
                            year: 2025,
                            sqm: -1,
                            brightnessRatio: -2,
                        },
                    },
                },
            }),
        });

        expect(createFavoriteMetricsCache(storage).get(location)).toEqual({ elevationM: 23 });
    });

    it('prunes metrics that no longer belong to a favorite coordinate', () => {
        const storage = memoryStorage();
        const cache = createFavoriteMetricsCache(storage);
        const retained = { lat: 23, lon: 113 };
        const removed = { lat: 24, lon: 114 };
        cache.set(retained, { elevationM: 10 });
        cache.set(removed, { elevationM: 20 });

        cache.retain([retained]);

        expect(cache.get(retained)).toEqual({ elevationM: 10 });
        expect(cache.get(removed)).toEqual({});
    });

    it('keeps the in-memory result usable when localStorage is full', () => {
        const storage = memoryStorage();
        storage.setItem.mockImplementation(() => {
            throw new DOMException('Quota exceeded', 'QuotaExceededError');
        });
        const cache = createFavoriteMetricsCache(storage);

        expect(cache.set(location, { elevationM: 8 })).toEqual({ elevationM: 8 });
        expect(cache.get(location)).toEqual({ elevationM: 8 });
    });

    it('preserves valid negative elevations for below-sea-level favorites', () => {
        const cache = createFavoriteMetricsCache(memoryStorage());

        cache.set(location, { elevationM: -430 });

        expect(cache.get(location)).toEqual({ elevationM: -430 });
    });
});

describe('favorite location metric loading', () => {
    const target = (id: string, lat: number): FavoriteMetricTarget => ({
        id,
        wgs84: { lat, lon: 113 },
    });

    it('requests only missing values and loads light-pollution tiles sequentially', async () => {
        const targets = [target('first', 23), target('second', 24), target('cached', 25)];
        const cached = new Map<string, FavoriteLocationMetrics>([
            ['first', { elevationM: 12 }],
            ['second', {}],
            ['cached', { elevationM: 18, lightPollution: lightPollutionPoint(20.5) }],
        ]);
        let activeLightPollutionRequests = 0;
        let maxActiveLightPollutionRequests = 0;
        const loadElevation = vi.fn(async () => 36);
        const loadLightPollution = vi.fn(async () => {
            activeLightPollutionRequests += 1;
            maxActiveLightPollutionRequests = Math.max(
                maxActiveLightPollutionRequests,
                activeLightPollutionRequests,
            );
            await Promise.resolve();
            activeLightPollutionRequests -= 1;
            return lightPollutionPoint();
        });
        const updates: { id: string; value: unknown }[] = [];

        await loadMissingFavoriteMetrics({
            targets,
            metricsFor: item => cached.get(item.id) || {},
            loadElevation,
            loadLightPollution,
            isCurrent: () => true,
            onUpdate: (id, value) => updates.push({ id, value }),
        });

        expect(loadElevation).toHaveBeenCalledTimes(1);
        expect(loadElevation).toHaveBeenCalledWith(targets[1]);
        expect(loadLightPollution).toHaveBeenCalledTimes(2);
        expect(loadLightPollution).toHaveBeenCalledWith(targets[0]);
        expect(loadLightPollution).toHaveBeenCalledWith(targets[1]);
        expect(maxActiveLightPollutionRequests).toBe(1);
        expect(updates).toEqual(expect.arrayContaining([
            { id: 'second', value: { elevationM: 36 } },
            { id: 'first', value: { lightPollution: lightPollutionPoint() } },
        ]));
    });

    it('does not publish an async result after the request becomes stale', async () => {
        let current = true;
        const onUpdate = vi.fn();

        await loadMissingFavoriteMetrics({
            targets: [target('place', 23)],
            metricsFor: () => ({ elevationM: 10 }),
            loadElevation: async () => 10,
            loadLightPollution: async () => {
                current = false;
                return lightPollutionPoint();
            },
            isCurrent: () => current,
            onUpdate,
        });

        expect(onUpdate).not.toHaveBeenCalled();
    });
});

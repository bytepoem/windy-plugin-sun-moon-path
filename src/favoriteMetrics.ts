import {
    LIGHT_POLLUTION_DATA_YEAR,
    estimateEquivalentBortle,
    estimateObservingConditions,
    type LightPollutionPoint,
} from './lightPollution';
import { loadElevationsWithConcurrency } from './locationSearch';
import type { Coordinates } from './solar';

export const FAVORITE_METRICS_CACHE_VERSION = 1;
export const FAVORITE_METRICS_STORAGE_KEY = 'windy-plugin-sun-moon-path.favorite-metrics';

type StoredLightPollutionPoint = Pick<LightPollutionPoint, 'year' | 'sqm' | 'brightnessRatio'>;

type StoredFavoriteLocationMetrics = {
    elevationM?: number;
    lightPollution?: StoredLightPollutionPoint;
};

type StoredFavoriteMetricsCache = {
    version: typeof FAVORITE_METRICS_CACHE_VERSION;
    locations: Record<string, StoredFavoriteLocationMetrics>;
};

export type FavoriteLocationMetrics = {
    elevationM?: number;
    lightPollution?: LightPollutionPoint;
};

export type FavoriteMetricTarget = {
    id: string;
    wgs84: Coordinates;
};

export type FavoriteMetricUpdate = {
    elevationM?: number | null;
    lightPollution?: LightPollutionPoint | null;
};

type FavoriteMetricsStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type FavoriteMetricsCache = {
    get: (location: Coordinates) => FavoriteLocationMetrics;
    set: (location: Coordinates, metrics: FavoriteLocationMetrics) => FavoriteLocationMetrics;
    remove: (location: Coordinates) => void;
    retain: (locations: Coordinates[]) => void;
};

const emptyCache = (): StoredFavoriteMetricsCache => ({
    version: FAVORITE_METRICS_CACHE_VERSION,
    locations: {},
});

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const finiteNumber = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const normalizeStoredLightPollution = (value: unknown): StoredLightPollutionPoint | undefined => {
    if (!isObject(value)) {
        return undefined;
    }
    const year = finiteNumber(value.year);
    const sqm = finiteNumber(value.sqm);
    const brightnessRatio = finiteNumber(value.brightnessRatio);
    if (
        year !== LIGHT_POLLUTION_DATA_YEAR
        || sqm === undefined
        || sqm < 0
        || brightnessRatio === undefined
        || brightnessRatio < 0
    ) {
        return undefined;
    }
    return { year, sqm, brightnessRatio };
};

const normalizeStoredMetrics = (value: unknown): StoredFavoriteLocationMetrics | null => {
    if (!isObject(value)) {
        return null;
    }
    const elevationM = finiteNumber(value.elevationM);
    const lightPollution = normalizeStoredLightPollution(value.lightPollution);
    if (elevationM === undefined && lightPollution === undefined) {
        return null;
    }
    return {
        ...(elevationM === undefined ? {} : { elevationM }),
        ...(lightPollution === undefined ? {} : { lightPollution }),
    };
};

const readStoredCache = (storage: FavoriteMetricsStorage | null): StoredFavoriteMetricsCache => {
    if (!storage) {
        return emptyCache();
    }
    try {
        const raw = storage.getItem(FAVORITE_METRICS_STORAGE_KEY);
        if (!raw) {
            return emptyCache();
        }
        const parsed: unknown = JSON.parse(raw);
        if (
            !isObject(parsed)
            || parsed.version !== FAVORITE_METRICS_CACHE_VERSION
            || !isObject(parsed.locations)
        ) {
            storage.removeItem(FAVORITE_METRICS_STORAGE_KEY);
            return emptyCache();
        }
        const locations: Record<string, StoredFavoriteLocationMetrics> = {};
        for (const [key, value] of Object.entries(parsed.locations)) {
            const metrics = normalizeStoredMetrics(value);
            if (metrics) {
                locations[key] = metrics;
            }
        }
        return { version: FAVORITE_METRICS_CACHE_VERSION, locations };
    } catch {
        try {
            storage.removeItem(FAVORITE_METRICS_STORAGE_KEY);
        } catch {
            // The cache is optional; storage access failures must not block favorites.
        }
        return emptyCache();
    }
};

export const favoriteMetricsLocationKey = (location: Coordinates): string =>
    `${location.lat.toFixed(6)},${location.lon.toFixed(6)}`;

const hydrateMetrics = (stored: StoredFavoriteLocationMetrics | undefined): FavoriteLocationMetrics => {
    if (!stored) {
        return {};
    }
    const lightPollution = stored.lightPollution
        ? {
            ...stored.lightPollution,
            estimatedBortle: estimateEquivalentBortle(stored.lightPollution.sqm),
            observingConditions: estimateObservingConditions(stored.lightPollution.sqm),
        }
        : undefined;
    return {
        ...(stored.elevationM === undefined ? {} : { elevationM: stored.elevationM }),
        ...(lightPollution === undefined ? {} : { lightPollution }),
    };
};

export const createFavoriteMetricsCache = (
    storage: FavoriteMetricsStorage | null,
): FavoriteMetricsCache => {
    const cache = readStoredCache(storage);

    const persist = () => {
        if (!storage) {
            return;
        }
        try {
            storage.setItem(FAVORITE_METRICS_STORAGE_KEY, JSON.stringify(cache));
        } catch {
            // Keep the in-memory cache usable when storage is unavailable or full.
        }
    };

    return {
        get: location => hydrateMetrics(cache.locations[favoriteMetricsLocationKey(location)]),
        set: (location, metrics) => {
            const key = favoriteMetricsLocationKey(location);
            const current = cache.locations[key] || {};
            const elevationM = finiteNumber(metrics.elevationM);
            const lightPollution = metrics.lightPollution?.year === LIGHT_POLLUTION_DATA_YEAR
                ? normalizeStoredLightPollution(metrics.lightPollution)
                : undefined;
            const next = {
                ...current,
                ...(elevationM === undefined ? {} : { elevationM }),
                ...(lightPollution === undefined ? {} : { lightPollution }),
            };
            cache.locations[key] = next;
            persist();
            return hydrateMetrics(next);
        },
        remove: location => {
            const key = favoriteMetricsLocationKey(location);
            if (cache.locations[key]) {
                delete cache.locations[key];
                persist();
            }
        },
        retain: locations => {
            const retainedKeys = new Set(locations.map(favoriteMetricsLocationKey));
            let changed = false;
            for (const key of Object.keys(cache.locations)) {
                if (!retainedKeys.has(key)) {
                    delete cache.locations[key];
                    changed = true;
                }
            }
            if (changed) {
                persist();
            }
        },
    };
};

export const loadMissingFavoriteMetrics = async ({
    targets,
    metricsFor,
    loadElevation,
    loadLightPollution,
    isCurrent,
    onUpdate,
}: {
    targets: FavoriteMetricTarget[];
    metricsFor: (target: FavoriteMetricTarget) => FavoriteLocationMetrics;
    loadElevation: (target: FavoriteMetricTarget) => Promise<number>;
    loadLightPollution: (target: FavoriteMetricTarget) => Promise<LightPollutionPoint>;
    isCurrent: () => boolean;
    onUpdate: (id: string, update: FavoriteMetricUpdate) => void;
}): Promise<void> => {
    const uniqueTargets = Array.from(new Map(targets.map(target => [target.id, target])).values());
    const elevationTargets = uniqueTargets.filter(target => metricsFor(target).elevationM === undefined);
    const lightPollutionTargets = uniqueTargets.filter(target => metricsFor(target).lightPollution === undefined);

    const elevationPromise = loadElevationsWithConcurrency({
        results: elevationTargets,
        concurrency: 3,
        loadElevation,
        isCurrent,
        onResult: (id, elevationM) => onUpdate(id, { elevationM }),
    });

    const lightPollutionPromise = (async () => {
        for (const target of lightPollutionTargets) {
            if (!isCurrent()) {
                return;
            }
            try {
                const lightPollution = await loadLightPollution(target);
                if (!isCurrent()) {
                    return;
                }
                onUpdate(target.id, { lightPollution });
            } catch {
                if (!isCurrent()) {
                    return;
                }
                onUpdate(target.id, { lightPollution: null });
            }
        }
    })();

    await Promise.all([elevationPromise, lightPollutionPromise]);
};

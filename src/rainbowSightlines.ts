import { OPEN_METEO_MODELS } from './openMeteo';
import { rainbowSamples } from './rainbowConditions';
import { calculateRainbow, type SkyDirection } from './rainbowGeometry';
import { destinationPoint, EARTH_RADIUS_KM, type Coordinates } from './solar';
import type { WeatherModel } from './weather';

const HOUR_MS = 3_600_000;
const TERRAIN_DIRECTION_COUNT = 7;
// Coarse screening: tighter spacing nearby, not a continuous or obstruction-free horizon.
export const TERRAIN_DISTANCES_KM = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 7, 10, 15, 20, 25, 30];
const ELEVATION_BATCH_SIZE = 100;
export const LOW_VISIBILITY_KM = 5;

export type SightlineRequest = {
    location: Coordinates;
    source: SkyDirection;
    timestamp: number;
    model: WeatherModel;
    cameraHeightM: number;
    signal: AbortSignal;
    fetcher?: typeof fetch;
};
type TerrainPoint = Coordinates & { directionIndex: number; distanceKm: number };
export type TerrainDirection = SkyDirection & {
    horizonAltitude: number | null;
    ridgeDistanceKm: number | null;
    complete: boolean;
    potentialObstruction: boolean;
};
export type TerrainResult = {
    observerElevationM: number | null;
    directions: TerrainDirection[];
};
export type VisibilityRoute = {
    bearing: number;
    distanceKm: number;
    minimumKm: number | null;
    complete: boolean;
    lowVisibility: boolean;
};
export type VisibilityResult = { timestamp: number; routes: VisibilityRoute[] };
export type SightlineState = {
    status: 'idle' | 'loading' | 'ready';
    terrain: TerrainResult | null;
    visibility: VisibilityResult | null;
};

/** Sample the visible bow itself, including its horizon crossings and top. */
export const terrainPlan = (location: Coordinates, source: SkyDirection) => {
    const arc = calculateRainbow(source);
    const visible = arc?.segments.filter(segment => !segment.belowHorizon).flatMap(segment => segment.points) ?? [];
    const directions = source.altitude > 0 && arc && arc.topAltitude > 0 && visible.length
        ? Array.from({ length: TERRAIN_DIRECTION_COUNT }, (_, index) =>
            visible[Math.round(index * (visible.length - 1) / (TERRAIN_DIRECTION_COUNT - 1))]) : [];
    const points: TerrainPoint[] = directions.flatMap((direction, directionIndex) =>
        TERRAIN_DISTANCES_KM.map(distanceKm => ({
            ...destinationPoint(location, direction.azimuth, distanceKm), directionIndex, distanceKm,
        })));
    return { directions, points };
};

/** Spherical-Earth line of sight with both elevations in the same DEM vertical datum.
 * No atmospheric refraction correction; observer height is metres above the DEM surface.
 */
export const terrainElevationAngle = (observerElevationM: number, targetElevationM: number, distanceKm: number): number => {
    const earthM = EARTH_RADIUS_KM * 1000;
    const angle = distanceKm / EARTH_RADIUS_KM;
    const targetRadius = earthM + targetElevationM;
    return Math.atan2(targetRadius * Math.cos(angle) - (earthM + observerElevationM),
        targetRadius * Math.sin(angle)) * 180 / Math.PI;
};

export const assessTerrain = (
    plan: ReturnType<typeof terrainPlan>, elevations: (number | null)[], cameraHeightM: number,
): TerrainResult => {
    const ground = elevations[0];
    const observerElevationM = typeof ground === 'number' && Number.isFinite(ground)
        && Number.isFinite(cameraHeightM) && cameraHeightM >= 0 ? ground + cameraHeightM : null;
    return {
        observerElevationM,
        directions: plan.directions.map((direction, directionIndex) => {
            const along = plan.points.flatMap((point, index) => {
                if (point.directionIndex !== directionIndex) { return []; }
                const elevation = elevations[index + 1];
                return [{ ...point, angle: observerElevationM !== null && typeof elevation === 'number' && Number.isFinite(elevation)
                    ? terrainElevationAngle(observerElevationM, elevation, point.distanceKm) : null }];
            });
            const known = along.filter((point): point is typeof point & { angle: number } => point.angle !== null);
            const ridge = known.reduce<typeof known[number] | null>((highest, point) =>
                !highest || point.angle > highest.angle ? point : highest, null);
            return { ...direction, horizonAltitude: ridge?.angle ?? null, ridgeDistanceKm: ridge?.distanceKm ?? null,
                complete: known.length === along.length && along.length > 0,
                potentialObstruction: ridge !== null && ridge.angle > direction.altitude };
        }),
    };
};

/** One observer elevation and 112 terrain samples, in API-sized batches.
 * Failed batches stay missing; abort prevents later batches from being dispatched.
 */
export const fetchRainbowTerrain = async (request: SightlineRequest): Promise<TerrainResult> => {
    const plan = terrainPlan(request.location, request.source);
    const coordinates = [request.location, ...plan.points];
    const elevations: (number | null)[] = [];
    for (let offset = 0; offset < coordinates.length; offset += ELEVATION_BATCH_SIZE) {
        request.signal.throwIfAborted();
        const batch = coordinates.slice(offset, offset + ELEVATION_BATCH_SIZE);
        const url = new URL('https://api.open-meteo.com/v1/elevation');
        url.searchParams.set('latitude', batch.map(point => point.lat.toFixed(5)).join(','));
        url.searchParams.set('longitude', batch.map(point => point.lon.toFixed(5)).join(','));
        try {
            const response = await (request.fetcher ?? fetch)(url, { signal: request.signal });
            if (!response.ok) { throw new Error('Elevation request failed'); }
            const payload = await response.json() as { elevation?: unknown };
            const values = payload.elevation;
            if (!Array.isArray(values) || values.length !== batch.length) { throw new Error('Incomplete elevation batch'); }
            elevations.push(...values.map(value => typeof value === 'number' && Number.isFinite(value) ? value : null));
        } catch {
            request.signal.throwIfAborted();
            elevations.push(...batch.map(() => null));
        }
    }
    return assessTerrain(plan, elevations, request.cameraHeightM);
};

export const visibilityPlan = (location: Coordinates, source: SkyDirection, model: WeatherModel) => {
    const candidates = rainbowSamples(location, source, model);
    // Origin plus midpoint/end for each candidate distance; deduplicate shared path locations.
    const points = [{ ...location, bearing: 0, distanceKm: 0 }];
    for (const candidate of candidates) {
        for (const distanceKm of [candidate.distanceKm / 2, candidate.distanceKm]) {
            if (!points.some(point => point.bearing === candidate.bearing && point.distanceKm === distanceKm)) {
                points.push({ ...destinationPoint(location, candidate.bearing, distanceKm), bearing: candidate.bearing, distanceKm });
            }
        }
    }
    return { candidates, points };
};

/** Near-surface visibility is a risk indicator, not a 3D optical-depth integral.
 * Never compare visibility directly with rain distance or treat absent data as clear air.
 */
export const assessVisibility = (
    plan: ReturnType<typeof visibilityPlan>, valuesKm: (number | null)[], timestamp: number,
): VisibilityResult => ({
    timestamp,
    routes: plan.candidates.map(candidate => {
        const values = plan.points.flatMap((point, index) => point.distanceKm === 0
            || (point.bearing === candidate.bearing && point.distanceKm <= candidate.distanceKm) ? [valuesKm[index]] : []);
        const known = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0);
        const minimumKm = known.length ? Math.min(...known) : null;
        return { bearing: candidate.bearing, distanceKm: candidate.distanceKm, minimumKm,
            complete: known.length === values.length && values.length > 0,
            lowVisibility: minimumKm !== null && minimumKm < LOW_VISIBILITY_KM };
    }),
});

export const fetchRainbowVisibility = async (request: SightlineRequest): Promise<VisibilityResult> => {
    const plan = visibilityPlan(request.location, request.source, request.model);
    // Visibility is instantaneous at the end label, unlike the preceding-hour rainfall sum.
    const timestamp = Math.ceil(request.timestamp / HOUR_MS) * HOUR_MS;
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', plan.points.map(point => point.lat.toFixed(5)).join(','));
    url.searchParams.set('longitude', plan.points.map(point => point.lon.toFixed(5)).join(','));
    url.searchParams.set('hourly', 'visibility');
    url.searchParams.set('models', OPEN_METEO_MODELS[request.model]);
    url.searchParams.set('timeformat', 'unixtime');
    url.searchParams.set('timezone', 'GMT');
    url.searchParams.set('past_hours', '6');
    url.searchParams.set('forecast_hours', '121');
    const response = await (request.fetcher ?? fetch)(url, { signal: request.signal });
    if (!response.ok) { throw new Error('Visibility request failed'); }
    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || payload.length !== plan.points.length) { throw new Error('Incomplete visibility batch'); }
    return assessVisibility(plan, payload.map(point => {
        const index = Array.isArray(point?.hourly?.time) ? point.hourly.time.indexOf(timestamp / 1000) : -1;
        const value: unknown = point?.hourly?.visibility?.[index];
        return point?.hourly_units?.time === 'unixtime' && point?.hourly_units?.visibility === 'm'
            && index >= 0 && typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value / 1000 : null;
    }), timestamp);
};

/** Separate outcomes preserve usable evidence when one source fails. All branches share
 * one abort signal and identity; closing/resetting cannot publish late results.
 */
export const createRainbowSightlineLoader = (
    publish: (state: SightlineState) => void,
    ports = { terrain: fetchRainbowTerrain, visibility: fetchRainbowVisibility },
) => {
    let active: AbortController | null = null;
    const cancel = () => {
        active?.abort();
        active = null;
    };
    return {
        reset: () => {
            cancel();
            publish({ status: 'idle', terrain: null, visibility: null });
        },
        destroy: cancel,
        load: async (request: Omit<SightlineRequest, 'signal'>) => {
            cancel();
            const controller = new AbortController();
            active = controller;
            publish({ status: 'loading', terrain: null, visibility: null });
            const [terrain, visibility] = await Promise.allSettled([
                ports.terrain({ ...request, signal: controller.signal }),
                ports.visibility({ ...request, signal: controller.signal }),
            ]);
            if (active !== controller) { return; }
            active = null;
            publish({ status: 'ready', terrain: terrain.status === 'fulfilled' ? terrain.value : null,
                visibility: visibility.status === 'fulfilled' ? visibility.value : null });
        },
    };
};

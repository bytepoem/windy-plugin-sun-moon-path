import { calculateRainbow, type SkyDirection } from './rainbowGeometry';
import { OPEN_METEO_MODELS } from './openMeteo';
import type { Coordinates } from './solar';
import type { WeatherModel } from './weather';

const HOUR_MS = 3_600_000;
// Approximate global grid spacing, not effective resolution or independent observations.
const SAMPLE_SPACING_KM: Record<WeatherModel, number> = { ecmwf: 9, gfs: 22, icon: 13 };
const RAIN_REFERENCE_MM = 0.1;
// A screening reference only: hourly mean DNI is not proof of simultaneous sun and rain.
const LIGHT_REFERENCE_WM2 = 120;

export type RainbowSample = Coordinates & { bearing: number; distanceKm: number };
export type RainbowEvidence = RainbowSample & { rainMm: number | null; directWm2: number | null };
/** Presentation uses the same screening thresholds as the aggregate assessment. */
export const rainbowSampleSignal = (sample: RainbowEvidence) => {
    if (sample.rainMm === null || sample.directWm2 === null) { return 'missing'; }
    if (sample.rainMm < RAIN_REFERENCE_MM) { return 'no-rain'; }
    return sample.directWm2 >= LIGHT_REFERENCE_WM2 ? 'favourable' : 'weak-light';
};
export type RainbowConditions = {
    level: 'favourable' | 'mixed' | 'unfavourable' | 'insufficient';
    start: number;
    end: number;
    samples: RainbowEvidence[];
    wetCount: number;
    litWetCount: number;
};

/** Sample the visible primary bow's azimuth span, at three model-scaled distances.
 * These are ground forecast locations, not reconstructed three-dimensional rain shafts.
 */
export const rainbowSamples = (location: Coordinates, source: SkyDirection, model: WeatherModel): RainbowSample[] => {
    const arc = calculateRainbow(source);
    if (source.altitude <= 0 || !arc || arc.topAltitude <= 0 || arc.leftAzimuth === null) { return []; }
    const halfWidth = (arc.center.azimuth - arc.leftAzimuth + 360) % 360;
    const radians = Math.PI / 180;
    const latitude = location.lat * radians;
    return [-1, 0, 1].flatMap(offset => {
        const bearing = (arc.center.azimuth + offset * halfWidth + 360) % 360;
        return [1, 2, 3].map(multiplier => {
            const distanceKm = SAMPLE_SPACING_KM[model] * multiplier;
            const angularDistance = distanceKm / 6371;
            const targetLatitude = Math.asin(Math.sin(latitude) * Math.cos(angularDistance)
                + Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing * radians));
            const targetLongitude = location.lon * radians + Math.atan2(
                Math.sin(bearing * radians) * Math.sin(angularDistance) * Math.cos(latitude),
                Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(targetLatitude),
            );
            return { lat: targetLatitude / radians, lon: (targetLongitude / radians + 540) % 360 - 180, bearing, distanceKm };
        });
    });
};

/** All evidence refers to the same preceding-hour interval. Never interpolate rainfall,
 * replace missing values with zero, or combine rain and light from different sample points.
 */
export const assessRainbowConditions = (samples: RainbowEvidence[], end: number): RainbowConditions => {
    const wet = samples.filter(sample => sample.rainMm !== null && sample.rainMm >= RAIN_REFERENCE_MM);
    const litWet = wet.filter(sample => sample.directWm2 !== null && sample.directWm2 >= LIGHT_REFERENCE_WM2);
    const complete = samples.length === 9 && samples.every(sample => sample.rainMm !== null && sample.directWm2 !== null);
    return {
        level: !complete ? 'insufficient' : litWet.length > 0 ? 'favourable' : wet.length > 0 ? 'mixed' : 'unfavourable',
        start: end - HOUR_MS, end, samples, wetCount: wet.length, litWetCount: litWet.length,
    };
};

type ForecastPayload = {
    hourly_units?: Record<string, unknown>;
    hourly?: Record<string, unknown>;
};

/** Dedicated Open-Meteo evidence: do not alter the shared weather table or its selected source.
 * Fetch all samples in one batch and require the exact interval, model and units requested.
 */
export const fetchRainbowConditions = async (request: {
    location: Coordinates;
    source: SkyDirection;
    model: WeatherModel;
    timestamp: number;
    signal: AbortSignal;
    fetcher?: typeof fetch;
}): Promise<RainbowConditions> => {
    const samples = rainbowSamples(request.location, request.source, request.model);
    const end = Math.ceil(request.timestamp / HOUR_MS) * HOUR_MS;
    if (samples.length === 0) { return assessRainbowConditions([], end); }
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', samples.map(sample => sample.lat.toFixed(5)).join(','));
    url.searchParams.set('longitude', samples.map(sample => sample.lon.toFixed(5)).join(','));
    url.searchParams.set('models', OPEN_METEO_MODELS[request.model]);
    url.searchParams.set('hourly', 'rain,showers,direct_normal_irradiance');
    url.searchParams.set('timeformat', 'unixtime');
    url.searchParams.set('timezone', 'GMT');
    url.searchParams.set('past_hours', '6');
    url.searchParams.set('forecast_hours', '121');
    const response = await (request.fetcher ?? fetch)(url, { signal: request.signal });
    if (!response.ok) { throw new Error(`Rainbow forecast HTTP ${response.status}`); }
    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || payload.length !== samples.length) {
        throw new Error('Incomplete rainbow forecast batch');
    }
    return assessRainbowConditions(samples.map((sample, index) => {
        const forecast = payload[index] as ForecastPayload | null;
        const hourly = forecast?.hourly;
        const units = forecast?.hourly_units;
        const times = hourly?.time;
        const timeIndex = Array.isArray(times) ? times.indexOf(end / 1000) : -1;
        const value = (field: string, unit: string): number | null => {
            const series = hourly?.[field];
            const item: unknown = Array.isArray(series) && timeIndex >= 0 ? series[timeIndex] : null;
            return units?.time === 'unixtime' && units[field] === unit
                && typeof item === 'number' && Number.isFinite(item) && item >= 0 ? item : null;
        };
        const rain = value('rain', 'mm');
        const showers = value('showers', 'mm');
        return { ...sample, rainMm: rain === null || showers === null ? null : rain + showers,
            directWm2: value('direct_normal_irradiance', 'W/m²') };
    }), end);
};

/** Own request cancellation and stale-response rejection independently of Svelte rendering. */
export const createRainbowConditionsLoader = (publish: (state: {
    status: 'idle' | 'loading' | 'ready' | 'error'; result: RainbowConditions | null;
}) => void, fetcher = fetchRainbowConditions) => {
    let active: AbortController | null = null;
    const cancel = () => {
        active?.abort();
        active = null;
    };
    return {
        reset: () => {
            cancel();
            publish({ status: 'idle', result: null });
        },
        destroy: cancel,
        load: async (request: Omit<Parameters<typeof fetchRainbowConditions>[0], 'signal'>) => {
            cancel();
            const controller = new AbortController();
            active = controller;
            publish({ status: 'loading', result: null });
            try {
                const result = await fetcher({ ...request, signal: controller.signal });
                if (active === controller) { publish({ status: 'ready', result }); }
            } catch {
                if (active === controller) { publish({ status: 'error', result: null }); }
            } finally {
                if (active === controller) { active = null; }
            }
        },
    };
};

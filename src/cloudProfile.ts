import type { WeatherForecastPayload } from './weather';

export type CloudBand = 'low' | 'medium' | 'high';
export const CLOUD_BANDS: CloudBand[] = ['low', 'medium', 'high'];
export type CloudSettings = {
    view: 'single' | 'layers';
    single: { mode: 'auto' | 'manual'; heightM: number | undefined };
    clock: string;
    body: 'sun' | 'moon';
    threshold: number;
    twilight: boolean;
    opacity: number;
    syncMap: boolean;
    cameraOffsetM: number | undefined;
    overlay: 'clouds' | 'lclouds' | 'mclouds' | 'hclouds';
    layers: Record<CloudBand, { enabled: boolean; mode: 'auto' | 'manual'; heightM: number | undefined }>;
};
export const createCloudSettings = (): CloudSettings => ({
    view: 'single', single: { mode: 'auto', heightM: undefined },
    clock: '', body: 'sun', threshold: 10, twilight: true, opacity: 85, syncMap: true, cameraOffsetM: 0, overlay: 'clouds',
    layers: {
        low: { enabled: true, mode: 'auto', heightM: undefined },
        medium: { enabled: true, mode: 'auto', heightM: undefined },
        high: { enabled: true, mode: 'auto', heightM: undefined },
    },
});
export type CloudLayer = {
    heightM: number;
    baseMinimumM: number | null;
    topM: number;
    cloudPercent: number;
    band: CloudBand;
};
export type CloudProfile = {
    timestamp: number;
    layers: CloudLayer[];
    coverage: Record<CloudBand, 'sampled' | 'missing'>;
};
export type CloudForecast = { profiles: CloudProfile[]; modelElevationM: number | null };

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const bandFor = (heightM: number): CloudBand => heightM < 2_000 ? 'low' : heightM < 6_000 ? 'medium' : 'high';

/** Preserve disconnected layers and model-specific pressure levels. A sampled height is not a measured base.
 * Band labels use height above model terrain; all layer heights remain AMSL for geometry.
 */
export const extractCloudForecast = (payload: WeatherForecastPayload | null, threshold: number): CloudForecast => {
    const modelElevationM = finite(payload?.header?.modelElevation) ? payload.header.modelElevation : null;
    const series = payload?.sounding || payload?.meteogram;
    if (!series || modelElevationM === null || !finite(threshold) || threshold <= 0 || threshold > 100) {
        return { profiles: [], modelElevationM };
    }
    const levels = Object.keys(series).filter(key => /^gh-\d+h$/.test(key)).map(key => key.slice(3))
        .sort((a, b) => parseInt(b) - parseInt(a));
    const profiles = series.ts.filter(finite).map(timestamp => {
        const index = series.ts.indexOf(timestamp);
        const points = levels.map(level => ({
            height: series[`gh-${level}`]?.[index],
            cloud: series[`cloud-${level}`]?.[index],
        }));
        const layers: CloudLayer[] = [];
        const coverage: CloudProfile['coverage'] = { low: 'missing', medium: 'missing', high: 'missing' };
        let current: CloudLayer | null = null;
        let previous: { height: number; cloud: number | null | undefined } | null = null;
        for (const point of points) {
            // Pressure orders the vertical column even when a height sample is missing.
            // Unknown or non-monotonic heights must break continuity, not join two cloud decks.
            if (!finite(point.height) || point.height <= Math.max(0, modelElevationM) || point.height > 30_000
                || (previous && point.height <= previous.height)) {
                current = null;
                previous = null;
                continue;
            }
            const band = bandFor(point.height - modelElevationM);
            const cloudKnown = finite(point.cloud) && point.cloud >= 0 && point.cloud <= 100;
            if (cloudKnown) {coverage[band] = 'sampled';}
            if (!cloudKnown || (point.cloud as number) < threshold) {
                current = null;
            } else if (current) {
                current.topM = point.height;
                current.cloudPercent = Math.max(current.cloudPercent, point.cloud as number);
            } else {
                current = {
                    heightM: point.height,
                    baseMinimumM: previous && finite(previous.cloud) && previous.cloud >= 0 && previous.cloud < threshold
                        ? previous.height : null,
                    topM: point.height,
                    cloudPercent: point.cloud as number,
                    band,
                };
                layers.push(current);
            }
            previous = { height: point.height, cloud: point.cloud };
        }
        return { timestamp, layers, coverage };
    }).sort((a, b) => a.timestamp - b.timestamp);
    return { profiles, modelElevationM };
};

/** Select an actual forecast step. Do not interpolate cloud layers across clearing/formation events. */
export const selectCloudProfile = (forecast: CloudForecast, timestamp: number): CloudProfile | null => {
    const points = forecast.profiles;
    if (!Number.isFinite(timestamp) || !points.length
        || timestamp < points[0].timestamp || timestamp > points[points.length - 1].timestamp) {return null;}
    const nearest = points.reduce((best, point) =>
        Math.abs(point.timestamp - timestamp) < Math.abs(best.timestamp - timestamp) ? point : best);
    return Math.abs(nearest.timestamp - timestamp) <= 90 * 60_000 ? nearest : null;
};

import type { WeatherForecastPayload } from './weather';

export type CloudBand = 'low' | 'medium' | 'high';
export const CLOUD_BANDS: CloudBand[] = ['low', 'medium', 'high'];
export type CloudHeightSource = 'base' | 'cloud' | 'dewpoint';
export type CloudSettings = {
    singleSource: CloudHeightSource;
    layeredSource: CloudHeightSource;
    dewPointSpreadC: number;
    view: 'single' | 'layers';
    single: { mode: 'auto' | 'manual'; heightM: number | undefined };
    clock: string;
    body: 'auto' | 'sun' | 'moon' | 'milkyway';
    threshold: number;
    twilight: boolean;
    syncMap: boolean;
    cameraOffsetM: number | undefined;
    overlay: 'clouds' | 'lclouds' | 'mclouds' | 'hclouds' | 'cbase' | 'satellite';
    layers: Record<CloudBand, { enabled: boolean; mode: 'auto' | 'manual'; heightM: number | undefined }>;
};
export const createCloudSettings = (): CloudSettings => ({
    singleSource: 'base', layeredSource: 'cloud', dewPointSpreadC: 2,
    view: 'single', single: { mode: 'auto', heightM: undefined },
    clock: '', body: 'sun', threshold: 10, twilight: true, syncMap: true, cameraOffsetM: 0, overlay: 'clouds',
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
    /** Temperature minus dew point at the base sample; only present for thermodynamic estimates. */
    dewPointSpreadC?: number;
    band: CloudBand;
};
export type CloudProfile = {
    timestamp: number;
    layers: CloudLayer[];
    coverage: Record<CloudBand, 'sampled' | 'missing'>;
};
export type CloudForecast = { profiles: CloudProfile[]; modelElevationM: number | null };

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
/** Categorize the base by metres above model terrain, not by its AMSL altitude. */
export const bandFor = (heightAglM: number): CloudBand => heightAglM < 2_000 ? 'low' : heightAglM < 6_000 ? 'medium' : 'high';

/** Preserve disconnected layers and model-specific pressure levels. A sampled height is not a measured base.
 * Band labels use height above model terrain; all layer heights remain AMSL for geometry.
 */
export const extractCloudForecast = (
    payload: WeatherForecastPayload | null, threshold: number, method: 'cloud' | 'dewpoint' = 'cloud',
): CloudForecast => {
    const modelElevationM = finite(payload?.header?.modelElevation) ? payload.header.modelElevation : null;
    const series = method === 'dewpoint' ? payload?.sounding : payload?.sounding || payload?.meteogram;
    if (!series || modelElevationM === null || !finite(threshold) || threshold < (method === 'cloud' ? 1 : 0) || threshold > (method === 'cloud' ? 100 : 10)) {
        return { profiles: [], modelElevationM };
    }
    // Include value-only levels too: a missing height must break continuity, not disappear.
    const levelPattern = method === 'cloud' ? /^(?:gh|cloud)-(\d+h)$/ : /^(?:gh|temp|dewPoint)-(\d+h)$/;
    const levels = [...new Set(Object.keys(series).flatMap(key => {
        const match = key.match(levelPattern);
        return match ? [match[1]] : [];
    }))].sort((a, b) => parseInt(b) - parseInt(a));
    const profiles = series.ts.filter(finite).map(timestamp => {
        const index = series.ts.indexOf(timestamp);
        const points = levels.map(level => {
            const temperature = series[`temp-${level}`]?.[index];
            const dewPoint = series[`dewPoint-${level}`]?.[index];
            // Windy supplies both temperatures in K. This is a dew-point-depression heuristic,
            // not a conversion to ice-relative saturation or a measured cloud boundary.
            const spread = finite(temperature) && temperature > 0 && finite(dewPoint) && dewPoint > 0
                ? Math.max(0, Math.round((temperature - dewPoint) * 1_000_000) / 1_000_000) : null;
            return { height: series[`gh-${level}`]?.[index],
                value: method === 'cloud' ? series[`cloud-${level}`]?.[index] : spread };
        });
        const known = (value: unknown): value is number => finite(value) && value >= 0
            && (method === 'dewpoint' || value <= 100);
        const detected = (value: number) => method === 'cloud' ? value >= threshold : value <= threshold;
        const layers: CloudLayer[] = [];
        const coverage: CloudProfile['coverage'] = { low: 'missing', medium: 'missing', high: 'missing' };
        let current: CloudLayer | null = null;
        let previous: { height: number; value: number | null | undefined } | null = null;
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
            const valueKnown = known(point.value);
            if (valueKnown) {coverage[band] = 'sampled';}
            if (!valueKnown || !detected(point.value as number)) {
                current = null;
            } else if (current) {
                current.topM = point.height;
                if (method === 'cloud') { current.cloudPercent = Math.max(current.cloudPercent, point.value as number); }
            } else {
                current = {
                    heightM: point.height,
                    baseMinimumM: previous && known(previous.value) && !detected(previous.value)
                        ? previous.height : null,
                    topM: point.height,
                    cloudPercent: method === 'cloud' ? point.value as number : 0,
                    ...(method === 'dewpoint' ? { dewPointSpreadC: point.value as number } : {}),
                    band,
                };
                layers.push(current);
            }
            previous = { height: point.height, value: point.value };
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

import metrics from '@windy/metrics';

export type WindUnit = 'kt' | 'bft' | 'm/s' | 'mph' | 'km/h';
export type TemperatureUnit = '°C' | '°F';
export type PrecipitationUnit = 'mm' | 'in';
export type DistanceUnit = 'km' | 'mi' | 'NM';
export type ElevationUnit = 'm' | 'ft';

export type UnitPreferences = {
    wind: WindUnit;
    temperature: TemperatureUnit;
    precipitation: PrecipitationUnit;
    distance: DistanceUnit;
    elevation: ElevationUnit;
};

const WIND_UNITS: ReadonlyArray<WindUnit> = ['kt', 'bft', 'm/s', 'mph', 'km/h'];
const TEMPERATURE_UNITS: ReadonlyArray<TemperatureUnit> = ['°C', '°F'];
const PRECIPITATION_UNITS: ReadonlyArray<PrecipitationUnit> = ['mm', 'in'];
const DISTANCE_UNITS: ReadonlyArray<DistanceUnit> = ['km', 'mi', 'NM'];
const ELEVATION_UNITS: ReadonlyArray<ElevationUnit> = ['m', 'ft'];

const includesUnit = <T extends string>(units: ReadonlyArray<T>, value: unknown): value is T =>
    typeof value === 'string' && units.includes(value as T);

export const currentUnitPreferences = (): UnitPreferences => ({
    wind: metrics.wind.metric as WindUnit,
    temperature: metrics.temp.metric as TemperatureUnit,
    precipitation: metrics.rain.metric as PrecipitationUnit,
    distance: metrics.distance.metric as DistanceUnit,
    elevation: metrics.elevation.metric as ElevationUnit,
});

/** Apply one Windy metric event without mutating the host preference. */
export const resolveUnitPreferencesChange = (
    current: UnitPreferences,
    ident: string | undefined,
    unit: string | undefined,
    readCurrent: () => UnitPreferences,
): UnitPreferences => {
    if (!ident) {
        return readCurrent();
    }
    if (ident === 'wind' && includesUnit(WIND_UNITS, unit)) {
        return { ...current, wind: unit };
    }
    if (ident === 'temp' && includesUnit(TEMPERATURE_UNITS, unit)) {
        return { ...current, temperature: unit };
    }
    if (ident === 'rain' && includesUnit(PRECIPITATION_UNITS, unit)) {
        return { ...current, precipitation: unit };
    }
    if (ident === 'distance' && includesUnit(DISTANCE_UNITS, unit)) {
        return { ...current, distance: unit };
    }
    if (ident === 'elevation' && includesUnit(ELEVATION_UNITS, unit)) {
        return { ...current, elevation: unit };
    }
    if (['wind', 'temp', 'rain', 'distance', 'elevation'].includes(ident)) {
        return readCurrent();
    }
    return current;
};

const formatCanonicalWindMs = (windMs: number): string =>
    String(Math.round(windMs * 10) / 10);

export const windDisplayUnit = (unit: WindUnit): string =>
    unit === 'bft' ? 'bft/m/s' : unit;

export const windThresholdUnit = (unit: WindUnit): WindUnit =>
    unit === 'bft' ? 'm/s' : unit;

export const convertWindSpeed = (
    windMs: number,
    unit: WindUnit,
    forcedPrecision?: number,
): number => metrics.wind.convertNumber(windMs, forcedPrecision, unit);

export const formatWindSpeed = (
    windMs: number,
    unit: WindUnit,
    forcedPrecision?: number,
): string => {
    const converted = String(convertWindSpeed(windMs, unit, forcedPrecision));
    return unit === 'bft' ? `${converted}/${formatCanonicalWindMs(windMs)}` : converted;
};

export const formatWindThreshold = (windMs: number, unit: WindUnit): string =>
    unit === 'bft' ? formatCanonicalWindMs(windMs) : formatWindSpeed(windMs, unit, 1);

export const formatTemperatureC = (temperatureC: number, unit: TemperatureUnit): string =>
    String(metrics.temp.convertNumber(temperatureC + 273.15, undefined, unit));

export const formatPrecipitationMm = (precipitationMm: number, unit: PrecipitationUnit): string =>
    String(metrics.rain.convertNumber(precipitationMm, unit === 'in' ? 3 : 1, unit));

export const formatDistanceKm = (distanceKm: number, unit: DistanceUnit): string => {
    const rough = metrics.distance.convertNumber(distanceKm * 1_000, 2, unit);
    const precision = Math.abs(rough) < 1 ? 2 : Math.abs(rough) < 10 ? 1 : 0;
    return String(metrics.distance.convertNumber(distanceKm * 1_000, precision, unit));
};

/** Visibility is canonicalized to 0.1 km, so retain enough converted precision for color thresholds. */
export const formatVisibilityKm = (visibilityKm: number, unit: DistanceUnit): string =>
    String(metrics.distance.convertNumber(visibilityKm * 1_000, unit === 'km' ? 1 : 2, unit));

export const formatElevationM = (elevationM: number, unit: ElevationUnit): string =>
    String(metrics.elevation.convertNumber(elevationM, 0, unit));

const formatRange = (
    range: { minimum: number; maximum: number },
    formatter: (value: number) => string,
): string => {
    const minimum = formatter(range.minimum);
    const maximum = formatter(range.maximum);
    return minimum === maximum ? minimum : `${minimum}–${maximum}`;
};

export const formatWindSpeedRange = (
    range: { minimum: number; maximum: number },
    unit: WindUnit,
): string => {
    const convertedRange = formatRange(range, value => String(convertWindSpeed(value, unit)));
    if (unit === 'bft') {
        const canonicalRange = formatRange(range, formatCanonicalWindMs);
        return `${convertedRange} bft / ${canonicalRange} m/s`;
    }
    return `${convertedRange} ${unit}`;
};

export const formatTemperatureRangeC = (
    range: { minimum: number; maximum: number },
    unit: TemperatureUnit,
): string => `${formatRange(range, value => formatTemperatureC(value, unit))} ${unit}`;

export const formatPrecipitationRangeMm = (
    range: { minimum: number; maximum: number },
    unit: PrecipitationUnit,
): string => `${formatRange(range, value => formatPrecipitationMm(value, unit))} ${unit}`;

export const formatDistanceRangeKm = (
    range: { minimum: number; maximum: number },
    unit: DistanceUnit,
): string => `${formatRange(range, value => formatDistanceKm(value, unit))} ${unit}`;

export const formatVisibilityRangeKm = (
    range: { minimum: number; maximum: number },
    unit: DistanceUnit,
): string => `${formatRange(range, value => formatVisibilityKm(value, unit))} ${unit}`;

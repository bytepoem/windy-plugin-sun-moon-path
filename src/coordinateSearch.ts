import { gcj02ToWgs84 } from './amap';
import { distanceKm, type Coordinates } from './solar';
import type { LocationSearchSelection } from './locationProvider';

export const COORDINATE_SYSTEMS = ['wgs84', 'gcj02'] as const;

export type CoordinateSystem = typeof COORDINATE_SYSTEMS[number];

export type CoordinateFieldParseResult =
    | { kind: 'empty' }
    | { kind: 'invalid'; reason: 'format' | 'latitude' | 'longitude' }
    | { kind: 'valid'; location: Coordinates };

const DECIMAL_FIELD_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

/**
 * Parses the two explicitly labelled decimal coordinate fields. Keeping the
 * fields separate removes ordering ambiguity while preserving precise range
 * errors next to the search control.
 */
export const parseCoordinateFields = (
    latitudeText: string,
    longitudeText: string,
): CoordinateFieldParseResult => {
    const normalizedLatitude = latitudeText.trim();
    const normalizedLongitude = longitudeText.trim();
    if (!normalizedLatitude && !normalizedLongitude) {
        return { kind: 'empty' };
    }
    if (!normalizedLatitude || !normalizedLongitude) {
        return { kind: 'invalid', reason: 'format' };
    }
    if (!DECIMAL_FIELD_PATTERN.test(normalizedLatitude)) {
        return { kind: 'invalid', reason: 'latitude' };
    }
    if (!DECIMAL_FIELD_PATTERN.test(normalizedLongitude)) {
        return { kind: 'invalid', reason: 'longitude' };
    }

    const lat = Number(normalizedLatitude);
    const lon = Number(normalizedLongitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        return { kind: 'invalid', reason: 'latitude' };
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
        return { kind: 'invalid', reason: 'longitude' };
    }

    return {
        kind: 'valid',
        location: {
            lat: Object.is(lat, -0) ? 0 : lat,
            lon: Object.is(lon, -0) ? 0 : lon,
        },
    };
};

/** Converts an explicitly identified coordinate system into Windy's WGS84 coordinates. */
export const coordinateToWgs84 = (
    location: Coordinates,
    system: CoordinateSystem,
): Coordinates => system === 'gcj02' ? gcj02ToWgs84(location) : { ...location };

/** Builds the normalized selection consumed by the existing location-change flow. */
export const coordinateLocationSelection = ({
    source,
    system,
    origin,
}: {
    source: Coordinates;
    system: CoordinateSystem;
    origin?: Coordinates;
}): LocationSearchSelection => {
    const wgs84 = coordinateToWgs84(source, system);
    return {
        id: `coordinate:${system}:${source.lat}:${source.lon}`,
        // An empty name deliberately requests Windy's existing reverse-name lookup.
        name: '',
        district: '',
        address: '',
        province: '',
        city: '',
        area: '',
        distanceKm: origin ? distanceKm(origin, wgs84) : null,
        wgs84,
        elevationM: undefined,
    };
};

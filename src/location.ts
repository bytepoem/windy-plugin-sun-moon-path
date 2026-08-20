import { coordinatesFromLocation, distanceKm, type Coordinates, type LocationLike } from './solar';

export type GeolocationLike = LocationLike & {
    source?: string;
};

const CURRENT_LOCATION_CENTER_TOLERANCE_KM = 1;

export const gpsCoordinatesFromLocation = (location: GeolocationLike | undefined): Coordinates | null =>
    location?.source === 'gps' ? coordinatesFromLocation(location) : null;

export const isMapCenteredOnLocation = (
    mapCenter: Coordinates,
    location: Coordinates,
    toleranceKm = CURRENT_LOCATION_CENTER_TOLERANCE_KM,
): boolean => distanceKm(mapCenter, location) <= toleranceKm;

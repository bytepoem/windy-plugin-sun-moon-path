import { coordinatesFromLocation, distanceKm, type Coordinates, type LocationLike } from './solar';

export type GeolocationLike = LocationLike & {
    source?: string;
};

export type ReverseLocationNameLike = {
    name?: string;
    region?: string;
};

const CURRENT_LOCATION_CENTER_TOLERANCE_KM = 1;
export const DETAILED_REVERSE_NAME_ZOOM = 12;

export const gpsCoordinatesFromLocation = (location: GeolocationLike | undefined): Coordinates | null =>
    location?.source === 'gps' ? coordinatesFromLocation(location) : null;

export const isMapCenteredOnLocation = (
    mapCenter: Coordinates,
    location: Coordinates,
    toleranceKm = CURRENT_LOCATION_CENTER_TOLERANCE_KM,
): boolean => distanceKm(mapCenter, location) <= toleranceKm;

export const shouldRefreshSameLocationImmediately = (
    isMounted: boolean,
    currentRefreshKey: string,
    nextRefreshKey: string,
): boolean => isMounted && currentRefreshKey === nextRefreshKey;

export const detailedLocationLabel = ({ name = '', region = '' }: ReverseLocationNameLike): string => {
    const detailedName = name.trim();
    const regionName = region.trim();
    return [detailedName, regionName]
        .filter((part, index, parts) => part && parts.indexOf(part) === index)
        .join(' · ');
};

export const isHomeButtonTarget = (target: unknown): boolean => {
    if (!target || typeof target !== 'object') {
        return false;
    }
    const closest = (target as { closest?: (selector: string) => unknown }).closest;
    if (typeof closest !== 'function') {
        return false;
    }
    return [
        '[data-ref="back2home"]',
        '.mobile-ui__icon[data-ignore="hp"][data-icon="]"]',
    ].some(selector => Boolean(closest.call(target, selector)));
};

export const scheduleReopenAfterHome = (
    reopen: () => void,
    schedule: (callback: () => void) => void = queueMicrotask,
): void => {
    // Windy closes open panes later in the same back2home broadcast dispatch.
    schedule(reopen);
};

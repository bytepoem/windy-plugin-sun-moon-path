import type { Coordinates, SolarPath } from './solar';

export type DirectionLineFitBounds = [
    [southLatitude: number, westLongitude: number],
    [northLatitude: number, eastLongitude: number],
];

interface MapViewportRect {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

interface MapViewportObstruction {
    side: 'right' | 'bottom';
    rect: MapViewportRect;
}

export interface VisibleMapViewport {
    fitPaddingTopLeft: [x: number, y: number];
    fitPaddingBottomRight: [x: number, y: number];
    centerPaddingLeft: number;
    centerPaddingTop: number;
}

/**
 * Converts Windy's shifted Leaflet container into padding for the portion of
 * the map that is actually visible beside or above the plugin panel.
 */
export const calculateVisibleMapViewport = ({
    containerRect,
    viewportWidth,
    viewportHeight,
    obstruction,
    edgePadding,
}: {
    containerRect: MapViewportRect;
    viewportWidth: number;
    viewportHeight: number;
    obstruction: MapViewportObstruction | null;
    edgePadding: number;
}): VisibleMapViewport => {
    const visibleLeft = Math.max(0, containerRect.left);
    const visibleTop = Math.max(0, containerRect.top);
    const visibleRight = Math.min(
        viewportWidth,
        containerRect.right,
        obstruction?.side === 'right' ? obstruction.rect.left : Number.POSITIVE_INFINITY,
    );
    const visibleBottom = Math.min(
        viewportHeight,
        containerRect.bottom,
        obstruction?.side === 'bottom' ? obstruction.rect.top : Number.POSITIVE_INFINITY,
    );
    const hiddenLeft = Math.max(0, visibleLeft - containerRect.left);
    const hiddenTop = Math.max(0, visibleTop - containerRect.top);
    const hiddenRight = Math.max(0, containerRect.right - visibleRight);
    const hiddenBottom = Math.max(0, containerRect.bottom - visibleBottom);

    return {
        fitPaddingTopLeft: [hiddenLeft + edgePadding, hiddenTop + edgePadding],
        fitPaddingBottomRight: [hiddenRight + edgePadding, hiddenBottom + edgePadding],
        // Windy's centerMap applies half of each padding value as the visual
        // target offset, hence the doubled-center difference below.
        centerPaddingLeft: visibleLeft + visibleRight - containerRect.left - containerRect.right,
        centerPaddingTop: visibleTop + visibleBottom - containerRect.top - containerRect.bottom,
    };
};

/**
 * Keeps a longitude on the same wrapped world copy as the observing location.
 * This prevents short lines crossing the date line from expanding the fit to
 * almost the whole globe.
 */
const unwrapLongitudeNear = (longitude: number, referenceLongitude: number): number => {
    let unwrapped = longitude;
    while (unwrapped - referenceLongitude > 180) {
        unwrapped -= 360;
    }
    while (unwrapped - referenceLongitude < -180) {
        unwrapped += 360;
    }
    return unwrapped;
};

/**
 * Builds the smallest bounds containing the currently selected event lines.
 * The outer endpoint follows the user's 400/600 km display preference so the
 * fit action represents the same geometry that is rendered on the map.
 */
export const buildDirectionLineFitBounds = ({
    location,
    paths,
    showExtendedDistanceMarker,
}: {
    location: Coordinates;
    paths: SolarPath[];
    showExtendedDistanceMarker: boolean;
}): DirectionLineFitBounds | null => {
    const endpoints = paths.flatMap(path => path.status === 'ok'
        ? path.samples.map(sample => showExtendedDistanceMarker ? sample.point600 : sample.point400)
        : []);
    if (endpoints.length === 0) {
        return null;
    }

    const points = [location, ...endpoints].map(point => ({
        lat: point.lat,
        lon: unwrapLongitudeNear(point.lon, location.lon),
    }));
    const latitudes = points.map(point => point.lat);
    const longitudes = points.map(point => point.lon);

    return [
        [Math.min(...latitudes), Math.min(...longitudes)],
        [Math.max(...latitudes), Math.max(...longitudes)],
    ];
};

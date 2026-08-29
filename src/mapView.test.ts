import { describe, expect, it } from 'vitest';

import { buildDirectionLineFitBounds, calculateVisibleMapViewport } from './mapView';
import { calculateSolarPath, dateInputToUtcNoon, destinationPoint, type SolarPath } from './solar';

const successfulPath = (location = { lat: 23.05, lon: 113.37 }): SolarPath =>
    calculateSolarPath({
        date: dateInputToUtcNoon('2026-08-29', 'Asia/Shanghai'),
        location,
        event: 'sunset',
    });

describe('direction-line map fitting', () => {
    it('uses the 400 km endpoints when the extended point is hidden', () => {
        const location = { lat: 23.05, lon: 113.37 };
        const path = successfulPath(location);
        if (path.status !== 'ok') {
            throw new Error('Expected a sunset path for the fixture');
        }

        const bounds = buildDirectionLineFitBounds({
            location,
            paths: [path],
            showExtendedDistanceMarker: false,
        });

        expect(bounds).not.toBeNull();
        expect(bounds?.[0][0]).toBe(Math.min(location.lat, ...path.samples.map(sample => sample.point400.lat)));
        expect(bounds?.[1][1]).toBe(Math.max(location.lon, ...path.samples.map(sample => sample.point400.lon)));
    });

    it('switches to the 600 km endpoints when the extended point is shown', () => {
        const location = { lat: 23.05, lon: 113.37 };
        const path = successfulPath(location);
        if (path.status !== 'ok') {
            throw new Error('Expected a sunset path for the fixture');
        }

        const compactBounds = buildDirectionLineFitBounds({
            location,
            paths: [path],
            showExtendedDistanceMarker: false,
        });
        const extendedBounds = buildDirectionLineFitBounds({
            location,
            paths: [path],
            showExtendedDistanceMarker: true,
        });

        expect(extendedBounds).not.toEqual(compactBounds);
        expect(extendedBounds?.[0][0]).toBe(Math.min(location.lat, ...path.samples.map(sample => sample.point600.lat)));
        expect(extendedBounds?.[1][1]).toBe(Math.max(location.lon, ...path.samples.map(sample => sample.point600.lon)));
    });

    it('keeps date-line-crossing endpoints on the location world copy', () => {
        const location = { lat: 0, lon: 179.5 };
        const endpoint = destinationPoint(location, 90, 600);
        const path: SolarPath = {
            status: 'ok',
            event: 'sunrise',
            eventTime: new Date('2026-08-29T00:00:00.000Z'),
            samples: [{
                kind: 'event',
                label: 'Sunrise',
                offsetMinutes: 0,
                time: new Date('2026-08-29T00:00:00.000Z'),
                azimuth: 90,
                point200: destinationPoint(location, 90, 200),
                point400: destinationPoint(location, 90, 400),
                point600: endpoint,
            }],
        };

        const bounds = buildDirectionLineFitBounds({
            location,
            paths: [path],
            showExtendedDistanceMarker: true,
        });

        expect(bounds?.[1][1]).toBeGreaterThan(180);
        expect((bounds?.[1][1] || 0) - (bounds?.[0][1] || 0)).toBeLessThan(10);
    });

    it('returns no bounds when the selected event has no rendered line', () => {
        expect(buildDirectionLineFitBounds({
            location: { lat: 89.9, lon: 0 },
            paths: [{ status: 'unavailable', event: 'sunset', reason: 'always-up' }],
            showExtendedDistanceMarker: false,
        })).toBeNull();
    });
});

describe('visible map viewport geometry', () => {
    it('accounts for Windy shifting a wide desktop map container behind both sides of the pane', () => {
        const viewport = calculateVisibleMapViewport({
            containerRect: { left: -260, top: 0, right: 1648, bottom: 1504 },
            viewportWidth: 1908,
            viewportHeight: 1504,
            obstruction: {
                side: 'right',
                rect: { left: 1388, top: 0, right: 1908, bottom: 1504 },
            },
            edgePadding: 18,
        });

        expect(viewport.fitPaddingTopLeft).toEqual([278, 18]);
        expect(viewport.fitPaddingBottomRight).toEqual([278, 18]);
        expect(viewport.centerPaddingLeft).toBe(0);
        expect(viewport.centerPaddingTop).toBe(0);
    });

    it('offsets a narrow desktop map when the pane overlays only its right side', () => {
        const viewport = calculateVisibleMapViewport({
            containerRect: { left: 0, top: 0, right: 1248, bottom: 527 },
            viewportWidth: 1248,
            viewportHeight: 527,
            obstruction: {
                side: 'right',
                rect: { left: 728, top: 0, right: 1248, bottom: 527 },
            },
            edgePadding: 18,
        });

        expect(viewport.fitPaddingTopLeft).toEqual([18, 18]);
        expect(viewport.fitPaddingBottomRight).toEqual([538, 18]);
        expect(viewport.centerPaddingLeft).toBe(-520);
        expect(viewport.centerPaddingTop).toBe(0);
    });

    it('centers compact mobile maps above the bottom panel', () => {
        const viewport = calculateVisibleMapViewport({
            containerRect: { left: 0, top: 0, right: 393, bottom: 852 },
            viewportWidth: 393,
            viewportHeight: 852,
            obstruction: {
                side: 'bottom',
                rect: { left: 0, top: 396, right: 393, bottom: 787 },
            },
            edgePadding: 18,
        });

        expect(viewport.fitPaddingTopLeft).toEqual([18, 18]);
        expect(viewport.fitPaddingBottomRight).toEqual([18, 474]);
        expect(viewport.centerPaddingLeft).toBe(0);
        expect(viewport.centerPaddingTop).toBe(-456);
    });
});

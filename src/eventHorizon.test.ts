import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEventHorizonOverlay, eventHorizonPoints, horizonDistanceKm, horizonFitBounds, layoutHorizonLabels } from './eventHorizon';
import { destinationPoint, EARTH_RADIUS_KM, type SolarEvent, type SolarPath } from './solar';
import type { DirectionPath } from './eventDirections';

const origin = { lat: 0, lon: 0 };
const path = (event: SolarEvent, azimuth: number): SolarPath => ({
    status: 'ok', event, eventTime: new Date('2026-10-13T00:00:00Z'),
    samples: [{ kind: 'event', offsetMinutes: 0, time: new Date('2026-10-13T00:00:00Z'),
        azimuth, label: event, point200: origin, point400: origin, point600: origin }],
});

afterEach(() => vi.unstubAllGlobals());

describe('horizon label placement', () => {
    const overlaps = (a: { left: number; top: number; width: number; height: number }, b: typeof a) =>
        a.left < b.left + b.width && a.left + a.width > b.left
        && a.top < b.top + b.height && a.top + a.height > b.top;

    it('separates the nearby Moon and galactic labels without covering endpoint circles', () => {
        const boxes = [
            { left: 160, top: 45, width: 90, height: 64 },
            { left: 116, top: 320, width: 90, height: 64 },
            { left: 80, top: 290, width: 90, height: 64 },
        ];
        const circles = [{ left: 178, top: 368, width: 20, height: 20 }];
        const placed = layoutHorizonLabels(boxes, circles);
        for (let index = 0; index < placed.length; index++) {
            expect(placed[index].left).toBe(boxes[index].left);
            for (const other of [...placed.slice(0, index), ...circles]) {
                expect(overlaps(placed[index], other)).toBe(false);
            }
        }
    });

    it('handles six coincident endpoints and leaves already separated labels in place', () => {
        const boxes = Array.from({ length: 6 }, () => ({ left: 100, top: 200, width: 80, height: 34 }));
        const placed = layoutHorizonLabels(boxes, []);
        for (let index = 1; index < placed.length; index++) {
            expect(placed.slice(0, index).some(other => overlaps(placed[index], other))).toBe(false);
        }
        expect(layoutHorizonLabels(placed, [])).toEqual(placed);
    });

    it('reads DOMRect-style inherited dimensions when placing later labels', () => {
        const rectangle = { left: 100, top: 200, width: 80, height: 34 };
        const placed = layoutHorizonLabels([Object.create(rectangle), Object.create(rectangle)], []);
        expect(placed[0]).toEqual(rectangle);
        expect(overlaps(placed[0], placed[1])).toBe(false);
    });
});

describe('geometric horizon', () => {
    it('matches sea-level and elevated observations, using surface distance rather than slant distance', () => {
        expect(horizonDistanceKm(0)).toBe(0);
        expect(horizonDistanceKm(2)).toBeCloseTo(5.048, 3);
        expect(horizonDistanceKm(100)).toBeCloseTo(35.696, 3);
        const heightKm = 12;
        const angle = horizonDistanceKm(heightKm * 1000)! / EARTH_RADIUS_KM;
        expect(Math.cos(angle) * (EARTH_RADIUS_KM + heightKm)).toBeCloseTo(EARTH_RADIUS_KM, 9);
        expect(horizonDistanceKm(12000)).toBeLessThan(Math.sqrt(heightKm * (2 * EARTH_RADIUS_KM + heightKm)));
        expect(horizonDistanceKm(0.000001)).toBeGreaterThan(0);
    });

    it.each([undefined, NaN, Infinity, -1, 12001])('rejects invalid height %s instead of claiming clearance', height => {
        expect(horizonDistanceKm(height)).toBeNull();
    });

    it('locates all four available event bearings at the calculated surface distance', () => {
        const points = eventHorizonPoints(origin, [path('sunrise', 90), path('moonrise', 0), path('sunset', 270), path('moonset', 180)], 10);
        expect(points).toHaveLength(4);
        expect(points[0].point.lat).toBeCloseTo(0);
        expect(points[0].point.lon * Math.PI / 180 * EARTH_RADIUS_KM).toBeCloseTo(10);
        expect(points[1].point.lon).toBeCloseTo(0);
        expect(points[1].point.lat * Math.PI / 180 * EARTH_RADIUS_KM).toBeCloseTo(10);
        expect(points[2].point.lon * Math.PI / 180 * EARTH_RADIUS_KM).toBeCloseTo(-10);
        expect(points[3].point.lat * Math.PI / 180 * EARTH_RADIUS_KM).toBeCloseTo(-10);
        expect(eventHorizonPoints(origin, [{ status: 'unavailable', event: 'moonrise', reason: 'always-up' }], 10)).toEqual([]);
        expect(eventHorizonPoints(origin, [path('sunrise', 90)], null)).toEqual([]);
        expect(eventHorizonPoints(origin, [path('sunrise', NaN)], 10)).toEqual([]);
    });

    it('follows each toolbar selection, including galactic rise/set and the All overview', () => {
        const paths: DirectionPath[] = [
            path('sunrise', 90), path('sunset', 270), path('moonrise', 110), path('moonset', 250),
            { ...path('sunrise', 130), event: 'milkywayrise', eventLabel: '银心升起' },
            { ...path('sunset', 230), event: 'milkywayset', eventLabel: '银心落下' },
        ];
        expect(eventHorizonPoints(origin, paths, 10, 'all')).toHaveLength(6);
        for (const candidate of paths) {
            const points = eventHorizonPoints(origin, paths, 10, candidate.event);
            expect(points.map(point => point.event)).toEqual([candidate.event]);
        }
        expect(eventHorizonPoints(origin, paths.slice(0, 4), 10, 'milkywayrise')).toEqual([]);
    });

    it.each([{ lat: 23, lon: 113 }, { lat: 70, lon: 179.99 }, { lat: -60, lon: -179.99 }])(
        'fits every bearing within the full circle at %j without expanding across the date line', location => {
            const distance = horizonDistanceKm(100)!;
            const [[south, west], [north, east]] = horizonFitBounds(location, distance)!;
            expect(east - west).toBeLessThan(2);
            for (let bearing = 0; bearing < 360; bearing += 1) {
                const point = destinationPoint(location, bearing, distance);
                const longitude = location.lon + ((point.lon - location.lon + 540) % 360 - 180);
                expect(point.lat).toBeGreaterThanOrEqual(south - 1e-9);
                expect(point.lat).toBeLessThanOrEqual(north + 1e-9);
                expect(longitude).toBeGreaterThanOrEqual(west - 1e-9);
                expect(longitude).toBeLessThanOrEqual(east + 1e-9);
            }
        },
    );

    it('handles zero height, invalid distance and circles reaching a pole', () => {
        expect(horizonFitBounds(origin, 0)).toEqual([[0, 0], [0, 0]]);
        expect(horizonFitBounds(origin, null)).toBeNull();
        expect(horizonFitBounds(origin, NaN)).toBeNull();
        const [[south, west], [north, east]] = horizonFitBounds({ lat: 89.99, lon: 100 }, 10)!;
        expect(south).toBeLessThan(89.99);
        expect(north).toBe(90);
        expect(east - west).toBe(360);
    });

    it('splits dateline rays, replaces old layers and clears markers on destroy', () => {
        const groups: { addTo: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> }[] = [];
        const marker = vi.fn(function (_point: [number, number], _options: L.MarkerOptions) {
            const instance = { addTo: vi.fn(), getElement: vi.fn() };
            instance.addTo.mockReturnValue(instance);
            return instance;
        });
        let rendererScale = 1;
        const lineElements: { getScreenCTM: ReturnType<typeof vi.fn>; setAttribute: ReturnType<typeof vi.fn> }[] = [];
        const line = vi.fn(function () {
            const element = {
                getScreenCTM: vi.fn(() => ({ a: rendererScale, b: 0 })),
                setAttribute: vi.fn(),
            };
            lineElements.push(element);
            const instance = { addTo: vi.fn() };
            instance.addTo.mockReturnValue(instance);
            return instance;
        });
        const icon = vi.fn(function (options: L.DivIconOptions) { return options; });
        vi.stubGlobal('L', {
            LayerGroup: vi.fn(function () {
                const group = { addTo: vi.fn(), remove: vi.fn() };
                group.addTo.mockReturnValue(group);
                groups.push(group);
                return group;
            }),
            Marker: marker, Polyline: line, DivIcon: icon,
        });
        const map = {
            on: vi.fn(), off: vi.fn(),
            getContainer: () => ({ querySelectorAll: () => lineElements }),
        };
        const overlay = createEventHorizonOverlay(map as unknown as L.LeafletGlMap);
        const location = { lat: 0, lon: 179.99 };
        const points = eventHorizonPoints(location, [path('sunrise', 90)], 10);
        overlay.render(location, points, '10 km', 'zh', 100);
        expect(line).toHaveBeenCalledTimes(2);
        expect(marker).toHaveBeenCalledTimes(2);
        expect(marker.mock.calls[0][0]).toEqual([location.lat, location.lon]);
        expect(icon.mock.calls[0][0].html).toContain('当前定位点');
        expect(icon.mock.calls[0][0].className).toContain('event-horizon-origin');
        // Windy scales the SVG container during zoom, then resets it after
        // reprojecting. Both stroke width and dash spacing must stay in pixels.
        const zoom = map.on.mock.calls.find(([event]) => event === 'zoom')?.[1];
        expect(zoom).toBeTypeOf('function');
        for (const scale of [16, 0.25]) {
            rendererScale = scale;
            zoom!();
            for (const element of lineElements) {
                expect(element.setAttribute).toHaveBeenCalledWith('stroke-width', String(3 / scale));
                expect(element.setAttribute).toHaveBeenCalledWith('stroke-dasharray', `${4 / scale} ${5 / scale}`);
            }
        }
        rendererScale = 1;
        for (const event of ['moveend', 'viewreset']) {
            const update = map.on.mock.calls.filter(([name]) => name === event).at(-1)?.[1];
            expect(update).toBe(zoom);
            update!();
            for (const element of lineElements) {
                expect(element.setAttribute).toHaveBeenLastCalledWith('stroke-dasharray', '4 5');
                expect(element.setAttribute).toHaveBeenCalledWith('stroke-width', '3');
            }
        }
        overlay.render(location, points, '6.2 mi', 'en', 50);
        expect(groups[0].remove).toHaveBeenCalledOnce();
        const nextLocation = { lat: 23, lon: 113 };
        const lineCount = line.mock.calls.length;
        overlay.render(nextLocation, [], '—', 'en', 0);
        expect(groups[1].remove).toHaveBeenCalledOnce();
        expect(marker.mock.calls.at(-1)?.[0]).toEqual([23, 113]);
        expect(icon.mock.calls.at(-1)?.[0].html).toContain('Selected location');
        expect(line).toHaveBeenCalledTimes(lineCount);
        overlay.destroy();
        expect(groups).toHaveLength(3);
        expect(groups[2].remove).toHaveBeenCalledOnce();
        overlay.render(location, points, '10 km', 'zh', 100);
        overlay.destroy();
        overlay.destroy();
        expect(groups[3].remove).toHaveBeenCalledOnce();
        const allEvents = eventHorizonPoints(origin, [path('sunrise', 90), path('sunset', 270), path('moonrise', 100), path('moonset', 260)], 10);
        overlay.render(origin, allEvents, '10 km', 'zh', 100);
        const labels = icon.mock.calls.slice(-4).map(([options]) => options.html);
        expect(labels.join(' ')).toContain('日落地平线');
        expect(labels.join(' ')).toContain('月落地平线');
        const galactic: DirectionPath = { ...path('sunrise', 130), event: 'milkywayrise', eventLabel: '银心升起' };
        overlay.render(origin, eventHorizonPoints(origin, [galactic], 10, 'milkywayrise'), '10 km', 'zh', 100);
        expect(icon.mock.calls.at(-1)?.[0].html).toContain('银心升起地平线');
        expect(icon.mock.calls.at(-1)?.[0].html).toContain('#9de0b7');
        overlay.destroy();
        for (const event of ['zoomend', 'moveend', 'resize']) {
            expect(map.on).toHaveBeenCalledWith(event, expect.any(Function));
        }
        expect(map.off.mock.calls).toEqual(map.on.mock.calls);
    });
});

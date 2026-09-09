import { describe, expect, it, vi } from 'vitest';

import { cloudMapDirections } from './cloudGeometry';
import { createMapOverlayController, type MapOverlayRuntime } from './mapOverlayController';
import { destinationPoint, calculateCurrentMoonInfo, calculateCurrentSolarDirection, calculateSolarPath } from './solar';

const location = { lat: 23.1291, lon: 113.2644 };

const createRuntime = () => {
    const groups: { remove: ReturnType<typeof vi.fn> }[] = [];
    const markers: { tooltip: string; addTo: ReturnType<typeof vi.fn>; bindTooltip: ReturnType<typeof vi.fn> }[] = [];
    const lines: {
        points: [number, number][];
        options: L.PolylineOptions;
        addTo: ReturnType<typeof vi.fn>;
        remove: ReturnType<typeof vi.fn>;
        setStyle: ReturnType<typeof vi.fn>;
    }[] = [];
    const runtime: MapOverlayRuntime = {
        createLayerGroup: () => {
            const group = { remove: vi.fn() };
            groups.push(group);
            return group as unknown as L.LayerGroup;
        },
        createDivIcon: options => ({ options }) as unknown as L.DivIcon,
        createMarker: () => {
            const marker = {
                tooltip: '',
                on: vi.fn(), off: vi.fn(), closeTooltip: vi.fn(), unbindTooltip: vi.fn(),
                addTo: vi.fn(function addTo() {
                    return marker;
                }),
                bindTooltip: vi.fn(function bindTooltip(value: string) {
                    marker.tooltip = value;
                    return marker;
                }),
            };
            markers.push(marker);
            return marker as unknown as L.Marker;
        },
        createPolyline: (latLngs, options) => {
            const line = {
                points: latLngs,
                options,
                addTo: vi.fn(function addTo() {
                    return line;
                }),
                remove: vi.fn(),
                setStyle: vi.fn(),
            };
            lines.push(line);
            return line as unknown as L.Polyline;
        },
    };
    return { runtime, groups, markers, lines };
};

describe('map overlay controller', () => {
    it.each([true, false])('renders event rays with distance markers enabled=%s', showDistanceMarkers => {
        const { runtime, groups, markers, lines } = createRuntime();
        const controller = createMapOverlayController({} as L.LeafletGlMap, runtime);
        const eventDate = new Date('2026-08-24T04:00:00Z');
        const path = calculateSolarPath({
            date: eventDate,
            dateInput: '2026-08-24',
            timeZone: 'Asia/Shanghai',
            location,
            event: 'sunset',
        });

        controller.render({
            location,
            paths: [path],
            currentSun: calculateCurrentSolarDirection({ date: eventDate, location }),
            currentMoon: calculateCurrentMoonInfo({ date: eventDate, location }),
            showExtendedDistanceMarker: true,
            showDistanceMarkers,
            directionRangeKm: showDistanceMarkers ? null : 900,
            opacityPercent: 80,
            originLabel: 'Observer',
            eventNames: {
                sunrise: 'Sunrise',
                sunset: 'Sunset',
                moonrise: 'Moonrise',
                moonset: 'Moonset',
            },
            formatDistance: value => `${value} km`,
        });

        if (!showDistanceMarkers && path.status === 'ok') {
            path.samples.forEach((sample, index) => {
                const endpoint = destinationPoint(location, sample.azimuth, 900);
                expect(lines[index].points.at(-1)).toEqual([endpoint.lat, endpoint.lon]);
                expect(lines[index].points.length).toBeGreaterThan(3);
            });
        }
        expect(groups).toHaveLength(1);
        expect(markers).toHaveLength(showDistanceMarkers ? 10 : 1);
        expect(markers[0].tooltip).toBe('Observer');
        expect(lines).toHaveLength(5);
        expect(lines[0].options.opacity).toBeCloseTo(0.76);
        expect(lines.at(-1)?.options.opacity).toBeCloseTo(0.76);
    });

    it('updates current directions without recreating event lines', () => {
        const { runtime, lines } = createRuntime();
        const controller = createMapOverlayController({} as L.LeafletGlMap, runtime);
        const date = new Date('2026-08-24T04:00:00Z');
        const path = calculateSolarPath({
            date,
            dateInput: '2026-08-24',
            timeZone: 'Asia/Shanghai',
            location,
            event: 'sunrise',
        });
        const currentSun = calculateCurrentSolarDirection({ date, location });

        controller.render({
            location,
            paths: [path],
            currentSun,
            currentMoon: null,
            showExtendedDistanceMarker: false,
            showDistanceMarkers: true,
            directionRangeKm: null,
            opacityPercent: 100,
            originLabel: 'Observer',
            eventNames: { sunrise: 'Sunrise', sunset: 'Sunset', moonrise: 'Moonrise', moonset: 'Moonset' },
            formatDistance: value => `${value} km`,
        });
        const eventLines = lines.slice(0, 3);
        const previousCurrentLine = lines[3];

        controller.updateCurrent({ location, currentSun, currentMoon: null, opacityPercent: 100 });

        expect(eventLines.every(line => line.remove.mock.calls.length === 0)).toBe(true);
        expect(previousCurrentLine.remove).toHaveBeenCalledOnce();
        expect(lines).toHaveLength(5);
    });

    it('updates opacity using each line semantic base opacity and destroys the group', () => {
        const { runtime, groups, lines } = createRuntime();
        const controller = createMapOverlayController({} as L.LeafletGlMap, runtime);
        const date = new Date('2026-08-24T04:00:00Z');
        const moonPath = calculateSolarPath({
            date,
            dateInput: '2026-08-24',
            timeZone: 'Asia/Shanghai',
            location,
            event: 'moonrise',
        });

        controller.render({
            location,
            paths: [moonPath],
            currentSun: null,
            currentMoon: null,
            showExtendedDistanceMarker: false,
            showDistanceMarkers: true,
            directionRangeKm: null,
            opacityPercent: 100,
            originLabel: 'Observer',
            eventNames: { sunrise: 'Sunrise', sunset: 'Sunset', moonrise: 'Moonrise', moonset: 'Moonset' },
            formatDistance: value => `${value} km`,
        });
        controller.setOpacity(50);
        controller.destroy();

        expect(lines[0].setStyle).toHaveBeenCalledWith({ opacity: 0.41 });
        expect(groups[0].remove).toHaveBeenCalledOnce();
    });
});


it('draws the sampled galactic bearing without a solar or lunar event path', () => {
    const { runtime, groups, lines } = createRuntime();
    const controller = createMapOverlayController({} as L.LeafletGlMap, runtime);
    const directions = cloudMapDirections(Date.parse('2026-09-09T12:07:00Z'), location, 'milkyway');
    controller.render({
        location, paths: [], ...directions,
        showExtendedDistanceMarker: false, showDistanceMarkers: false, directionRangeKm: 500,
        opacityPercent: 50, originLabel: 'Observer',
        eventNames: { sunrise: 'Sunrise', sunset: 'Sunset', moonrise: 'Moonrise', moonset: 'Moonset' },
        formatDistance: value => `${value} km`,
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].options.color).toBe('#9de0b7');
    expect(lines[0].options.smoothFactor).toBe(0);
    expect(lines[0].points).toEqual(directions.currentGalacticCenter!.points.map(point => [point.lat, point.lon]));
    controller.updateCurrent({ location, ...directions, opacityPercent: 50 });
    expect(lines[0].remove).toHaveBeenCalledOnce();
    expect(lines).toHaveLength(2);
    controller.destroy();
    expect(groups[0].remove).toHaveBeenCalledOnce();
});

import { describe, expect, it, vi } from 'vitest';

import { createMapOverlayController, type MapOverlayRuntime } from './mapOverlayController';
import { calculateCurrentMoonInfo, calculateCurrentSolarDirection, calculateSolarPath } from './solar';

const location = { lat: 23.1291, lon: 113.2644 };

const createRuntime = () => {
    const groups: { remove: ReturnType<typeof vi.fn> }[] = [];
    const markers: { tooltip: string; addTo: ReturnType<typeof vi.fn>; bindTooltip: ReturnType<typeof vi.fn> }[] = [];
    const lines: {
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
        createPolyline: (_latLngs, options) => {
            const line = {
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
    it('renders event markers and current directions behind one interface', () => {
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
            opacityPercent: 80,
            originLabel: 'Observer',
            eventNames: {
                sunrise: 'Sunrise',
                sunset: 'Sunset',
                moonrise: 'Moonrise',
                moonset: 'Moonset',
            },
        });

        expect(groups).toHaveLength(1);
        expect(markers).toHaveLength(10);
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
            opacityPercent: 100,
            originLabel: 'Observer',
            eventNames: { sunrise: 'Sunrise', sunset: 'Sunset', moonrise: 'Moonrise', moonset: 'Moonset' },
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
            opacityPercent: 100,
            originLabel: 'Observer',
            eventNames: { sunrise: 'Sunrise', sunset: 'Sunset', moonrise: 'Moonrise', moonset: 'Moonset' },
        });
        controller.setOpacity(50);
        controller.destroy();

        expect(lines[0].setStyle).toHaveBeenCalledWith({ opacity: 0.41 });
        expect(groups[0].remove).toHaveBeenCalledOnce();
    });
});

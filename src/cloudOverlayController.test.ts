import { describe, expect, it, vi } from 'vitest';
import { createCloudOverlayController, type CloudOverlayState } from './cloudOverlayController';
import type { MapOverlayRuntime } from './mapOverlayController';

vi.mock('./unitPreferences', () => ({
    formatDistanceKm: (value: number) => value.toFixed(0),
    formatElevationM: (value: number) => value.toFixed(0),
}));

const state: CloudOverlayState = {
    location: { lat: 23, lon: 113 },
    position: { altitude: 10, azimuth: 270, sightlineAvailable: true }, sunAzimuth: 270,
    layers: [{ heightM: 6000, topM: 6000, baseMinimumM: null, cloudPercent: 50, band: 'high' }],
    twilight: true, opacity: 85, language: 'zh',
    units: { distance: 'km', elevation: 'm', wind: 'm/s', temperature: '°C', precipitation: 'mm' },
};

describe('cloud map ownership', () => {
    it('replaces its group, removes disabled layers and makes repeated destruction safe', () => {
        const groups: { remove: ReturnType<typeof vi.fn> }[] = [];
        const lines: L.PolylineOptions[] = [];
        const node = { addTo: () => node, bindTooltip: () => node,
            on: vi.fn(), off: vi.fn(), closeTooltip: vi.fn(), unbindTooltip: vi.fn(),
            getElement: () => ({ querySelector: () => ({ getBoundingClientRect: () => ({ width: 24 }) }) }) };
        const runtime: MapOverlayRuntime = {
            createLayerGroup: () => {
                const group = { remove: vi.fn() };
                groups.push(group);
                return group as unknown as L.LayerGroup;
            },
            createDivIcon: () => ({} as L.DivIcon),
            createMarker: () => node as unknown as L.Marker,
            createPolyline: (_points, options) => {
                lines.push(options);
                return node as unknown as L.Polyline;
            },
        };
        const map = { on: vi.fn(), off: vi.fn(), getZoom: () => 7 };
        const controller = createCloudOverlayController(map as unknown as L.LeafletGlMap, runtime);
        controller.render(state);
        const mouseOut = node.on.mock.calls[0][1];
        mouseOut();
        expect(node.closeTooltip).toHaveBeenCalledOnce();
        const closeOnMove = map.on.mock.calls.find(([event]) => event === 'movestart')![1];
        closeOnMove();
        expect(node.closeTooltip.mock.calls.length).toBeGreaterThan(1);
        expect(lines).toHaveLength(4);
        expect(lines.every(line => line.opacity === 0.85)).toBe(true);
        controller.render({ ...state, twilight: false });
        expect(groups[0].remove).toHaveBeenCalledOnce();
        expect(lines).toHaveLength(5);
        controller.render({ ...state, layers: [] });
        expect(groups).toHaveLength(2);
        expect(groups[1].remove).toHaveBeenCalledOnce();
        controller.destroy();
        expect(groups[1].remove).toHaveBeenCalledOnce();
        expect(map.off).toHaveBeenCalledTimes(8);
        expect(map.off.mock.calls[0]).toEqual(['zoomend', map.on.mock.calls[0][1]]);
        expect(node.unbindTooltip).toHaveBeenCalled();
        expect(node.off).toHaveBeenCalledWith('mouseout', mouseOut);
    });
});

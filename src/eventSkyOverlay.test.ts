import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEventSkyOverlay, eventSkyGeometry, eventSkySvg, type EventSkyState } from './eventSkyOverlay';
import { projectRainbowDirection } from './rainbowGeometry';

const state: EventSkyState = {
    location: { lat: 23.13, lon: 113.26 }, timestamp: Date.parse('2026-09-28T12:05:00Z'),
    timeLabel: '银心落 · 2026-09-28 20:05', language: 'zh', opacity: 85,
};

afterEach(() => vi.unstubAllGlobals());

describe('event sky chart', () => {
    it('projects a closed galactic equator with both hemispheres and a centre on the band', () => {
        const geometry = eventSkyGeometry(state.timestamp, state.location);
        expect(geometry.band[0].azimuth).toBeCloseTo(geometry.band.at(-1)!.azimuth, 8);
        expect(geometry.band.some(point => point.altitude > 0)).toBe(true);
        expect(geometry.band.some(point => point.altitude < 0)).toBe(true);
        const center = projectRainbowDirection(geometry.center, 106);
        const nearest = Math.min(...geometry.band.map(point => {
            const projected = projectRainbowDirection(point, 106);
            return Math.hypot(projected.x - center.x, projected.y - center.y);
        }));
        expect(nearest).toBeLessThan(1);
        for (const point of geometry.band) {
            const projected = projectRainbowDirection(point, 106);
            expect(Math.hypot(projected.x, projected.y)).toBeLessThanOrEqual(106.000001);
        }
        const later = eventSkyGeometry(state.timestamp + 3 * 3600_000, state.location);
        expect(Math.abs(later.center.altitude - geometry.center.altitude)).toBeGreaterThan(10);
        expect(later.band[90].altitude).not.toBeCloseTo(geometry.band[90].altitude);
    });

    it('distinguishes below-horizon directions, includes all bodies and escapes the time label', () => {
        const svg = eventSkySvg({ ...state, timeLabel: '<now & then>' });
        expect(svg).toContain('event-sky-sun');
        expect(svg).toContain('event-sky-moon');
        expect(svg).toContain('event-sky-center');
        expect(svg).toContain('太阳 ↓');
        expect(svg).toContain('stroke-dasharray="3 5"');
        expect(svg).toContain('&lt;now &amp; then&gt;');
        expect(svg).not.toMatch(/NaN|Infinity/);
        expect(eventSkySvg({ ...state, language: 'en', opacity: 0 })).toContain('opacity="0"');
    });

    it('reuses one marker and removes it immediately on destroy without new listeners', () => {
        const node = { addTo: vi.fn(), setLatLng: vi.fn(), setIcon: vi.fn(), remove: vi.fn() };
        node.addTo.mockReturnValue(node);
        node.setLatLng.mockReturnValue(node);
        const marker = vi.fn(function () { return node; });
        vi.stubGlobal('L', { Marker: marker, DivIcon: vi.fn(function (options) { return options; }) });
        const map = { on: vi.fn() };
        const overlay = createEventSkyOverlay(map as unknown as L.LeafletGlMap);
        overlay.render(state);
        overlay.render({ ...state, location: { lat: 40, lon: -73 } });
        expect(marker).toHaveBeenCalledOnce();
        expect(node.setLatLng).toHaveBeenCalledWith([40, -73]);
        expect(map.on).not.toHaveBeenCalled();
        overlay.destroy();
        overlay.destroy();
        expect(node.remove).toHaveBeenCalledOnce();
        overlay.render(state);
        expect(marker).toHaveBeenCalledTimes(2);
        overlay.destroy();
        expect(node.remove).toHaveBeenCalledTimes(2);
    });
});

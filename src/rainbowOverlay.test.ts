import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRainbowOverlay, rainbowOverlaySvg, type RainbowOverlayState } from './rainbowOverlay';

const state: RainbowOverlayState = {
    location: { lat: 23, lon: 113 }, source: { altitude: 20, azimuth: 260 },
    body: 'sun',
    secondary: false, fullCircle: false, opacity: 85, language: 'zh',
};
afterEach(() => vi.unstubAllGlobals());

describe('rainbow map overlay', () => {
    it('separates full-circle and secondary settings but hides bows below the source horizon', () => {
        const single = rainbowOverlaySvg(state);
        const double = rainbowOverlaySvg({ ...state, secondary: true });
        expect(single).not.toContain('stroke-dasharray');
        expect(rainbowOverlaySvg({ ...state, fullCircle: true })).toContain('stroke-dasharray');
        expect(double.match(/<path /g)!.length).toBeGreaterThan(single.match(/<path /g)!.length);
        for (const fullCircle of [false, true]) {
            expect(rainbowOverlaySvg({ ...state, source: { altitude: -1.9, azimuth: 270.6 }, secondary: true, fullCircle })).not.toContain('<path ');
        }
        expect(rainbowOverlaySvg({ ...state, source: null })).not.toContain('<path ');
    });

    it('renders the selected light source rather than leaving a solar marker in Moon mode', () => {
        const moonState: RainbowOverlayState = { ...state, body: 'moon', source: { altitude: 15, azimuth: 90 } };
        const svg = rainbowOverlaySvg(moonState);
        expect(svg).toContain('月亮 90.0°');
        expect(svg).not.toContain('太阳');
        expect(svg).toContain('rainbow-moon-icon');
        expect(svg).toContain('x2="106"');
        const night = rainbowOverlaySvg({ ...moonState, source: { altitude: -10, azimuth: 270 } });
        expect(night).toContain('月亮 ↓ 270.0°');
        expect(night).toContain('stroke-dasharray="4 3"');
        expect(night).not.toContain('class="rainbow-band"');
        expect(rainbowOverlaySvg(state)).toContain('太阳 260.0°');
        expect(rainbowOverlaySvg(state)).not.toContain('rainbow-moon-icon');
        expect(rainbowOverlaySvg({ ...state, source: null })).not.toContain('class="rainbow-source-bearing"');
    });

    it('places the opposite-source target at the antipodal direction and hides it with a below-horizon source', () => {
        const svg = rainbowOverlaySvg({ ...state, source: { altitude: 60, azimuth: 270 } });
        const position = svg.match(/class="rainbow-opposite-source" transform="translate\(([^,]+),([^)]+)\)"/)!;
        expect(Number(position[1])).toBeCloseTo(53);
        expect(Number(position[2])).toBeCloseTo(0);
        expect(svg).toContain('反太阳点');
        expect(rainbowOverlaySvg({ ...state, body: 'moon' })).toContain('反月亮点');
        for (const source of [null, { altitude: -1, azimuth: 270 }]) {
            expect(rainbowOverlaySvg({ ...state, source, fullCircle: true })).not.toContain('rainbow-opposite-source');
        }
    });

    it('keeps seven distinct screen-space stripes and reverses the secondary colours', () => {
        const svg = rainbowOverlaySvg({ ...state, secondary: true });
        const stripes = [...svg.matchAll(/class="rainbow-band" d="([^"]+)" stroke="([^"]+)"/g)];
        expect(stripes).toHaveLength(14);
        expect(new Set(stripes.slice(0, 7).map(match => match[1])).size).toBe(7);
        expect(stripes.slice(7).map(match => match[2])).toEqual(stripes.slice(0, 7).map(match => match[2]).reverse());
        // At the bow top (east, source west), stripe centres span 4.8 pixels,
        // plus two half-width edges for the 5.6-pixel band.
        const east = rainbowOverlaySvg({ ...state, source: { altitude: 20, azimuth: 270 } });
        const topXs = [...east.matchAll(/class="rainbow-band" d="([^"]+)"/g)].map(match =>
            Math.max(...[...match[1].matchAll(/[ML](-?[\d.]+),/g)].map(point => Number(point[1]))));
        expect(topXs[0] - topXs[6]).toBeCloseTo(4.8);
        // Increasing optical radius raises the top towards the zenith (smaller x).
        expect(topXs[6]).toBeLessThan(topXs[0]);
        const full = rainbowOverlaySvg({ ...state, fullCircle: true, source: { altitude: 20, azimuth: 270 } });
        const below = [...full.matchAll(/class="rainbow-band" d="([^"]+)" stroke="([^"]+)"[^>]*stroke-dasharray/g)];
        const minimumX = (colour: string) => Math.min(...below.filter(match => match[2] === colour)
            .flatMap(match => [...match[1].matchAll(/[ML](-?[\d.]+),/g)].map(point => Number(point[1]))));
        // The lower part folds into the chart; its outward optical edge is also
        // closer to the chart centre at the bottom of this west-lit cone.
        expect(minimumX('#ee7067')).toBeLessThan(minimumX('#9b70e8'));
    });

    it('aligns altitude grid radii with the orthographic sky projection', () => {
        const svg = rainbowOverlaySvg(state);
        const radii = [...svg.matchAll(/<circle r="([\d.]+)" stroke-opacity/g)].map(match => Number(match[1]));
        expect(radii).toHaveLength(3);
        expect(radii[0]).toBeCloseTo(106);
        expect(radii[1]).toBeCloseTo(106 * Math.cos(Math.PI / 6));
        expect(radii[2]).toBeCloseTo(53);
    });

    it('reuses its marker, tracks location changes and destroys it idempotently without listeners', () => {
        const node = { addTo: vi.fn(), setLatLng: vi.fn(), setIcon: vi.fn(), remove: vi.fn() };
        node.addTo.mockReturnValue(node);
        node.setLatLng.mockReturnValue(node);
        node.setIcon.mockReturnValue(node);
        const marker = vi.fn(function () { return node; });
        vi.stubGlobal('L', { Marker: marker, DivIcon: vi.fn(function (options) { return options; }) });
        const map = { on: vi.fn(), off: vi.fn() };
        const overlay = createRainbowOverlay(map as unknown as L.LeafletGlMap);
        overlay.render(state);
        overlay.render({ ...state, location: { lat: 30, lon: 120 } });
        expect(marker).toHaveBeenCalledOnce();
        expect(node.setLatLng).toHaveBeenCalledWith([30, 120]);
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

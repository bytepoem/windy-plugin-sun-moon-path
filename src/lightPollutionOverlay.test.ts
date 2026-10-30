import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLightPollutionOverlayController, type LightPollutionOverlayRuntime, type LightPollutionOverlayStatus } from './lightPollutionOverlay';

afterEach(() => vi.unstubAllGlobals());

const setup = () => {
    const callbacks = new Map<number, () => void>();
    const listeners = new Set<() => void>();
    const layers: { state: { loading: boolean; failed: boolean; hasData: boolean }; remove: ReturnType<typeof vi.fn>; setOpacity: ReturnType<typeof vi.fn> }[] = [];
    let latitude = 30;
    let time = 0;
    let frameId = 0;
    const map = {
        getCenter: () => ({ lat: latitude }),
        on: (_event: string, fn: () => void) => listeners.add(fn),
        off: (_event: string, fn: () => void) => listeners.delete(fn),
    } as unknown as L.LeafletGlMap;
    const runtime: LightPollutionOverlayRuntime = {
        createLayer: vi.fn((_map, opacity) => {
            const layer = {
                state: { loading: true, failed: false, hasData: false },
                remove: vi.fn(),
                setOpacity: vi.fn(),
                readState: () => layer.state,
            };
            layer.setOpacity(opacity);
            layers.push(layer);
            return layer;
        }),
        requestAnimationFrame: callback => {
            callbacks.set(++frameId, callback);
            return frameId;
        },
        cancelAnimationFrame: id => { callbacks.delete(id); },
        now: () => time,
    };
    const statuses: LightPollutionOverlayStatus[] = [];
    const controller = createLightPollutionOverlayController(map, status => statuses.push(status), runtime);
    return {
        controller, runtime, callbacks, layers, listeners, statuses,
        move: (lat: number) => { latitude = lat; listeners.forEach(fn => fn()); },
        advance: (ms = 16) => {
            time += ms;
            const pending = [...callbacks.values()];
            callbacks.clear();
            pending.forEach(fn => fn());
        },
    };
};

describe('static light pollution overlay lifecycle', () => {
    it('restores 0% without a false timeout and starts loading when opacity increases', () => {
        const s = setup();
        s.controller.setOpacity(0);
        s.controller.setEnabled(true);
        expect(s.statuses.at(-1)).toBe('transparent');
        expect(s.layers).toHaveLength(0);
        expect(s.callbacks.size).toBe(0);
        s.advance(30_000);
        expect(s.statuses.at(-1)).toBe('transparent');
        s.controller.setOpacity(50);
        expect(s.layers).toHaveLength(1);
        expect(s.statuses.at(-1)).toBe('loading');
        s.controller.setOpacity(0);
        expect(s.callbacks.size).toBe(0);
        s.controller.setOpacity(70);
        expect(s.layers).toHaveLength(1);
        s.layers[0].state = { loading: false, failed: false, hasData: true };
        s.advance();
        expect(s.statuses.at(-1)).toBe('ready');
    });

    it('updates the renderer through MapLibre instead of the ineffective Windy TileLayer setter', () => {
        let renderedOpacity = 0.5;
        vi.stubGlobal('L', {
            TileLayer: class {
                id = 'sun-path-light-pollution';
                addTo() { return this; }
                remove() { /* No browser resources in this SDK contract fixture. */ }
                setOpacity() { /* Current Windy setter leaves the rendered paint unchanged. */ }
            },
        });
        vi.stubGlobal('requestAnimationFrame', () => 1);
        vi.stubGlobal('cancelAnimationFrame', vi.fn());
        const map = {
            getCenter: () => ({ lat: 30 }),
            on: vi.fn(), off: vi.fn(),
            maplibreMap: {
                setPaintProperty: (id: string, property: string, value: number) => {
                    expect(id).toBe('sun-path-light-pollution');
                    expect(property).toBe('raster-opacity');
                    renderedOpacity = value;
                },
            },
        } as unknown as L.LeafletGlMap;
        const controller = createLightPollutionOverlayController(map, () => undefined);
        controller.setEnabled(true);
        controller.setOpacity(100);
        expect(renderedOpacity).toBe(1);
        controller.setOpacity(0);
        expect(renderedOpacity).toBe(0);
        controller.destroy();
    });

    it('loads only when enabled, waits for its own tiles and changes opacity without refetching', () => {
        const s = setup();
        expect(s.layers).toHaveLength(0);
        s.controller.setOpacity(35);
        s.controller.setEnabled(true);
        expect(s.statuses).toEqual(['loading']);
        expect(s.layers[0].setOpacity).toHaveBeenLastCalledWith(0.35);
        s.advance();
        expect(s.statuses.at(-1)).toBe('loading');
        s.layers[0].state = { loading: false, failed: false, hasData: true };
        s.advance();
        expect(s.statuses.at(-1)).toBe('ready');
        expect(s.callbacks.size).toBe(0);
        s.controller.setOpacity(0);
        expect(s.layers[0].setOpacity).toHaveBeenLastCalledWith(0);
        expect(s.layers).toHaveLength(1);
    });

    it('discards late readiness callbacks across off/on and releases every resource on destroy', () => {
        const s = setup();
        s.controller.setEnabled(true);
        const late = [...s.callbacks.values()][0];
        s.controller.setEnabled(false);
        expect(s.layers[0].remove).toHaveBeenCalledOnce();
        expect(s.listeners.size).toBe(0);
        expect(s.callbacks.size).toBe(0);
        s.controller.setEnabled(true);
        s.layers[0].state = { loading: false, failed: false, hasData: true };
        late();
        expect(s.statuses.at(-1)).toBe('loading');
        s.controller.destroy();
        s.controller.destroy();
        expect(s.layers[1].remove).toHaveBeenCalledOnce();
        expect(s.listeners.size).toBe(0);
        expect(s.callbacks.size).toBe(0);
        expect(s.statuses.at(-1)).toBe('disabled');
    });

    it('removes incomplete imagery on a tile failure and retries with a fresh layer', () => {
        const s = setup();
        s.controller.setEnabled(true);
        s.layers[0].state = { loading: false, failed: true, hasData: true };
        s.advance();
        expect(s.statuses.at(-1)).toBe('error');
        expect(s.layers[0].remove).toHaveBeenCalledOnce();
        s.controller.retry();
        expect(s.layers).toHaveLength(2);
        s.layers[1].state = { loading: false, failed: false, hasData: true };
        s.advance();
        expect(s.statuses.at(-1)).toBe('ready');
    });

    it('bounds loading time and never treats an empty grid as loaded', () => {
        const s = setup();
        s.controller.setEnabled(true);
        s.layers[0].state = { loading: false, failed: false, hasData: false };
        s.advance(20_000);
        expect(s.statuses.at(-1)).toBe('error');
        expect(s.callbacks.size).toBe(0);
        expect(s.layers[0].remove).toHaveBeenCalledOnce();
    });

    it('accepts completed tiles when a background tab delays the first readiness frame', () => {
        const s = setup();
        s.controller.setEnabled(true);
        s.layers[0].state = { loading: false, failed: false, hasData: true };
        s.advance(30_000);
        expect(s.statuses.at(-1)).toBe('ready');
        expect(s.layers[0].remove).not.toHaveBeenCalled();
        expect(s.callbacks.size).toBe(0);
    });

    it('hides outside the model coverage and resumes when the map moves back', () => {
        const s = setup();
        s.move(80);
        s.controller.setEnabled(true);
        expect(s.statuses.at(-1)).toBe('out-of-range');
        expect(s.layers).toHaveLength(0);
        s.move(30);
        expect(s.layers).toHaveLength(1);
        s.move(-66);
        expect(s.layers[0].remove).toHaveBeenCalledOnce();
        expect(s.statuses.at(-1)).toBe('out-of-range');
        s.controller.destroy();
        s.move(30);
        expect(s.layers).toHaveLength(1);
    });

    it('rechecks a loaded layer after panning without rebuilding it', () => {
        const s = setup();
        s.controller.setEnabled(true);
        s.layers[0].state = { loading: false, failed: false, hasData: true };
        s.advance();
        s.layers[0].state.loading = true;
        s.move(35);
        s.advance();
        expect(s.statuses.at(-1)).toBe('loading');
        expect(s.layers).toHaveLength(1);
        s.layers[0].state.failed = true;
        s.advance();
        expect(s.statuses.at(-1)).toBe('error');
    });
});

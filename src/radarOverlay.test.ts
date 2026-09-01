import { describe, expect, it, vi } from 'vitest';

import {
    buildRainViewerTileUrl,
    createRadarOverlayController,
    DEFAULT_RADAR_OPACITY_PERCENT,
    latestRainViewerFrame,
    matchRadarFrame,
    rainViewerFrames,
    normalizeRadarProvider,
    normalizeRadarOpacityPercent,
    RAINVIEWER_API_URL,
    type RadarOverlayRuntime,
    type RadarOverlayStatus,
} from './radarOverlay';

const manifest = {
    host: 'https://tilecache.rainviewer.com',
    radar: {
        past: [
            { time: 100, path: '/v2/radar/old' },
            { time: 200, path: '/v2/radar/latest' },
        ],
    },
};

const createRuntime = () => {
    const layers: {
        url: string;
        options: L.TileLayerOptions;
        loading: boolean;
        isLoading: ReturnType<typeof vi.fn>;
        addTo: ReturnType<typeof vi.fn>;
        remove: ReturnType<typeof vi.fn>;
        setOpacity: ReturnType<typeof vi.fn>;
    }[] = [];
    const animationFrames: { callback: () => void; id: number }[] = [];
    const timers: { callback: () => void; intervalMs: number; id: ReturnType<typeof setInterval> }[] = [];
    const runtime: RadarOverlayRuntime = {
        cancelAnimationFrame: vi.fn(),
        clearInterval: vi.fn(),
        createTileLayer: (url, options) => {
            const layer = {
                url,
                options,
                loading: true,
                isLoading: vi.fn(() => layer.loading),
                addTo: vi.fn(function addTo() {
                    return layer;
                }),
                remove: vi.fn(),
                setOpacity: vi.fn(function setOpacity() {
                    return layer;
                }),
            };
            layers.push(layer);
            return layer;
        },
        fetch: vi.fn(async input => {
            expect(input).toBe(RAINVIEWER_API_URL);
            return new Response(JSON.stringify(manifest), {
                headers: { 'Content-Type': 'application/json' },
            });
        }),
        now: () => Date.parse('2026-08-30T10:00:00Z'),
        requestAnimationFrame: callback => {
            const id = animationFrames.length + 1;
            animationFrames.push({ callback, id });
            return id;
        },
        setInterval: (callback, intervalMs) => {
            const id = timers.length as unknown as ReturnType<typeof setInterval>;
            timers.push({ callback, intervalMs, id });
            return id;
        },
    };
    return {
        runtime,
        animationFrames,
        layers,
        timers,
    };
};

describe('radar overlay provider contracts', () => {
    it('normalizes the RainViewer provider and radar opacity', () => {
        expect(normalizeRadarProvider('rainviewer')).toBe('rainviewer');
        expect(normalizeRadarProvider('unknown')).toBe('none');
        expect(normalizeRadarOpacityPercent(-1)).toBe(0);
        expect(normalizeRadarOpacityPercent(72.6)).toBe(73);
        expect(normalizeRadarOpacityPercent(120)).toBe(100);
        expect(normalizeRadarOpacityPercent(Number.NaN)).toBe(DEFAULT_RADAR_OPACITY_PERCENT);
    });

    it('selects the latest RainViewer frame and builds its transparent tile URL', () => {
        expect(rainViewerFrames(manifest)?.frames).toEqual([
            { time: 100, path: '/v2/radar/old' },
            { time: 200, path: '/v2/radar/latest' },
        ]);
        expect(latestRainViewerFrame(manifest)).toEqual({
            host: 'https://tilecache.rainviewer.com',
            frame: { time: 200, path: '/v2/radar/latest' },
        });
        expect(buildRainViewerTileUrl('https://tilecache.rainviewer.com/', '/v2/radar/latest')).toBe(
            'https://tilecache.rainviewer.com/v2/radar/latest/256/{z}/{x}/{y}/2/0_0.png',
        );
        expect(latestRainViewerFrame({ host: 'x', radar: { past: [] } })).toBeNull();
    });

    it('matches nearby frames and uses a recent latest frame only for Windy current time', () => {
        const times = [
            Date.parse('2026-08-30T09:40:00Z'),
            Date.parse('2026-08-30T09:50:00Z'),
            Date.parse('2026-08-30T10:00:00Z'),
        ];
        const currentTime = Date.parse('2026-08-30T10:08:00Z');
        expect(matchRadarFrame(times, Date.parse('2026-08-30T09:53:00Z'), currentTime)).toEqual({
            index: 1,
            inRange: true,
        });
        expect(matchRadarFrame(times, Date.parse('2026-08-30T10:06:00Z'), currentTime)).toEqual({
            index: 2,
            inRange: true,
        });
        expect(matchRadarFrame(times, Date.parse('2026-08-30T10:09:00Z'), currentTime)).toEqual({
            index: 2,
            inRange: false,
        });
        expect(matchRadarFrame(times, Date.parse('2026-08-30T09:30:00Z'), currentTime)).toEqual({
            index: 0,
            inRange: false,
        });
        expect(matchRadarFrame(times, Date.parse('2026-08-30T10:20:00Z'), currentTime)).toEqual({
            index: 2,
            inRange: false,
        });
        expect(matchRadarFrame(
            times,
            Date.parse('2026-08-30T10:30:00Z'),
            Date.parse('2026-08-30T10:30:00Z'),
        )).toEqual({
            index: 2,
            inRange: false,
        });
    });
});

describe('radar overlay controller', () => {
    it('keeps the latest recent RainViewer frame visible at Windy current time', async () => {
        const { runtime, animationFrames, layers } = createRuntime();
        runtime.now = () => 560_000;
        const statuses: RadarOverlayStatus[] = [];
        const controller = createRadarOverlayController(
            {} as L.LeafletGlMap,
            status => statuses.push(status),
            runtime,
        );
        controller.setTimestamp(560_000);

        await controller.apply({ provider: 'rainviewer' });

        expect(controller.getActiveFrameTime()).toBe(200_000);
        expect(layers[0].options.opacity).toBe(0.9);
        expect(statuses).toEqual(['loading']);
        layers[0].loading = false;
        animationFrames.shift()?.callback();
        expect(statuses).toEqual(['loading', 'ready']);
    });

    it('hides a cached current-time fallback before a stalled refresh can leave it stale', async () => {
        const { runtime, animationFrames, layers, timers } = createRuntime();
        let currentTime = 560_000;
        runtime.now = () => currentTime;
        const statuses: RadarOverlayStatus[] = [];
        const controller = createRadarOverlayController(
            {} as L.LeafletGlMap,
            status => statuses.push(status),
            runtime,
        );
        controller.setTimestamp(560_000);
        await controller.apply({ provider: 'rainviewer' });
        layers[0].loading = false;
        animationFrames.shift()?.callback();

        runtime.fetch = vi.fn((_input, init) => new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
                reject(new DOMException('Aborted', 'AbortError'));
            }, { once: true });
        }));
        currentTime = 1_160_000;
        timers[0].callback();

        expect(controller.getActiveFrameTime()).toBeNull();
        expect(layers[0].setOpacity).toHaveBeenLastCalledWith(0);
        expect(statuses.at(-1)).toBe('out-of-range');

        controller.destroy();
    });

    it('restores a cached frame when a near-future selection becomes current during a stalled refresh', async () => {
        const { runtime, animationFrames, layers, timers } = createRuntime();
        let currentTime = 550_000;
        runtime.now = () => currentTime;
        const statuses: RadarOverlayStatus[] = [];
        const controller = createRadarOverlayController(
            {} as L.LeafletGlMap,
            status => statuses.push(status),
            runtime,
        );
        controller.setTimestamp(560_000);
        await controller.apply({ provider: 'rainviewer' });
        expect(controller.getActiveFrameTime()).toBeNull();
        expect(statuses).toEqual(['loading', 'out-of-range']);
        layers[0].loading = false;
        animationFrames.shift()?.callback();

        runtime.fetch = vi.fn((_input, init) => new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
                reject(new DOMException('Aborted', 'AbortError'));
            }, { once: true });
        }));
        currentTime = 560_000;
        timers[0].callback();

        expect(controller.getActiveFrameTime()).toBe(200_000);
        expect(layers[0].setOpacity).toHaveBeenLastCalledWith(0.9);
        expect(statuses.at(-1)).toBe('ready');

        controller.destroy();
    });

    it('loads the latest RainViewer frame and reports ready after Windy finishes loading the tile grid', async () => {
        const { runtime, animationFrames, layers, timers } = createRuntime();
        const statuses: RadarOverlayStatus[] = [];
        const controller = createRadarOverlayController(
            {} as L.LeafletGlMap,
            status => statuses.push(status),
            runtime,
        );
        controller.setTimestamp(200_000);

        await controller.apply({
            provider: 'rainviewer',
        });

        expect(statuses).toEqual(['loading']);
        expect(layers).toHaveLength(1);
        expect(layers[0].url).toContain('/v2/radar/latest/256/{z}/{x}/{y}/2/0_0.png');
        expect(layers[0].options.customShader?.pixelTransform).toContain('vec4 pixelTransform');
        expect(layers[0].options.maxNativeZoom).toBe(7);
        expect(layers[0].options.opacity).toBe(0.9);
        expect(layers[0].options.tileFilter).toBe(9728);
        expect(timers).toHaveLength(1);
        expect(controller.getActiveFrameTime()).toBe(200_000);
        expect(statuses).toEqual(['loading']);

        layers[0].loading = false;
        animationFrames.shift()?.callback();
        expect(statuses).toEqual(['loading', 'ready']);

        controller.setTimestamp(100_000);
        expect(controller.getActiveFrameTime()).toBe(100_000);
        expect(layers).toHaveLength(2);
        expect(layers[0].remove).toHaveBeenCalledOnce();
        expect(layers[1].url).toBe(
            'https://tilecache.rainviewer.com/v2/radar/old/256/{z}/{x}/{y}/2/0_0.png',
        );

        expect(statuses).toEqual(['loading', 'ready', 'loading']);
        layers[1].loading = false;
        animationFrames.shift()?.callback();
        expect(statuses).toEqual(['loading', 'ready', 'loading', 'ready']);

        timers[0].callback();
        await vi.waitFor(() => expect(layers).toHaveLength(2));
    });

    it('waits for the first render frame before observing a tile grid that starts loading asynchronously', async () => {
        const { runtime, animationFrames, layers } = createRuntime();
        const statuses: RadarOverlayStatus[] = [];
        const controller = createRadarOverlayController(
            {} as L.LeafletGlMap,
            status => statuses.push(status),
            runtime,
        );
        controller.setTimestamp(200_000);

        await controller.apply({ provider: 'rainviewer' });

        expect(layers[0].isLoading).not.toHaveBeenCalled();
        expect(statuses).toEqual(['loading']);

        layers[0].loading = true;
        animationFrames.shift()?.callback();
        expect(statuses).toEqual(['loading']);

        layers[0].loading = false;
        animationFrames.shift()?.callback();
        expect(statuses).toEqual(['loading', 'ready']);
    });

    it('reports a RainViewer layer-construction failure after loading the manifest', async () => {
        const { runtime } = createRuntime();
        runtime.createTileLayer = vi.fn(() => {
            throw new Error('Layer construction failed');
        });
        const statuses: RadarOverlayStatus[] = [];
        const controller = createRadarOverlayController(
            {} as L.LeafletGlMap,
            status => statuses.push(status),
            runtime,
        );

        await controller.apply({
            provider: 'rainviewer',
        });

        expect(statuses).toEqual(['loading', 'error']);
    });

    it('cancels RainViewer readiness polling and removes the layer and refresh timer on destroy', async () => {
        const { runtime, layers } = createRuntime();
        const statuses: RadarOverlayStatus[] = [];
        const controller = createRadarOverlayController(
            {} as L.LeafletGlMap,
            status => statuses.push(status),
            runtime,
        );

        await controller.apply({
            provider: 'rainviewer',
        });
        expect(layers).toHaveLength(1);

        controller.destroy();
        expect(runtime.cancelAnimationFrame).toHaveBeenCalledOnce();
        expect(layers[0].remove).toHaveBeenCalledOnce();
        expect(runtime.clearInterval).toHaveBeenCalledOnce();
        expect(statuses.at(-1)).toBe('disabled');
    });

    it('applies opacity immediately and reuses it when a layer is created later', async () => {
        const { runtime, layers } = createRuntime();
        const controller = createRadarOverlayController(
            {} as L.LeafletGlMap,
            () => undefined,
            runtime,
        );

        controller.setOpacity(64);
        controller.setTimestamp(200_000);
        await controller.apply({
            provider: 'rainviewer',
        });
        expect(layers[0].options.opacity).toBe(0.64);

        controller.setOpacity(38);
        expect(layers[0].setOpacity).toHaveBeenCalledWith(0.38);
    });

    it('hides the radar outside its history and restores the matching frame on Windy timeline changes', async () => {
        const { runtime, animationFrames, layers } = createRuntime();
        const statuses: RadarOverlayStatus[] = [];
        const controller = createRadarOverlayController(
            {} as L.LeafletGlMap,
            status => statuses.push(status),
            runtime,
        );
        controller.setTimestamp(200_000);
        await controller.apply({
            provider: 'rainviewer',
        });
        layers[0].loading = false;
        animationFrames.shift()?.callback();

        controller.setTimestamp(Date.parse('2026-08-30T10:00:00Z'));
        expect(controller.getActiveFrameTime()).toBeNull();
        expect(layers[0].setOpacity).toHaveBeenLastCalledWith(0);
        expect(statuses.at(-1)).toBe('out-of-range');

        controller.setTimestamp(100_000);
        expect(controller.getActiveFrameTime()).toBe(100_000);
        expect(layers[0].setOpacity).toHaveBeenLastCalledWith(0.9);
        expect(layers).toHaveLength(2);
        expect(layers[0].remove).toHaveBeenCalledOnce();
        expect(layers[1].url).toBe(
            'https://tilecache.rainviewer.com/v2/radar/old/256/{z}/{x}/{y}/2/0_0.png',
        );
        expect(statuses.at(-1)).toBe('loading');
        layers[1].loading = false;
        animationFrames.shift()?.callback();
        expect(statuses.at(-1)).toBe('ready');
    });

    it('remembers a hidden settled layer and restores the same frame without getting stuck loading', async () => {
        const { runtime, animationFrames, layers } = createRuntime();
        const statuses: RadarOverlayStatus[] = [];
        const controller = createRadarOverlayController(
            {} as L.LeafletGlMap,
            status => statuses.push(status),
            runtime,
        );
        controller.setTimestamp(Date.parse('2026-08-30T10:00:00Z'));

        await controller.apply({
            provider: 'rainviewer',
        });

        expect(statuses).toEqual(['loading', 'out-of-range']);
        expect(layers).toHaveLength(1);
        layers[0].loading = false;
        animationFrames.shift()?.callback();
        expect(statuses).toEqual(['loading', 'out-of-range']);

        controller.setTimestamp(200_000);

        expect(layers).toHaveLength(1);
        expect(layers[0].setOpacity).toHaveBeenLastCalledWith(0.9);
        expect(statuses.at(-1)).toBe('ready');
    });

    it('removes the RainViewer layer when radar overlay is turned off', async () => {
        const { runtime, layers } = createRuntime();
        const controller = createRadarOverlayController(
            {} as L.LeafletGlMap,
            () => undefined,
            runtime,
        );

        await controller.apply({
            provider: 'rainviewer',
        });
        await controller.apply({ provider: 'none' });

        expect(layers).toHaveLength(1);
        expect(layers[0].remove).toHaveBeenCalledOnce();
    });

    it('aborts an in-flight RainViewer manifest request during destroy', async () => {
        const { runtime } = createRuntime();
        let requestSignal: AbortSignal | null = null;
        let wasAborted = false;
        runtime.fetch = vi.fn((_input, init) => {
            requestSignal = init?.signal as AbortSignal;
            return new Promise<Response>((_resolve, reject) => {
                requestSignal?.addEventListener('abort', () => {
                    wasAborted = true;
                    reject(new DOMException('Aborted', 'AbortError'));
                });
            });
        });
        const statuses: RadarOverlayStatus[] = [];
        const controller = createRadarOverlayController(
            {} as L.LeafletGlMap,
            status => statuses.push(status),
            runtime,
        );

        const applyPromise = controller.apply({
            provider: 'rainviewer',
        });
        controller.destroy();
        await applyPromise;

        expect(wasAborted).toBe(true);
        expect(statuses).toEqual(['loading', 'disabled']);
    });
});

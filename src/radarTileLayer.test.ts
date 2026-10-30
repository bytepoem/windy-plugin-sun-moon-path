import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRadarTileLayer, recolorRadarPixels } from './radarTileLayer';

const setup = () => {
    const protocols = new Map<string, L.AddProtocolAction>();
    const nativeLayer = {
        id: 'radar-test',
        addTo: vi.fn(),
        remove: vi.fn(),
        setOpacity: vi.fn(),
        isLoading: vi.fn(() => false),
    };
    const TileLayer = vi.fn(function () { return nativeLayer; });
    const removeProtocol = vi.fn((name: string) => protocols.delete(name));
    vi.stubGlobal('L', {
        TileLayer,
        addProtocol: (name: string, loadTile: L.AddProtocolAction) => protocols.set(name, loadTile),
        removeProtocol,
    });
    const setPaintProperty = vi.fn();
    const map = { maplibreMap: { setPaintProperty } } as unknown as L.LeafletGlMap;
    const layer = createRadarTileLayer('https://tilecache.rainviewer.com/test.png', { opacity: 0.9 });
    layer.addTo(map);
    const [protocol, handler] = [...protocols.entries()][0];
    const request = { url: `${protocol}://https://tilecache.rainviewer.com/test.png` };
    return { layer, handler, request, protocols, nativeLayer, TileLayer, removeProtocol, setPaintProperty };
};

afterEach(() => vi.unstubAllGlobals());

describe('recolored radar tiles', () => {
    it('changes real Universal Blue samples to green and yellow, preserving transparent pixels', () => {
        const pixels = new Uint8ClampedArray([0, 163, 224, 255, 0, 85, 136, 255, 0, 0, 0, 0]);
        recolorRadarPixels(pixels);
        expect([...pixels]).toEqual([0, 216, 0, 255, 255, 255, 0, 255, 0, 0, 0, 0]);
    });

    it('returns recolored PNG bytes to the map even when TileLayer ignores customShader', async () => {
        const context = {
            drawImage: vi.fn(),
            getImageData: () => ({ data: new Uint8ClampedArray([0, 163, 224, 255]) }),
            putImageData: vi.fn(),
        };
        const close = vi.fn();
        vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob(['source']))));
        vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 1, height: 1, close })));
        vi.stubGlobal('OffscreenCanvas', vi.fn(function () {
            return {
                getContext: () => context,
                convertToBlob: async () => new Blob(['recolored-png']),
            };
        }));
        const { layer, handler, request, protocols } = setup();
        const result = await handler(request, new AbortController());
        expect([...context.putImageData.mock.calls[0][0].data]).toEqual([0, 216, 0, 255]);
        expect(new TextDecoder().decode(result.data)).toBe('recolored-png');
        expect(close).toHaveBeenCalledOnce();
        layer.remove();
        expect(protocols.size).toBe(0);
    });

    it('aborts an in-flight fetch and unregisters its protocol on removal', async () => {
        let tileSignal: AbortSignal | undefined;
        vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
            tileSignal = options.signal as AbortSignal;
            tileSignal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        })));
        const { layer, handler, request, protocols, removeProtocol } = setup();
        const requestController = new AbortController();
        const removeListener = vi.spyOn(requestController.signal, 'removeEventListener');
        const pending = handler(request, requestController);
        const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
        layer.remove();
        expect(removeListener).toHaveBeenCalled();
        await rejected;
        expect(tileSignal?.aborted).toBe(true);
        expect(protocols.size).toBe(0);
        layer.remove();
        expect(removeProtocol).toHaveBeenCalledOnce();
    });

    it('closes a bitmap that finishes decoding after its frame has been removed', async () => {
        const close = vi.fn();
        let resolveBitmap: (bitmap: unknown) => void = () => {};
        vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob(['source']))));
        const decode = vi.fn(() => new Promise(resolve => { resolveBitmap = resolve; }));
        vi.stubGlobal('createImageBitmap', decode);
        const { layer, handler, request } = setup();
        const pending = handler(request, new AbortController());
        const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
        await vi.waitFor(() => expect(decode).toHaveBeenCalledOnce());
        layer.remove();
        resolveBitmap({ width: 1, height: 1, close });
        await rejected;
        expect(close).toHaveBeenCalledOnce();
    });

    it('honors map request cancellation before fetching and propagates HTTP errors', async () => {
        const fetch = vi.fn(async () => new Response('', { status: 503 }));
        vi.stubGlobal('fetch', fetch);
        const { layer, handler, request } = setup();
        const cancelled = new AbortController();
        cancelled.abort();
        await expect(handler(request, cancelled)).rejects.toMatchObject({ name: 'AbortError' });
        expect(fetch).not.toHaveBeenCalled();
        await expect(handler(request, new AbortController())).rejects.toThrow('503');
        layer.remove();
    });

    it('updates evaluated opacity and releases the protocol if attachment fails', () => {
        const { layer, nativeLayer, setPaintProperty, protocols } = setup();
        layer.setOpacity(0.4);
        expect(setPaintProperty).toHaveBeenCalledWith('radar-test', 'raster-opacity', 0.4);
        layer.remove();
        nativeLayer.addTo.mockImplementation(() => { throw new Error('attach failed'); });
        const next = createRadarTileLayer('https://tilecache.rainviewer.com/test.png', {});
        expect(() => next.addTo({} as L.LeafletGlMap)).toThrow('attach failed');
        expect(protocols.size).toBe(0);
    });
});

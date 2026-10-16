import { mapRainViewerPixelToNmc } from './radarPalette';

/** Recolor unsmoothed Universal Blue pixels before the map uploads the tile texture. */
export const recolorRadarPixels = (pixels: Uint8ClampedArray): void => {
    for (let offset = 0; offset < pixels.length; offset += 4) {
        if (pixels[offset + 3] === 0) {
            continue;
        }
        const mapped = mapRainViewerPixelToNmc([
            pixels[offset], pixels[offset + 1], pixels[offset + 2], pixels[offset + 3],
        ]);
        pixels.set(mapped, offset);
    }
};

/** Decode and re-encode one tile; decoded image memory is released even after cancellation. */
const recolorRadarTile = async (blob: Blob, signal: AbortSignal): Promise<ArrayBuffer> => {
    signal.throwIfAborted();
    const bitmap = await createImageBitmap(blob);
    try {
        signal.throwIfAborted();
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) {
            throw new Error('Radar tile canvas is unavailable');
        }
        context.drawImage(bitmap, 0, 0);
        const image = context.getImageData(0, 0, bitmap.width, bitmap.height);
        recolorRadarPixels(image.data);
        context.putImageData(image, 0, 0);
        const output = await canvas.convertToBlob({ type: 'image/png' });
        signal.throwIfAborted();
        return await output.arrayBuffer();
    } finally {
        bitmap.close();
    }
};

/**
 * Own a recolored raster layer and its protocol. Current Windy TileLayer ignores customShader,
 * so the supported resource-loading protocol supplies already recolored PNGs instead.
 * Each frame has its own registration; removal aborts all work before unregistering it.
 */
export const createRadarTileLayer = (url: string, options: L.TileLayerOptions) => {
    const protocol = `sun-path-radar-${crypto.randomUUID()}`;
    const prefix = `${protocol}://`;
    const tileLayer = new L.TileLayer(`${prefix}${url}`, options);
    const pending = new Map<AbortController, () => void>();
    let disposed = false;
    let registered = false;
    let attachedMap: L.LeafletGlMap | null = null;

    const dispose = () => {
        disposed = true;
        for (const [controller, detach] of pending) {
            detach();
            controller.abort();
        }
        pending.clear();
        if (registered) {
            L.removeProtocol(protocol);
            registered = false;
        }
    };

    const layer = {
        addTo(map: L.LeafletGlMap) {
            if (disposed) {
                throw new Error('Radar tile layer has been removed');
            }
            L.addProtocol(protocol, async (request, requestController) => {
                const controller = new AbortController();
                const cancel = () => controller.abort();
                const detach = () => requestController.signal.removeEventListener('abort', cancel);
                requestController.signal.addEventListener('abort', cancel, { once: true });
                pending.set(controller, detach);
                try {
                    if (disposed || requestController.signal.aborted) {
                        controller.abort();
                    }
                    controller.signal.throwIfAborted();
                    const response = await fetch(request.url.slice(prefix.length), { signal: controller.signal });
                    if (!response.ok) {
                        throw new Error(`Radar tile request failed with ${response.status}`);
                    }
                    const data = await recolorRadarTile(await response.blob(), controller.signal);
                    controller.signal.throwIfAborted();
                    return { data };
                } finally {
                    detach();
                    pending.delete(controller);
                }
            });
            registered = true;
            try {
                tileLayer.addTo(map);
                attachedMap = map;
                return layer;
            } catch (error) {
                try {
                    tileLayer.remove();
                } finally {
                    dispose();
                }
                throw error;
            }
        },
        isLoading: () => tileLayer.isLoading(),
        setOpacity(opacity: number) {
            // Windy's wrapper mutates a raw paint field; update the renderer's evaluated paint too.
            tileLayer.setOpacity(opacity);
            if (attachedMap && tileLayer.id) {
                const renderer = attachedMap.maplibreMap as unknown as {
                    setPaintProperty: (id: string, name: string, value: number) => void;
                };
                renderer.setPaintProperty(tileLayer.id, 'raster-opacity', opacity);
            }
            return layer;
        },
        remove() {
            try {
                tileLayer.remove();
            } finally {
                attachedMap = null;
                dispose();
            }
        },
    };
    return layer;
};

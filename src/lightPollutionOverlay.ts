import { LIGHT_POLLUTION_DATA_YEAR } from './lightPollution';

export const LIGHT_POLLUTION_ATLAS_URL = 'https://djlorenz.github.io/astronomy/lp/';
export const LIGHT_POLLUTION_TILE_URL = `https://djlorenz.github.io/astronomy/image_tiles/tiles${LIGHT_POLLUTION_DATA_YEAR}/tile_{z}_{x}_{y}.png`;
export const DEFAULT_LIGHT_POLLUTION_OPACITY_PERCENT = 50;

export type LightPollutionOverlayStatus = 'disabled' | 'transparent' | 'loading' | 'ready' | 'out-of-range' | 'error';

type TileState = { loading: boolean; failed: boolean; hasData: boolean };
// Windy's bundled declaration omits this public MapLibre method, present in the host.
type AtlasPaintRenderer = {
    setPaintProperty: (layerId: string, property: 'raster-opacity', value: number) => void;
};
type AtlasLayer = {
    remove: () => void;
    setOpacity: (opacity: number) => void;
    readState: () => TileState;
};

export type LightPollutionOverlayRuntime = {
    createLayer: (map: L.LeafletGlMap, opacity: number) => AtlasLayer;
    requestAnimationFrame: (callback: () => void) => number;
    cancelAnimationFrame: (id: number) => void;
    now: () => number;
};

// Above Windy's base map (400), below its POIs (550) and ordinary plugin overlays.
const ATLAS_LAYER_BUCKET = 499;
const LOAD_TIMEOUT_MS = 20_000;

export const normalizeLightPollutionOpacity = (value: number): number =>
    Number.isFinite(value)
        ? Math.max(0, Math.min(100, Math.round(value)))
        : DEFAULT_LIGHT_POLLUTION_OPACITY_PERCENT;

const browserRuntime: LightPollutionOverlayRuntime = {
    createLayer: (map, opacity) => {
        const layer = new L.TileLayer(LIGHT_POLLUTION_TILE_URL, {
            layerId: 'sun-path-light-pollution',
            layerBucketId: ATLAS_LAYER_BUCKET,
            attribution: `<a href="${LIGHT_POLLUTION_ATLAS_URL}" target="_blank" rel="noreferrer">Light Pollution Atlas © David Lorenz · ${LIGHT_POLLUTION_DATA_YEAR}</a>`,
            // These are 1024px XYZ tiles, with native URLs z=0..6. Leaflet's
            // older 256px zoom convention (max 8, offset -2) does not apply to Windy GL.
            tileSize: 1024,
            minNativeZoom: 0,
            maxNativeZoom: 6,
            maxZoom: 22,
            opacity,
        }).addTo(map);
        return {
            remove: () => layer.remove(),
            setOpacity: value => {
                // Windy GL's TileLayer setter currently assigns a plain field on
                // StyleLayer.paint. Use MapLibre's public setter so rendering actually updates.
                if (layer.id) {
                    const renderer = map.maplibreMap as unknown as AtlasPaintRenderer;
                    renderer.setPaintProperty(layer.id, 'raster-opacity', value);
                }
            },
            readState: () => {
                // isLoading() checks the entire Windy map, including unrelated
                // weather layers. Inspect only this source and distinguish errors from loaded tiles.
                const cache = layer.sourceCache();
                const states = cache?.getIds().map(id => cache.getTileByID(id).state) ?? [];
                return {
                    loading: !cache || !cache.loaded() || states.length === 0,
                    failed: states.includes('errored'),
                    hasData: states.includes('loaded'),
                };
            },
        };
    },
    requestAnimationFrame: callback => requestAnimationFrame(callback),
    cancelAnimationFrame: id => cancelAnimationFrame(id),
    now: () => Date.now(),
};

/** Own one static atlas layer. Time changes never affect its year or fetches.
 * A failed view is removed rather than presented as an incomplete dark-sky map.
 * Only enabled views subscribe to map movement; disable/destroy invalidate pending checks.
 */
export const createLightPollutionOverlayController = (
    map: L.LeafletGlMap,
    onStatus: (status: LightPollutionOverlayStatus) => void,
    runtime: LightPollutionOverlayRuntime = browserRuntime,
) => {
    let enabled = false;
    let opacity = DEFAULT_LIGHT_POLLUTION_OPACITY_PERCENT;
    let layer: AtlasLayer | null = null;
    let frame: number | null = null;
    let generation = 0;
    let status: LightPollutionOverlayStatus = 'disabled';

    const report = (next: LightPollutionOverlayStatus) => {
        if (status !== next) {
            status = next;
            onStatus(next);
        }
    };

    const cancelCheck = () => {
        generation += 1;
        if (frame !== null) {
            runtime.cancelAnimationFrame(frame);
            frame = null;
        }
    };

    const removeLayer = () => {
        cancelCheck();
        layer?.remove();
        layer = null;
    };

    const refresh = () => {
        if (!enabled) { return; }
        cancelCheck();
        const latitude = map.getCenter().lat;
        if (!Number.isFinite(latitude) || latitude < -65 || latitude >= 75) {
            removeLayer();
            report('out-of-range');
            return;
        }
        // MapLibre does not request tiles for a fully transparent layer. In
        // particular, restoring a saved 0% preference must not time out as a network failure.
        if (opacity === 0) {
            report('transparent');
            return;
        }
        const fail = () => {
            removeLayer();
            report('error');
        };
        try {
            layer ??= runtime.createLayer(map, opacity / 100);
        } catch {
            fail();
            return;
        }
        const ownGeneration = generation;
        const activeLayer = layer;
        const startedAt = runtime.now();
        report('loading');
        const check = () => {
            if (!enabled || generation !== ownGeneration || layer !== activeLayer) { return; }
            frame = null;
            try {
                const current = activeLayer.readState();
                if (current.failed) {
                    fail();
                } else if (!current.loading && current.hasData) {
                    // Background tabs pause RAF; accept tiles that completed while checks were suspended.
                    report('ready');
                } else if (runtime.now() - startedAt >= LOAD_TIMEOUT_MS) {
                    fail();
                } else {
                    frame = runtime.requestAnimationFrame(check);
                }
            } catch {
                fail();
            }
        };
        // Wait for Windy to initialize the tile grid before inspecting readiness.
        frame = runtime.requestAnimationFrame(check);
    };

    const setEnabled = (next: boolean) => {
        if (enabled === next) { return; }
        enabled = next;
        if (enabled) {
            map.on('moveend', refresh);
            refresh();
        } else {
            map.off('moveend', refresh);
            removeLayer();
            report('disabled');
        }
    };

    return {
        setEnabled,
        setOpacity: (value: number) => {
            opacity = normalizeLightPollutionOpacity(value);
            layer?.setOpacity(opacity / 100);
            if (enabled) {
                if (opacity === 0) {
                    cancelCheck();
                    report('transparent');
                } else if (!layer || status === 'transparent') {
                    refresh();
                }
            }
        },
        retry: () => {
            removeLayer();
            refresh();
        },
        destroy: () => { setEnabled(false); },
    };
};

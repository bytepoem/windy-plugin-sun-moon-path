import { NMC_RADAR_PIXEL_TRANSFORM } from './radarPalette';

export const RADAR_PROVIDERS = ['none', 'rainviewer'] as const;

export type RadarProvider = (typeof RADAR_PROVIDERS)[number];

export type RadarOverlayStatus =
    | 'disabled'
    | 'loading'
    | 'ready'
    | 'out-of-range'
    | 'error';

export type RadarOverlayConfig = {
    provider: RadarProvider;
};

type RainViewerFrame = {
    time: number;
    path: string;
};

type RadarFrame = {
    time: number;
    tileUrl: string;
};

type RadarTileLayer = {
    addTo: (map: L.LeafletGlMap) => RadarTileLayer;
    isLoading: () => boolean;
    remove: () => void;
    setOpacity: (opacity: number) => RadarTileLayer;
};

export type RadarOverlayRuntime = {
    cancelAnimationFrame: (frameId: number) => void;
    clearInterval: (timer: ReturnType<typeof setInterval>) => void;
    createTileLayer: (url: string, options: L.TileLayerOptions) => RadarTileLayer;
    fetch: typeof fetch;
    now: () => number;
    requestAnimationFrame: (callback: () => void) => number;
    setInterval: (callback: () => void, intervalMs: number) => ReturnType<typeof setInterval>;
};

export type RadarOverlayController = {
    apply: (config: RadarOverlayConfig) => Promise<void>;
    destroy: () => void;
    getActiveFrameTime: () => number | null;
    setOpacity: (opacityPercent: number) => void;
    setTimestamp: (timestampMs: number) => void;
};

export const RAINVIEWER_API_URL = 'https://api.rainviewer.com/public/weather-maps.json';
export const RAINVIEWER_WEBSITE_URL = 'https://www.rainviewer.com/';

const RAINVIEWER_REFRESH_INTERVAL_MS = 5 * 60 * 1_000;
const MINIMUM_FRAME_EDGE_TOLERANCE_MS = 5 * 60 * 1_000;
const CURRENT_FRAME_FALLBACK_TOLERANCE_MS = 15 * 60 * 1_000;
export const DEFAULT_RADAR_OPACITY_PERCENT = 90;

const browserRuntime: RadarOverlayRuntime = {
    cancelAnimationFrame: frameId => cancelAnimationFrame(frameId),
    clearInterval: timer => clearInterval(timer),
    createTileLayer: (url, options) => new L.TileLayer(url, options) as unknown as RadarTileLayer,
    fetch: (...args) => fetch(...args),
    now: () => Date.now(),
    requestAnimationFrame: callback => requestAnimationFrame(callback),
    setInterval: (callback, intervalMs) => setInterval(callback, intervalMs),
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

export const normalizeRadarOpacityPercent = (value: number): number =>
    Number.isFinite(value)
        ? Math.min(100, Math.max(0, Math.round(value)))
        : DEFAULT_RADAR_OPACITY_PERCENT;

/** Accept only the provider identifiers supported by the current plugin build. */
export const normalizeRadarProvider = (value: string | null): RadarProvider =>
    RADAR_PROVIDERS.includes(value as RadarProvider) ? value as RadarProvider : 'none';

/** Extract all usable historical radar frames from RainViewer's public manifest. */
export const rainViewerFrames = (value: unknown): { host: string; frames: RainViewerFrame[] } | null => {
    if (!isRecord(value) || typeof value.host !== 'string' || !isRecord(value.radar)) {
        return null;
    }
    const rawPast = value.radar.past;
    if (!Array.isArray(rawPast)) {
        return null;
    }
    const frames = rawPast.filter((candidate): candidate is RainViewerFrame =>
        isRecord(candidate)
        && Number.isFinite(candidate.time)
        && typeof candidate.path === 'string'
        && candidate.path.startsWith('/'),
    ).sort((first, second) => first.time - second.time);
    return frames.length > 0
        ? { host: value.host.replace(/\/$/, ''), frames }
        : null;
};

/** Extract the most recent radar frame from RainViewer's public manifest. */
export const latestRainViewerFrame = (value: unknown): { host: string; frame: RainViewerFrame } | null => {
    const timeline = rainViewerFrames(value);
    const frame = timeline?.frames.at(-1);
    return timeline && frame ? { host: timeline.host, frame } : null;
};

/** Build a transparent Web Mercator radar tile URL for RainViewer's latest frame. */
export const buildRainViewerTileUrl = (host: string, path: string): string =>
    `${host.replace(/\/$/, '')}${path}/256/{z}/{x}/{y}/2/0_0.png`;

/**
 * Match Windy's selected timestamp to the closest provider frame.
 *
 * RainViewer publishes ten-minute observations several minutes after their nominal timestamp. When Windy is still
 * showing the current time, keep the newest recent observation visible through that normal publication delay. This
 * fallback is intentionally limited to the current-time selection so moving Windy's timeline into the future never
 * presents an old radar frame as a forecast.
 */
export const matchRadarFrame = (
    times: number[],
    timestampMs: number,
    currentTimeMs: number,
): { index: number; inRange: boolean } | null => {
    if (times.length === 0 || !Number.isFinite(timestampMs) || !Number.isFinite(currentTimeMs)) {
        return null;
    }
    const index = times.reduce((closestIndex, time, candidateIndex) => (
        Math.abs(time - timestampMs) < Math.abs(times[closestIndex] - timestampMs)
            ? candidateIndex
            : closestIndex
    ), 0);
    const positiveIntervals = times
        .slice(1)
        .map((time, candidateIndex) => time - times[candidateIndex])
        .filter(interval => interval > 0)
        .sort((first, second) => first - second);
    const middleInterval = positiveIntervals[Math.floor(positiveIntervals.length / 2)];
    const edgeTolerance = Math.max(
        MINIMUM_FRAME_EDGE_TOLERANCE_MS,
        middleInterval === undefined ? 0 : middleInterval / 2,
    );
    const latestTime = times[times.length - 1];
    const selectedCurrentTime = Math.abs(timestampMs - currentTimeMs) <= edgeTolerance;
    const latestFrameAge = currentTimeMs - latestTime;
    const canUseLatestCurrentFrame = index === times.length - 1
        && selectedCurrentTime
        && latestFrameAge >= 0
        && latestFrameAge <= CURRENT_FRAME_FALLBACK_TOLERANCE_MS;
    return {
        index,
        inRange: timestampMs <= currentTimeMs
            && timestampMs >= times[0] - edgeTolerance
            && (
                timestampMs <= latestTime + edgeTolerance
                || canUseLatestCurrentFrame
            ),
    };
};

/**
 * Owns one third-party radar tile layer and all related requests, readiness checks and refresh timers.
 * Applying a new provider atomically tears down the previous provider before activating the next one.
 */
export const createRadarOverlayController = (
    map: L.LeafletGlMap,
    onStatus: (status: RadarOverlayStatus) => void,
    runtime: RadarOverlayRuntime = browserRuntime,
): RadarOverlayController => {
    let layer: RadarTileLayer | null = null;
    let layerReadinessFrame: number | null = null;
    let refreshTimer: ReturnType<typeof setInterval> | null = null;
    let requestController: AbortController | null = null;
    let generation = 0;
    let activeTileUrl = '';
    let activeLayerOptions: L.TileLayerOptions | null = null;
    let layerIsLoaded = false;
    let opacityPercent = DEFAULT_RADAR_OPACITY_PERCENT;
    let frames: RadarFrame[] = [];
    let selectedFrameIndex = -1;
    let requestedTimestampMs = runtime.now();
    let frameVisible = true;

    const clearFrames = () => {
        frames = [];
        selectedFrameIndex = -1;
        frameVisible = true;
    };

    const cancelLayerReadinessCheck = () => {
        if (layerReadinessFrame !== null) {
            runtime.cancelAnimationFrame(layerReadinessFrame);
            layerReadinessFrame = null;
        }
    };

    const clearLayer = () => {
        cancelLayerReadinessCheck();
        if (!layer) {
            return;
        }
        layer.remove();
        layer = null;
        activeTileUrl = '';
        layerIsLoaded = false;
    };

    const stopRefresh = () => {
        if (refreshTimer !== null) {
            runtime.clearInterval(refreshTimer);
            refreshTimer = null;
        }
    };

    const cancelRequest = () => {
        requestController?.abort();
        requestController = null;
    };

    const reset = () => {
        generation += 1;
        cancelRequest();
        stopRefresh();
        clearLayer();
        activeLayerOptions = null;
        clearFrames();
    };

    const selectRequestedFrame = () => {
        const match = matchRadarFrame(
            frames.map(frame => frame.time),
            requestedTimestampMs,
            runtime.now(),
        );
        if (!match) {
            selectedFrameIndex = -1;
            frameVisible = false;
            return;
        }
        selectedFrameIndex = match.index;
        frameVisible = match.inRange;
    };

    const replaceFrames = (nextFrames: RadarFrame[]) => {
        frames = nextFrames;
        selectRequestedFrame();
    };

    /** Stop presenting a cached current-time fallback once it is no longer recent enough. */
    const revalidateCachedFrameVisibility = () => {
        if (frames.length === 0) {
            return;
        }
        const wasVisible = frameVisible;
        selectRequestedFrame();
        if (!layer || wasVisible === frameVisible) {
            return;
        }
        if (!frameVisible) {
            layer.setOpacity(0);
            onStatus('out-of-range');
            return;
        }
        layer.setOpacity(opacityPercent / 100);
        onStatus(layerIsLoaded ? 'ready' : 'loading');
    };

    /**
     * Windy's GL-backed TileLayer does not emit Leaflet's load/tileerror events.
     * Poll its documented isLoading() state until the current raster grid settles.
     */
    const watchLayerReadiness = (nextLayer: RadarTileLayer, ownGeneration: number) => {
        const check = () => {
            layerReadinessFrame = null;
            if (generation !== ownGeneration || layer !== nextLayer) {
                return;
            }
            if (nextLayer.isLoading()) {
                layerReadinessFrame = runtime.requestAnimationFrame(check);
                return;
            }
            layerIsLoaded = true;
            if (frameVisible) {
                onStatus('ready');
            }
        };
        layerReadinessFrame = runtime.requestAnimationFrame(check);
    };

    const installLayer = (url: string, options: L.TileLayerOptions, ownGeneration: number) => {
        clearLayer();
        const nextLayer = runtime.createTileLayer(url, options);
        layerIsLoaded = false;
        layer = nextLayer.addTo(map);
        activeLayerOptions = options;
        activeTileUrl = url;
        watchLayerReadiness(nextLayer, ownGeneration);
    };

    /**
     * Recreate the raster layer for a new radar frame.
     * Windy's GL-backed tile layer can retain the previous raster source when only its URL changes,
     * so a frame switch must replace the layer to guarantee fresh tile requests during playback.
     */
    const replaceActiveFrameLayer = (url: string, ownGeneration: number) => {
        if (!activeLayerOptions) {
            throw new Error('Radar layer options are unavailable');
        }
        installLayer(url, {
            ...activeLayerOptions,
            opacity: frameVisible ? opacityPercent / 100 : 0,
        }, ownGeneration);
    };

    const refreshRainViewer = async (ownGeneration: number) => {
        // Recheck cached data before waiting on the network so a stalled request cannot leave stale radar visible.
        revalidateCachedFrameVisibility();
        cancelRequest();
        const controller = new AbortController();
        requestController = controller;
        try {
            const response = await runtime.fetch(RAINVIEWER_API_URL, {
                signal: controller.signal,
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) {
                throw new Error(`RainViewer manifest request failed with ${response.status}`);
            }
            const timeline = rainViewerFrames(await response.json());
            if (!timeline) {
                throw new Error('RainViewer manifest contains no radar frames');
            }
            if (controller.signal.aborted || generation !== ownGeneration) {
                return;
            }
            replaceFrames(timeline.frames.map(frame => ({
                time: frame.time * 1_000,
                tileUrl: buildRainViewerTileUrl(timeline.host, frame.path),
            })));
            const tileUrl = frames[selectedFrameIndex].tileUrl;
            if (layer) {
                layer.setOpacity(frameVisible ? opacityPercent / 100 : 0);
                if (activeTileUrl !== tileUrl) {
                    onStatus('loading');
                    replaceActiveFrameLayer(tileUrl, ownGeneration);
                }
                if (!frameVisible) {
                    onStatus('out-of-range');
                } else if (activeTileUrl === tileUrl) {
                    onStatus(layerIsLoaded ? 'ready' : 'loading');
                }
                return;
            }
            installLayer(tileUrl, {
                attribution: `<a href="${RAINVIEWER_WEBSITE_URL}" target="_blank" rel="noreferrer">Weather data by RainViewer</a>`,
                customShader: { pixelTransform: NMC_RADAR_PIXEL_TRANSFORM },
                maxNativeZoom: 7,
                maxZoom: 22,
                opacity: frameVisible ? opacityPercent / 100 : 0,
                tileFilter: 9728,
            }, ownGeneration);
            if (!frameVisible) {
                onStatus('out-of-range');
            }
        } catch {
            if (!controller.signal.aborted && generation === ownGeneration) {
                onStatus('error');
            }
        } finally {
            if (requestController === controller) {
                requestController = null;
            }
        }
    };

    const apply = async (config: RadarOverlayConfig) => {
        reset();
        const ownGeneration = generation;
        if (config.provider === 'none') {
            onStatus('disabled');
            return;
        }
        onStatus('loading');
        refreshTimer = runtime.setInterval(() => {
            void refreshRainViewer(ownGeneration);
        }, RAINVIEWER_REFRESH_INTERVAL_MS);
        await refreshRainViewer(ownGeneration);
    };

    const destroy = () => {
        reset();
        onStatus('disabled');
    };

    const setOpacity = (value: number) => {
        opacityPercent = normalizeRadarOpacityPercent(value);
        layer?.setOpacity(frameVisible ? opacityPercent / 100 : 0);
    };

    /** Return the actual provider frame displayed for Windy's current timestamp. */
    const getActiveFrameTime = (): number | null => (
        frameVisible && selectedFrameIndex >= 0
            ? frames[selectedFrameIndex]?.time ?? null
            : null
    );

    /** Follow Windy's native timeline and hide the third-party layer outside its available history. */
    const setTimestamp = (timestampMs: number) => {
        if (!Number.isFinite(timestampMs)) {
            return;
        }
        requestedTimestampMs = timestampMs;
        const wasVisible = frameVisible;
        selectRequestedFrame();
        if (!layer || selectedFrameIndex < 0) {
            return;
        }
        if (!frameVisible) {
            layer.setOpacity(0);
            onStatus('out-of-range');
            return;
        }
        layer.setOpacity(opacityPercent / 100);
        const tileUrl = frames[selectedFrameIndex].tileUrl;
        if (activeTileUrl !== tileUrl) {
            onStatus('loading');
            try {
                replaceActiveFrameLayer(tileUrl, generation);
            } catch {
                clearLayer();
                onStatus('error');
            }
        } else if (!wasVisible) {
            onStatus(layerIsLoaded ? 'ready' : 'loading');
        }
    };

    return { apply, destroy, getActiveFrameTime, setOpacity, setTimestamp };
};

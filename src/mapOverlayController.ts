import { manageMarkerTooltip } from './markerTooltip';
import { directionLineColor, type DirectionPath } from './eventDirections';
import {
    destinationPoint,
    CURRENT_DIRECTION_COLOR,
    CURRENT_MOON_DIRECTION_COLOR,
    splitPolylineAtDateLine,
    type Coordinates,
    type SolarEvent,
} from './solar';

type MarkerKind = 'origin' | 'inner' | 'outer' | 'extended';

export type MapOverlayRuntime = {
    createLayerGroup: (map: L.LeafletGlMap) => L.LayerGroup;
    createDivIcon: (options: L.DivIconOptions) => L.DivIcon;
    createMarker: (latLng: [number, number], options: L.MarkerOptions) => L.Marker;
    createPolyline: (latLngs: [number, number][], options: L.PolylineOptions) => L.Polyline;
};

/** Optional sampled path is used by cloud planning; ordinary live bearings retain their endpoints. */
type MapBearing = { endpoint: Coordinates; points?: Coordinates[] };

export type MapOverlayRenderState = {
    location: Coordinates;
    paths: DirectionPath[];
    currentSun: MapBearing | null;
    currentMoon: MapBearing | null;
    currentGalacticCenter?: MapBearing | null;
    // Only event-view bearings represent wall-clock time; cloud sightlines do not.
    liveLabels?: { sun: string; moon: string };
    showExtendedDistanceMarker: boolean;
    showDistanceMarkers: boolean;
    directionRangeKm: number | null;
    opacityPercent: number;
    originLabel: string;
    eventNames: Record<SolarEvent, string>;
    formatDistance: (distanceKm: number) => string;
};

export type MapOverlayCurrentState = Pick<
    MapOverlayRenderState,
    'location' | 'currentSun' | 'currentMoon' | 'currentGalacticCenter' | 'liveLabels' | 'opacityPercent'
>;

export type MapOverlayController = {
    render: (state: MapOverlayRenderState) => void;
    updateCurrent: (state: MapOverlayCurrentState) => void;
    setOpacity: (opacityPercent: number) => void;
    destroy: () => void;
};

const browserRuntime: MapOverlayRuntime = {
    createLayerGroup: map => new L.LayerGroup().addTo(map),
    createDivIcon: options => new L.DivIcon(options),
    createMarker: (latLng, options) => new L.Marker(latLng, options),
    createPolyline: (latLngs, options) => new L.Polyline(latLngs, options),
};

const markerIcon = (runtime: MapOverlayRuntime, kind: MarkerKind): L.DivIcon => {
    const size = kind === 'origin' ? 16 : 10;
    return runtime.createDivIcon({
        className: `sun-path-marker sun-path-marker--${kind}`,
        html: '<span></span>',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
};

const toLatLng = (location: Coordinates): [number, number] => [location.lat, location.lon];

const normalizedOpacityPercent = (value: number): number =>
    Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 100;

export const createMapOverlayController = (
    map: L.LeafletGlMap,
    runtime: MapOverlayRuntime = browserRuntime,
): MapOverlayController => {
    const releaseTooltips: (() => void)[] = [];
    let layerGroup: L.LayerGroup | null = null;
    let eventLines: { line: L.Polyline; baseOpacity: number }[] = [];
    let currentLines: { line: L.Polyline; baseOpacity: number }[] = [];
    let currentMarkers: L.Marker[] = [];
    let opacityPercent = 100;

    const scaledOpacity = (baseOpacity: number): number =>
        baseOpacity * normalizedOpacityPercent(opacityPercent) / 100;

    const removeCurrentLines = () => {
        for (const { line } of currentLines) {
            layerGroup?.removeLayer(line);
        }
        currentLines = [];
        for (const marker of currentMarkers) {
            layerGroup?.removeLayer(marker);
        }
        currentMarkers = [];
    };

    const destroy = () => {
        releaseTooltips.splice(0).forEach(release => release());
        layerGroup?.remove();
        layerGroup = null;
        eventLines = [];
        currentLines = [];
        currentMarkers = [];
    };

    const drawCurrentDirection = (
        location: Coordinates,
        direction: MapBearing,
        color: string,
        options: L.PolylineOptions = {},
    ) => {
        if (!layerGroup) {
            return;
        }
        for (const segment of splitPolylineAtDateLine(direction.points ?? [location, direction.endpoint])) {
            const baseOpacity = 0.95;
            const line = runtime.createPolyline(segment.map(toLatLng), {
                color,
                weight: 2,
                opacity: scaledOpacity(baseOpacity),
                lineCap: 'round',
                lineJoin: 'round',
                ...(direction.points ? { smoothFactor: 0 } : {}),
                ...options,
            }).addTo(layerGroup);
            currentLines.push({ line, baseOpacity });
        }
    };

    const updateCurrent = (state: MapOverlayCurrentState) => {
        opacityPercent = state.opacityPercent;
        removeCurrentLines();
        for (const body of ['sun', 'moon'] as const) {
            const direction = body === 'sun' ? state.currentSun : state.currentMoon;
            if (!direction) {continue;}
            const live = state.liveLabels?.[body];
            const color = body === 'sun' ? (live ? '#ffd166' : CURRENT_DIRECTION_COLOR) : CURRENT_MOON_DIRECTION_COLOR;
            const dash = body === 'moon' ? { dashArray: '7 6' } : {};
            if (live) {
                drawCurrentDirection(state.location, direction, '#111b26', { weight: 6, ...dash, interactive: false });
            }
            drawCurrentDirection(state.location, direction, color, { weight: live ? 3 : 2, ...dash, interactive: false });
            if (live && layerGroup) {
                // These are direction-endpoint badges, not projected sky positions.
                const symbol = body === 'sun'
                    ? '<circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/>'
                    : '<path d="M19.6 15.2A8.4 8.4 0 0 1 8.8 4.4A8.6 8.6 0 1 0 19.6 15.2Z" fill="currentColor"/>';
                const label = live.replace(/[&<>"']/g, character =>
                    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
                const icon = runtime.createDivIcon({
                    className: `live-direction-marker live-direction-marker--${body}`,
                    html: `<span role="img" aria-label="${label}" style="color:${color}"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">${symbol}</svg><b aria-hidden="true">now</b></span>`,
                    iconSize: [30, 34],
                    // The 20px body icon is centred exactly on the bearing endpoint;
                    // the caption sits below it within the same transparent marker.
                    iconAnchor: [15, 10],
                });
                const marker = runtime.createMarker(toLatLng(direction.endpoint), {
                    icon, interactive: false, keyboard: false, opacity: scaledOpacity(1),
                }).addTo(layerGroup);
                currentMarkers.push(marker);
            }
        }
        if (state.currentGalacticCenter) {
            drawCurrentDirection(state.location, state.currentGalacticCenter, '#9de0b7');
        }
    };

    const render = (state: MapOverlayRenderState) => {
        destroy();
        opacityPercent = state.opacityPercent;
        const availablePaths = state.paths.filter(
            (path): path is Extract<DirectionPath, { status: 'ok' }> => path.status === 'ok',
        );
        // A galactic bearing has no solar/lunar event ray, but is independently drawable.
        if (availablePaths.length === 0 && !state.currentSun && !state.currentMoon && !state.currentGalacticCenter) {
            return;
        }

        layerGroup = runtime.createLayerGroup(map);
        const origin = runtime.createMarker(toLatLng(state.location), {
            icon: markerIcon(runtime, 'origin'),
        }).addTo(layerGroup).bindTooltip(state.originLabel, { direction: 'top', offset: [0, -8] });
        releaseTooltips.push(manageMarkerTooltip(origin));

        for (const path of availablePaths) {
            const eventName = 'eventLabel' in path ? path.eventLabel : state.eventNames[path.event];
            const isMoonEvent = path.event === 'moonrise' || path.event === 'moonset';
            const baseOpacity = isMoonEvent ? 0.82 : 0.95;
            for (const sample of path.samples) {
                // Sample extended cloud rays on the sphere to match cloud arcs in Mercator.
                const rangeKm = Math.max(state.showExtendedDistanceMarker ? 600 : 400, state.directionRangeKm ?? 0);
                const points = state.directionRangeKm !== null
                    ? Array.from({ length: Math.ceil(rangeKm / 25) + 1 }, (_, index) =>
                        destinationPoint(state.location, sample.azimuth, rangeKm * index / Math.ceil(rangeKm / 25)))
                    : [
                    state.location,
                    sample.point200,
                    sample.point400,
                    ...(state.showExtendedDistanceMarker ? [sample.point600] : []),
                ];
                for (const segment of splitPolylineAtDateLine(points)) {
                    const line = runtime.createPolyline(segment.map(toLatLng), {
                        color: directionLineColor(path.event, sample.kind),
                        weight: 3,
                        opacity: scaledOpacity(baseOpacity),
                        lineCap: 'round',
                        lineJoin: 'round',
                        ...(isMoonEvent ? { dashArray: '9 6' } : {}),
                    }).addTo(layerGroup);
                    eventLines.push({ line, baseOpacity });
                }

                // Cloud geometry replaces fixed-distance reference dots, but keeps the event rays.
                if (!state.showDistanceMarkers) {continue;}
                const markerInputs: { kind: MarkerKind; point: Coordinates; distance: number }[] = [
                    { kind: 'inner', point: sample.point200, distance: 200 },
                    { kind: 'outer', point: sample.point400, distance: 400 },
                    ...(state.showExtendedDistanceMarker
                        ? [{ kind: 'extended' as const, point: sample.point600, distance: 600 }]
                        : []),
                ];
                for (const markerInput of markerInputs) {
                    const marker = runtime.createMarker(toLatLng(markerInput.point), {
                        icon: markerIcon(runtime, markerInput.kind),
                    }).addTo(layerGroup).bindTooltip(
                        `${eventName} · ${sample.label} · ${state.formatDistance(markerInput.distance)}`,
                        { direction: 'top', offset: [0, -6] },
                    );
                    releaseTooltips.push(manageMarkerTooltip(marker));
                }
            }
        }

        updateCurrent(state);
    };

    const setOpacity = (value: number) => {
        opacityPercent = normalizedOpacityPercent(value);
        for (const { line, baseOpacity } of [...eventLines, ...currentLines]) {
            line.setStyle({ opacity: scaledOpacity(baseOpacity) });
        }
        currentMarkers.forEach(marker => marker.setOpacity(scaledOpacity(1)));
    };

    return { render, updateCurrent, setOpacity, destroy };
};

import { manageMarkerTooltip } from './markerTooltip';
import {
    destinationPoint,
    CURRENT_DIRECTION_COLOR,
    CURRENT_MOON_DIRECTION_COLOR,
    LINE_COLORS,
    MOON_LINE_COLORS,
    splitPolylineAtDateLine,
    type Coordinates,
    type SolarEvent,
    type SolarPath,
    type SolarSampleKind,
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
    paths: SolarPath[];
    currentSun: MapBearing | null;
    currentMoon: MapBearing | null;
    currentGalacticCenter?: MapBearing | null;
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
    'location' | 'currentSun' | 'currentMoon' | 'currentGalacticCenter' | 'opacityPercent'
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

const lineColorForEvent = (event: SolarEvent, kind: SolarSampleKind): string =>
    event === 'moonrise' || event === 'moonset' ? MOON_LINE_COLORS[kind] : LINE_COLORS[kind];

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
    let opacityPercent = 100;

    const scaledOpacity = (baseOpacity: number): number =>
        baseOpacity * normalizedOpacityPercent(opacityPercent) / 100;

    const removeCurrentLines = () => {
        for (const { line } of currentLines) {
            line.remove();
        }
        currentLines = [];
    };

    const destroy = () => {
        releaseTooltips.splice(0).forEach(release => release());
        layerGroup?.remove();
        layerGroup = null;
        eventLines = [];
        currentLines = [];
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
        if (state.currentSun) {
            drawCurrentDirection(state.location, state.currentSun, CURRENT_DIRECTION_COLOR);
        }
        if (state.currentMoon) {
            drawCurrentDirection(
                state.location,
                state.currentMoon,
                CURRENT_MOON_DIRECTION_COLOR,
                { dashArray: '7 6' },
            );
        }
        if (state.currentGalacticCenter) {
            drawCurrentDirection(state.location, state.currentGalacticCenter, '#9de0b7');
        }
    };

    const render = (state: MapOverlayRenderState) => {
        destroy();
        opacityPercent = state.opacityPercent;
        const availablePaths = state.paths.filter(
            (path): path is Extract<SolarPath, { status: 'ok' }> => path.status === 'ok',
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
                        color: lineColorForEvent(path.event, sample.kind),
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
                        `${state.eventNames[path.event]} · ${sample.label} · ${state.formatDistance(markerInput.distance)}`,
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
    };

    return { render, updateCurrent, setOpacity, destroy };
};

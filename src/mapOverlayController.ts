import {
    CURRENT_DIRECTION_COLOR,
    CURRENT_MOON_DIRECTION_COLOR,
    LINE_COLORS,
    MOON_LINE_COLORS,
    splitPolylineAtDateLine,
    type Coordinates,
    type CurrentMoonInfo,
    type SolarDirection,
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

export type MapOverlayRenderState = {
    location: Coordinates;
    paths: SolarPath[];
    currentSun: SolarDirection | null;
    currentMoon: CurrentMoonInfo | null;
    showExtendedDistanceMarker: boolean;
    opacityPercent: number;
    originLabel: string;
    eventNames: Record<SolarEvent, string>;
};

export type MapOverlayCurrentState = Pick<
    MapOverlayRenderState,
    'location' | 'currentSun' | 'currentMoon' | 'opacityPercent'
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
        layerGroup?.remove();
        layerGroup = null;
        eventLines = [];
        currentLines = [];
    };

    const drawCurrentDirection = (
        location: Coordinates,
        endpoint: Coordinates,
        color: string,
        options: L.PolylineOptions = {},
    ) => {
        if (!layerGroup) {
            return;
        }
        for (const segment of splitPolylineAtDateLine([location, endpoint])) {
            const baseOpacity = 0.95;
            const line = runtime.createPolyline(segment.map(toLatLng), {
                color,
                weight: 2,
                opacity: scaledOpacity(baseOpacity),
                lineCap: 'round',
                lineJoin: 'round',
                ...options,
            }).addTo(layerGroup);
            currentLines.push({ line, baseOpacity });
        }
    };

    const updateCurrent = (state: MapOverlayCurrentState) => {
        opacityPercent = state.opacityPercent;
        removeCurrentLines();
        if (state.currentSun) {
            drawCurrentDirection(state.location, state.currentSun.endpoint, CURRENT_DIRECTION_COLOR);
        }
        if (state.currentMoon) {
            drawCurrentDirection(
                state.location,
                state.currentMoon.endpoint,
                CURRENT_MOON_DIRECTION_COLOR,
                { dashArray: '7 6' },
            );
        }
    };

    const render = (state: MapOverlayRenderState) => {
        destroy();
        opacityPercent = state.opacityPercent;
        const availablePaths = state.paths.filter(
            (path): path is Extract<SolarPath, { status: 'ok' }> => path.status === 'ok',
        );
        if (availablePaths.length === 0) {
            return;
        }

        layerGroup = runtime.createLayerGroup(map);
        runtime.createMarker(toLatLng(state.location), {
            icon: markerIcon(runtime, 'origin'),
        }).addTo(layerGroup).bindTooltip(state.originLabel, { direction: 'top', offset: [0, -8] });

        for (const path of availablePaths) {
            const isMoonEvent = path.event === 'moonrise' || path.event === 'moonset';
            const baseOpacity = isMoonEvent ? 0.82 : 0.95;
            for (const sample of path.samples) {
                const points = [
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

                const markerInputs: { kind: MarkerKind; point: Coordinates; distance: number }[] = [
                    { kind: 'inner', point: sample.point200, distance: 200 },
                    { kind: 'outer', point: sample.point400, distance: 400 },
                    ...(state.showExtendedDistanceMarker
                        ? [{ kind: 'extended' as const, point: sample.point600, distance: 600 }]
                        : []),
                ];
                for (const markerInput of markerInputs) {
                    runtime.createMarker(toLatLng(markerInput.point), {
                        icon: markerIcon(runtime, markerInput.kind),
                    }).addTo(layerGroup).bindTooltip(
                        `${state.eventNames[path.event]} · ${sample.label} · ${markerInput.distance} km`,
                        { direction: 'top', offset: [0, -6] },
                    );
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

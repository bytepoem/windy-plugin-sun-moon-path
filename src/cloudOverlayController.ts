import { cloudArc, cloudSightDistance, cloudTwilightDistances } from './cloudGeometry';
import { destinationPoint, splitPolylineAtDateLine, type Coordinates } from './solar';
import { formatDistanceKm, formatElevationM, type UnitPreferences } from './unitPreferences';
import type { CloudLayer } from './cloudProfile';
import type { MapOverlayRuntime } from './mapOverlayController';

export const CLOUD_BAND_COLORS = { low: '#ffe600', medium: '#ff9500', high: '#ff3030' } as const;

export type CloudOverlayState = {
    location: Coordinates;
    position: { altitude: number; azimuth: number; sightlineAvailable: boolean };
    sunAzimuth: number;
    layers: CloudLayer[];
    twilight: boolean;
    opacity: number;
    language: 'zh' | 'en';
    units: UnitPreferences;
};

/** Own cloud layers and their tooltip/zoom listeners; destroy releases all of them. */
export const createCloudOverlayController = (map: L.LeafletGlMap, runtime: MapOverlayRuntime = {
    createLayerGroup: target => new L.LayerGroup().addTo(target),
    createPolyline: (points, options) => new L.Polyline(points, options),
    createDivIcon: options => new L.DivIcon(options),
    createMarker: (point, options) => new L.Marker(point, options),
}) => {
    let group: L.LayerGroup | null = null;
    let redrawOnZoom: (() => void) | null = null;
    const markers: { marker: L.Marker; close: () => void }[] = [];
    const tooltipCloseEvents = ['movestart', 'zoomstart', 'click'] as const;
    const closeTooltips = () => markers.forEach(({ marker }) => marker.closeTooltip());
    const destroy = () => {
        if (redrawOnZoom) {
            map.off('zoomend', redrawOnZoom);
            tooltipCloseEvents.forEach(event => map.off(event, closeTooltips));
        }
        redrawOnZoom = null;
        markers.splice(0).forEach(({ marker, close }) => {
            marker.off('mouseout', close);
            marker.closeTooltip();
            marker.unbindTooltip();
        });
        group?.remove();
        group = null;
    };
    const render = (state: CloudOverlayState) => {
        destroy();
        if (!state.layers.length) {return;}
        group = runtime.createLayerGroup(map);
        redrawOnZoom = () => render(state);
        map.on('zoomend', redrawOnZoom);
        tooltipCloseEvents.forEach(event => map.on(event, closeTooltips));
        const line = (points: Coordinates[], options: L.PolylineOptions) => {
            for (const segment of splitPolylineAtDateLine(points)) {
                runtime.createPolyline(segment.map(point => [point.lat, point.lon]), {
                    weight: 2, opacity: state.opacity / 100, interactive: false, smoothFactor: 0,
                    className: 'cloud-planning-line', ...options,
                }).addTo(group!);
            }
        };
        const label = (point: Coordinates, text: string, color: string, title: string, dot = false, inline = false) => {
            const marker = runtime.createMarker([point.lat, point.lon], {
                icon: runtime.createDivIcon({
                    className: dot ? 'cloud-planning-point' : 'cloud-planning-marker',
                    html: `<span style="${dot ? 'border-color' : 'color'}:${color}">${dot ? '' : text}</span>`,
                    iconSize: dot ? [12, 12] : [110, 24], iconAnchor: dot ? [6, 6] : [55, inline ? 12 : 30],
                }),
            }).addTo(group!).bindTooltip(title);
            const close = () => marker.closeTooltip();
            marker.on('mouseout', close);
            markers.push({ marker, close });
            return marker.getElement()?.querySelector('span')?.getBoundingClientRect().width ?? 0;
        };
        const distanceLabel = (value: number) => `${formatDistanceKm(value, state.units.distance)} ${state.units.distance}`;
        const range = Math.max(10, ...state.layers.map(layer =>
            cloudTwilightDistances(layer.heightM)?.clearKm || 0));
        label(state.location, '', '#6ed9ee', state.language === 'zh' ? '机位' : 'Camera', true);
        // Sample the bearing ray as a geodesic; two endpoints alone distort long lines in Mercator.
        if (state.position.sightlineAvailable) {
            line(Array.from({ length: 41 }, (_, i) =>
                destinationPoint(state.location, state.position.azimuth, range * i / 40)),
            { color: '#6ed9ee', dashArray: '8 5', weight: 2 });
        }
        for (const layer of state.layers) {
            const geometry = cloudTwilightDistances(layer.heightM);
            if (!geometry) {continue;}
            const height = `${formatElevationM(layer.heightM, state.units.elevation)} ${state.units.elevation}`;
            const distance = state.position.sightlineAvailable
                ? cloudSightDistance(layer.heightM, state.position.altitude) : null;
            if (distance !== null) {
                const point = destinationPoint(state.location, state.position.azimuth, distance);
                label(point, '', '#6ed9ee',
                    `${height} · ${state.language === 'zh' ? '视线与云层交点' : 'Sightline intersection'} · ${distanceLabel(distance)}`, true);
            }
            if (!state.twilight) {continue;}
            const top = destinationPoint(state.location, 0, geometry.horizonKm);
            const labelWidth = label(top, formatDistanceKm(geometry.horizonKm, state.units.distance), '#ffffff',
                `${height} · ${state.language === 'zh' ? '地平线云距' : 'Horizon distance'} · ${distanceLabel(geometry.horizonKm)}`, false, true);
            // Leave a real opening behind the transparent label. Keep its screen
            // width stable when zooming instead of painting over the map tiles.
            const metresPerPixel = 156543.03392 * Math.cos(top.lat * Math.PI / 180) / 2 ** map.getZoom();
            const radiusPixels = geometry.horizonKm * 1000 / metresPerPixel;
            const gap = Math.min(160, 2 * Math.asin(Math.min(1, (labelWidth / 2 + 3) / radiusPixels)) * 180 / Math.PI);
            line(cloudArc(state.location, geometry.horizonKm, 180, 360 - gap), { color: '#ffffff' });
            const bandColor = CLOUD_BAND_COLORS[layer.band];
            line(cloudArc(state.location, geometry.tangentKm, state.sunAzimuth, 12), { color: bandColor, dashArray: '4 4', weight: 3 });
            const farArc = cloudArc(state.location, geometry.clearKm, state.sunAzimuth, 36);
            line(farArc, { color: bandColor, weight: 3 });
            // Northmost sampled point is the visual top in Windy's north-up map.
            label(farArc.reduce((highest, point) => point.lat > highest.lat ? point : highest),
                formatDistanceKm(geometry.clearKm, state.units.distance), bandColor, `${height} · ${state.language === 'zh' ? '最远无云距' : 'Farthest clear distance'} · ${distanceLabel(geometry.clearKm)}`);
        }
    };
    return { render, destroy };
};

import { destinationPoint, EARTH_RADIUS_KM, splitPolylineAtDateLine, type Coordinates } from './solar';
import { renderHorizonIcon } from './horizonIcon';
import type { DirectionEvent, DirectionPath } from './eventDirections';
import type { DirectionLineFitBounds } from './mapView';

export const MAX_OBSERVER_HEIGHT_M = 12_000;
export const HORIZON_EVENTS = [
    { event: 'sunrise', body: 'sun', zh: '日出', en: 'Sunrise' },
    { event: 'sunset', body: 'sun', zh: '日落', en: 'Sunset' },
    { event: 'moonrise', body: 'moon', zh: '月出', en: 'Moonrise' },
    { event: 'moonset', body: 'moon', zh: '月落', en: 'Moonset' },
    { event: 'milkywayrise', body: 'galactic', zh: '银心升起', en: 'Galactic centre rise' },
    { event: 'milkywayset', body: 'galactic', zh: '银心落下', en: 'Galactic centre set' },
] as const;

/** Surface distance to the tangent point on a smooth reference sphere.
 * Height is above that reference (e.g. sea level), not automatically above terrain.
 * Refraction, terrain and celestial rise-time corrections are outside this model.
 */
export const horizonDistanceKm = (heightM: number | undefined): number | null => {
    if (heightM === undefined || !Number.isFinite(heightM) || heightM < 0 || heightM > MAX_OBSERVER_HEIGHT_M) {
        return null;
    }
    const heightKm = heightM / 1000;
    // atan2 avoids loss of precision for very small positive heights.
    const tangentLengthKm = Math.sqrt(heightKm * (2 * EARTH_RADIUS_KM + heightKm));
    return EARTH_RADIUS_KM * Math.atan2(tangentLengthKm, EARTH_RADIUS_KM);
};

/** Use the selected day's existing event bearing, never a live or ±30 minute ray. */
export const eventHorizonPoints = (
    location: Coordinates, paths: DirectionPath[], distanceKm: number | null, selectedEvent: DirectionEvent = 'all',
) => {
    if (distanceKm === null || !Number.isFinite(distanceKm) || distanceKm < 0) { return []; }
    return paths.flatMap(path => {
        if (path.status !== 'ok' || (selectedEvent !== 'all' && path.event !== selectedEvent)) { return []; }
        const sample = path.samples.find(candidate => candidate.kind === 'event');
        if (!sample || !Number.isFinite(sample.azimuth)) { return []; }
        const point = destinationPoint(location, sample.azimuth, distanceKm);
        const steps = Math.max(1, Math.ceil(distanceKm / 5));
        const line = Array.from({ length: steps + 1 }, (_, index) =>
            destinationPoint(location, sample.azimuth, distanceKm * index / steps));
        return [{ event: path.event, azimuth: sample.azimuth, point, line }];
    });
};

/** Bounds enclose the whole horizon circle, independent of which events exist.
 * Keep longitudes in the observer's world copy across the date line. A circle
 * reaching either pole spans all longitudes; zero height fits the origin alone.
 */
export const horizonFitBounds = (location: Coordinates, distanceKm: number | null): DirectionLineFitBounds | null => {
    if (distanceKm === null || !Number.isFinite(distanceKm) || distanceKm < 0
        || !Number.isFinite(location.lat) || Math.abs(location.lat) > 90 || !Number.isFinite(location.lon)) {
        return null;
    }
    const radians = Math.PI / 180;
    const angularRadius = distanceKm / EARTH_RADIUS_KM;
    const latitude = location.lat * radians;
    const reachesPole = Math.abs(latitude) + angularRadius >= Math.PI / 2;
    const longitudeRadius = reachesPole ? 180
        : Math.asin(Math.min(1, Math.sin(angularRadius) / Math.cos(latitude))) / radians;
    return [
        [Math.max(-90, location.lat - angularRadius / radians), location.lon - longitudeRadius],
        [Math.min(90, location.lat + angularRadius / radians), location.lon + longitudeRadius],
    ];
};

const escapeText = (value: string) => value.replace(/[&<>"']/g, character =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

type LabelRect = { left: number; top: number; width: number; height: number };
const LABEL_GAP_PX = 6;
const LINE_WIDTH_PX = 3;
const LINE_DASH_PX = 4;
const LINE_GAP_PX = 5;

/** Move text by the shortest vertical distance that clears earlier labels and
 * every endpoint circle. Geographic markers and horizontal anchoring stay fixed.
 * Actual DOM dimensions keep translated labels and different distance units safe.
 */
export const layoutHorizonLabels = (labels: LabelRect[], endpoints: LabelRect[]): LabelRect[] => {
    const occupied = [...endpoints];
    return labels.map(label => {
        const neighbours = occupied.filter(other => label.left < other.left + other.width + LABEL_GAP_PX
            && label.left + label.width + LABEL_GAP_PX > other.left);
        const candidates = [label.top, ...neighbours.flatMap(other => [
            other.top - LABEL_GAP_PX - label.height,
            other.top + other.height + LABEL_GAP_PX,
        ])].sort((a, b) => Math.abs(a - label.top) - Math.abs(b - label.top) || a - b);
        const top = candidates.find(candidate => neighbours.every(other =>
            candidate + label.height + LABEL_GAP_PX <= other.top
            || candidate >= other.top + other.height + LABEL_GAP_PX))!;
        // DOMRect exposes dimensions through prototype getters, not own fields.
        const placed = { left: label.left, top, width: label.width, height: label.height };
        occupied.push(placed);
        return placed;
    });
};

/** Own geographic layers and the view-change listener; destroy releases both. */
export const createEventHorizonOverlay = (map: L.LeafletGlMap) => {
    let group: L.LayerGroup | null = null;
    const markers: L.Marker[] = [];
    const layoutEvents = ['zoomend', 'moveend', 'resize'] as const;
    // Windy's renderer resets its SVG transform on moveend/viewreset, after zoomend.
    const strokeEvents = ['zoom', 'moveend', 'viewreset'] as const;
    let listening = false;
    /** Windy scales the outer SVG during animated zoom, beyond the scope of
     * non-scaling-stroke. Compensate using the actual screen transform, including
     * its reset after reprojection, so widths and dash lengths stay in pixels.
     */
    const updateLineStrokes = () => {
        const elements = map.getContainer().querySelectorAll<SVGPathElement>('.event-horizon-line');
        const scaledElements = Array.from(elements).flatMap(element => {
            const transform = element.getScreenCTM();
            const scale = transform ? Math.hypot(transform.a, transform.b) : 0;
            return Number.isFinite(scale) && scale > 0 ? [{ element, scale }] : [];
        });
        // Read every transform before writing attributes to avoid interleaving layout.
        for (const { element, scale } of scaledElements) {
            element.setAttribute('stroke-width', String(LINE_WIDTH_PX / scale));
            element.setAttribute('stroke-dasharray', `${LINE_DASH_PX / scale} ${LINE_GAP_PX / scale}`);
        }
    };
    const layoutLabels = () => {
        const elements = markers.flatMap(marker => {
            const root = marker.getElement();
            const label = root?.querySelector<HTMLElement>('.event-horizon-label');
            return root && label ? [{ root, label }] : [];
        });
        // Reset all preferred positions, then batch reads and writes to avoid
        // accumulating offsets or repeatedly forcing layout on map movement.
        elements.forEach(({ label }) => { label.style.transform = ''; });
        const boxes = elements.map(({ label }) => label.getBoundingClientRect());
        const endpoints = elements.map(({ root }) => root.getBoundingClientRect());
        const placed = layoutHorizonLabels(boxes, endpoints);
        elements.forEach(({ label }, index) => {
            label.style.transform = `translateY(${placed[index].top - boxes[index].top}px)`;
        });
    };
    const destroy = () => {
        if (listening) {
            layoutEvents.forEach(event => map.off(event, layoutLabels));
            strokeEvents.forEach(event => map.off(event, updateLineStrokes));
        }
        listening = false;
        markers.length = 0;
        group?.remove();
        group = null;
    };
    return {
        destroy,
        render(location: Coordinates, points: ReturnType<typeof eventHorizonPoints>, distanceLabel: string, language: 'zh' | 'en', opacityPercent: number) {
            destroy();
            group = new L.LayerGroup().addTo(map);
            const opacity = Number.isFinite(opacityPercent) ? Math.max(0, Math.min(100, opacityPercent)) / 100 : 1;
            // The observing point remains visible while elevation/events load or
            // no selected event exists. Place its label first so ray labels avoid it.
            const originLabel = language === 'zh' ? '当前定位点' : 'Selected location';
            const originIcon = new L.DivIcon({
                className: 'sun-path-marker sun-path-marker--origin event-horizon-origin',
                iconSize: [16, 16], iconAnchor: [8, 8],
                html: `<span role="img" aria-label="${originLabel}"></span><div class="event-horizon-label" aria-hidden="true" style="position:absolute;left:20px;top:-24px;white-space:nowrap;padding:2px 5px;color:#eee7ff;font:12px/15px sans-serif">${originLabel}</div>`,
            });
            markers.push(new L.Marker([location.lat, location.lon], {
                icon: originIcon, opacity, interactive: false, keyboard: false, zIndexOffset: 1000,
            }).addTo(group));
            for (const item of points) {
                const definition = HORIZON_EVENTS.find(event => event.event === item.event)!;
                const sun = definition.body === 'sun';
                const color = sun ? '#ffd166' : definition.body === 'moon' ? '#8ec5ff' : '#9de0b7';
                const name = language === 'zh' ? `${definition.zh}地平线` : `${definition.en} horizon`;
                const label = escapeText(`${name} · ${distanceLabel}`);
                const labelSide = Math.sin(item.azimuth * Math.PI / 180) >= 0 ? 'right' : 'left';
                const shortName = definition.body === 'galactic'
                    ? (language === 'zh' ? (item.event === 'milkywayrise' ? '银心升' : '银心落')
                        : (item.event === 'milkywayrise' ? 'GC rise' : 'GC set'))
                    : language === 'zh' ? definition.zh : definition.en;
                for (const segment of splitPolylineAtDateLine(item.line)) {
                    new L.Polyline(segment.map(point => [point.lat, point.lon] as [number, number]), {
                        color, weight: LINE_WIDTH_PX, dashArray: `${LINE_DASH_PX} ${LINE_GAP_PX}`, opacity, interactive: false,
                        className: 'event-horizon-line',
                    }).addTo(group);
                }
                const icon = new L.DivIcon({
                    // Anchor the symbol's horizon midpoint to the geographic endpoint.
                    className: 'event-horizon-marker', iconSize: [20, 20], iconAnchor: [10, 15],
                    // Prefer labels just above and inward from their endpoints;
                    // layoutLabels resolves actual screen collisions after mounting.
                    html: `<span role="img" aria-label="${label}" style="display:block;width:20px;height:20px;filter:drop-shadow(0 1px 1px #17212a)">${renderHorizonIcon(definition.body, 20, color)}</span><span class="event-horizon-label" aria-hidden="true" style="position:absolute;${labelSide}:24px;top:-28px;white-space:nowrap;text-align:center;padding:2px 5px;color:${color};font:12px/15px sans-serif">${shortName}<br>${escapeText(distanceLabel)}</span>`,
                });
                // Apply opacity once to the entire marker, including its text label.
                markers.push(new L.Marker([item.point.lat, item.point.lon], { icon, opacity, interactive: false, keyboard: false }).addTo(group));
            }
            layoutEvents.forEach(event => map.on(event, layoutLabels));
            strokeEvents.forEach(event => map.on(event, updateLineStrokes));
            listening = true;
            updateLineStrokes();
            layoutLabels();
        },
    };
};

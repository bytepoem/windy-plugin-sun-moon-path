import { EquatorFromVector, Horizon, MakeTime, Observer, RotateVector, Rotation_GAL_EQJ, Vector } from 'astronomy-engine';
import { cloudBodyPosition, cloudGalacticCenterPosition } from './cloudGeometry';
import { projectRainbowDirection, type SkyDirection } from './rainbowGeometry';
import type { Coordinates } from './solar';

const HORIZON_RADIUS = 106;
const ICON_SIZE = 280;

export interface EventSkyState {
    location: Coordinates;
    timestamp: number;
    timeLabel: string;
    language: 'zh' | 'en';
    opacity: number;
}

/** Sample the galactic equator in the same fixed-equatorial convention as our
 * galactic-centre planner. Band width is illustrative, not a visibility model.
 */
export const eventSkyGeometry = (timestamp: number, location: Coordinates) => {
    const date = new Date(timestamp);
    // Vector requires AstroTime; all galactic samples share the same observation instant.
    const time = MakeTime(date);
    const observer = new Observer(location.lat, location.lon, 0);
    const rotation = Rotation_GAL_EQJ();
    const band = Array.from({ length: 361 }, (_, longitude) => {
        const radians = longitude * Math.PI / 180;
        const equatorial = EquatorFromVector(RotateVector(rotation,
            new Vector(Math.cos(radians), Math.sin(radians), 0, time)));
        return Horizon(date, observer, equatorial.ra, equatorial.dec, 'normal');
    });
    return {
        sun: cloudBodyPosition('sun', timestamp, location),
        moon: cloudBodyPosition('moon', timestamp, location),
        center: cloudGalacticCenterPosition(timestamp, location),
        band,
    };
};

const escapeText = (value: string) => value.replace(/[&<>"']/g, character =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

/** A fixed pixel sky projection, separate from the existing geographic long rays.
 * Solid upper and dashed lower hemispheres remain distinguishable when projected together.
 */
export const eventSkySvg = (state: EventSkyState): string => {
    const geometry = eventSkyGeometry(state.timestamp, state.location);
    const zh = state.language === 'zh';
    const project = (direction: SkyDirection) => projectRainbowDirection(direction, HORIZON_RADIUS);
    const grid = [0, 30, 60].map(altitude => {
        const radius = -project({ azimuth: 0, altitude }).y;
        return `<circle r="${radius}" stroke-opacity="${altitude === 0 ? 0.8 : 0.3}"/><text x="4" y="${-radius + 12}">${altitude}°</text>`;
    }).join('');
    const cardinal = [[0, -118, zh ? '北' : 'N'], [119, 4, zh ? '东' : 'E'],
        [0, 121, zh ? '南' : 'S'], [-119, 4, zh ? '西' : 'W']]
        .map(([x, y, name]) => `<text x="${x}" y="${y}" text-anchor="middle">${name}</text>`).join('');
    // Split at the horizon before styling. Adjacent 1° samples bound crossing
    // error; interpolation places the shared endpoint on the horizon ring.
    const segments: { below: boolean; points: SkyDirection[] }[] = [];
    for (let index = 1; index < geometry.band.length; index += 1) {
        const a = geometry.band[index - 1];
        const b = geometry.band[index];
        const append = (start: SkyDirection, end: SkyDirection, below: boolean) => {
            const previous = segments.at(-1);
            if (previous?.below === below) {
                previous.points.push(end);
            } else {
                segments.push({ below, points: [start, end] });
            }
        };
        if ((a.altitude < 0) !== (b.altitude < 0)) {
            const fraction = a.altitude / (a.altitude - b.altitude);
            const delta = ((b.azimuth - a.azimuth + 540) % 360) - 180;
            const crossing = { altitude: 0, azimuth: a.azimuth + delta * fraction };
            append(a, crossing, a.altitude < 0);
            append(crossing, b, b.altitude < 0);
        } else {
            append(a, b, a.altitude < 0);
        }
    }
    const band = segments.sort((a, b) => Number(b.below) - Number(a.below)).map(segment => {
        const path = segment.points.map((point, index) => {
            const { x, y } = project(point);
            return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
        }).join(' ');
        return `<g class="event-sky-band" opacity="${segment.below ? 0.35 : 0.8}">
            <path d="${path}" stroke="#57c58b" stroke-width="9" stroke-opacity="0.25" ${segment.below ? 'stroke-dasharray="3 5"' : ''}/>
            <path d="${path}" stroke="#a3ebc1" stroke-width="1.5" ${segment.below ? 'stroke-dasharray="3 5"' : ''}/></g>`;
    }).join('');
    const bodies = ([['sun', geometry.sun, '#ffd166', zh ? '太阳' : 'Sun'],
        ['moon', geometry.moon, '#f5efcf', zh ? '月亮' : 'Moon'],
        ['center', geometry.center, '#9de0b7', zh ? '银心' : 'GC']] as const).map(([body, direction, color, name]) => {
        const { x, y } = project(direction);
        const below = direction.altitude < 0;
        const fill = below ? '#17212a' : color;
        const rays = Array.from({ length: 8 }, (_, index) => {
            const angle = index * Math.PI / 4;
            return `<line x1="${5 * Math.cos(angle)}" y1="${5 * Math.sin(angle)}" x2="${8 * Math.cos(angle)}" y2="${8 * Math.sin(angle)}"/>`;
        }).join('');
        const icon = body === 'sun' ? `<circle r="3" fill="${fill}"/>${rays}`
            : body === 'moon' ? `<path d="M5 3A6 6 0 0 1-3-5A6.5 6.5 0 1 0 5 3Z" fill="${fill}"/>`
                : `<ellipse rx="8" ry="3.5" transform="rotate(-35)"/><circle r="2" fill="${fill}"/>`;
        return `<g class="event-sky-${body}" stroke="${color}" stroke-width="1.5">
            <line x1="0" y1="0" x2="${x}" y2="${y}" opacity="0.65" ${below ? 'stroke-dasharray="4 3"' : ''}/>
            <g transform="translate(${x},${y})">${icon}</g>
            <text x="${x + (x >= 0 ? -10 : 10)}" y="${y + (body === 'moon' ? -12 : 18)}" text-anchor="${x >= 0 ? 'end' : 'start'}">${name}${below ? ' ↓' : ''} ${direction.altitude.toFixed(1)}°</text></g>`;
    }).join('');
    const opacity = Number.isFinite(state.opacity) ? Math.min(100, Math.max(0, state.opacity)) / 100 : 1;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="-140 -140 280 280" style="overflow:visible;pointer-events:none" role="img" aria-label="${zh ? '日月银河天空方向图' : 'Sun, Moon and Milky Way sky chart'}">
        <style>.event-sky-overlay text{fill:#f2f4fa;stroke:#17212a;stroke-width:3px;paint-order:stroke;font:11px sans-serif}</style>
        <g opacity="${opacity}" fill="none" stroke="#e6edf4" stroke-width="1">
            <circle r="106" fill="#17212a" fill-opacity="0.12"/>${grid}${cardinal}${band}${bodies}<circle r="3" fill="#f2f4fa"/>
            <text x="0" y="-132" text-anchor="middle">${escapeText(state.timeLabel)}</text>
        </g></svg>`;
};

/** Own one noninteractive Leaflet marker; no additional listeners or timers. */
export const createEventSkyOverlay = (map: L.LeafletGlMap) => {
    let marker: L.Marker | null = null;
    return {
        render(state: EventSkyState) {
            const icon = new L.DivIcon({ className: 'event-sky-overlay', html: eventSkySvg(state),
                iconSize: [ICON_SIZE, ICON_SIZE], iconAnchor: [ICON_SIZE / 2, ICON_SIZE / 2] });
            if (marker) {
                marker.setLatLng([state.location.lat, state.location.lon]).setIcon(icon);
            } else {
                marker = new L.Marker([state.location.lat, state.location.lon], {
                    icon, interactive: false, keyboard: false,
                }).addTo(map);
            }
        },
        destroy() {
            marker?.remove();
            marker = null;
        },
    };
};

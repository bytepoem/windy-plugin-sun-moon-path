import { calculateRainbow, PRIMARY_RAINBOW_RADIUS, projectRainbowDirection, rainbowSourceAboveHorizon, SECONDARY_RAINBOW_RADIUS, type SkyDirection } from './rainbowGeometry';
import type { Coordinates } from './solar';

const HORIZON_RADIUS = 106;
const ICON_SIZE = HORIZON_RADIUS * 2 + 32;
// Seven screen-space stripes keep the bow legible without changing its reference angle.
const RAINBOW_BAND_WIDTH = 5.6;
// Ordered inner to outer. The secondary bow reverses them.
const COLORS = ['#9b70e8', '#597bea', '#4aa9ef', '#62c887', '#edda63', '#efa34f', '#ee7067'];

/** Offset along the projected curve's normal, so adjacent colours do not cover one another.
 * Cone samples have a consistent winding for above-horizon sources. Each clipped segment
 * retains that winding, including the hidden half of a full circle.
 */
const stripePath = (points: SkyDirection[], offset: number): string => {
    const projected = points.map(point => projectRainbowDirection(point, HORIZON_RADIUS));
    return projected.map((point, index) => {
        const previous = projected[Math.max(0, index - 1)];
        const next = projected[Math.min(projected.length - 1, index + 1)];
        const dx = next.x - previous.x;
        const dy = next.y - previous.y;
        const length = Math.hypot(dx, dy);
        const x = point.x + (length > 0 ? dy / length * offset : 0);
        const y = point.y - (length > 0 ? dx / length * offset : 0);
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
};

export interface RainbowOverlayState {
    location: Coordinates;
    source: SkyDirection | null;
    body: 'sun' | 'moon';
    secondary: boolean;
    fullCircle: boolean;
    opacity: number;
    language: 'zh' | 'en';
}

/** Draw a non-interactive sky chart anchored to the selected map location.
 * A single SVG marker avoids geographic-distance implications and owns no map listeners.
 */
export const rainbowOverlaySvg = (state: RainbowOverlayState): string => {
    const zh = state.language === 'zh';
    const opacity = Number.isFinite(state.opacity) ? Math.min(100, Math.max(0, state.opacity)) / 100 : 1;
    const grid = [0, 30, 60].map(altitude => {
        // Grid and rainbow must use the same projection, including its nonlinear altitude spacing.
        const radius = -projectRainbowDirection({ azimuth: 0, altitude }, HORIZON_RADIUS).y;
        return `<circle r="${radius}" stroke-opacity="${altitude === 0 ? 0.85 : 0.35}"/><text x="4" y="${-radius + 12}">${altitude}°</text>`;
    }).join('');
    const labels = [[0, -HORIZON_RADIUS - 9, zh ? '北' : 'N'], [HORIZON_RADIUS + 12, 4, zh ? '东' : 'E'],
        [0, HORIZON_RADIUS + 16, zh ? '南' : 'S'], [-HORIZON_RADIUS - 12, 4, zh ? '西' : 'W']]
        .map(([x, y, label]) => `<text x="${x}" y="${y}" text-anchor="middle">${label}</text>`).join('');
    const aboveHorizonPaths: string[] = [];
    const belowHorizonPaths: string[] = [];
    if (rainbowSourceAboveHorizon(state.source)) {
        for (const secondary of state.secondary ? [false, true] : [false]) {
            const arc = calculateRainbow(state.source, secondary ? SECONDARY_RAINBOW_RADIUS : PRIMARY_RAINBOW_RADIUS);
            COLORS.forEach((color, index) => {
                for (const segment of arc?.segments ?? []) {
                    if (segment.belowHorizon && !state.fullCircle) {continue;}
                    const stripeWidth = RAINBOW_BAND_WIDTH / COLORS.length;
                    // Orthographic projection folds the lower hemisphere: increasing optical
                    // radius lies on opposite screen-normal sides above and below the horizon.
                    const outwardSign = segment.belowHorizon ? 1 : -1;
                    const path = stripePath(segment.points, outwardSign * (index - (COLORS.length - 1) / 2) * stripeWidth);
                    const paths = segment.belowHorizon ? belowHorizonPaths : aboveHorizonPaths;
                    paths.push(`<path class="rainbow-band" d="${path}" stroke="${secondary ? COLORS[COLORS.length - 1 - index] : color}" stroke-width="${stripeWidth}" stroke-linejoin="round" opacity="${(secondary ? 0.65 : 1) * (segment.belowHorizon ? 0.55 : 1)}" ${segment.belowHorizon ? 'stroke-dasharray="4 3"' : ''}/>`);
                }
            });
        }
    }
    // This is a direction symbol, not a prediction or an angular-size model of a glory.
    let oppositeSource = '';
    if (rainbowSourceAboveHorizon(state.source)) {
        const direction = { azimuth: (state.source.azimuth + 180) % 360, altitude: -state.source.altitude };
        const position = projectRainbowDirection(direction, HORIZON_RADIUS);
        const name = state.body === 'sun' ? (zh ? '反太阳点' : 'Antisolar point') : (zh ? '反月亮点' : 'Antilunar point');
        const rings = COLORS.map((color, index) => `<circle r="${(COLORS.length - index) * 0.75}" fill="${color}"/>`).join('');
        oppositeSource = `<g class="rainbow-opposite-source" transform="translate(${position.x},${position.y})" stroke="none"><title>${name}</title><circle r="6.25" fill="#e6edf4" fill-opacity="0.7"/>${rings}</g>`;
    }
    // Marker and rainbow use exactly the same selected light source and planning instant.
    let sourceBearing = '';
    if (state.source && Number.isFinite(state.source.azimuth) && Number.isFinite(state.source.altitude)
        && Math.abs(state.source.altitude) <= 90) {
        const endpoint = projectRainbowDirection({ ...state.source, altitude: 0 }, HORIZON_RADIUS);
        const position = projectRainbowDirection(state.source, HORIZON_RADIUS);
        const belowHorizon = state.source.altitude < 0;
        const color = state.body === 'sun' ? '#ffd166' : '#f5efcf';
        const rays = Array.from({ length: 8 }, (_, index) => {
            const angle = index * Math.PI / 4;
            return `<line x1="${5 * Math.cos(angle)}" y1="${5 * Math.sin(angle)}" x2="${8 * Math.cos(angle)}" y2="${8 * Math.sin(angle)}"/>`;
        }).join('');
        const name = state.body === 'sun' ? (zh ? '太阳' : 'Sun') : (zh ? '月亮' : 'Moon');
        const label = `${name} ${belowHorizon ? '↓ ' : ''}${((state.source.azimuth % 360 + 360) % 360).toFixed(1)}°`;
        const icon = state.body === 'sun' ? `<circle r="3" fill="${belowHorizon ? '#17212a' : color}"/>${rays}`
            : `<path class="rainbow-moon-icon" d="M5 3A6 6 0 0 1-3-5A6.5 6.5 0 1 0 5 3Z" fill="${belowHorizon ? '#17212a' : color}"/>`;
        sourceBearing = `<g class="rainbow-source-bearing" stroke="${color}" stroke-width="1.5">
            <line x1="0" y1="0" x2="${endpoint.x}" y2="${endpoint.y}" opacity="0.8" ${belowHorizon ? 'stroke-dasharray="4 3"' : ''}/>
            <g transform="translate(${position.x},${position.y})">${icon}</g>
            <text x="${position.x + (position.x >= 0 ? -10 : 10)}" y="${position.y + 16}" text-anchor="${position.x >= 0 ? 'end' : 'start'}">${label}</text>
        </g>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="${-ICON_SIZE / 2} ${-ICON_SIZE / 2} ${ICON_SIZE} ${ICON_SIZE}" style="overflow:visible;pointer-events:none" aria-hidden="true">
        <g opacity="${opacity}" fill="none" stroke="#e6edf4" stroke-width="1">
            <style>.rainbow-sky-overlay text{fill:#f2f4fa;stroke:#17212a;stroke-width:3px;paint-order:stroke;font:11px sans-serif}</style>
            ${grid}${labels}<circle r="3" fill="#f2f4fa"/>${belowHorizonPaths.join('')}${aboveHorizonPaths.join('')}${oppositeSource}${sourceBearing}
        </g></svg>`;
};

export const createRainbowOverlay = (map: L.LeafletGlMap) => {
    let marker: L.Marker | null = null;
    const destroy = () => {
        marker?.remove();
        marker = null;
    };
    const render = (state: RainbowOverlayState) => {
        const icon = new L.DivIcon({ className: 'rainbow-sky-overlay', html: rainbowOverlaySvg(state),
            iconSize: [ICON_SIZE, ICON_SIZE], iconAnchor: [ICON_SIZE / 2, ICON_SIZE / 2] });
        if (marker) {
            marker.setLatLng([state.location.lat, state.location.lon]).setIcon(icon);
        } else {
            marker = new L.Marker([state.location.lat, state.location.lon], {
                icon, interactive: false, keyboard: false,
            }).addTo(map);
        }
    };
    return { render, destroy };
};

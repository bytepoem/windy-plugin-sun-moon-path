const RAD = Math.PI / 180;
const normalize = (angle: number) => ((angle % 360) + 360) % 360;
const clamp = (value: number) => Math.max(-1, Math.min(1, value));

export const PRIMARY_RAINBOW_RADIUS = 42;
export const SECONDARY_RAINBOW_RADIUS = 51;

export interface SkyDirection {
    azimuth: number;
    altitude: number;
}

/** Display policy: keep the geometric solver independent, but hide bows when
 * their light source is below the horizontal horizon, even in full-circle mode.
 */
export const rainbowSourceAboveHorizon = (source: SkyDirection | null): source is SkyDirection =>
    source !== null && Number.isFinite(source.azimuth) && Number.isFinite(source.altitude)
    && source.altitude >= 0 && source.altitude <= 90;

export interface RainbowArc {
    radius: number;
    center: SkyDirection;
    topAltitude: number;
    leftAzimuth: number | null;
    rightAzimuth: number | null;
    segments: { belowHorizon: boolean; points: SkyDirection[] }[];
}

/** Build a small circle about the antisolar/antilunar direction, in local ENU space.
 * Negative light-source altitudes still have valid geometric directions. This
 * does not establish illumination: droplets, terrain and lunar brightness are not modelled.
 * Exact horizon crossings are inserted before clipping, so arcs do not bridge the ground.
 */
export const calculateRainbow = (source: SkyDirection, radius = PRIMARY_RAINBOW_RADIUS): RainbowArc | null => {
    if (![source.azimuth, source.altitude, radius].every(Number.isFinite)
        || Math.abs(source.altitude) > 90 || radius <= 0 || radius >= 90) {return null;}
    const bearing = normalize(source.azimuth + 180) * RAD;
    const altitude = source.altitude * RAD;
    const cone = radius * RAD;
    const sinAltitude = Math.sin(altitude);
    const cosAltitude = Math.cos(altitude);
    const pointAt = (phase: number): SkyDirection => {
        const forward = cosAltitude * Math.cos(cone) + sinAltitude * Math.sin(cone) * Math.cos(phase);
        const right = Math.sin(cone) * Math.sin(phase);
        const up = -sinAltitude * Math.cos(cone) + cosAltitude * Math.sin(cone) * Math.cos(phase);
        const east = forward * Math.sin(bearing) + right * Math.cos(bearing);
        const north = forward * Math.cos(bearing) - right * Math.sin(bearing);
        return { azimuth: normalize(Math.atan2(east, north) / RAD), altitude: Math.asin(clamp(up)) / RAD };
    };
    const intersectsHorizon = Math.abs(source.altitude) <= radius;
    const crossingPhase = intersectsHorizon
        ? Math.acos(clamp(Math.tan(altitude) / Math.tan(cone))) : null;
    // Orthographic projection is continuous at both poles. A 1° phase step
    // bounds the chord error below 0.01px at the map's current display radius.
    const phases = Array.from({ length: 361 }, (_, index) => (index - 180) * RAD);
    if (crossingPhase !== null) {phases.push(-crossingPhase, crossingPhase);}
    const ordered = [...new Set(phases)].sort((a, b) => a - b);
    const segments: RainbowArc['segments'] = [];
    for (let index = 1; index < ordered.length; index += 1) {
        const previous = ordered[index - 1];
        const next = ordered[index];
        const belowHorizon = pointAt((previous + next) / 2).altitude < 0;
        const last = segments.at(-1);
        if (last && last.belowHorizon === belowHorizon) {
            last.points.push(pointAt(next));
        } else {
            segments.push({ belowHorizon, points: [pointAt(previous), pointAt(next)] });
        }
    }
    const halfWidth = intersectsHorizon
        ? Math.acos(clamp(Math.cos(cone) / cosAltitude)) / RAD : null;
    const center = { azimuth: normalize(source.azimuth + 180), altitude: -source.altitude };
    return {
        // Once the circle passes over the zenith, the maximum altitude decreases
        // again. Do not return values above 90° for deeply negative source altitudes.
        radius, center, topAltitude: 90 - Math.abs(90 + source.altitude - radius),
        leftAzimuth: halfWidth === null ? null : normalize(center.azimuth - halfWidth),
        rightAzimuth: halfWidth === null ? null : normalize(center.azimuth + halfWidth),
        segments,
    };
};

/** Top-down orthographic sky chart: project the unit direction onto the EN plane.
 * The cosine altitude radius preserves the bow's outward curvature.
 * Above/below-horizon directions can overlap in 2D;
 * the renderer distinguishes them using solid/dashed strokes. Radius is pixels.
 */
export const projectRainbowDirection = (point: SkyDirection, horizonRadius: number) => {
    const radius = horizonRadius * Math.cos(point.altitude * RAD);
    return { x: radius * Math.sin(point.azimuth * RAD), y: -radius * Math.cos(point.azimuth * RAD) };
};

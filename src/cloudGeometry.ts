import { Body, Equator, Horizon, KM_PER_AU, Observer } from 'astronomy-engine';
import { EARTH_RADIUS_KM, GALACTIC_CENTER_RIGHT_ASCENSION_DEG, GALACTIC_CENTER_DECLINATION_DEG,
    CURRENT_DIRECTION_LENGTH_KM, destinationPoint, type Coordinates } from './solar';

const RAD = Math.PI / 180;

/** Use topocentric, of-date apparent equatorial coordinates, including aberration.
 * Keep true and refracted altitude separate: cloud intersections use apparent
 * direction, while the twilight illumination limit uses geometric altitude.
 */
export const cloudBodyPosition = (body: 'sun' | 'moon', timestamp: number, location: Coordinates) => {
    const date = new Date(timestamp);
    const observer = new Observer(location.lat, location.lon, 0);
    const equatorial = Equator(body === 'sun' ? Body.Sun : Body.Moon, date, observer, true, true);
    const geometric = Horizon(date, observer, equatorial.ra, equatorial.dec);
    const apparent = Horizon(date, observer, equatorial.ra, equatorial.dec, 'normal');
    // Normal refraction already tapers below -1 degrees. Elevated-observer
    // sunsets can occur there; keep their zero-height reference intersection.
    // Match Astronomy Engine's lunar equatorial radius. The upper limb can be
    // visible while the centre is below zero at moonrise/moonset.
    const moonUpperLimbAltitude = body === 'moon'
        ? apparent.altitude + Math.asin(1738.1 / (equatorial.dist * KM_PER_AU)) / RAD : null;
    return { azimuth: apparent.azimuth, altitude: apparent.altitude, geometricAltitude: geometric.altitude,
        moonUpperLimbAltitude,
        sightlineAvailable: Number.isFinite(apparent.altitude) && Math.abs(apparent.altitude) <= 90 };
};

/** Fixed equatorial Milky Way photography reference shared with the visibility planner.
 * Use its RA/Dec directly with the date's sidereal rotation (no J2000 precession),
 * matching the PlanIt screenshot convention. This is a photographic band reference,
 * not an astrometric Sgr A* position. Keep true and refracted altitudes separate.
 */
export const cloudGalacticCenterPosition = (timestamp: number, location: Coordinates) => {
    const date = new Date(timestamp);
    const observer = new Observer(location.lat, location.lon, 0);
    const equatorial = { ra: GALACTIC_CENTER_RIGHT_ASCENSION_DEG / 15, dec: GALACTIC_CENTER_DECLINATION_DEG };
    const geometric = Horizon(date, observer, equatorial.ra, equatorial.dec);
    const apparent = Horizon(date, observer, equatorial.ra, equatorial.dec, 'normal');
    return { azimuth: apparent.azimuth, altitude: apparent.altitude, geometricAltitude: geometric.altitude,
        moonUpperLimbAltitude: null,
        sightlineAvailable: Number.isFinite(apparent.altitude) && apparent.altitude >= 0 && apparent.altitude <= 90 };
};

/** Resolve auto from the calculation instant, never from the forecast step or device clock.
 * Solar blocking requires its apparent centre above the horizon; lunar visibility
 * continues to include the upper limb. Height-only twilight references are independent.
 */
export const cloudTargetPosition = (target: 'auto' | 'sun' | 'moon' | 'milkyway', timestamp: number, location: Coordinates) => {
    if (target === 'milkyway') {
        return { body: target, position: cloudGalacticCenterPosition(timestamp, location) };
    }
    const sun = cloudBodyPosition('sun', timestamp, location);
    const body = target === 'auto' ? (sun.altitude >= 0 ? 'sun' : 'moon') : target;
    const position = body === 'sun' ? sun : cloudBodyPosition('moon', timestamp, location);
    return { body, position: { ...position,
        sightlineAvailable: position.sightlineAvailable && (body === 'sun'
            ? position.altitude >= 0 : (position.moonUpperLimbAltitude ?? -90) >= 0) } };
};

/** Apparent-direction reference intersection, not a refracted physical ray trace.
 * All cloud distances share a zero-height reference; camera terrain elevation is
 * deliberately not an input. Heights are metres above that reference, not camera
 * clearance obtained by subtracting terrain. Distances are surface arcs. The apparent ray
 * may pass through the ideal sphere before reaching the cloud shell; do not suppress
 * that planning reference with a geometric Earth-occlusion test.
 */
export const cloudSightDistance = (cloudHeightM: number, altitudeDeg: number): number | null => {
    if (![cloudHeightM, altitudeDeg].every(Number.isFinite)
        || cloudHeightM <= 0 || cloudHeightM > 30_000
        || Math.abs(altitudeDeg) > 90) {return null;}
    const observer = EARTH_RADIUS_KM;
    const cloud = EARTH_RADIUS_KM + cloudHeightM / 1_000;
    const altitude = altitudeDeg * RAD;
    const b = observer * Math.sin(altitude);
    const discriminant = cloud * cloud - (observer * Math.cos(altitude)) ** 2;
    if (discriminant < 0) {return null;}
    const roots = [-b - Math.sqrt(discriminant), -b + Math.sqrt(discriminant)].filter(t => t >= -1e-8);
    if (!roots.length) {return null;}
    const rayLength = Math.max(0, Math.min(...roots));
    return EARTH_RADIUS_KM * Math.atan2(
        rayLength * Math.cos(altitude), observer + rayLength * Math.sin(altitude),
    );
};

/** Limiting sunset geometry for a visible horizon cloud and blockers at the same height.
 * These are reference envelopes, not a spatial weather prediction or a current illumination boundary.
 */
export const cloudTwilightDistances = (cloudHeightM: number) => {
    if (!Number.isFinite(cloudHeightM)
        || cloudHeightM <= 0 || cloudHeightM > 30_000) {return null;}
    const cloudAngle = Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + cloudHeightM / 1_000));
    // Planit's reference envelopes use a sea-level origin; camera elevation must
    // not add the observer's horizon distance to every circle and limiting angle.
    return {
        horizonKm: EARTH_RADIUS_KM * cloudAngle,
        tangentKm: EARTH_RADIUS_KM * 2 * cloudAngle,
        clearKm: EARTH_RADIUS_KM * 3 * cloudAngle,
        minimumSunAltitude: -2 * cloudAngle / RAD,
    };
};

export const cloudArc = (location: Coordinates, distanceKm: number, bearing: number, width: number): Coordinates[] => {
    // Dense small-circle samples avoid visible corners at regional map zooms.
    const steps = Math.max(1, Math.ceil(width / 0.25));
    return Array.from({ length: steps + 1 }, (_, index) =>
        destinationPoint(location, bearing - width / 2 + width * index / steps, distanceKm));
};

/** Resolve local wall time without accepting invalid dates or silently shifting a DST gap. */
export const cloudTimeInstant = (date: string, clock: string, timeZone: string): number | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(clock)) {return null;}
    const naive = Date.parse(`${date}T${clock}:00Z`);
    if (!Number.isFinite(naive)) {return null;}
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    const local = (instant: number) => {
        const p = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, part.value]));
        return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
    };
    // Sample offsets on both sides of a transition; choose the first occurrence of an ambiguous time.
    const candidates = [-36, 0, 36].map(hours => {
        const probe = naive + hours * 3_600_000;
        return naive - (Date.parse(`${local(probe)}:00Z`) - probe);
    }).filter(value => local(value) === `${date}T${clock}`);
    return candidates.length ? Math.min(...candidates) : null;
};

/** Map live-bearing layers use the same planning instant as cloud intersections.
 * An unavailable planning time must clear these lines, never fall back to now.
 */
export type CloudDirectionBody = 'sun' | 'moon' | 'milkyway';

export const cloudMapDirections = (timestamp: number | null, location: Coordinates, body: CloudDirectionBody) => {
    const empty = { currentSun: null, currentMoon: null, currentGalacticCenter: null };
    if (timestamp === null) {return empty;}
    const position = cloudTargetPosition(body, timestamp, location).position;
    const points = cloudBearingPath(location, position.azimuth, CURRENT_DIRECTION_LENGTH_KM);
    const direction = { azimuth: position.azimuth, altitude: position.altitude, endpoint: points[points.length - 1], points };
    if (body === 'sun') {return { ...empty, currentSun: direction };}
    if (body === 'moon') {return { ...empty, currentMoon: direction };}
    return { ...empty, currentGalacticCenter: direction };
};

/** Shared geodesic ray with fixed distance steps: overlapping rays have identical
 * vertices even when their total lengths differ. Mercator must not join only the endpoints.
 */
export const cloudBearingPath = (location: Coordinates, azimuth: number, distanceKm: number): Coordinates[] => {
    const points = Array.from({ length: Math.ceil(distanceKm / 2) }, (_, index) =>
        destinationPoint(location, azimuth, index * 2));
    points.push(destinationPoint(location, azimuth, distanceKm));
    return points;
};

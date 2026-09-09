import { describe, expect, it } from 'vitest';
import { cloudArc, cloudBearingPath, cloudMapDirections, cloudBodyPosition, cloudGalacticCenterPosition, cloudTargetPosition, cloudSightDistance, cloudTimeInstant, cloudTwilightDistances } from './cloudGeometry';
import { distanceKm, splitPolylineAtDateLine } from './solar';

describe('cloud geometry', () => {
    it.each([[2000, 106.62], [4000, 169.03], [6000, 218.03]])(
        'uses the same zero-height reference in the Panjiadong mountain case for %i m', (height, expected) => {
            expect(cloudSightDistance(height, 0.59504)).toBeCloseTo(expected, 2);
        },
    );
    it.each([
        [2_000, 160, 479, -2.9], [4_000, 226, 677, -4.1], [6_000, 276, 829, -5.0],
    ])('matches the reference horizon and twilight distances for %i m', (height, horizon, clear, altitude) => {
        const result = cloudTwilightDistances(height)!;
        expect(Math.round(result.horizonKm)).toBe(horizon);
        expect(Math.round(result.clearKm)).toBe(clear);
        expect(result.minimumSunAltitude).toBeCloseTo(altitude, 1);
        expect(result.tangentKm).toBeCloseTo(result.horizonKm * 2);
    });

    it('computes surface sightline distance and stays finite at the horizon', () => {
        expect(cloudSightDistance(6_000, 32.1)).toBeCloseTo(9.544, 2);
        expect(cloudSightDistance(6_000, 0)).toBeCloseTo(276.391, 2);
        expect(cloudSightDistance(6_000, 90)).toBeCloseTo(0);
        expect(cloudSightDistance(6_000, -0.1)).toBeGreaterThan(276.391);
    });

    it('keeps the horizon intersection and horizon envelope on the same reference sphere', () => {
        for (const height of [500, 2000, 4000, 6000]) {
            expect(cloudSightDistance(height, 0)).toBeCloseTo(cloudTwilightDistances(height)!.horizonKm, 6);
        }
    });

    it('rejects invalid geometry inputs instead of drawing NaN paths', () => {
        for (const height of [0, -100, NaN, Infinity, 30_001]) {
            expect(cloudTwilightDistances(height)).toBeNull();
            expect(cloudSightDistance(height, 10)).toBeNull();
        }
        expect(cloudSightDistance(6_000, 91)).toBeNull();
    });

    it('provides distinct geometric and apparent directions for both bodies', () => {
        const location = { lat: 23.1291, lon: 113.2644 };
        const time = Date.parse('2026-09-05T10:30:00Z');
        for (const body of ['sun', 'moon'] as const) {
            const position = cloudBodyPosition(body, time, location);
            expect(position.geometricAltitude).toBeLessThan(position.altitude);
            expect(position.azimuth).toBeGreaterThanOrEqual(0);
            expect(position.azimuth).toBeLessThan(360);
        }
    });

    it.each([[2000, 176.10], [4000, 241.96], [6000, 292.55]])(
        'reproduces the screenshot cloud intersection for %i m at its inferred apparent altitude', (height, expected) => {
            expect(cloudSightDistance(height, -0.141304)).toBeCloseTo(expected, 2);
        },
    );

    it('keeps near-sunset refraction and twilight geometry separate at Beiting', () => {
        const instant = cloudTimeInstant('2026-09-06', '18:39', 'Asia/Shanghai')!;
        const position = cloudBodyPosition('sun', instant, { lat: 23.052, lon: 113.370 });
        expect(position.geometricAltitude).toBeCloseTo(-0.744586, 5);
        expect(position.altitude).toBeCloseTo(-0.141583, 5);
        expect(cloudSightDistance(2000, position.altitude)).toBeGreaterThan(170);
        expect(position.geometricAltitude).toBeGreaterThan(cloudTwilightDistances(2000)!.minimumSunAltitude);
        expect(position.sightlineAvailable).toBe(true);
    });

    it('retains intersections at elevated-observer sunset below minus one degree', () => {
        const position = cloudBodyPosition('sun', Date.parse('2026-09-07T10:47:34.893Z'),
            { lat: 24.918759, lon: 112.658726 });
        expect(position.geometricAltitude).toBeLessThan(-2);
        expect(position.sightlineAvailable).toBe(true);
        const distances = [2000, 4000, 6000].map(height => cloudSightDistance(height, position.altitude));
        expect(distances.every(distance => distance !== null && Number.isFinite(distance) && distance > 0)).toBe(true);
        expect(distances[0]!).toBeLessThan(distances[1]!);
        expect(distances[1]!).toBeLessThan(distances[2]!);
    });

    it('builds a geodesic circle across the date line with no world-spanning segment', () => {
        const origin = { lat: 55, lon: 179 };
        const circle = cloudArc(origin, 829, 0, 360);
        expect(circle.slice(1).every((point, index) => distanceKm(circle[index], point) < 4)).toBe(true);
        expect(circle.every(point => Math.abs(distanceKm(origin, point) - 829) < 0.001)).toBe(true);
        const segments = splitPolylineAtDateLine(circle);
        expect(segments.length).toBeGreaterThan(1);
        for (const segment of segments) {
            expect(segment.every((point, i) => !i || Math.abs(point.lon - segment[i - 1].lon) <= 180)).toBe(true);
        }
    });
});

describe('cloud planning time', () => {
    it('uses the saved Panjiadong coordinates and distinguishes adjacent sunset minutes', () => {
        const location = { lat: 24.918758774730893, lon: 112.65872569226866 };
        for (const [clock, expected] of [
            ['18:38', [94.33, 154.32, 202.14]],
            ['18:39', [106.62, 169.04, 218.04]],
        ] as const) {
            const time = cloudTimeInstant('2026-09-06', clock, 'Asia/Shanghai')!;
            const position = cloudBodyPosition('sun', time, location);
            [2000, 4000, 6000].forEach((height, index) => {
                expect(cloudSightDistance(height, position.altitude)).toBeCloseTo(expected[index], 2);
            });
        }
    });
    it('matches the Panjiadong screenshot from coordinates and time, without an inferred angle input', () => {
        const location = { lat: 24.918759, lon: 112.658726 };
        const instant = cloudTimeInstant('2026-09-06', '18:39', 'Asia/Shanghai')!;
        const position = cloudBodyPosition('sun', instant, location);
        const screenshot = [106.62, 169.03, 218.03];
        [2000, 4000, 6000].forEach((height, index) => {
            expect(Math.abs(cloudSightDistance(height, position.altitude)! - screenshot[index])).toBeLessThan(0.01);
        });
    });
    it('resolves the location timezone independently of the computer timezone', () => {
        expect(cloudTimeInstant('2026-09-05', '18:30', 'Asia/Shanghai')).toBe(Date.parse('2026-09-05T10:30Z'));
        expect(cloudTimeInstant('2026-09-05', '00:15', 'Asia/Kathmandu')).toBe(Date.parse('2026-09-04T18:30Z'));
    });
    it('rejects DST gaps and chooses the first occurrence of a repeated clock time', () => {
        expect(cloudTimeInstant('2026-03-08', '02:30', 'America/New_York')).toBeNull();
        expect(cloudTimeInstant('2026-11-01', '01:30', 'America/New_York')).toBe(Date.parse('2026-11-01T05:30Z'));
    });
    it('rejects cleared and invalid inputs', () => {
        expect(cloudTimeInstant('2026-02-30', '12:00', 'UTC')).toBeNull();
        expect(cloudTimeInstant('2026-09-05', '', 'UTC')).toBeNull();
        expect(cloudTimeInstant('2026-09-05', '24:00', 'UTC')).toBeNull();
    });
});

describe('cloud obstruction targets', () => {
    const location = { lat: 23.1291, lon: 113.2644 };

    it.each([
        ['2026-09-09T04:00:00Z', 'sun'],
        ['2026-09-09T16:00:00Z', 'moon'],
    ] as const)('selects %s by its calculation time', (clock, body) => {
        const instant = Date.parse(clock);
        const target = cloudTargetPosition('auto', instant, location);
        expect(target.body).toBe(body);
        const position = cloudBodyPosition(body, instant, location);
        expect(target.position).toEqual({ ...position,
            sightlineAvailable: body === 'sun' || (position.moonUpperLimbAltitude ?? -90) >= 0 });
    });

    it('honours explicit moon selection even in daylight and uses the lunar sightline', () => {
        const instant = Date.parse('2026-09-09T04:00:00Z');
        const moon = cloudTargetPosition('moon', instant, location);
        const sun = cloudTargetPosition('sun', instant, location);
        expect(moon.body).toBe('moon');
        expect(moon.position).toEqual(cloudBodyPosition('moon', instant, location));
        expect(cloudSightDistance(2000, moon.position.altitude)).not.toBeCloseTo(
            cloudSightDistance(2000, sun.position.altitude)!, 3);
        expect(cloudTargetPosition('sun', Date.parse('2026-09-09T16:00:00Z'), location).body).toBe('sun');
    });

    it('keeps a moonrise intersection when its upper limb is above the horizon', () => {
        // Find the centre crossing for this day without depending on a second ephemeris.
        const start = Date.parse('2026-09-08T18:00:00Z');
        const nearHorizon = Array.from({ length: 240 }, (_, minute) =>
            cloudTargetPosition('moon', start + minute * 60_000, location))
            .find(target => target.position.altitude < 0 && target.position.moonUpperLimbAltitude! > 0);
        expect(nearHorizon).toBeDefined();
        expect(nearHorizon!.position.sightlineAvailable).toBe(true);
        expect(cloudSightDistance(2000, nearHorizon!.position.altitude)).toBeGreaterThan(0);
    });

    it('marks a Moon below the horizon unavailable without switching an explicit target', () => {
        const moon = cloudTargetPosition('moon', Date.parse('2026-09-09T16:00:00Z'), location);
        expect(moon.body).toBe('moon');
        expect(moon.position.altitude).toBeLessThan(0);
        expect(moon.position.sightlineAvailable).toBe(false);
    });

    it('uses solar altitude rather than fixed clock hours in polar day and night', () => {
        const pole = { lat: 80, lon: 0 };
        expect(cloudTargetPosition('auto', Date.parse('2026-06-21T00:00:00Z'), pole).body).toBe('sun');
        expect(cloudTargetPosition('auto', Date.parse('2026-12-21T12:00:00Z'), pole).body).toBe('moon');
    });
});


describe('galactic centre cloud obstruction', () => {
    it.each([[2000, 2.9520506], [4000, 5.9002339], [6000, 8.8445602]])(
        'checks the screenshot displayed altitude at %i m without tuning the ephemeris', (height, expected) => {
            expect(cloudSightDistance(height, 34.1)).toBeCloseTo(expected, 6);
        },
    );

    it('uses the galactic direction and changes it with time and location', () => {
        const instant = Date.parse('2026-09-08T12:07:00Z');
        const location = { lat: 24.918759, lon: 112.658726 };
        const target = cloudTargetPosition('milkyway', instant, location);
        expect(target.body).toBe('milkyway');
        expect(target.position).toEqual(cloudGalacticCenterPosition(instant, location));
        expect(target.position.altitude).toBeGreaterThan(34);
        expect(target.position.altitude).toBeLessThan(34.3);
        expect(target.position.azimuth).toBeGreaterThan(196.4);
        expect(target.position.azimuth).toBeLessThan(196.6);
        expect(target.position.sightlineAvailable).toBe(true);
        expect(target.position.altitude.toFixed(1)).toBe('34.1');
        expect(target.position.azimuth.toFixed(1)).toBe('196.5');
        [2000, 4000, 6000].forEach((height, index) => {
            expect(cloudSightDistance(height, target.position.altitude)!.toFixed(2)).toBe(['2.95', '5.89', '8.84'][index]);
        });
        expect(target.position.altitude).toBeGreaterThan(target.position.geometricAltitude);
        expect(cloudTargetPosition('sun', instant, location).position.altitude).toBeLessThan(0);
        expect(cloudGalacticCenterPosition(instant + 3600_000, location).azimuth).toBeGreaterThan(target.position.azimuth);
        expect(cloudGalacticCenterPosition(instant, { ...location, lat: 35 }).altitude).toBeLessThan(target.position.altitude);
    });

    it('has no below-horizon intersection and never auto-selects the galactic centre', () => {
        const instant = Date.parse('2026-09-08T00:07:00Z');
        const location = { lat: 24.918759, lon: 112.658726 };
        const target = cloudTargetPosition('milkyway', instant, location);
        expect(target.body).toBe('milkyway');
        expect(target.position.altitude).toBeLessThan(0);
        expect(target.position.sightlineAvailable).toBe(false);
        expect(cloudTargetPosition('auto', instant, location).body).toBe('sun');
        expect(cloudTargetPosition('milkyway', instant, { lat: 80, lon: 0 }).position.sightlineAvailable).toBe(false);
    });
});


describe('cloud planning map bearings', () => {
    const location = { lat: 24.918759, lon: 112.658726 };
    it.each(['sun', 'moon', 'milkyway'] as const)('shows only the selected %s bearing and moves it with time', body => {
        const first = cloudMapDirections(Date.parse('2026-09-08T08:00:00Z'), location, body);
        const second = cloudMapDirections(Date.parse('2026-09-08T12:07:00Z'), location, body);
        const firstLines = Object.values(first).filter(line => line !== null);
        const secondLines = Object.values(second).filter(line => line !== null);
        expect(firstLines).toHaveLength(1);
        expect(secondLines).toHaveLength(1);
        expect(distanceKm(firstLines[0]!.endpoint, secondLines[0]!.endpoint)).toBeGreaterThan(10);
        const field = body === 'sun' ? 'currentSun' : body === 'moon' ? 'currentMoon' : 'currentGalacticCenter';
        expect(second[field]).not.toBeNull();
        expect(Object.values(cloudMapDirections(null, location, body)).every(line => line === null)).toBe(true);
    });
});


describe('solar obstruction horizon visibility', () => {
    const location = { lat: 23.1291, lon: 113.2644 };
    it.each(['2026-09-09T10:59:00Z', '2026-09-09T16:00:00Z'])(
        'hides solar blocking below the apparent horizon at %s', time => {
            const result = cloudTargetPosition('sun', Date.parse(time), location);
            expect(result.body).toBe('sun');
            expect(result.position.altitude).toBeLessThan(0);
            expect(result.position.sightlineAvailable).toBe(false);
            const reference = cloudTwilightDistances(2000)!;
            expect(Math.round(reference.horizonKm)).toBe(160);
            expect(Math.round(reference.tangentKm)).toBe(319);
            expect(Math.round(reference.clearKm)).toBe(479);
        },
    );
    it('restores solar blocking above the horizon', () => {
        const result = cloudTargetPosition('sun', Date.parse('2026-09-09T04:00:00Z'), location);
        expect(result.position.altitude).toBeGreaterThan(0);
        expect(result.position.sightlineAvailable).toBe(true);
    });
});


describe('shared obstruction and bearing direction', () => {
    it.each(['sun', 'moon', 'milkyway'] as const)('uses identical ephemeris and overlapping vertices for %s', body => {
        const location = { lat: 23.1291, lon: 113.2644 };
        for (const clock of ['2026-09-09T03:15:00Z', '2026-09-09T12:07:00Z']) {
            const time = Date.parse(clock);
            const target = cloudTargetPosition(body, time, location).position;
            const bearing = Object.values(cloudMapDirections(time, location, body)).find(value => value !== null)!;
            expect(bearing.azimuth).toBe(target.azimuth);
            expect(bearing.altitude).toBe(target.altitude);
            const obstructionPath = cloudBearingPath(location, target.azimuth, 479.25);
            expect(bearing.points.slice(0, obstructionPath.length - 1)).toEqual(obstructionPath.slice(0, -1));
        }
    });
});

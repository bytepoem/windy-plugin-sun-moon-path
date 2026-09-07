import { describe, expect, it } from 'vitest';
import { cloudArc, cloudBodyPosition, cloudSightDistance, cloudTimeInstant, cloudTwilightDistances } from './cloudGeometry';
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

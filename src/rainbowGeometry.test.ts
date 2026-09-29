import { describe, expect, it } from 'vitest';
import { calculateRainbow, projectRainbowDirection, rainbowSourceAboveHorizon } from './rainbowGeometry';

describe('rainbow sky geometry', () => {
    it('shares an exact horizontal-horizon display boundary for data and map bows', () => {
        for (const altitude of [-90, -1.9, -0.001, NaN, 90.01]) {
            expect(rainbowSourceAboveHorizon({ altitude, azimuth: 270 })).toBe(false);
        }
        expect(rainbowSourceAboveHorizon(null)).toBe(false);
        for (const altitude of [0, 0.001, 42, 90]) {
            expect(rainbowSourceAboveHorizon({ altitude, azimuth: 270 })).toBe(true);
        }
    });
    it('reproduces the reference primary-bow bearings', () => {
        const arc = calculateRainbow({ azimuth: 92.3, altitude: 3.4 })!;
        expect(arc.center.azimuth).toBeCloseTo(272.3, 10);
        expect(arc.center.altitude).toBe(-3.4);
        expect(arc.topAltitude).toBeCloseTo(38.6, 8);
        expect(arc.leftAzimuth?.toFixed(1)).toBe('230.4');
        expect(arc.rightAzimuth?.toFixed(1)).toBe('314.2');
    });

    it.each([
        [14.4, 262.6, 27.6, 42.7, 82.6, 122.5],
        [4.1, 267.6, 37.9, 45.7, 87.6, 129.4],
        [-1.9, 270.6, 43.9, 48.6, 90.6, 132.5],
    ])('matches screenshot reference at source altitude %s°', (altitude, azimuth, top, left, center, right) => {
        const arc = calculateRainbow({ altitude, azimuth });
        expect(arc).not.toBeNull();
        expect(arc!.topAltitude).toBeCloseTo(top, 8);
        // Screenshots round input and output independently to 0.1°, so the hidden
        // source azimuth may differ by 0.05° from the number entered here.
        expect(Math.abs(arc!.leftAzimuth! - left)).toBeLessThan(0.11);
        expect(Math.abs(arc!.center.azimuth - center)).toBeLessThan(0.11);
        expect(Math.abs(arc!.rightAzimuth! - right)).toBeLessThan(0.11);
    });

    it.each([14.4, 4.1])('bows outward in the map projection at source altitude %s°', altitude => {
        // Put the antisolar axis due east. For positive source altitude the top
        // of the visible bow must lie east of the chord between horizon endpoints.
        const arc = calculateRainbow({ altitude, azimuth: 270 })!;
        const top = projectRainbowDirection({ azimuth: 90, altitude: arc.topAltitude }, 100);
        const left = projectRainbowDirection({ azimuth: arc.leftAzimuth!, altitude: 0 }, 100);
        const right = projectRainbowDirection({ azimuth: arc.rightAzimuth!, altitude: 0 }, 100);
        expect(top.x).toBeGreaterThan((left.x + right.x) / 2);
        expect(top.x).toBeCloseTo(100 * Math.cos(arc.topAltitude * Math.PI / 180), 8);
    });

    it('keeps every sampled direction on the optical cone, including below-horizon arcs', () => {
        const rad = Math.PI / 180;
        for (const altitude of [-90, -53, -42, -1.9, 0, 3.4, 32.2, 42, 51.9, 90]) {
            for (const radius of [40, 42, 51, 53]) {
                const arc = calculateRainbow({ azimuth: 350, altitude }, radius)!;
                for (const segment of arc.segments) {
                    for (const point of segment.points) {
                        const dot = Math.sin(point.altitude * rad) * Math.sin(-altitude * rad)
                            + Math.cos(point.altitude * rad) * Math.cos(altitude * rad)
                            * Math.cos((point.azimuth - arc.center.azimuth) * rad);
                        expect(dot).toBeCloseTo(Math.cos(radius * rad), 10);
                        expect(segment.belowHorizon ? point.altitude <= 1e-9 : point.altitude >= -1e-9).toBe(true);
                    }
                }
            }
        }
    });

    it('inserts exact horizon endpoints, wraps north and leaves no crossings above the limit', () => {
        const arc = calculateRainbow({ azimuth: 170, altitude: 20 })!;
        expect(arc.leftAzimuth).toBeGreaterThan(300);
        expect(arc.rightAzimuth).toBeLessThan(40);
        const visible = arc.segments.filter(segment => !segment.belowHorizon);
        expect(visible).toHaveLength(1);
        expect(visible[0].points[0].altitude).toBeCloseTo(0, 10);
        expect(visible[0].points.at(-1)!.altitude).toBeCloseTo(0, 10);
        const below = calculateRainbow({ azimuth: 128.1, altitude: 51.9 })!;
        expect(below.topAltitude).toBeCloseTo(-9.9);
        expect(below.leftAzimuth).toBeNull();
        expect(below.rightAzimuth).toBeNull();
        expect(below.segments.every(segment => segment.belowHorizon)).toBe(true);
    });

    it('allows a secondary above the horizon after the primary has disappeared', () => {
        const source = { azimuth: 100, altitude: 45 };
        expect(calculateRainbow(source)!.topAltitude).toBe(-3);
        expect(calculateRainbow(source, 51)!.topAltitude).toBe(6);
        expect(calculateRainbow(source, 51)!.leftAzimuth).not.toBeNull();
    });

    it('rejects invalid input while preserving geometric directions below the horizon', () => {
        for (const altitude of [-91, NaN, Infinity, 91]) {
            expect(calculateRainbow({ altitude, azimuth: 10 })).toBeNull();
        }
        expect(calculateRainbow({ altitude: 10, azimuth: NaN })).toBeNull();
    });

    it('uses the same top-down projection for both hemispheres', () => {
        const above = projectRainbowDirection({ azimuth: 90, altitude: 30 }, 90);
        const below = projectRainbowDirection({ azimuth: 90, altitude: -30 }, 90);
        expect(above.x).toBeCloseTo(90 * Math.cos(Math.PI / 6));
        expect(below).toEqual(above);
        expect(projectRainbowDirection({ azimuth: 0, altitude: 90 }, 90).y).toBeCloseTo(0, 10);
    });

    it('bounds the top altitude and omits nonexistent horizon endpoints for a low source', () => {
        for (const altitude of [-90, -80, -60, -48, -42.1]) {
            const arc = calculateRainbow({ azimuth: 270, altitude })!;
            expect(arc.leftAzimuth).toBeNull();
            expect(arc.rightAzimuth).toBeNull();
            expect(arc.topAltitude).toBeCloseTo(Math.max(...arc.segments.flatMap(segment => segment.points.map(point => point.altitude))), 6);
            expect(arc.topAltitude).toBeLessThanOrEqual(90);
            expect(arc.segments.every(segment => !segment.belowHorizon)).toBe(true);
        }
    });

    it('projects smoothly through the nadir without spurious chords or leaving the horizon disc', () => {
        for (const radius of [40, 42, 51, 53]) {
            for (const offset of [-0.1, -0.00001, 0, 0.00001, 0.1]) {
                const arc = calculateRainbow({ azimuth: 0, altitude: 90 - radius + offset }, radius)!;
                for (const segment of arc.segments) {
                    for (let index = 1; index < segment.points.length; index += 1) {
                        const previous = projectRainbowDirection(segment.points[index - 1], 106);
                        const next = projectRainbowDirection(segment.points[index], 106);
                        expect(Math.hypot(next.x - previous.x, next.y - previous.y)).toBeLessThan(2);
                        expect(Math.hypot(next.x, next.y)).toBeLessThanOrEqual(106 + 1e-9);
                    }
                }
            }
        }
    });
});

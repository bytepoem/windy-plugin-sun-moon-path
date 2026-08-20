import * as SunCalc from 'suncalc';

import type { CelestialBody, Coordinates } from './solar';

export type CelestialHorizonEventKind = 'rise' | 'set';

export interface CelestialCurvePoint {
    position: number;
    altitudeDeg: number;
}

export interface CelestialCurveSegment {
    points: CelestialCurvePoint[];
}

export interface CelestialHorizonEvent {
    body: CelestialBody;
    kind: CelestialHorizonEventKind;
    timestamp: number;
    position: number;
}

export interface CelestialCurve {
    body: CelestialBody;
    segments: CelestialCurveSegment[];
    events: CelestialHorizonEvent[];
}

const SAMPLE_STEP_MS = 15 * 60 * 1000;

const altitudeDegrees = (body: CelestialBody, timestamp: number, location: Coordinates): number => {
    const position = body === 'moon'
        ? SunCalc.getMoonPosition(new Date(timestamp), location.lat, location.lon)
        : SunCalc.getPosition(new Date(timestamp), location.lat, location.lon);
    return position.altitude;
};

export const findTimestampPosition = (timestamps: number[], timestamp: number): number | null => {
    if (timestamps.length === 0 || timestamp < timestamps[0] || timestamp > timestamps.at(-1)!) {
        return null;
    }
    const exactIndex = timestamps.indexOf(timestamp);
    if (exactIndex >= 0) {
        return exactIndex;
    }
    const nextIndex = timestamps.findIndex(value => value > timestamp);
    if (nextIndex <= 0) {
        return null;
    }
    const previous = timestamps[nextIndex - 1];
    const next = timestamps[nextIndex];
    return next === previous
        ? nextIndex - 1
        : nextIndex - 1 + (timestamp - previous) / (next - previous);
};

const horizonCrossing = (
    previousTimestamp: number,
    previousAltitude: number,
    timestamp: number,
    altitude: number,
): number => {
    const altitudeRange = altitude - previousAltitude;
    if (altitudeRange === 0) {
        return timestamp;
    }
    const fraction = Math.min(1, Math.max(0, -previousAltitude / altitudeRange));
    return previousTimestamp + fraction * (timestamp - previousTimestamp);
};

export const buildCelestialCurve = ({
    body,
    timestamps,
    location,
}: {
    body: CelestialBody;
    timestamps: number[];
    location: Coordinates;
}): CelestialCurve => {
    if (timestamps.length < 2) {
        return { body, segments: [], events: [] };
    }

    const start = timestamps[0];
    const end = timestamps.at(-1)!;
    const sampleTimestamps: number[] = [];
    for (let timestamp = start; timestamp < end; timestamp += SAMPLE_STEP_MS) {
        sampleTimestamps.push(timestamp);
    }
    sampleTimestamps.push(end);

    const segments: CelestialCurveSegment[] = [];
    const events: CelestialHorizonEvent[] = [];
    let activePoints: CelestialCurvePoint[] = [];
    let previousTimestamp = sampleTimestamps[0];
    let previousAltitude = altitudeDegrees(body, previousTimestamp, location);

    const pointAt = (timestamp: number, altitudeDeg: number): CelestialCurvePoint | null => {
        const position = findTimestampPosition(timestamps, timestamp);
        return position === null ? null : { position, altitudeDeg: Math.max(0, altitudeDeg) };
    };

    const firstPoint = pointAt(previousTimestamp, previousAltitude);
    if (previousAltitude >= 0 && firstPoint) {
        activePoints.push(firstPoint);
    }

    for (const timestamp of sampleTimestamps.slice(1)) {
        const altitude = altitudeDegrees(body, timestamp, location);
        const wasVisible = previousAltitude >= 0;
        const isVisible = altitude >= 0;

        if (wasVisible !== isVisible) {
            const crossingTimestamp = horizonCrossing(
                previousTimestamp,
                previousAltitude,
                timestamp,
                altitude,
            );
            const crossingPoint = pointAt(crossingTimestamp, 0);
            if (crossingPoint) {
                if (isVisible) {
                    activePoints = [crossingPoint];
                } else {
                    activePoints.push(crossingPoint);
                }
                events.push({
                    body,
                    kind: isVisible ? 'rise' : 'set',
                    timestamp: crossingTimestamp,
                    position: crossingPoint.position,
                });
                if (!isVisible && activePoints.length >= 2) {
                    segments.push({ points: activePoints });
                    activePoints = [];
                }
            }
        }

        if (isVisible) {
            const point = pointAt(timestamp, altitude);
            if (point) {
                activePoints.push(point);
            }
        }

        previousTimestamp = timestamp;
        previousAltitude = altitude;
    }

    if (activePoints.length >= 2) {
        segments.push({ points: activePoints });
    }

    return { body, segments, events };
};

export const buildCelestialCurves = (
    timestamps: number[],
    location: Coordinates,
): CelestialCurve[] => [
    buildCelestialCurve({ body: 'sun', timestamps, location }),
    buildCelestialCurve({ body: 'moon', timestamps, location }),
];

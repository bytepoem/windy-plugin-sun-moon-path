import {
    calculateAstronomyTimeline,
    calculateSolarPath,
    dateInputToUtcMidnight,
    dateInputToUtcNoon,
    type AstronomyInterval,
    type AstronomyIntervalKind,
    type AstronomyTimeline,
    type Coordinates,
    type SolarEvent,
    type SolarPath,
} from './solar';
import type { LightPollutionPoint } from './lightPollution';
import type { WeatherPoint } from './weather';

const CELESTIAL_EVENTS: SolarEvent[] = ['sunrise', 'sunset', 'moonrise', 'moonset'];

export type ObservationEvent = SolarEvent | 'all';

export type ObservationLocationContext = {
    timeZone: string;
    elevationM: number;
};

export type ObservationPlan = ObservationLocationContext & {
    paths: SolarPath[];
    timeline: AstronomyTimeline;
};

export type ObservationPlannerPort = {
    getTimeZone: (location: Coordinates, datetime: string) => Promise<string>;
    getElevation: (location: Coordinates) => Promise<number>;
};

export type ObservationPlanner = {
    plan: (input: {
        location: Coordinates;
        dateInput: string;
        knownElevationM?: number | null;
    }) => Promise<ObservationPlan>;
};

export type ObservationPlannerErrorCode = 'TIME_ZONE_UNAVAILABLE' | 'TIME_ZONE_INVALID';

export class ObservationPlannerError extends Error {
    constructor(readonly code: ObservationPlannerErrorCode) {
        super(code);
        this.name = 'ObservationPlannerError';
    }
}

export type ObservationMetricRange = {
    minimum: number;
    maximum: number;
};

export type ObservationWindowEvidence = {
    weatherSampleCount: number;
    totalCloudPercent: ObservationMetricRange | null;
    precipitationMm: ObservationMetricRange | null;
    visibilityKm: ObservationMetricRange | null;
    aod550: ObservationMetricRange | null;
    moonIlluminationFraction: number | null;
    sqm: number | null;
    estimatedBortle: number | null;
};

export type ObservationWindow = {
    kind: AstronomyIntervalKind;
    interval: AstronomyInterval | null;
    evidence: ObservationWindowEvidence;
};

const locationKey = (location: Coordinates): string => `${location.lat}|${location.lon}`;

const isValidTimeZone = (candidate: string): boolean => {
    try {
        new Intl.DateTimeFormat(undefined, { timeZone: candidate }).format();
        return true;
    } catch {
        return false;
    }
};

export const createObservationPlanner = (port: ObservationPlannerPort): ObservationPlanner => {
    let cachedContext: (ObservationLocationContext & { key: string }) | null = null;
    let pendingContext: { key: string; promise: Promise<ObservationLocationContext> } | null = null;

    const resolveContext = (
        location: Coordinates,
        dateInput: string,
        knownElevationM?: number | null,
    ): Promise<ObservationLocationContext> => {
        const key = locationKey(location);
        const elevationOverride = Number.isFinite(knownElevationM)
            ? Math.max(0, knownElevationM as number)
            : null;
        if (cachedContext?.key === key) {
            if (elevationOverride !== null) {
                cachedContext = { ...cachedContext, elevationM: elevationOverride };
            }
            return Promise.resolve(cachedContext);
        }
        if (pendingContext?.key === key) {
            return elevationOverride === null
                ? pendingContext.promise
                : pendingContext.promise.then(context => {
                    const updatedContext = { ...context, elevationM: elevationOverride };
                    cachedContext = { key, ...updatedContext };
                    return updatedContext;
                });
        }

        const datetime = dateInputToUtcNoon(dateInput, 'UTC').toISOString();
        const promise = Promise.allSettled([
            port.getTimeZone(location, datetime),
            elevationOverride !== null
                ? Promise.resolve(elevationOverride)
                : port.getElevation(location),
        ]).then(([timeZoneResult, elevationResult]) => {
            if (timeZoneResult.status !== 'fulfilled') {
                throw new ObservationPlannerError('TIME_ZONE_UNAVAILABLE');
            }
            if (!timeZoneResult.value || !isValidTimeZone(timeZoneResult.value)) {
                throw new ObservationPlannerError('TIME_ZONE_INVALID');
            }

            const context = {
                key,
                timeZone: timeZoneResult.value,
                elevationM: elevationResult.status === 'fulfilled' && Number.isFinite(elevationResult.value)
                    ? Math.max(0, elevationResult.value)
                    : 0,
            };
            cachedContext = context;
            return context;
        }).finally(() => {
            if (pendingContext?.promise === promise) {
                pendingContext = null;
            }
        });

        pendingContext = { key, promise };
        return promise;
    };

    return {
        plan: async ({ location, dateInput, knownElevationM }) => {
            const context = await resolveContext(location, dateInput, knownElevationM);
            const paths = CELESTIAL_EVENTS.map(event => {
                const eventDate = event === 'moonrise' || event === 'moonset'
                    ? dateInputToUtcMidnight(dateInput, context.timeZone)
                    : dateInputToUtcNoon(dateInput, context.timeZone);
                return calculateSolarPath({
                    date: eventDate,
                    dateInput,
                    timeZone: context.timeZone,
                    location,
                    event,
                    elevationM: context.elevationM,
                });
            });

            return {
                ...context,
                paths,
                timeline: calculateAstronomyTimeline({
                    dateInput,
                    timeZone: context.timeZone,
                    location,
                    elevationM: context.elevationM,
                }),
            };
        },
    };
};

export const selectObservationPaths = (
    paths: SolarPath[],
    event: ObservationEvent,
): SolarPath[] => event === 'all' ? paths : paths.filter(path => path.event === event);

const metricRange = (
    points: WeatherPoint[],
    field: 'totalCloudPercent' | 'precipMm' | 'visibilityKm' | 'aod550',
): ObservationMetricRange | null => {
    const values = points
        .map(point => point[field])
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    return values.length > 0
        ? { minimum: Math.min(...values), maximum: Math.max(...values) }
        : null;
};

const weatherPointsForInterval = (
    points: WeatherPoint[],
    interval: AstronomyInterval,
): WeatherPoint[] => {
    const sortedPoints = [...points].sort((left, right) => left.timestamp - right.timestamp);
    return sortedPoints.filter((point, index) => {
        const previousTimestamp = sortedPoints[index - 1]?.timestamp;
        const nextTimestamp = sortedPoints[index + 1]?.timestamp;
        const representedStart = previousTimestamp === undefined
            ? nextTimestamp === undefined
                ? point.timestamp
                : point.timestamp - (nextTimestamp - point.timestamp) / 2
            : (previousTimestamp + point.timestamp) / 2;
        const representedEnd = nextTimestamp === undefined
            ? previousTimestamp === undefined
                ? point.timestamp
                : point.timestamp + (point.timestamp - previousTimestamp) / 2
            : (point.timestamp + nextTimestamp) / 2;
        return representedEnd >= interval.start.getTime() && representedStart <= interval.end.getTime();
    });
};

export const buildObservationWindows = ({
    timeline,
    weatherPoints,
    lightPollution,
    referenceTime,
}: {
    timeline: AstronomyTimeline | null;
    weatherPoints: WeatherPoint[];
    lightPollution: LightPollutionPoint | null;
    referenceTime: number;
}): ObservationWindow[] => {
    const preferredInterval = (kind: AstronomyIntervalKind): AstronomyInterval | null => {
        const candidates = (timeline?.intervals || []).filter(interval => interval.kind === kind);
        return candidates.find(interval =>
            interval.start.getTime() <= referenceTime && interval.end.getTime() >= referenceTime,
        ) || candidates.find(interval => interval.start.getTime() >= referenceTime) || candidates.at(-1) || null;
    };

    return (['moonless-night', 'milky-way'] as const).map(kind => {
        const interval = preferredInterval(kind);
        const samples = interval ? weatherPointsForInterval(weatherPoints, interval) : [];
        return {
            kind,
            interval,
            evidence: {
                weatherSampleCount: samples.length,
                totalCloudPercent: metricRange(samples, 'totalCloudPercent'),
                precipitationMm: metricRange(samples, 'precipMm'),
                visibilityKm: metricRange(samples, 'visibilityKm'),
                aod550: metricRange(samples, 'aod550'),
                moonIlluminationFraction: timeline?.moonIllumination.fraction ?? null,
                sqm: lightPollution?.sqm ?? null,
                estimatedBortle: lightPollution?.estimatedBortle ?? null,
            },
        };
    });
};

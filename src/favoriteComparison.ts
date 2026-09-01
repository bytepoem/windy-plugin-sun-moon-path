import {
    buildObservationWindows,
    type ObservationWindow,
} from './observationPlanner';
import {
    calculateAstronomyTimeline,
    dateInputForInstant,
    dateInputToUtcNoon,
    type AstronomyTimeline,
    type Coordinates,
} from './solar';
import {
    findWeatherDateSelection,
    type WeatherDateSelection,
    type WeatherModel,
    type WeatherPoint,
} from './weather';
import type { OpenMeteoAtmospherePoint } from './openMeteo';
import type { LightPollutionPoint } from './lightPollution';

export const FAVORITE_COMPARISON_MIN_TARGETS = 2;
export const FAVORITE_COMPARISON_MAX_TARGETS = 5;
const FAVORITE_COMPARISON_TARGET_CONCURRENCY = 2;

export type FavoriteComparisonTarget = {
    id: string;
    title: string;
    location: Coordinates;
    knownElevationM?: number;
    knownLightPollution?: LightPollutionPoint;
};

export type FavoriteComparisonPrepareErrorCode = 'TIME_ZONE_UNAVAILABLE' | 'TIME_ZONE_INVALID';

export type FavoriteComparisonPreparedTarget = {
    target: FavoriteComparisonTarget;
    status: 'ready';
    timeZone: string;
    elevationM: number;
    lightPollution: LightPollutionPoint | null;
    lightPollutionStatus: 'ready' | 'error';
    atmospherePoints: OpenMeteoAtmospherePoint[];
    atmosphereStatus: 'ready' | 'empty' | 'error';
    timeline: AstronomyTimeline;
} | {
    target: FavoriteComparisonTarget;
    status: 'error';
    errorCode: FavoriteComparisonPrepareErrorCode;
};

export type FavoriteComparisonResult = {
    prepared: FavoriteComparisonPreparedTarget;
    weatherStatus: 'ready' | 'empty' | 'error';
    dateSelection: WeatherDateSelection;
    windows: ObservationWindow[];
};

export type FavoriteComparisonPlannerPort = {
    getTimeZone: (location: Coordinates, datetime: string) => Promise<string>;
    getElevation: (location: Coordinates, signal: AbortSignal) => Promise<number>;
    getAtmosphere: (
        location: Coordinates,
        requestedAt: number,
        signal: AbortSignal,
    ) => Promise<OpenMeteoAtmospherePoint[]>;
    getLightPollution: (location: Coordinates, signal: AbortSignal) => Promise<LightPollutionPoint>;
    getWeather: (
        location: Coordinates,
        model: WeatherModel,
        requestedAt: number,
        signal: AbortSignal,
    ) => Promise<WeatherPoint[]>;
};

export type FavoriteComparisonSession = {
    dateInput: string;
    requestedAt: number;
    preparedTargets: FavoriteComparisonPreparedTarget[];
    loadModel: (model: WeatherModel, signal: AbortSignal) => Promise<FavoriteComparisonResult[]>;
};

export type FavoriteComparisonPlanner = {
    prepare: (input: {
        targets: FavoriteComparisonTarget[];
        dateInput: string;
        requestedAt: number;
        signal: AbortSignal;
    }) => Promise<FavoriteComparisonSession>;
};

const isValidTimeZone = (candidate: string): boolean => {
    try {
        new Intl.DateTimeFormat(undefined, { timeZone: candidate }).format();
        return true;
    } catch {
        return false;
    }
};

const abortError = (): Error => {
    const error = new Error('Favorite comparison request aborted');
    error.name = 'AbortError';
    return error;
};

const assertActive = (signal: AbortSignal) => {
    if (signal.aborted) {
        throw abortError();
    }
};

type TargetTaskRunner = <Result>(task: () => Promise<Result>) => Promise<Result>;

/**
 * Shares two location slots across preparation, refreshes and model switches.
 * A released slot is transferred directly to the next queued task so a rapid
 * refresh cannot temporarily exceed the configured location concurrency.
 */
const createTargetTaskRunner = (): TargetTaskRunner => {
    let activeTasks = 0;
    const waitingTasks: (() => void)[] = [];
    const acquire = (): Promise<void> => new Promise(resolve => {
        if (activeTasks < FAVORITE_COMPARISON_TARGET_CONCURRENCY) {
            activeTasks += 1;
            resolve();
            return;
        }
        waitingTasks.push(resolve);
    });
    const release = () => {
        const nextTask = waitingTasks.shift();
        if (nextTask) {
            nextTask();
            return;
        }
        activeTasks -= 1;
    };
    return async <Result>(task: () => Promise<Result>): Promise<Result> => {
        await acquire();
        try {
            return await task();
        } finally {
            release();
        }
    };
};

/** Runs location work through the shared limiter; Promise.all preserves selection order. */
const mapTargetsWithConcurrency = <Item, Result>(
    items: Item[],
    runTask: TargetTaskRunner,
    mapper: (item: Item) => Promise<Result>,
): Promise<Result[]> => Promise.all(items.map(item => runTask(() => mapper(item))));

const emptyDateSelection = (): WeatherDateSelection => ({
    coverage: 'empty',
    startIndex: null,
    length: 0,
});

const atmosphereOnlyWeatherPoint = (point: OpenMeteoAtmospherePoint): WeatherPoint => ({
    timestamp: point.timestamp,
    iconCode: null,
    isDay: false,
    totalCloudPercent: null,
    highCloudPercent: null,
    mediumCloudPercent: null,
    lowCloudPercent: null,
    temperatureC: null,
    dewPointC: null,
    humidityPercent: null,
    precipMm: null,
    windMs: null,
    windDirectionDeg: null,
    aod550: point.aod550,
    visibilityKm: point.visibilityKm,
});

/** Keeps Open-Meteo evidence available even when a Windy model request fails. */
const mergeComparisonWeather = (
    weatherPoints: WeatherPoint[],
    atmospherePoints: OpenMeteoAtmospherePoint[],
): WeatherPoint[] => {
    const pointsByTimestamp = new Map(weatherPoints.map(point => [point.timestamp, point]));
    for (const atmospherePoint of atmospherePoints) {
        const weatherPoint = pointsByTimestamp.get(atmospherePoint.timestamp);
        pointsByTimestamp.set(
            atmospherePoint.timestamp,
            weatherPoint
                ? {
                    ...weatherPoint,
                    aod550: atmospherePoint.aod550,
                    visibilityKm: atmospherePoint.visibilityKm,
                }
                : atmosphereOnlyWeatherPoint(atmospherePoint),
        );
    }
    return [...pointsByTimestamp.values()].sort((left, right) => left.timestamp - right.timestamp);
};

/**
 * Builds one comparison session in two phases. Location, astronomy and Open-Meteo
 * context are prepared once; subsequent model changes only call the Windy forecast port.
 */
export const createFavoriteComparisonPlanner = (
    port: FavoriteComparisonPlannerPort,
): FavoriteComparisonPlanner => {
    const runTargetTask = createTargetTaskRunner();
    return ({
        prepare: async ({ targets, dateInput, requestedAt, signal }) => {
            if (
                targets.length < FAVORITE_COMPARISON_MIN_TARGETS
                || targets.length > FAVORITE_COMPARISON_MAX_TARGETS
            ) {
                throw new RangeError('Favorite comparison requires two to five targets');
            }
            assertActive(signal);
            const datetime = dateInputToUtcNoon(dateInput, 'UTC').toISOString();
            const preparedTargets = await mapTargetsWithConcurrency(
                targets,
                runTargetTask,
                async target => {
                    assertActive(signal);
                    const [
                        timeZoneResult,
                        elevationResult,
                        atmosphereResult,
                        lightPollutionResult,
                    ] = await Promise.allSettled([
                        port.getTimeZone(target.location, datetime),
                        target.knownElevationM === undefined
                            ? port.getElevation(target.location, signal)
                            : Promise.resolve(target.knownElevationM),
                        port.getAtmosphere(target.location, requestedAt, signal),
                        target.knownLightPollution === undefined
                            ? port.getLightPollution(target.location, signal)
                            : Promise.resolve(target.knownLightPollution),
                    ]);
                    assertActive(signal);

                    if (timeZoneResult.status !== 'fulfilled') {
                        return {
                            target,
                            status: 'error',
                            errorCode: 'TIME_ZONE_UNAVAILABLE',
                        } satisfies FavoriteComparisonPreparedTarget;
                    }
                    if (!timeZoneResult.value || !isValidTimeZone(timeZoneResult.value)) {
                        return {
                            target,
                            status: 'error',
                            errorCode: 'TIME_ZONE_INVALID',
                        } satisfies FavoriteComparisonPreparedTarget;
                    }

                    const elevationM = elevationResult.status === 'fulfilled'
                        && Number.isFinite(elevationResult.value)
                        ? Math.max(0, elevationResult.value)
                        : 0;
                    const atmospherePoints = atmosphereResult.status === 'fulfilled'
                        ? atmosphereResult.value
                        : [];
                    const lightPollution = lightPollutionResult.status === 'fulfilled'
                        ? lightPollutionResult.value
                        : null;

                    return {
                        target,
                        status: 'ready',
                        timeZone: timeZoneResult.value,
                        elevationM,
                        lightPollution,
                        lightPollutionStatus: lightPollutionResult.status === 'fulfilled' ? 'ready' : 'error',
                        atmospherePoints,
                        atmosphereStatus: atmosphereResult.status === 'rejected'
                            ? 'error'
                            : atmospherePoints.length > 0 ? 'ready' : 'empty',
                        timeline: calculateAstronomyTimeline({
                            dateInput,
                            timeZone: timeZoneResult.value,
                            location: target.location,
                            elevationM,
                        }),
                    } satisfies FavoriteComparisonPreparedTarget;
                },
            );
            assertActive(signal);

            return {
                dateInput,
                requestedAt,
                preparedTargets,
                loadModel: async (model, modelSignal) => {
                    assertActive(modelSignal);
                    return mapTargetsWithConcurrency(
                        preparedTargets,
                        runTargetTask,
                        async prepared => {
                            assertActive(modelSignal);
                            if (prepared.status === 'error') {
                                return {
                                    prepared,
                                    weatherStatus: 'error',
                                    dateSelection: emptyDateSelection(),
                                    windows: [],
                                } satisfies FavoriteComparisonResult;
                            }

                            try {
                                const baseWeatherPoints = await port.getWeather(
                                    prepared.target.location,
                                    model,
                                    requestedAt,
                                    modelSignal,
                                );
                                assertActive(modelSignal);
                                const weatherPoints = mergeComparisonWeather(
                                    baseWeatherPoints,
                                    prepared.atmospherePoints,
                                );
                                const dateSelection = findWeatherDateSelection(
                                    weatherPoints,
                                    prepared.timeZone,
                                    dateInput,
                                );
                                const referenceTime = dateInputForInstant(
                                    new Date(requestedAt),
                                    prepared.timeZone,
                                ) === dateInput
                                    ? requestedAt
                                    : dateInputToUtcNoon(dateInput, prepared.timeZone).getTime();
                                return {
                                    prepared,
                                    weatherStatus: baseWeatherPoints.length > 0 ? 'ready' : 'empty',
                                    dateSelection,
                                    windows: buildObservationWindows({
                                        timeline: prepared.timeline,
                                        weatherPoints,
                                        lightPollution: prepared.lightPollution,
                                        referenceTime,
                                    }),
                                } satisfies FavoriteComparisonResult;
                            } catch (error) {
                                if (
                                    modelSignal.aborted
                                    || (error instanceof Error && error.name === 'AbortError')
                                ) {
                                    throw abortError();
                                }
                                const atmosphereOnlyPoints = mergeComparisonWeather(
                                    [],
                                    prepared.atmospherePoints,
                                );
                                const dateSelection = findWeatherDateSelection(
                                    atmosphereOnlyPoints,
                                    prepared.timeZone,
                                    dateInput,
                                );
                                return {
                                    prepared,
                                    weatherStatus: 'error',
                                    dateSelection,
                                    windows: buildObservationWindows({
                                        timeline: prepared.timeline,
                                        weatherPoints: atmosphereOnlyPoints,
                                        lightPollution: prepared.lightPollution,
                                        referenceTime: requestedAt,
                                    }),
                                } satisfies FavoriteComparisonResult;
                            }
                        },
                    );
                },
            };
        },
    });
};

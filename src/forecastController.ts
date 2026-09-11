import {
    buildOpenMeteoRequestKey,
    mergeOpenMeteoAtmosphere,
    type OpenMeteoAtmospherePoint,
} from './openMeteo';
import {
    buildWeatherLocationKey,
    buildWeatherRequestKey,
    type WeatherForecastPayload,
    type WeatherLoadStatus,
    type WeatherPoint,
    type WeatherSource,
} from './weather';
import type { WeatherProvider, WeatherRequest, WeatherResult } from './weatherProvider';

export type ForecastInput = Omit<WeatherRequest, 'signal'> & {
    source: WeatherSource;
    contextReady: boolean;
    visible: boolean;
    cloudsVisible: boolean;
};

export type ForecastState = {
    requestKey: string;
    points: WeatherPoint[];
    weatherStatus: WeatherLoadStatus;
    weatherError: string;
    atmosphereStatus: WeatherLoadStatus;
    cloudStatus: WeatherLoadStatus;
    cloudForecast: WeatherForecastPayload | null;
};

export const emptyForecastState = (): ForecastState => ({
    requestKey: '',
    points: [],
    weatherStatus: 'idle',
    weatherError: '',
    atmosphereStatus: 'idle',
    cloudStatus: 'idle',
    cloudForecast: null,
});

type Channel<Value> = {
    key: string;
    status: WeatherLoadStatus;
    data: Value | null;
    error: string;
    controller: AbortController | null;
};

const channel = <Value>(): Channel<Value> => ({
    key: '',
    status: 'idle',
    data: null,
    error: '',
    controller: null,
});

/**
 * Owns one panel's forecast lifetimes. Keys identify reusable results; controller
 * identity distinguishes retries of the same key, even when a provider ignores abort.
 * All three channels settle independently. Destroy is terminal and never emits.
 */
export const createForecastController = (
    provider: WeatherProvider & {
        atmosphere: (
            input: WeatherRequest & { includeVisibility: boolean },
        ) => Promise<OpenMeteoAtmospherePoint[]>;
    },
    onChange: (state: ForecastState) => void,
) => {
    const weather = channel<WeatherResult>();
    const atmosphere = channel<OpenMeteoAtmospherePoint[]>();
    const clouds = channel<WeatherForecastPayload>();
    let input: ForecastInput | null = null;
    let destroyed = false;
    let state = emptyForecastState();

    const publish = () => {
        if (destroyed) {
            return;
        }
        state = {
            requestKey: weather.key,
            points: mergeOpenMeteoAtmosphere(
                weather.data?.points ?? [],
                atmosphere.data ?? [],
                input?.source === 'windy',
            ),
            weatherStatus: weather.status,
            weatherError: weather.error,
            atmosphereStatus: atmosphere.status,
            cloudStatus: input?.source === 'windy' ? weather.status : clouds.status,
            cloudForecast:
                input?.source === 'windy' ? (weather.data?.cloudForecast ?? null) : clouds.data,
        };
        onChange(state);
    };

    const reset = (target: Channel<unknown>, key = target.key) => {
        target.controller?.abort();
        target.key = key;
        target.status = 'idle';
        target.data = null;
        target.error = '';
        target.controller = null;
    };

    const load = async <Value>(
        target: Channel<Value>,
        fetchValue: (signal: AbortSignal) => Promise<Value>,
        resultStatus: (value: Value) => WeatherLoadStatus,
    ) => {
        target.controller?.abort();
        const controller = new AbortController();
        target.controller = controller;
        target.status = 'loading';
        target.data = null;
        target.error = '';
        publish();
        const isCurrent = () =>
            !destroyed && !controller.signal.aborted && target.controller === controller;
        try {
            const result = await fetchValue(controller.signal);
            if (!isCurrent()) {
                return;
            }
            target.data = result;
            target.status = resultStatus(result);
        } catch (error) {
            if (!isCurrent()) {
                return;
            }
            target.status = 'error';
            target.error = error instanceof Error ? error.message : '';
        } finally {
            // A superseded request must not clear the new request's loading state.
            if (isCurrent()) {
                target.controller = null;
                publish();
            }
        }
    };

    const start = (kind: 'weather' | 'atmosphere' | 'clouds') => {
        if (destroyed || !input?.contextReady) {
            return;
        }
        const request = { ...input, location: { ...input.location } };
        if (kind === 'weather') {
            void load(
                weather,
                signal => provider.weather({ ...request, signal }),
                result => (result.points.length ? 'ready' : 'empty'),
            );
        } else if (kind === 'atmosphere') {
            void load(
                atmosphere,
                signal =>
                    provider.atmosphere({
                        ...request,
                        signal,
                        includeVisibility: request.source === 'windy',
                    }),
                result => (result.length ? 'ready' : 'error'),
            );
        } else {
            void load(
                clouds,
                signal => provider.clouds({ ...request, signal }),
                () => 'ready',
            );
        }
    };

    return {
        /** Input changes invalidate only channels whose source/location/hour/model identity changed. */
        update(next: ForecastInput): ForecastState {
            if (destroyed) {
                return state;
            }
            input = { ...next, location: { ...next.location } };
            const locationKey = buildWeatherLocationKey(next.location);
            const weatherKey = buildWeatherRequestKey(
                next.model,
                locationKey,
                next.requestedAt,
                next.source,
            );
            const atmosphereKey = `${next.source}|${buildOpenMeteoRequestKey(locationKey, next.requestedAt)}`;
            let changed = false;
            for (const [target, key] of [
                [weather, weatherKey],
                [atmosphere, atmosphereKey],
                [clouds, weatherKey],
            ] as const) {
                if (target.key !== key || (!next.contextReady && target.status !== 'idle')) {
                    reset(target, key);
                    changed = true;
                }
            }
            if (changed) {
                publish();
            }
            if (!next.contextReady) {
                return state;
            }
            if (next.visible && weather.status === 'idle') {
                start('weather');
            }
            if (next.visible && atmosphere.status === 'idle') {
                start('atmosphere');
            }
            if (next.cloudsVisible && next.source === 'open-meteo' && clouds.status === 'idle') {
                start('clouds');
            }
            // Return synchronous transitions so reactive callers can declare the output dependency.
            return state;
        },
        retry(kind: 'weather' | 'atmosphere' | 'clouds') {
            start(kind === 'clouds' && input?.source === 'windy' ? 'weather' : kind);
        },
        /** Explicit relocation, including the same coordinates, refreshes the whole forecast context. */
        invalidate() {
            if (destroyed) {
                return;
            }
            input = input ? { ...input, contextReady: false } : null;
            reset(weather);
            reset(atmosphere);
            reset(clouds);
            publish();
        },
        /** Collapsing normal mobile details cancels pending work, but retains completed forecasts. */
        suspendDetails() {
            if (destroyed) {
                return;
            }
            if (weather.status === 'loading') {
                reset(weather);
            }
            if (atmosphere.status === 'loading') {
                reset(atmosphere);
            }
            publish();
        },
        destroy() {
            destroyed = true;
            input = null;
            reset(weather);
            reset(atmosphere);
            reset(clouds);
        },
    };
};

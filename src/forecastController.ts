import {
    buildOpenMeteoRequestKey,
    combineAtmospherePoints,
    mergeOpenMeteoAtmosphere,
    type AtmosphereMetric,
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
    aodStatus: WeatherLoadStatus;
    visibilityStatus: WeatherLoadStatus;
    cloudStatus: WeatherLoadStatus;
    cloudForecast: WeatherForecastPayload | null;
};

export const emptyForecastState = (): ForecastState => ({
    requestKey: '',
    points: [],
    weatherStatus: 'idle',
    weatherError: '',
    atmosphereStatus: 'idle',
    aodStatus: 'idle',
    visibilityStatus: 'idle',
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
 * Weather, AOD, visibility and clouds settle independently. Destroy is terminal and never emits.
 */
export const createForecastController = (
    provider: WeatherProvider & {
        atmosphere: (
            input: WeatherRequest & { metric: AtmosphereMetric },
        ) => Promise<OpenMeteoAtmospherePoint[]>;
    },
    onChange: (state: ForecastState) => void,
    onError: (kind: 'weather' | 'atmosphere' | 'clouds', error: unknown) => void = () => undefined,
) => {
    const weather = channel<WeatherResult>();
    const aod = channel<OpenMeteoAtmospherePoint[]>();
    const visibility = channel<OpenMeteoAtmospherePoint[]>();
    const clouds = channel<WeatherForecastPayload>();
    let input: ForecastInput | null = null;
    let destroyed = false;
    let state = emptyForecastState();

    const publish = () => {
        if (destroyed) {
            return;
        }
        const atmosphereStates = input?.source === 'windy' ? [aod.status, visibility.status] : [aod.status];
        state = {
            requestKey: weather.key,
            points: mergeOpenMeteoAtmosphere(
                weather.data?.points ?? [],
                combineAtmospherePoints(aod.data ?? [], visibility.data ?? []),
                input?.source === 'windy',
            ),
            weatherStatus: weather.status,
            weatherError: weather.error,
            // This aggregate is only a diagnostic summary. Consumers use the metric states.
            atmosphereStatus: atmosphereStates.includes('loading') ? 'loading'
                : atmosphereStates.includes('idle') ? 'idle'
                : atmosphereStates.includes('error') ? 'error'
                : atmosphereStates.includes('empty') ? 'empty' : 'ready',
            aodStatus: aod.status,
            visibilityStatus: input?.source === 'windy' ? visibility.status : weather.status,
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
        kind: 'weather' | 'atmosphere' | 'clouds',
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
            try { onError(kind, error); } catch { /* Diagnostic failure cannot change forecast state. */ }
        } finally {
            // A superseded request must not clear the new request's loading state.
            if (isCurrent()) {
                target.controller = null;
                publish();
            }
        }
    };

    const start = (kind: 'weather' | AtmosphereMetric | 'clouds') => {
        if (destroyed || !input?.contextReady) {
            return;
        }
        const request = { ...input, location: { ...input.location } };
        if (kind === 'weather') {
            void load(
                weather,
                signal => provider.weather({ ...request, signal }),
                result => (result.points.length ? 'ready' : 'empty'),
                'weather',
            );
        } else if (kind === 'aod' || kind === 'visibility') {
            if (kind === 'visibility' && request.source !== 'windy') { return; }
            void load(
                kind === 'aod' ? aod : visibility,
                signal =>
                    provider.atmosphere({
                        ...request,
                        signal,
                        metric: kind,
                    }),
                result => (result.some(point => kind === 'aod' ? point.aod550 !== null : point.visibilityKm !== null) ? 'ready' : 'empty'),
                'atmosphere',
            );
        } else {
            void load(
                clouds,
                signal => provider.clouds({ ...request, signal }),
                () => 'ready',
                'clouds',
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
            const atmosphereKey = buildOpenMeteoRequestKey(locationKey, next.requestedAt);
            let changed = false;
            for (const [target, key] of [
                [weather, weatherKey],
                [aod, atmosphereKey],
                [visibility, next.source === 'windy' ? atmosphereKey : ''],
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
            if (next.visible && aod.status === 'idle') { start('aod'); }
            if (next.visible && next.source === 'windy' && visibility.status === 'idle') { start('visibility'); }
            if (next.cloudsVisible && next.source === 'open-meteo' && clouds.status === 'idle') {
                start('clouds');
            }
            // Return synchronous transitions so reactive callers can declare the output dependency.
            return state;
        },
        retry(kind: 'weather' | AtmosphereMetric | 'clouds') {
            if ((kind === 'aod' || kind === 'visibility')
                && !['error', 'empty'].includes((kind === 'aod' ? aod : visibility).status)) { return; }
            start(kind === 'clouds' && input?.source === 'windy' ? 'weather' : kind);
        },
        /** Explicit relocation, including the same coordinates, refreshes the whole forecast context. */
        invalidate() {
            if (destroyed) {
                return;
            }
            input = input ? { ...input, contextReady: false } : null;
            reset(weather);
            reset(aod);
            reset(visibility);
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
            if (aod.status === 'loading') { reset(aod); }
            if (visibility.status === 'loading') { reset(visibility); }
            publish();
        },
        destroy() {
            destroyed = true;
            input = null;
            reset(weather);
            reset(aod);
            reset(visibility);
            reset(clouds);
        },
    };
};

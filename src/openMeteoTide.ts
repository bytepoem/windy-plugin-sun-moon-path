import { addDaysToDateInput, dateInputForInstant, dateInputToUtcMidnight, type Coordinates } from './solar';

export type TidePoint = { timestamp: number; height: number };
export type TideEvent = TidePoint & { type: 'H' | 'L' };
export type TideForecast = { hourly: TidePoint[]; grid: Coordinates; fetchedAt: number };
export type TideDay = TideForecast & { events: TideEvent[] };
export type TideErrorCode = 'quota' | 'network' | 'data';
export class TideError extends Error {
    constructor(public code: TideErrorCode) { super(code); }
}
const HOUR_MS = 3_600_000;
const CACHE_MS = 8 * HOUR_MS;
const REQUEST_TIMEOUT_MS = 15_000;

const record = (value: unknown): Record<string, unknown> =>
    value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};

/** Null is a missing ocean cell, never zero. Unix seconds remain UTC across DST changes. */
export const parseTideForecast = (value: unknown, fetchedAt: number): TideForecast => {
    const data = record(value);
    const hourly = record(data.hourly);
    const units = record(data.hourly_units);
    const times = hourly.time;
    const heights = hourly.sea_level_height_msl;
    if (!Array.isArray(times) || !Array.isArray(heights) || times.length !== heights.length
        || units.time !== 'unixtime' || units.sea_level_height_msl !== 'm'
        || typeof data.latitude !== 'number' || !Number.isFinite(data.latitude) || Math.abs(data.latitude) > 90
        || typeof data.longitude !== 'number' || !Number.isFinite(data.longitude) || Math.abs(data.longitude) > 180) {
        throw new TideError('data');
    }
    const points: TidePoint[] = [];
    times.forEach((time, index) => {
        const height = heights[index];
        if (typeof time !== 'number' || !Number.isFinite(time)
            || (index > 0 && time - times[index - 1] !== HOUR_MS / 1000)
            || (height !== null && (typeof height !== 'number' || !Number.isFinite(height)))) {
            throw new TideError('data');
        }
        if (height !== null) { points.push({ timestamp: time * 1000, height }); }
    });
    return { hourly: points, grid: { lat: data.latitude, lon: data.longitude }, fetchedAt };
};

/** One coordinate forecast covers local dates, plus UTC padding at both ends. No credentials or persistence. */
export const fetchTideForecast = async (location: Coordinates, signal: AbortSignal,
    fetcher: typeof fetch = fetch): Promise<TideForecast> => {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
    const cancel = () => {
        clearTimeout(timeout);
        signal.removeEventListener('abort', cancel);
        abort.abort();
    };
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) { cancel(); }
    try {
        const url = new URL('https://marine-api.open-meteo.com/v1/marine');
        url.search = new URLSearchParams({ latitude: String(location.lat), longitude: String(location.lon),
            hourly: 'sea_level_height_msl', timeformat: 'unixtime', timezone: 'GMT',
            past_days: '1', forecast_days: '11', cell_selection: 'sea' }).toString();
        const response = await fetcher(url.toString(), { signal: abort.signal, credentials: 'omit', redirect: 'error' });
        if (!response.ok) { throw new TideError(response.status === 429 ? 'quota' : 'network'); }
        return parseTideForecast(await response.json(), Date.now());
    } catch (error) {
        if (signal.aborted) { throw new DOMException('Aborted', 'AbortError'); }
        throw error instanceof TideError ? error : new TideError('network');
    } finally {
        clearTimeout(timeout);
        signal.removeEventListener('abort', cancel);
    }
};

/** Linear readings only between adjacent hours; do not fill gaps or extrapolate. */
export const tideHeightAt = (points: TidePoint[], at: number | null): number | null => {
    if (at === null) { return null; }
    const right = points.findIndex(point => point.timestamp >= at);
    if (right < 0) { return null; }
    if (points[right].timestamp === at) { return points[right].height; }
    if (right === 0) { return null; }
    const left = points[right - 1];
    const next = points[right];
    if (next.timestamp - left.timestamp > HOUR_MS) { return null; }
    return left.height + (next.height - left.height) * (at - left.timestamp) / (next.timestamp - left.timestamp);
};

/** These are approximate model peaks/troughs, not provider tide events. Require both adjacent slopes. */
export const estimateTideEvents = (points: TidePoint[]): TideEvent[] => {
    const events: TideEvent[] = [];
    for (let index = 1; index < points.length - 1; index += 1) {
        const left = points[index - 1];
        const point = points[index];
        let last = index;
        while (last + 1 < points.length && points[last + 1].height === point.height
            && points[last + 1].timestamp - points[last].timestamp === HOUR_MS) { last += 1; }
        const right = points[last + 1];
        if (right && point.timestamp - left.timestamp === HOUR_MS
            && right.timestamp - points[last].timestamp === HOUR_MS) {
            const high = point.height > left.height && point.height > right.height;
            const low = point.height < left.height && point.height < right.height;
            if (high || low) {
                events.push({ timestamp: (point.timestamp + points[last].timestamp) / 2,
                    height: point.height, type: high ? 'H' : 'L' });
            }
        }
        index = last;
    }
    return events;
};

/** Clip in absolute time, including interpolated boundary samples for fractional-offset time zones. */
export const selectTideDay = (forecast: TideForecast, date: string, timeZone: string): TideDay => {
    const start = dateInputToUtcMidnight(date, timeZone).getTime();
    const end = dateInputToUtcMidnight(addDaysToDateInput(date, 1), timeZone).getTime();
    const hourly = forecast.hourly.filter(point => point.timestamp >= start && point.timestamp <= end);
    for (const timestamp of [start, end]) {
        const height = tideHeightAt(forecast.hourly, timestamp);
        if (height !== null && !hourly.some(point => point.timestamp === timestamp)) { hourly.push({ timestamp, height }); }
    }
    hourly.sort((a, b) => a.timestamp - b.timestamp);
    return { ...forecast, hourly, events: estimateTideEvents(forecast.hourly)
        .filter(event => event.timestamp >= start && event.timestamp < end) };
};

export type TideState = {
    status: 'idle' | 'loading' | 'ready' | 'no-data' | 'out-of-range' | 'error';
    day: TideDay | null; error: TideErrorCode | null;
};
export const emptyTideState = (): TideState => ({ status: 'idle', day: null, error: null });
export type TideInput = { location: Coordinates; date: string; timeZone: string; active: boolean; ready: boolean; now: number };

/** Owns one in-memory coordinate forecast. Hidden views cancel work; failures require explicit retry. */
export const createTideController = (changed: (state: TideState) => void, request = fetchTideForecast) => {
    let input: TideInput | null = null;
    let state = emptyTideState();
    let pending: AbortController | null = null;
    let revision = 0;
    let destroyed = false;
    let cache: { forecast: TideForecast; savedAt: number; utcDate: string } | null = null;
    const publish = () => { if (!destroyed) { changed({ ...state }); } };
    const cancel = () => {
        revision += 1;
        pending?.abort();
        pending = null;
    };
    const load = async () => {
        if (destroyed || !input?.active || !input.ready) { return; }
        cancel();
        const snapshot = input;
        const today = dateInputForInstant(new Date(snapshot.now), snapshot.timeZone);
        if (snapshot.date < today || snapshot.date > addDaysToDateInput(today, 9)) {
            state = { status: 'out-of-range', day: null, error: null };
            publish();
            return;
        }
        const current = revision;
        const utcDate = dateInputForInstant(new Date(snapshot.now), 'UTC');
        state = { status: 'loading', day: null, error: null };
        publish();
        const abort = new AbortController();
        pending = abort;
        try {
            const fresh = cache && cache.utcDate === utcDate && snapshot.now >= cache.savedAt
                && snapshot.now - cache.savedAt < CACHE_MS;
            const forecast = fresh ? cache!.forecast : await request(snapshot.location, abort.signal);
            if (current !== revision || destroyed) { return; }
            if (!fresh) { cache = { forecast, savedAt: snapshot.now, utcDate }; }
            const day = selectTideDay(forecast, snapshot.date, snapshot.timeZone);
            state = { status: day.hourly.length >= 2 ? 'ready' : 'no-data', day, error: null };
        } catch (error) {
            if (current !== revision || destroyed) { return; }
            state = { status: 'error', day: null, error: error instanceof TideError ? error.code : 'network' };
        }
        if (current === revision && !destroyed) {
            pending = null;
            publish();
        }
    };
    return {
        update(next: TideInput) {
            if (destroyed) { return; }
            const old = input;
            const moved = !old || old.location.lat !== next.location.lat || old.location.lon !== next.location.lon;
            const dateChanged = !old || old.date !== next.date || old.timeZone !== next.timeZone;
            const dayChanged = old && (dateInputForInstant(new Date(old.now), next.timeZone)
                !== dateInputForInstant(new Date(next.now), next.timeZone)
                || dateInputForInstant(new Date(old.now), 'UTC') !== dateInputForInstant(new Date(next.now), 'UTC'));
            input = next;
            if (moved) { cache = null; }
            if (!next.active || !next.ready) {
                cancel();
                if (moved || dateChanged || state.status === 'loading' || !next.ready) {
                    state = emptyTideState();
                    publish();
                }
                return;
            }
            const reopened = !old?.active || !old.ready;
            if (moved || dateChanged || dayChanged || state.status === 'idle'
                || (reopened && state.status !== 'error')) { void load(); }
        },
        retry() {
            cache = null;
            void load();
        },
        destroy() {
            destroyed = true;
            cancel();
            cache = null;
            input = null;
        },
    };
};

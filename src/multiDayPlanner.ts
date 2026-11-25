import {
    addDaysToDateInput, calculateAstronomyTimeline, dateInputToUtcNoon,
    type AstronomyInterval, type AstronomyTimeline, type Coordinates, type SolarEvent,
} from './solar';
import { isSelectableDate, maximumSelectableDate, minimumSelectableDate } from './dateSelection';
import type { WeatherLoadStatus, WeatherMetric, WeatherPoint } from './weather';

export const MULTI_DAY_EVENTS = ['sunrise', 'sunset', 'moonrise', 'moonset'] as const satisfies ReadonlyArray<SolarEvent>;
export type MultiDayTarget = 'moonless-night' | 'milky-way' | SolarEvent;
export type MultiDayInterval = { start: Date; end: Date; event?: SolarEvent };
const EVENT_WINDOW_RADIUS_MS = 3_600_000;
const MAX_REFERENCE_DISTANCE_MS = 90 * 60_000;
/** Include the neighbouring dates scanned by the existing daily calculator. */
export const isValidMultiDayRange = (date: string, count: number, minimumDate = minimumSelectableDate()): boolean =>
    (count === 7 || count === 30) && isSelectableDate(date, minimumDate, maximumSelectableDate(count));
export type MultiDayRow = {
    date: string;
    timeline: AstronomyTimeline;
    windows: Record<MultiDayTarget, MultiDayInterval[]>;
};

/** A night belongs to one local noon-to-noon bucket, including DST transitions.
 * Adjacent civil-day calculations can return the same untrimmed interval. Merge
 * those copies before clipping, so the same night is never counted twice.
 */
export const nightBucketIntervals = (
    intervals: AstronomyInterval[], date: string, timeZone: string,
): AstronomyInterval[] => {
    const start = dateInputToUtcNoon(date, timeZone).getTime();
    const end = dateInputToUtcNoon(addDaysToDateInput(date, 1), timeZone).getTime();
    const merged: AstronomyInterval[] = [];
    for (const interval of [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime())) {
        const left = Math.max(start, interval.start.getTime());
        const right = Math.min(end, interval.end.getTime());
        if (right <= left) { continue; }
        const previous = merged.at(-1);
        if (previous && previous.kind === interval.kind && left <= previous.end.getTime()) {
            previous.end = new Date(Math.max(right, previous.end.getTime()));
        } else {
            merged.push({ ...interval, start: new Date(left), end: new Date(right) });
        }
    }
    return merged;
};

/** Reuse neighbouring timelines while a range is built; all calculations stay local. */
export const createMultiDayCalculator = (location: Coordinates, timeZone: string, elevationM: number) => {
    const cache = new Map<string, AstronomyTimeline>();
    const timeline = (date: string) => {
        let value = cache.get(date);
        if (!value) {
            value = calculateAstronomyTimeline({ dateInput: date, location, timeZone, elevationM });
            cache.set(date, value);
        }
        return value;
    };
    return (date: string): MultiDayRow => {
        const current = timeline(date);
        const adjacent = timeline(addDaysToDateInput(date, 1));
        const collect = (kind: 'moonless-night' | 'milky-way') => nightBucketIntervals(
            [...current.intervals, ...adjacent.intervals].filter(interval => interval.kind === kind), date, timeZone,
        );
        // The event owns the window even when one endpoint crosses local midnight.
        const eventWindow = (event: SolarEvent): MultiDayInterval[] => {
            const time = current.items.find(item => item.kind === event)?.time;
            if (!time) { return []; }
            const timestamp = time.getTime();
            return [{ start: new Date(timestamp - EVENT_WINDOW_RADIUS_MS), end: new Date(timestamp + EVENT_WINDOW_RADIUS_MS), event }];
        };
        return {
            date, timeline: current,
            windows: {
                'moonless-night': collect('moonless-night'),
                'milky-way': collect('milky-way'),
                sunrise: eventWindow('sunrise'),
                sunset: eventWindow('sunset'),
                moonrise: eventWindow('moonrise'),
                moonset: eventWindow('moonset'),
            },
        };
    };
};

export type WindowWeather = {
    state: 'loading' | 'error' | 'missing' | 'outside' | 'partial' | 'full';
    points: WeatherPoint[];
    reference: { point: WeatherPoint; event: SolarEvent; offsetMs: number } | null;
    coveredStart: number | null;
    coveredEnd: number | null;
};

/** Keep original in-window samples distinct from an optional event reference.
 * A reference uses the nearest original point and requires the event to be in range.
 */
export const multiDayWindowWeather = (
    interval: MultiDayInterval, points: WeatherPoint[], status: WeatherLoadStatus,
): WindowWeather => {
    const start = interval.start.getTime();
    const end = interval.end.getTime();
    const forecast = [...points].sort((a, b) => a.timestamp - b.timestamp);
    const samples = forecast.filter(point => point.timestamp >= start && point.timestamp < end);
    const first = forecast[0]?.timestamp;
    const last = forecast.at(-1)?.timestamp;
    const state = status === 'idle' || status === 'loading' ? 'loading' : status === 'error' ? 'error'
        : first === undefined || last === undefined ? 'missing'
        : end <= first || start > last ? 'outside'
        : !samples.length ? 'missing' : start < first || end > last ? 'partial' : 'full';
    let reference: WindowWeather['reference'] = null;
    const eventTime = start + (end - start) / 2;
    if (status === 'ready' && state === 'missing' && interval.event && first !== undefined && last !== undefined
        && first <= eventTime && eventTime <= last) {
        // Sorted timestamps make an exact tie select the earlier forecast.
        const nearest = forecast.reduce((best, point) =>
            Math.abs(point.timestamp - eventTime) < Math.abs(best.timestamp - eventTime) ? point : best);
        const offsetMs = nearest.timestamp - eventTime;
        if (Math.abs(offsetMs) <= MAX_REFERENCE_DISTANCE_MS) {
            reference = { point: nearest, event: interval.event, offsetMs };
        }
    }
    return { state, points: samples, reference,
        coveredStart: first === undefined ? null : Math.max(start, first),
        coveredEnd: last === undefined ? null : Math.min(end, last) };
};

/** Source accumulations may end outside the window while overlapping it. Keep
 * their original values and durations; they are never a window rainfall total.
 */
export const multiDayPrecipitationPoints = (interval: MultiDayInterval, points: WeatherPoint[]): WeatherPoint[] =>
    points.filter(point => point.precipitationPeriodMs
        ? point.timestamp > interval.start.getTime() && point.timestamp - point.precipitationPeriodMs < interval.end.getTime()
        : point.timestamp >= interval.start.getTime() && point.timestamp < interval.end.getTime());

// Direction is circular, so it must not use a scalar minimum/maximum range.
export const multiDayMetricRange = (points: WeatherPoint[], metric: Exclude<WeatherMetric, 'windDirectionDeg'>) => {
    const values = points.map(point => point[metric]).filter((value): value is number => value !== null && Number.isFinite(value));
    return values.length ? { min: Math.min(...values), max: Math.max(...values), missing: values.length !== points.length } : null;
};

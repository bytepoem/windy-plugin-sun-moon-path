import {
    addDaysToDateInput, calculateAstronomyTimeline, dateInputToUtcNoon,
    type AstronomyInterval, type AstronomyTimeline, type Coordinates,
} from './solar';
import { isSelectableDate, maximumSelectableDate, minimumSelectableDate } from './dateSelection';
import type { WeatherLoadStatus, WeatherMetric, WeatherPoint } from './weather';

export type MultiDayTarget = 'moonless-night' | 'milky-way' | 'sunset';
export type MultiDayInterval = { start: Date; end: Date };
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
        const sunset = current.items.find(item => item.kind === 'sunset')?.time;
        return {
            date, timeline: current,
            windows: {
                'moonless-night': collect('moonless-night'),
                'milky-way': collect('milky-way'),
                sunset: sunset ? [{ start: new Date(sunset.getTime() - 3_600_000),
                    end: new Date(sunset.getTime() + 3_600_000) }] : [],
            },
        };
    };
};

export type WindowWeather = {
    state: 'loading' | 'error' | 'missing' | 'outside' | 'partial' | 'full';
    points: WeatherPoint[];
    coveredStart: number | null;
    coveredEnd: number | null;
};

/** Original samples only: never extend the forecast endpoints, fill holes or
 * substitute whole-day weather. Accumulated precipitation is shown separately.
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
    return { state, points: samples,
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

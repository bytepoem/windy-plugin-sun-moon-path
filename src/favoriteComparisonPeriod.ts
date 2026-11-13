import { dateInputForInstant } from './solar';
import type { FavoriteComparisonResult } from './favoriteComparison';
import type { WeatherPoint } from './weather';

export type ComparisonMode = 'day' | 'target' | 'custom';
export type ComparisonTargetWindow = 'moonless-night' | 'milky-way' | 'sunset';
export type ComparisonInterval = { start: number; end: number };
export type ComparisonPeriod = {
    intervals: ComparisonInterval[];
    points: WeatherPoint[];
    precipitationPoints: WeatherPoint[];
    coverage: 'full' | 'partial' | 'outside' | 'missing' | 'error' | 'no-window' | 'invalid';
};

const HOUR_MS = 3_600_000;

/** Resolve a civil minute without normalizing a DST gap or silently choosing a fold.
 * Offsets on both sides of a transition also cover half-hour DST. The comparison
 * UI supplies a prepared comparison site's time zone for nearby sites in one zone.
 */
export const resolveComparisonCivilTime = (value: string, timeZone: string): number | null => {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) { return null; }
    const naive = Date.parse(value + ':00Z');
    if (!Number.isFinite(naive)) { return null; }
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    const civil = (instant: number) => {
        const parts = formatter.formatToParts(instant);
        const part = (type: string) => parts.find(item => item.type === type)?.value;
        return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
    };
    const offsets = new Set([-48, -24, 0, 24, 48].map(hours => {
        const instant = naive + hours * HOUR_MS;
        return Date.parse(civil(instant) + ':00Z') - instant;
    }));
    const candidates = [...offsets].map(offset => naive - offset).filter(instant => civil(instant) === value);
    return candidates.length === 1 ? candidates[0] : null;
};

/** Target windows retain their real endpoints, including portions after midnight.
 * All matching segments are the default; an explicit index selects one per site.
 */
export const comparisonTargetIntervals = (
    result: FavoriteComparisonResult,
    target: ComparisonTargetWindow,
): ComparisonInterval[] => {
    if (result.prepared.status !== 'ready') { return []; }
    if (target === 'sunset') {
        const sunset = result.prepared.timeline.items.find(item => item.kind === 'sunset')?.time?.getTime();
        return sunset === undefined ? [] : [{ start: sunset - HOUR_MS, end: sunset + HOUR_MS }];
    }
    return result.prepared.timeline.intervals.filter(interval => interval.kind === target)
        .map(interval => ({ start: interval.start.getTime(), end: interval.end.getTime() }));
};

/** Samples are half-open [start, end), at the provider's original resolution.
 * Coverage uses only weather timestamps, never independent atmosphere samples.
 * No resampling, extrapolation, ranking or precipitation proration takes place.
 */
export const selectComparisonPeriod = ({ result, mode, target, segment = 'all', custom }: {
    result: FavoriteComparisonResult;
    mode: ComparisonMode;
    target: ComparisonTargetWindow;
    segment?: 'all' | number;
    custom: ComparisonInterval | null;
}): ComparisonPeriod => {
    const empty = (coverage: ComparisonPeriod['coverage']): ComparisonPeriod => ({
        intervals: [], points: [], precipitationPoints: [], coverage,
    });
    if (result.prepared.status !== 'ready') { return empty('error'); }
    if (mode === 'custom' && (!custom || !Number.isFinite(custom.start) || !Number.isFinite(custom.end)
        || custom.end <= custom.start)) { return empty('invalid'); }
    const all = comparisonTargetIntervals(result, target);
    const intervals = mode === 'day'
        ? [{ start: result.prepared.timeline.dayStart.getTime(), end: result.prepared.timeline.dayEnd.getTime() }]
        : mode === 'custom' ? custom ? [custom] : []
        : segment === 'all' ? all : all[segment] ? [all[segment]] : [];
    if (!intervals.length) { return empty(mode === 'custom' ? 'invalid' : 'no-window'); }
    const inside = (timestamp: number) => intervals.some(interval => timestamp >= interval.start && timestamp < interval.end);
    const points = mode === 'day' ? result.dailyWeatherPoints : result.weatherPoints.filter(point => inside(point.timestamp));
    const precipitationPoints = mode === 'day' ? points : result.forecastPoints.filter(point =>
        point.precipitationPeriodMs
            ? intervals.some(interval => point.timestamp > interval.start
                && point.timestamp - point.precipitationPeriodMs! < interval.end)
            : inside(point.timestamp));
    const forecast = [...result.forecastPoints].sort((a, b) => a.timestamp - b.timestamp);
    const first = forecast[0]?.timestamp;
    const last = forecast.at(-1)?.timestamp;
    const selectedForecast = forecast.filter(point => inside(point.timestamp));
    const outside = first === undefined || last === undefined || intervals.every(interval => interval.end <= first || interval.start > last);
    const full = first !== undefined && last !== undefined
        && intervals.every(interval => interval.start >= first && interval.end <= last);
    return {
        intervals, points, precipitationPoints,
        coverage: result.weatherStatus === 'error' ? 'error'
            : outside ? result.weatherStatus === 'empty' ? 'missing' : 'outside'
            : !selectedForecast.length ? 'missing' : full ? 'full' : 'partial',
    };
};

/** Local sample dates remain explicit; nearby-site comparisons omit UTC offsets. */
export const comparisonInstantLabel = (timestamp: number, timeZone: string): string => {
    const clock = new Intl.DateTimeFormat('en-GB', {
        timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(timestamp);
    return `${dateInputForInstant(new Date(timestamp), timeZone)} ${clock}`;
};

/** Compact endpoints share the observing-date header. Cross-midnight windows
 * label both dates so separate segments and adjacent nights remain distinct.
 */
export const comparisonIntervalLabels = (
    interval: ComparisonInterval,
    timeZone: string,
    dateInput: string,
    shortDate: (month: number, day: number) => string,
): { start: string; end: string } => {
    const startDate = dateInputForInstant(new Date(interval.start), timeZone);
    const endDate = dateInputForInstant(new Date(interval.end), timeZone);
    const clock = (timestamp: number) => new Intl.DateTimeFormat('en-GB', {
        timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(timestamp);
    const endpoint = (timestamp: number, date: string) => {
        const [, month, day] = date.split('-').map(Number);
        return startDate !== endDate || date !== dateInput ? `${shortDate(month, day)} ${clock(timestamp)}` : clock(timestamp);
    };
    return { start: endpoint(interval.start, startDate), end: endpoint(interval.end, endDate) };
};

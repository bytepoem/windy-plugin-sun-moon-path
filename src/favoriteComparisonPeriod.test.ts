import { beforeAll, describe, expect, it } from 'vitest';
import { comparisonInstantLabel, comparisonIntervalLabels, comparisonTargetIntervals, resolveComparisonCivilTime, selectComparisonPeriod } from './favoriteComparisonPeriod';
import { calculateAstronomyTimeline } from './solar';
import { compileRenderer, type RenderComponent } from './test/renderSvelte';
import type { FavoriteComparisonResult } from './favoriteComparison';
import type { WeatherPoint } from './weather';

const hour = 3_600_000;
const base = Date.UTC(2026, 10, 13);
const point = (timestamp: number, cloud = 80): WeatherPoint => ({
    timestamp, iconCode: 1, isDay: false, totalCloudPercent: cloud, highCloudPercent: null,
    mediumCloudPercent: null, lowCloudPercent: null, temperatureC: null, dewPointC: null,
    humidityPercent: null, precipMm: 2, precipitationPeriodMs: hour,
    windMs: cloud / 10, windDirectionDeg: null, aod550: null, visibilityKm: null,
});
const fixture = (timeZone = 'UTC', location = { lat: 23.1, lon: 113.3 }): FavoriteComparisonResult => {
    const forecastPoints = Array.from({ length: 49 }, (_, i) => point(base + i * hour, i === 19 ? 10 : 80));
    return {
        prepared: {
            status: 'ready', target: { id: timeZone, title: timeZone, location }, timeZone, elevationM: 0,
            lightPollution: null, lightPollutionStatus: 'error', atmospherePoints: [], aodStatus: 'empty', visibilityStatus: 'empty',
            timeline: calculateAstronomyTimeline({ dateInput: '2026-11-13', timeZone, location }),
        },
        forecastPoints, weatherPoints: forecastPoints, dailyWeatherPoints: forecastPoints.slice(0, 24),
        weatherStatus: 'ready', windows: [], dateSelection: { coverage: 'covered', startIndex: 0, length: 24 },
    };
};
const select = (result: FavoriteComparisonResult, start: number, end: number) => selectComparisonPeriod({
    result, mode: 'custom', target: 'milky-way', custom: { start, end },
});

describe('comparison periods and original forecast resolution', () => {
    it('keeps day semantics and reveals improvement only in the selected period', () => {
        const result = fixture();
        const day = selectComparisonPeriod({ result, mode: 'day', target: 'milky-way', custom: null });
        expect(day.points).toEqual(result.dailyWeatherPoints);
        // Whole day retains the existing timestamp-on-local-date semantics.
        expect(day.precipitationPoints).toEqual(result.dailyWeatherPoints);
        const period = select(result, base + 19 * hour, base + 20 * hour);
        expect(period.points.map(p => p.totalCloudPercent)).toEqual([10]);
        expect(period.points.map(p => p.windMs)).toEqual([1]);
        expect(period.precipitationPoints.map(p => p.timestamp)).toEqual([base + 20 * hour]);
        expect(period.precipitationPoints[0].precipMm).toBe(2);
    });

    it('retains a full overlapping precipitation period without fabricating an instant value', () => {
        const period = select(fixture(), base + 19.5 * hour, base + 19.75 * hour);
        expect(period.points).toEqual([]);
        expect(period.coverage).toBe('missing');
        expect(period.precipitationPoints).toEqual([point(base + 20 * hour)]);
    });

    it('distinguishes missing, partial, outside, failed and invalid periods', () => {
        const result = fixture();
        expect(select(result, base - hour, base + hour).coverage).toBe('partial');
        expect(select(result, base - 2 * hour, base - hour).coverage).toBe('outside');
        expect(select({ ...result, weatherStatus: 'error', forecastPoints: [] }, base, base + hour).coverage).toBe('error');
        expect(select({ ...result, weatherStatus: 'empty', forecastPoints: [] }, base, base + hour).coverage).toBe('missing');
        expect(selectComparisonPeriod({ result, mode: 'custom', target: 'sunset', custom: null }).coverage).toBe('invalid');
        // Independent atmosphere points cannot extend a provider's coverage.
        expect(select({ ...result, weatherPoints: [...result.weatherPoints, point(base - hour)] }, base - hour, base).coverage).toBe('outside');
    });

    it('includes every segment, supports one per site and preserves midnight crossings', () => {
        const result = fixture();
        if (result.prepared.status !== 'ready') { throw new Error('fixture'); }
        result.prepared.timeline.intervals = [0, 23].map(h => ({
            kind: 'milky-way', label: '', start: new Date(base + h * hour), end: new Date(base + (h + 2) * hour),
        }));
        const input = { result, mode: 'target' as const, target: 'milky-way' as const, custom: null };
        expect(selectComparisonPeriod(input).points.map(p => p.timestamp)).toEqual([base, base + hour, base + 23 * hour, base + 24 * hour]);
        expect(selectComparisonPeriod({ ...input, segment: 1 }).intervals).toEqual([{ start: base + 23 * hour, end: base + 25 * hour }]);
        result.prepared.timeline.intervals = [];
        expect(selectComparisonPeriod(input).coverage).toBe('no-window');
    });

    it('compares local sunset events at different UTC instants, but custom intervals at the same UTC instants', () => {
        const a = fixture('Asia/Shanghai');
        const b = fixture('America/New_York', { lat: 40.7, lon: -74 });
        const [sunsetA] = comparisonTargetIntervals(a, 'sunset');
        const [sunsetB] = comparisonTargetIntervals(b, 'sunset');
        expect(sunsetA.end - sunsetA.start).toBe(2 * hour);
        expect(Math.abs(sunsetB.start - sunsetA.start)).toBeGreaterThan(8 * hour);
        expect(select(a, base + 23 * hour, base + 25 * hour).points).toEqual(select(b, base + 23 * hour, base + 25 * hour).points);
        if (a.prepared.status !== 'ready') { throw new Error('fixture'); }
        a.prepared.timeline.items = [];
        expect(comparisonTargetIntervals(a, 'sunset')).toEqual([]);
    });

    it.each([
        ['2026-03-08T02:30', 'America/New_York', null],
        ['2026-11-01T01:30', 'America/New_York', null],
        ['2026-10-04T02:15', 'Australia/Lord_Howe', null],
        ['2026-04-05T01:45', 'Australia/Lord_Howe', null],
        ['2026-02-30T18:00', 'UTC', null],
        ['', 'UTC', null],
        ['2026-11-01T06:30', 'UTC', Date.UTC(2026, 10, 1, 6, 30)],
        ['2026-11-13T18:00', 'Asia/Kathmandu', Date.UTC(2026, 10, 13, 12, 15)],
        ['2026-11-13T00:30', 'Pacific/Kiritimati', Date.UTC(2026, 10, 12, 10, 30)],
    ])('resolves %s in %s without silent DST normalization', (civil, zone, expected) => {
        expect(resolveComparisonCivilTime(civil as string, zone as string)).toBe(expected);
    });

    it.each([['2026-03-08', 23], ['2026-11-01', 25]] as const)('uses the real %s day length', (dateInput, hours) => {
        const timeline = calculateAstronomyTimeline({ dateInput, timeZone: 'America/New_York', location: { lat: 40.7, lon: -74 } });
        expect((timeline.dayEnd.getTime() - timeline.dayStart.getTime()) / hour).toBe(hours);
    });

    it('keeps ordinary windows compact and dates explicit on adjacent nights', () => {
        const date = (month: number, day: number) => `${month}/${day}`;
        expect(comparisonIntervalLabels({ start: base + 17 * hour, end: base + 19 * hour }, 'UTC', '2026-11-13', date))
            .toEqual({ start: '17:00', end: '19:00' });
        expect(comparisonIntervalLabels({ start: base + 20 * hour, end: base + 29 * hour }, 'UTC', '2026-11-13', date))
            .toEqual({ start: '11/13 20:00', end: '11/14 05:00' });
        expect(comparisonIntervalLabels({ start: base - 4 * hour, end: base + 5 * hour }, 'UTC', '2026-11-13', date))
            .toEqual({ start: '11/12 20:00', end: '11/13 05:00' });
        expect(comparisonInstantLabel(base + 17 * hour, 'UTC')).toBe('2026-11-13 17:00');
    });
});

describe('compiled period weather details', () => {
    let render: RenderComponent;
    beforeAll(async () => { render = await compileRenderer('ComparisonPeriodDetails.svelte'); }, 20_000);
    it('renders actual selected samples, unknowns and full precipitation boundaries', () => {
        const result = fixture();
        result.weatherPoints[19].windMs = null;
        const html = render({ result, period: select(result, base + 19 * hour, base + 20 * hour), language: 'en',
            units: { wind: 'm/s', precipitation: 'mm', temperature: '°C', distance: 'km', altitude: 'm' } });
        expect(html).toContain('10%');
        expect(html).toContain('Missing data');
        expect(html).toContain('2026-11-13 19:00');
        expect(html).toContain('2026-11-13 20:00');
        expect(html).not.toContain('GMT');
        expect(html).not.toContain('80%');
    });
    it.each(['outside', 'no-window', 'error'] as const)('renders %s without good-condition claims', coverage => {
        const html = render({ result: fixture(), period: { intervals: [], points: [], precipitationPoints: [], coverage }, language: 'en' });
        expect(html).toContain(coverage === 'outside' ? 'Date outside forecast range' : coverage === 'error' ? 'Model data unavailable' : 'No available window');
        expect(html).not.toContain('0%');
    });
    it.each(['day', 'custom'] as const)('does not present independent atmosphere timestamps as original weather samples in %s mode', mode => {
        const result = fixture();
        result.weatherPoints = [...result.weatherPoints, { ...point(base + 19.5 * hour), totalCloudPercent: null, windMs: null, precipMm: null, aod550: 0.2 }];
        result.dailyWeatherPoints = result.weatherPoints.filter(p => p.timestamp >= base + 19 * hour && p.timestamp < base + 20 * hour);
        const period = mode === 'day' ? selectComparisonPeriod({ result, mode, target: 'sunset', custom: null })
            : select(result, base + 19 * hour, base + 20 * hour);
        const html = render({ result, period, language: 'en',
            units: { wind: 'm/s', precipitation: 'mm' } });
        expect(html).not.toContain('19:30');
        expect(html).toContain(`Original forecast samples · ${mode === 'day' ? 1 : 2}`);
    });
});

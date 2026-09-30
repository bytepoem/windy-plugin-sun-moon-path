import { describe, expect, it } from 'vitest';
import { Body, Equator, Horizon, Observer } from 'astronomy-engine';
import { createObservationPlanner } from './observationPlanner';
import { resolvePlanningTime } from './planningTime';
import { dateInputForInstant, dateInputToUtcMidnight } from './solar';

describe('astronomy and planning-time integration', () => {
    it('uses the first valid instant of a day whose midnight is skipped', () => {
        const timeZone = 'America/Santiago';
        const before = dateInputToUtcMidnight('2026-09-05', timeZone);
        const start = dateInputToUtcMidnight('2026-09-06', timeZone);
        const end = dateInputToUtcMidnight('2026-09-07', timeZone);
        expect(start.toISOString()).toBe('2026-09-06T04:00:00.000Z');
        expect(dateInputForInstant(start, timeZone)).toBe('2026-09-06');
        expect(start.getTime() - before.getTime()).toBe(24 * 3_600_000);
        expect(end.getTime() - start.getTime()).toBe(23 * 3_600_000);
    });

    it('selects the first occurrence when the local midnight repeats', () => {
        const timeZone = 'America/Havana';
        const start = dateInputToUtcMidnight('2026-11-01', timeZone);
        const end = dateInputToUtcMidnight('2026-11-02', timeZone);
        expect(start.toISOString()).toBe('2026-11-01T04:00:00.000Z');
        expect(end.getTime() - start.getTime()).toBe(25 * 3_600_000);
    });

    it.each([
        { timeZone: 'Asia/Shanghai', location: { lat: 23.13, lon: 113.26 } },
        { timeZone: 'America/Los_Angeles', location: { lat: 34.05, lon: -118.24 } },
        { timeZone: 'Pacific/Auckland', location: { lat: -36.85, lon: 174.76 } },
        { timeZone: 'Pacific/Apia', location: { lat: -13.83, lon: -171.75 } },
        { timeZone: 'Pacific/Kiritimati', location: { lat: 1.87, lon: -157.43 } },
        { timeZone: 'Pacific/Pago_Pago', location: { lat: -14.28, lon: -170.7 } },
    ])('resolves event and midnight selections on the local day in $timeZone', async ({ timeZone, location }) => {
        const planner = createObservationPlanner({
            getTimeZone: async () => timeZone,
            getElevation: async () => 10,
        });
        const selectedDate = '2026-09-30';
        const plan = await planner.plan({ location, dateInput: selectedDate });
        const input = { selectedDate, timeZone: plan.timeZone, now: new Date('2026-09-30T12:00:00Z'),
            ready: true, events: plan.timeline.items };
        const sunset = plan.timeline.items.find(event => event.kind === 'sunset')!.time!;
        const eventTime = resolvePlanningTime({ ...input, selection: { mode: 'event', event: 'sunset' } });
        expect(eventTime.timestamp).toBe(sunset.getTime());
        expect(dateInputForInstant(sunset, timeZone)).toBe(selectedDate);
        const sunsetPath = plan.paths.find(path => path.event === 'sunset')!;
        expect(sunsetPath.status).toBe('ok');
        if (sunsetPath.status === 'ok') {
            expect(sunsetPath.eventTime.getTime()).toBe(sunset.getTime());
        }
        const midnight = resolvePlanningTime({ ...input, selection: { mode: 'clock', clock: '00:00' } });
        expect(midnight.timestamp).toBe(plan.timeline.dayStart.getTime());
        expect(dateInputForInstant(new Date(midnight.timestamp!), timeZone)).toBe(selectedDate);
    });

    it.each([
        { dateInput: '2026-09-30', timeZone: 'Pacific/Auckland', location: { lat: -36.85, lon: 174.76 } },
        { dateInput: '2026-08-23', timeZone: 'Europe/Helsinki', location: { lat: 60.17, lon: 24.94 } },
        { dateInput: '2026-09-30', timeZone: 'Pacific/Apia', location: { lat: -13.83, lon: -171.75 } },
    ])('never includes daylight in observing windows for $timeZone on $dateInput', async ({ dateInput, timeZone, location }) => {
        const planner = createObservationPlanner({ getTimeZone: async () => timeZone, getElevation: async () => 0 });
        const { timeline } = await planner.plan({ location, dateInput });
        expect(timeline.intervals.length).toBeGreaterThan(0);
        const observer = new Observer(location.lat, location.lon, 0);
        for (const interval of timeline.intervals) {
            // Independent geometric altitude: SunCalc getPosition adds refraction,
            // whereas its astronomical-night event threshold is geometric -18°.
            for (let timestamp = interval.start.getTime() + 60_000; timestamp < interval.end.getTime(); timestamp += 10 * 60_000) {
                const date = new Date(timestamp);
                const sun = Equator(Body.Sun, date, observer, true, true);
                const altitude = Horizon(date, observer, sun.ra, sun.dec).altitude;
                expect(altitude).toBeLessThanOrEqual(-17.9);
            }
        }
    });

    it('does not reuse a previous sunset when the next location has polar day', async () => {
        const planner = createObservationPlanner({
            getTimeZone: async location => location.lat > 70 ? 'Arctic/Longyearbyen' : 'Asia/Shanghai',
            getElevation: async () => 0,
        });
        const selectedDate = '2026-06-21';
        const selection = { mode: 'event', event: 'sunset' } as const;
        const now = new Date('2026-06-21T12:00:00Z');
        const ordinary = await planner.plan({ location: { lat: 23, lon: 113 }, dateInput: selectedDate });
        const original = { selectedDate, selection, now, timeZone: ordinary.timeZone, events: ordinary.timeline.items };
        expect(resolvePlanningTime({ ...original, ready: true }).timestamp).not.toBeNull();
        expect(resolvePlanningTime({ ...original, ready: false }).timestamp).toBeNull();
        const polar = await planner.plan({ location: { lat: 78.22, lon: 15.65 }, dateInput: selectedDate });
        expect(resolvePlanningTime({ ...original, timeZone: polar.timeZone, events: polar.timeline.items, ready: true }))
            .toEqual({ clock: '', timestamp: null });
    });

    it.each([
        { timeZone: 'America/New_York', location: { lat: 40.71, lon: -74.01 }, dates: ['2026-03-08', '2026-11-01'] },
        { timeZone: 'Pacific/Auckland', location: { lat: -36.85, lon: 174.76 }, dates: ['2026-09-27', '2026-04-05'] },
    ])('uses real 23/25-hour local days for daylight-saving transitions in $timeZone', async ({ timeZone, location, dates }) => {
        const planner = createObservationPlanner({ getTimeZone: async () => timeZone, getElevation: async () => 0 });
        for (const [dateInput, hours] of [[dates[0], 23], [dates[1], 25]] as const) {
            const plan = await planner.plan({ location, dateInput });
            expect(plan.timeline.dayEnd.getTime() - plan.timeline.dayStart.getTime()).toBe(hours * 3_600_000);
            for (const event of plan.timeline.items.filter(item => item.time)) {
                expect(dateInputForInstant(event.time!, timeZone)).toBe(dateInput);
            }
        }
    });
});

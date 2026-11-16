import { describe, expect, it } from 'vitest';
import { createObservationPlanner } from './observationPlanner';
import { createPlanningState, planningDateForLocation, transitionPlanningState, type PlanningState } from './planningState';
import { resolvePlanningTime } from './planningTime';

const timestamp = Date.parse('2026-11-01T06:30:27Z');
const hostTime = (state: PlanningState, overrides = {}) => transitionPlanningState(state, {
    type: 'host-time', timestamp: timestamp + 3_600_000, pluginName: 'planner', currentTimestamp: timestamp, ...overrides,
});
const resolve = (state: PlanningState, selectedDate = '2026-11-01', timeZone = 'America/New_York') =>
    resolvePlanningTime({ selection: state.selection, selectedDate, timeZone,
        now: new Date(timestamp), events: [], ready: true });

describe('planning intent transitions', () => {
    it('captures now/overview/tide instants and waits for the selected location before deriving a date', () => {
        const state = createPlanningState(Date.parse('2026-11-01T23:30:27Z'));
        expect(planningDateForLocation(state.selection, 'Asia/Shanghai', false)).toBeNull();
        expect(planningDateForLocation(state.selection, 'Asia/Shanghai', true)).toBe('2026-11-02');
        expect(planningDateForLocation(state.selection, 'America/New_York', true)).toBe('2026-11-01');
        expect(resolve(state).timestamp).toBe(Date.parse('2026-11-01T23:30:27Z'));
    });

    it('keeps an absolute repeated DST instant until a manual date edit releases it to a local clock', () => {
        const state = createPlanningState(timestamp);
        expect(resolve(state)).toEqual({ clock: '01:30', timestamp });
        const edited = transitionPlanningState(state, { type: 'date', timeZone: 'America/New_York' });
        expect(resolve(edited, '2026-11-02')).toEqual({ clock: '01:30', timestamp: Date.parse('2026-11-02T06:30Z') });
        expect(planningDateForLocation(edited.selection, 'Asia/Shanghai', true)).toBeNull();
    });

    it('preserves current/event intent and preview on a date-only comparison edit', () => {
        for (const selection of [{ mode: 'current' }, { mode: 'event', event: 'sunset' }, { mode: 'clock', clock: '03:15' }] as const) {
            const state: PlanningState = { selection, preview: true, hostInputActive: true };
            expect(transitionPlanningState(state, { type: 'date', timeZone: 'Asia/Shanghai' }))
                .toEqual({ selection, preview: true, hostInputActive: false });
        }
    });

    it('previews a clock locally, commits it, and rejects a nonexistent DST clock', () => {
        const armed = transitionPlanningState(createPlanningState(timestamp), { type: 'host-input' });
        const preview = transitionPlanningState(armed, { type: 'clock', clock: '02:30', preview: true });
        expect(preview.hostInputActive).toBe(false);
        expect(preview.preview).toBe(true);
        expect(resolve(preview, '2026-03-08').timestamp).toBeNull();
        const committed = transitionPlanningState(preview, { type: 'commit' });
        expect(committed).toEqual({ ...preview, preview: false });
        expect(resolve(committed, '2026-03-09').timestamp).toBe(Date.parse('2026-03-09T06:30Z'));
    });

    it('distinguishes continuously current directions from a captured now instant', () => {
        const current = transitionPlanningState(createPlanningState(timestamp), { type: 'current' });
        expect(resolve(current).timestamp).toBe(timestamp);
        const input = { selectedDate: '2026-11-01', timeZone: 'America/New_York',
            now: new Date(timestamp + 60_000), events: [], ready: true };
        expect(resolvePlanningTime({ ...input, selection: current.selection }).timestamp).toBe(timestamp + 60_000);
        expect(resolvePlanningTime({ ...input, selection: createPlanningState(timestamp).selection }).timestamp).toBe(timestamp);
    });

    it('rejects unavailable or unresolved events without changing any intent flags', () => {
        const state = transitionPlanningState(createPlanningState(timestamp), { type: 'host-input' });
        const action = { type: 'event', event: 'sunset', ready: true, events: [{ kind: 'sunset', time: new Date(timestamp) }] } as const;
        expect(transitionPlanningState(state, { ...action, events: [...action.events], ready: false })).toBe(state);
        expect(transitionPlanningState(state, { ...action, events: [{ kind: 'sunset', time: null }] })).toBe(state);
        expect(transitionPlanningState(state, { ...action, event: 'moonrise', events: [...action.events] })).toBe(state);
    });

    it('selects real astronomy events with exact seconds and re-resolves them after relocation', async () => {
        const planner = createObservationPlanner({ getTimeZone: async () => 'Asia/Shanghai', getElevation: async () => 0 });
        const date = '2026-11-01';
        const plan = await planner.plan({ location: { lat: 23.13, lon: 113.26 }, dateInput: date });
        const state = transitionPlanningState(createPlanningState(timestamp), {
            type: 'event', event: 'sunset', ready: true, events: plan.timeline.items,
        });
        const input = { selection: state.selection, selectedDate: date, timeZone: plan.timeZone,
            now: new Date(timestamp), events: plan.timeline.items, ready: true };
        expect(resolvePlanningTime(input).timestamp).toBe(plan.timeline.items.find(item => item.kind === 'sunset')!.time!.getTime());
        expect(resolvePlanningTime({ ...input, ready: false }).timestamp).toBeNull();
        const moved = await planner.plan({ location: { lat: 31.23, lon: 121.47 }, dateInput: date });
        expect(resolvePlanningTime({ ...input, events: moved.timeline.items }).timestamp)
            .toBe(moved.timeline.items.find(item => item.kind === 'sunset')!.time!.getTime());
    });

    it('ignores automatic host initialization until host input, then follows unsourced updates', () => {
        const state = createPlanningState(timestamp);
        expect(hostTime(state)).toBe(state);
        const armed = transitionPlanningState(state, { type: 'host-input' });
        const following = hostTime(armed);
        expect(following.selection).toEqual({ mode: 'windy', timestamp: timestamp + 3_600_000 });
        expect(hostTime({ ...following, hostInputActive: false }, { timestamp: timestamp + 7_200_000 }).selection)
            .toEqual({ mode: 'windy', timestamp: timestamp + 7_200_000 });
        expect(hostTime(state, { source: 'progress-bar' }).selection.mode).toBe('windy');
    });

    it('ignores own-source and exact-time echoes, invalid instants, and keeps an event selected', () => {
        const state: PlanningState = { selection: { mode: 'event', event: 'sunset' }, preview: false, hostInputActive: true };
        for (const override of [
            { source: 'planner' }, { timestamp }, { timestamp: NaN }, { timestamp: Infinity }, { timestamp: 9e15 },
        ]) {
            expect(hostTime(state, override)).toBe(state);
        }
    });

    it('every local selection releases previously armed host input', () => {
        const state: PlanningState = { selection: { mode: 'windy', timestamp }, preview: true, hostInputActive: true };
        const choices = [
            transitionPlanningState(state, { type: 'instant', timestamp }),
            transitionPlanningState(state, { type: 'date', timeZone: 'Asia/Shanghai' }),
            transitionPlanningState(state, { type: 'clock', clock: '12:00', preview: false }),
            transitionPlanningState(state, { type: 'current' }),
            transitionPlanningState(state, { type: 'event', event: 'sunset', ready: true,
                events: [{ kind: 'sunset', time: new Date(timestamp) }] }),
        ];
        for (const choice of choices) {
            expect(choice.hostInputActive).toBe(false);
            expect(hostTime(choice)).toBe(choice);
        }
    });
});

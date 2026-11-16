import { dateInputForInstant, formatLocalClock } from './solar';
import type { PlanningTimeSelection } from './planningTime';

/** The shell owns location/date; this value owns only the user's time intent. */
export type PlanningState = {
    selection: PlanningTimeSelection;
    preview: boolean;
    hostInputActive: boolean;
};

type PlanningAction =
    | { type: 'instant'; timestamp: number }
    | { type: 'date'; timeZone: string }
    | { type: 'clock'; clock: string; preview: boolean }
    | { type: 'commit' }
    | { type: 'current' }
    | { type: 'event'; event: string; ready: boolean; events: { kind: string; time: Date | null }[] }
    | { type: 'host-input' }
    | { type: 'host-time'; timestamp: number; source?: string; pluginName: string; currentTimestamp: number | null };

export const createPlanningState = (timestamp: number): PlanningState => ({
    selection: { mode: 'instant', timestamp },
    preview: false,
    hostInputActive: false,
});

/**
 * Apply one time intent atomically. Local choices release host control; automatic
 * host initialization and echoes cannot replace them. An ignored action returns
 * the same value, so event callers can avoid changing direction/body controls.
 * No timers, effects or second copy of the location/date live in this module.
 */
export const transitionPlanningState = (state: PlanningState, action: PlanningAction): PlanningState => {
    switch (action.type) {
        case 'instant':
            return createPlanningState(action.timestamp);
        case 'date': {
            const { selection } = state;
            return {
                ...state,
                hostInputActive: false,
                selection: selection.mode === 'instant' || selection.mode === 'windy'
                    ? { mode: 'clock', clock: formatLocalClock(new Date(selection.timestamp), action.timeZone) }
                    : selection,
            };
        }
        case 'clock':
            return {
                selection: { mode: 'clock', clock: action.clock },
                preview: action.preview,
                hostInputActive: false,
            };
        case 'commit':
            return { ...state, preview: false };
        case 'current':
            return { selection: { mode: 'current' }, preview: false, hostInputActive: false };
        case 'event':
            if (!action.ready || !action.events.some(item => item.kind === action.event && item.time)) {
                return state;
            }
            return { selection: { mode: 'event', event: action.event }, preview: false, hostInputActive: false };
        case 'host-input':
            return { ...state, hostInputActive: true };
        case 'host-time':
            if (action.source === action.pluginName
                || !Number.isFinite(action.timestamp)
                || !Number.isFinite(new Date(action.timestamp).getTime())
                || action.timestamp === action.currentTimestamp
                || (state.selection.mode !== 'windy' && !action.source && !state.hostInputActive)) {
                return state;
            }
            return { ...state, selection: { mode: 'windy', timestamp: action.timestamp }, preview: false };
    }
};

/** Absolute instants acquire a civil date only from the selected location's context. */
export const planningDateForLocation = (
    selection: PlanningTimeSelection,
    timeZone: string,
    contextReady: boolean,
): string | null => contextReady && (selection.mode === 'windy' || selection.mode === 'instant')
    ? dateInputForInstant(new Date(selection.timestamp), timeZone)
    : null;

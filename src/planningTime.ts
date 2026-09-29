import { cloudTimeInstant } from './cloudGeometry';
import { dateInputForInstant, formatLocalClock } from './solar';

export type PlanningTimeSelection =
    | { mode: 'clock'; clock: string }
    | { mode: 'event'; event: string }
    | { mode: 'windy'; timestamp: number }
    | { mode: 'instant'; timestamp: number }
    | { mode: 'current' };

/** One clock for every planner. Event selections retain their exact instant;
 * manual/current clocks are interpreted on the selected local civil date.
 * No consumer may calculate with an unresolved location/date snapshot.
 */
export const resolvePlanningTime = ({ selection, selectedDate, timeZone, now, events, ready }: {
    selection: PlanningTimeSelection;
    selectedDate: string;
    timeZone: string;
    now: Date;
    events: { kind: string; time: Date | null }[];
    ready: boolean;
}): { clock: string; timestamp: number | null } => {
    if (!ready) {
        return { clock: selection.mode === 'clock' ? selection.clock : '', timestamp: null };
    }
    if (selection.mode === 'event') {
        const event = events.find(item => item.kind === selection.event)?.time;
        return { clock: event ? formatLocalClock(event, timeZone) : '', timestamp: event?.getTime() ?? null };
    }
    if (selection.mode === 'windy' || selection.mode === 'instant') {
        return { clock: formatLocalClock(new Date(selection.timestamp), timeZone), timestamp: selection.timestamp };
    }
    const clock = selection.mode === 'clock' ? selection.clock : formatLocalClock(now, timeZone);
    if (selection.mode === 'current' && dateInputForInstant(now, timeZone) === selectedDate) {
        return { clock, timestamp: now.getTime() };
    }
    return { clock, timestamp: cloudTimeInstant(selectedDate, clock, timeZone) };
};

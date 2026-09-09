import { cloudGalacticCenterPosition, type CloudDirectionBody } from './cloudGeometry';
import { addDaysToDateInput, dateInputToUtcMidnight, type Coordinates, type SolarEvent } from './solar';

export type CloudTimelineEventType = SolarEvent | 'milkywayrise' | 'milkywayset';
export type CloudTimelineEvent = { type: CloudTimelineEventType; timestamp: number };

/** A rise/set shortcut selects its body as well as its event time. */
export const cloudEventBody = (event: CloudTimelineEventType): CloudDirectionBody =>
    event.startsWith('milkyway') ? 'milkyway' : event.startsWith('moon') ? 'moon' : 'sun';

/** Scan the observer's local civil day, then refine each apparent-horizon crossing.
 * Only date/location changes call this function; moving the time slider does not.
 * Sun/Moon events remain owned by the main astronomical planner.
 */
export const galacticCenterEvents = (date: string, timeZone: string, location: Coordinates): CloudTimelineEvent[] => {
    const start = dateInputToUtcMidnight(date, timeZone).getTime();
    const end = dateInputToUtcMidnight(addDaysToDateInput(date, 1), timeZone).getTime();
    const altitude = (time: number) => cloudGalacticCenterPosition(time, location).altitude;
    const events: CloudTimelineEvent[] = [];
    let left = start;
    let previous = altitude(left);
    for (let right = Math.min(start + 60_000, end); left < end; right = Math.min(right + 60_000, end)) {
        const next = altitude(right);
        if ((previous < 0 && next >= 0) || (previous >= 0 && next < 0)) {
            const rising = next >= 0;
            let lo = left;
            let hi = right;
            while (hi - lo > 1) {
                const middle = Math.floor((lo + hi) / 2);
                if ((altitude(middle) >= 0) === rising) {hi = middle;} else {lo = middle;}
            }
            // Pick the visible side of the boundary, so the event's own sightline is usable.
            const timestamp = rising ? hi : lo;
            if (timestamp < end) {events.push({ type: rising ? 'milkywayrise' : 'milkywayset', timestamp });}
        }
        left = right;
        previous = next;
    }
    return events;
};

export const cloudTimelineLabel = (type: CloudTimelineEventType, zh: boolean): string => ({
    sunrise: zh ? '日出' : 'Sunrise', sunset: zh ? '日落' : 'Sunset',
    moonrise: zh ? '月升' : 'Moonrise', moonset: zh ? '月落' : 'Moonset',
    milkywayrise: zh ? '银心升' : 'GC rise', milkywayset: zh ? '银心落' : 'GC set',
})[type];

export const cloudClockMinute = (clock: string): number => {
    const [hour, minute] = clock.split(':').map(Number);
    return Number.isFinite(hour + minute) ? hour * 60 + minute : 0;
};
export const cloudMinuteClock = (minute: number): string =>
    `${Math.floor(minute / 60).toString().padStart(2, '0')}:${(minute % 60).toString().padStart(2, '0')}`;

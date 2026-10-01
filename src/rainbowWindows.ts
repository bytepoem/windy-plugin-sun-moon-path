import { cloudBodyPosition } from './cloudGeometry';
import { PRIMARY_RAINBOW_RADIUS, SECONDARY_RAINBOW_RADIUS } from './rainbowGeometry';
import { addDaysToDateInput, dateInputToUtcMidnight, type Coordinates } from './solar';

const MINUTE_MS = 60_000;

/** Daily geometric windows, sampled at minute resolution using the same apparent
 * source altitude as the map. Each minute is classified at its midpoint so the
 * displayed boundaries remain minute-aligned. This is not a weather forecast.
 * Civil midnights bound the scan, including 23/25-hour daylight-saving dates.
 */
export const rainbowWindows = (date: string, timeZone: string, location: Coordinates, body: 'sun' | 'moon') => {
    const start = dateInputToUtcMidnight(date, timeZone).getTime();
    const end = dateInputToUtcMidnight(addDaysToDateInput(date, 1), timeZone).getTime();
    const primary: { start: number; end: number }[] = [];
    const secondary: { start: number; end: number }[] = [];
    for (let time = start; time < end; time += MINUTE_MS) {
        const next = Math.min(time + MINUTE_MS, end);
        const altitude = cloudBodyPosition(body, (time + next) / 2, location).altitude;
        for (const [radius, windows] of [[PRIMARY_RAINBOW_RADIUS, primary], [SECONDARY_RAINBOW_RADIUS, secondary]] as const) {
            if (!Number.isFinite(altitude) || altitude < 0 || altitude >= radius) { continue; }
            const previous = windows.at(-1);
            if (previous?.end === time) {
                previous.end = next;
            } else {
                windows.push({ start: time, end: next });
            }
        }
    }
    return { primary, secondary, dayEnd: end };
};

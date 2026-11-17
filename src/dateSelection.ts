/** Date selection policy uses the browser's current year, independently of the
 * observing site's time zone. Callers pass the same minimum to DOM and logic.
 */
export const minimumSelectableDate = (now = new Date()): string => `${now.getFullYear() - 1}-01-01`;

/** Reserve neighbouring days used by the astronomy calculator. A range must
 * remain editable when switching between its seven-day and thirty-day views.
 */
export const maximumSelectableDate = (dayCount = 1): string => {
    const date = new Date('9999-12-31T12:00:00Z');
    const astronomyScanMarginDays = 2;
    // Multi-day night buckets also calculate the following civil day's timeline.
    const adjacentTimelineDays = dayCount > 1 ? 1 : 0;
    date.setUTCDate(date.getUTCDate() - dayCount - astronomyScanMarginDays - adjacentTimelineDays);
    return date.toISOString().slice(0, 10);
};

/** Parse the calculator's four-digit Gregorian dates without normalizing an
 * invalid calendar day. Year 0100 is the calculator's existing lower bound.
 */
export const parseCalendarDate = (value: string): [number, number, number] | null => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) { return null; }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    return year >= 100 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
        ? [year, month, day] : null;
};

/** Validate committed UI dates before changing state or starting requests. */
export const isSelectableDate = (
    value: string, minimumDate = minimumSelectableDate(), maximumDate = maximumSelectableDate(),
): boolean => parseCalendarDate(value) !== null && value >= minimumDate && value <= maximumDate;

/** Resolve one local civil minute. Gaps are invalid; callers explicitly choose
 * the first repeated instant or reject ambiguity. Numeric parts avoid ISO
 * reparsing of three/five-digit Intl years, including neighbouring offset probes.
 */
export const resolveCivilMinute = (
    value: string, timeZone: string, ambiguity: 'earlier' | 'reject',
): number | null => {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) { return null; }
    const date = parseCalendarDate(value.slice(0, 10));
    const hour = Number(value.slice(11, 13));
    const minute = Number(value.slice(14, 16));
    if (!date || hour > 23 || minute > 59) { return null; }
    const [year, month, day] = date;
    const naive = Date.UTC(year, month - 1, day, hour, minute);
    try {
        const formatter = new Intl.DateTimeFormat('en-GB', {
            timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
        });
        const localTimestamp = (instant: number): number => {
            const parts = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, Number(part.value)]));
            // setUTCFullYear avoids Date.UTC's special 1900 offset for years 0–99
            // when a probe around 0100 enters the preceding year.
            const local = new Date(0);
            local.setUTCFullYear(parts.year, parts.month - 1, parts.day);
            local.setUTCHours(parts.hour, parts.minute, parts.second, 0);
            return local.getTime();
        };
        const offsets = new Set([-48, -24, 0, 24, 48].map(hours => {
            const probe = naive + hours * 3_600_000;
            return localTimestamp(probe) - probe;
        }));
        const candidates = [...offsets].map(offset => naive - offset)
            .filter(instant => localTimestamp(instant) === naive).sort((left, right) => left - right);
        return candidates.length === 1 || (ambiguity === 'earlier' && candidates.length > 1) ? candidates[0] : null;
    } catch {
        // Invalid time zones and unresolvable civil values are not UTC instants.
        return null;
    }
};

/** Display a validated civil date without letting the UI language reorder it.
 * Full dates retain their ISO year; compact dates always use month/day.
 */
export const formatDisplayDate = (dateInput: string, includeYear = false): string => {
    if (includeYear) { return dateInput; }
    const [, month, day] = dateInput.split('-').map(Number);
    return `${month}/${day}`;
};

/** Read the instant in its existing time zone, then format a Gregorian date and
 * 24-hour clock. Omitting timeZone retains the browser-local radar convention.
 */
export const formatDisplayDateTime = (instant: Date | number, timeZone?: string, includeYear = false): string => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(instant);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    const date = `${values.year.padStart(4, '0')}-${values.month}-${values.day}`;
    return `${formatDisplayDate(date, includeYear)} ${values.hour}:${values.minute}`;
};

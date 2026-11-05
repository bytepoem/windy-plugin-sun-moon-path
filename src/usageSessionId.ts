/** UUIDv7 embeds the session start time, as required by PostHog session aggregation. */
export const createUsageSessionId = (now = Date.now()): string => {
    const timestamp = Math.floor(now).toString(16).padStart(12, '0');
    const random = crypto.randomUUID();
    // Replace the first 48 bits with time and the version nibble with 7;
    // retain the UUIDv4 generator's 74 random bits and RFC variant bits.
    return `${timestamp.slice(0, 8)}-${timestamp.slice(8)}-7${random.slice(15)}`;
};

/** PostHog excludes events more than 24 hours after the UUIDv7 timestamp. */
export const usageSessionExpired = (id: string, now = Date.now()): boolean => {
    const started = Number.parseInt(id.slice(0, 8) + id.slice(9, 13), 16);
    return now < started || now - started >= 24 * 60 * 60 * 1000;
};

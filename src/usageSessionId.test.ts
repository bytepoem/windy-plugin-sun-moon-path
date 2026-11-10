import { describe, expect, it } from 'vitest';
import { createUsageSessionId, usageSessionExpired } from './usageSessionId';

describe('PostHog session identity', () => {
    it('encodes the start timestamp as UUIDv7 and uses independent random suffixes', () => {
        const now = 1_800_000_000_123;
        const first = createUsageSessionId(now);
        expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        expect(Number.parseInt(first.slice(0, 8) + first.slice(9, 13), 16)).toBe(now);
        expect(createUsageSessionId(now)).not.toBe(first);
        expect(usageSessionExpired(first, now)).toBe(false);
        expect(usageSessionExpired(first, now + 86_399_999)).toBe(false);
        expect(usageSessionExpired(first, now + 86_400_000)).toBe(true);
        expect(usageSessionExpired(first, now - 1)).toBe(true);
    });
});

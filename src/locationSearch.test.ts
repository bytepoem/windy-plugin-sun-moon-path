import { describe, expect, it, vi } from 'vitest';

import { loadElevationsWithConcurrency, type ElevationSearchResult } from './locationSearch';

const results = Array.from({ length: 8 }, (_, index): ElevationSearchResult => ({
    id: String(index),
    wgs84: { lat: 23 + index / 100, lon: 113 + index / 100 },
}));

describe('location search elevation loading', () => {
    it('limits the number of simultaneous elevation requests', async () => {
        let activeRequests = 0;
        let peakRequests = 0;
        const received: string[] = [];

        await loadElevationsWithConcurrency({
            results,
            concurrency: 3,
            isCurrent: () => true,
            loadElevation: async result => {
                activeRequests += 1;
                peakRequests = Math.max(peakRequests, activeRequests);
                await new Promise(resolve => setTimeout(resolve, 0));
                activeRequests -= 1;
                return Number(result.id) * 100;
            },
            onResult: id => received.push(id),
        });

        expect(peakRequests).toBe(3);
        expect(received).toHaveLength(results.length);
    });

    it('stops scheduling and ignores in-flight results after the search becomes stale', async () => {
        let current = true;
        let releaseRequests!: () => void;
        const requestGate = new Promise<void>(resolve => {
            releaseRequests = resolve;
        });
        const loadElevation = vi.fn(async () => {
            await requestGate;
            return 500;
        });
        const onResult = vi.fn();

        const loading = loadElevationsWithConcurrency({
            results,
            concurrency: 3,
            isCurrent: () => current,
            loadElevation,
            onResult,
        });
        await Promise.resolve();
        expect(loadElevation).toHaveBeenCalledTimes(3);

        current = false;
        releaseRequests();
        await loading;

        expect(loadElevation).toHaveBeenCalledTimes(3);
        expect(onResult).not.toHaveBeenCalled();
    });
});

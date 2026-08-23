import { describe, expect, it } from 'vitest';

import {
    gpsCoordinatesFromLocation,
    isMapCenteredOnLocation,
    shouldRefreshSameLocationImmediately,
} from './location';

describe('location selection', () => {
    it('accepts only real GPS coordinates for current-location rendering', () => {
        expect(gpsCoordinatesFromLocation({ lat: 23.1291, lon: 113.2644, source: 'gps' })).toEqual({
            lat: 23.1291,
            lon: 113.2644,
        });
        expect(gpsCoordinatesFromLocation({ lat: 22.3193, lon: 114.1694, source: 'ip' })).toBeNull();
        expect(gpsCoordinatesFromLocation({ lat: 23.1291, lon: 113.2644, source: 'last' })).toBeNull();
        expect(gpsCoordinatesFromLocation({ lat: 23.05, lon: 113.37, source: 'fallback' })).toBeNull();
    });

    it('recognizes when the Windy map has returned to the GPS position', () => {
        const gps = { lat: 23.1291, lon: 113.2644 };

        expect(isMapCenteredOnLocation({ lat: 23.1292, lon: 113.2645 }, gps)).toBe(true);
        expect(isMapCenteredOnLocation({ lat: 22.3193, lon: 114.1694 }, gps)).toBe(false);
    });

    it('refreshes immediately when a mounted plugin selects the same location context again', () => {
        expect(shouldRefreshSameLocationImmediately(true, '2026-08-23|24.919|112.659', '2026-08-23|24.919|112.659')).toBe(true);
        expect(shouldRefreshSameLocationImmediately(true, 'old-location', 'new-location')).toBe(false);
        expect(shouldRefreshSameLocationImmediately(false, 'same-location', 'same-location')).toBe(false);
    });
});

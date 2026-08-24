import { describe, expect, it } from 'vitest';

import {
    detailedLocationLabel,
    gpsCoordinatesFromLocation,
    isHomeButtonTarget,
    isMapCenteredOnLocation,
    scheduleReopenAfterHome,
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

    it('reopens the plugin only after Windy finishes closing panes for Home', () => {
        const actions: string[] = [];
        const scheduledReopens: (() => void)[] = [];

        scheduleReopenAfterHome(
            () => actions.push('reopen-plugin'),
            callback => {
                scheduledReopens.push(callback);
            },
        );
        actions.push('host-close-plugins');

        expect(actions).toEqual(['host-close-plugins']);
        expect(scheduledReopens).toHaveLength(1);

        scheduledReopens[0]?.();

        expect(actions).toEqual(['host-close-plugins', 'reopen-plugin']);
    });

    it('combines the detailed reverse-geocoded name with its region', () => {
        expect(detailedLocationLabel({
            name: '北亭村, 小谷围街道',
            region: '广州市',
        })).toBe('北亭村, 小谷围街道 · 广州市');
        expect(detailedLocationLabel({
            name: '广州市',
            region: '广州市',
        })).toBe('广州市');
        expect(detailedLocationLabel({
            name: '',
            region: '',
        })).toBe('');
    });

    it('recognizes clicks originating from Windy Home and its child elements', () => {
        const desktopHomeChild = {
            closest: (selector: string) => selector === '[data-ref="back2home"]' ? { dataset: { ref: 'back2home' } } : null,
        };
        const mobileHomeChild = {
            closest: (selector: string) => selector === '.mobile-ui__icon[data-ignore="hp"][data-icon="]"]'
                ? { className: 'mobile-ui__icon' }
                : null,
        };
        const otherTarget = {
            closest: () => null,
        };

        expect(isHomeButtonTarget(desktopHomeChild)).toBe(true);
        expect(isHomeButtonTarget(mobileHomeChild)).toBe(true);
        expect(isHomeButtonTarget(otherTarget)).toBe(false);
        expect(isHomeButtonTarget(null)).toBe(false);
    });
});

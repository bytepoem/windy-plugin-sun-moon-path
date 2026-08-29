import { describe, expect, it } from 'vitest';

import {
    DEFAULT_INITIAL_OVERLAY,
    INITIAL_OVERLAY_PRIORITY,
    KEEP_CURRENT_OVERLAY,
    normalizeInitialOverlayPreference,
    orderInitialOverlayOptions,
} from './initialOverlay';

const availableOverlays = ['wind', 'satellite', 'clouds'] as const;

describe('initial overlay preference', () => {
    it('places astronomy overlays first and preserves the remaining source order', () => {
        const source = [
            { value: 'wind', label: 'Wind' },
            { value: 'fog', label: 'Fog' },
            { value: 'rain', label: 'Rain' },
            { value: 'satellite', label: 'Satellite' },
            { value: 'clouds', label: 'Clouds' },
            { value: 'radar', label: 'Radar' },
            { value: 'visibility', label: 'Visibility' },
            { value: 'temp', label: 'Temperature' },
            { value: 'hclouds', label: 'High clouds' },
            { value: 'mclouds', label: 'Medium clouds' },
            { value: 'lclouds', label: 'Low clouds' },
            { value: 'gust', label: 'Gusts' },
        ] as const;

        expect(orderInitialOverlayOptions(source).map(option => option.value)).toEqual([
            ...INITIAL_OVERLAY_PRIORITY,
            'fog',
            'gust',
        ]);
        expect(source.map(option => option.value)).toEqual([
            'wind',
            'fog',
            'rain',
            'satellite',
            'clouds',
            'radar',
            'visibility',
            'temp',
            'hclouds',
            'mclouds',
            'lclouds',
            'gust',
        ]);
    });

    it('defaults to the satellite overlay', () => {
        expect(normalizeInitialOverlayPreference(null, availableOverlays)).toBe(
            DEFAULT_INITIAL_OVERLAY,
        );
    });

    it('preserves the explicit keep-current choice', () => {
        expect(normalizeInitialOverlayPreference(KEEP_CURRENT_OVERLAY, availableOverlays)).toBe(
            KEEP_CURRENT_OVERLAY,
        );
    });

    it('accepts an overlay exposed by the current Windy runtime', () => {
        expect(normalizeInitialOverlayPreference('clouds', availableOverlays)).toBe('clouds');
    });

    it('rejects a persisted value that is no longer available', () => {
        expect(normalizeInitialOverlayPreference('unknown-overlay', availableOverlays)).toBe(
            DEFAULT_INITIAL_OVERLAY,
        );
    });
});

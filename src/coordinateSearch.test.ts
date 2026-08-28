import { describe, expect, it } from 'vitest';

import {
    coordinateLocationSelection,
    coordinateToWgs84,
    parseCoordinateFields,
} from './coordinateSearch';

describe('coordinate search', () => {
    it.each([
        ['23.1291', '113.2644', { lat: 23.1291, lon: 113.2644 }],
        ['-33.8688', '151.2093', { lat: -33.8688, lon: 151.2093 }],
        ['90', '180', { lat: 90, lon: 180 }],
        ['-90', '-180', { lat: -90, lon: -180 }],
    ])('parses latitude %s and longitude %s', (latitude, longitude, location) => {
        expect(parseCoordinateFields(latitude, longitude)).toEqual({ kind: 'valid', location });
    });

    it('keeps empty coordinate fields idle until the user enters a value', () => {
        expect(parseCoordinateFields('', '')).toEqual({ kind: 'empty' });
    });

    it('reports incomplete and out-of-range coordinate input precisely', () => {
        expect(parseCoordinateFields('23.1', '')).toEqual({ kind: 'invalid', reason: 'format' });
        expect(parseCoordinateFields('north', '113')).toEqual({ kind: 'invalid', reason: 'latitude' });
        expect(parseCoordinateFields('0x10', '113')).toEqual({ kind: 'invalid', reason: 'latitude' });
        expect(parseCoordinateFields('23', '1e2')).toEqual({ kind: 'invalid', reason: 'longitude' });
        expect(parseCoordinateFields('91', '113')).toEqual({ kind: 'invalid', reason: 'latitude' });
        expect(parseCoordinateFields('23', '181')).toEqual({ kind: 'invalid', reason: 'longitude' });
    });

    it('preserves WGS84 and converts mainland GCJ-02 coordinates', () => {
        const wgs84 = { lat: 39.90735, lon: 116.39125 };
        const gcj02 = { lat: 39.908753, lon: 116.397491 };

        expect(coordinateToWgs84(wgs84, 'wgs84')).toEqual(wgs84);
        expect(coordinateToWgs84(gcj02, 'gcj02').lat).toBeCloseTo(wgs84.lat, 4);
        expect(coordinateToWgs84(gcj02, 'gcj02').lon).toBeCloseTo(wgs84.lon, 4);
    });

    it('builds a name-less WGS84 selection so the host resolves the place label', () => {
        const selection = coordinateLocationSelection({
            source: { lat: 23.1291, lon: 113.2644 },
            system: 'wgs84',
            origin: { lat: 23, lon: 113 },
        });

        expect(selection.name).toBe('');
        expect(selection.wgs84).toEqual({ lat: 23.1291, lon: 113.2644 });
        expect(selection.distanceKm).toBeGreaterThan(0);
        expect(selection.elevationM).toBeUndefined();
    });
});

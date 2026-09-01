import { describe, expect, it, vi } from 'vitest';

vi.mock('@windy/metrics', () => ({
    default: {
        wind: {
            metric: 'm/s',
            convertNumber: (value: number, precision: number | undefined, unit: string) => {
                if (unit === 'bft') {
                    return value < 5.5 ? 3 : 5;
                }
                const factors: Record<string, number> = { 'm/s': 1, 'km/h': 3.6, kt: 1.94384, mph: 2.23694 };
                const multiplier = 10 ** (precision ?? 0);
                return Math.round(value * factors[unit] * multiplier) / multiplier;
            },
        },
        temp: {
            metric: '°C',
            convertNumber: (value: number, _precision: number | undefined, unit: string) =>
                Math.round(unit === '°F' ? (value - 273.15) * 9 / 5 + 32 : value - 273.15),
        },
        rain: {
            metric: 'mm',
            convertNumber: (value: number, precision: number, unit: string) => {
                const converted = unit === 'in' ? value / 25.4 : value;
                const multiplier = 10 ** precision;
                return Math.round(converted * multiplier) / multiplier;
            },
        },
        distance: {
            metric: 'km',
            convertNumber: (value: number, precision: number, unit: string) => {
                const factors: Record<string, number> = { km: 1 / 1_000, mi: 1 / 1_609.344, NM: 1 / 1_852 };
                const multiplier = 10 ** precision;
                return Math.round(value * factors[unit] * multiplier) / multiplier;
            },
        },
        elevation: {
            metric: 'm',
            convertNumber: (value: number, _precision: number, unit: string) =>
                Math.round(unit === 'ft' ? value * 3.28084 : value),
        },
    },
}));

import {
    currentUnitPreferences,
    formatDistanceKm,
    formatDistanceRangeKm,
    formatElevationM,
    formatPrecipitationMm,
    formatPrecipitationRangeMm,
    formatTemperatureC,
    formatTemperatureRangeC,
    formatVisibilityKm,
    formatVisibilityRangeKm,
    formatWindSpeed,
    formatWindSpeedRange,
    formatWindThreshold,
    resolveUnitPreferencesChange,
    windDisplayUnit,
    windThresholdUnit,
    type UnitPreferences,
} from './unitPreferences';

const metricUnits: UnitPreferences = {
    wind: 'm/s',
    temperature: '°C',
    precipitation: 'mm',
    distance: 'km',
    elevation: 'm',
};

describe('Windy unit preferences', () => {
    it('reads the current host units', () => {
        expect(currentUnitPreferences()).toEqual(metricUnits);
    });

    it('applies only supported metric events', () => {
        const readCurrent = vi.fn(() => ({ ...metricUnits, temperature: '°F' as const }));
        expect(resolveUnitPreferencesChange(metricUnits, 'temp', '°F', readCurrent).temperature).toBe('°F');
        expect(resolveUnitPreferencesChange(metricUnits, 'rain', 'in', readCurrent).precipitation).toBe('in');
        expect(resolveUnitPreferencesChange(metricUnits, 'distance', 'mi', readCurrent).distance).toBe('mi');
        expect(resolveUnitPreferencesChange(metricUnits, 'elevation', 'ft', readCurrent).elevation).toBe('ft');
        expect(resolveUnitPreferencesChange(metricUnits, 'snow', 'in', readCurrent)).toBe(metricUnits);
        expect(resolveUnitPreferencesChange(metricUnits, 'temp', undefined, readCurrent).temperature).toBe('°F');
        expect(resolveUnitPreferencesChange(metricUnits, undefined, undefined, readCurrent).temperature).toBe('°F');
        expect(readCurrent).toHaveBeenCalledTimes(2);
    });

    it('formats continuous unit families from their canonical values', () => {
        expect(formatTemperatureC(20, '°F')).toBe('68');
        expect(formatTemperatureRangeC({ minimum: 18, maximum: 20 }, '°F')).toBe('64–68 °F');
        expect(formatPrecipitationMm(25.4, 'in')).toBe('1');
        expect(formatPrecipitationRangeMm({ minimum: 1, maximum: 2.5 }, 'in')).toBe('0.039–0.098 in');
        expect(formatDistanceKm(1, 'mi')).toBe('0.62');
        expect(formatDistanceRangeKm({ minimum: 0.8, maximum: 12 }, 'mi')).toBe('0.5–7.5 mi');
        expect(formatVisibilityKm(9.9, 'mi')).toBe('6.15');
        expect(formatVisibilityKm(10, 'mi')).toBe('6.21');
        expect(formatVisibilityRangeKm({ minimum: 0.8, maximum: 12 }, 'mi')).toBe('0.5–7.46 mi');
        expect(formatElevationM(100, 'ft')).toBe('328');
    });

    it('keeps canonical m/s visible beside categorical Beaufort values', () => {
        expect(windDisplayUnit('bft')).toBe('bft/m/s');
        expect(windThresholdUnit('bft')).toBe('m/s');
        expect(formatWindSpeed(4.5, 'bft')).toBe('3/4.5');
        expect(formatWindThreshold(4.5, 'bft')).toBe('4.5');
        expect(formatWindSpeedRange({ minimum: 4.5, maximum: 4.6 }, 'bft'))
            .toBe('3 bft / 4.5–4.6 m/s');
    });
});

import { describe, expect, it } from 'vitest';

import { resolveObservationEvidenceState } from './observationEvidence';

import type { ObservationWindowEvidence } from './observationPlanner';

const completeEvidence = (overrides: Partial<ObservationWindowEvidence> = {}): ObservationWindowEvidence => ({
    weatherSampleCount: 2,
    weatherCoverage: 'full',
    dominantWeatherIconCode: 3,
    totalCloudPercent: { minimum: 10, maximum: 30 },
    highCloudPercent: { minimum: 5, maximum: 15 },
    mediumCloudPercent: { minimum: 4, maximum: 12 },
    lowCloudPercent: { minimum: 3, maximum: 10 },
    temperatureC: { minimum: 18, maximum: 20 },
    dewPointC: { minimum: 14, maximum: 15 },
    precipitationMm: { minimum: 0, maximum: 0 },
    windKmh: { minimum: 7, maximum: 12 },
    humidityPercent: { minimum: 63, maximum: 78 },
    visibilityKm: { minimum: 8, maximum: 12 },
    aod550: null,
    moonIlluminationFraction: null,
    sqm: null,
    estimatedBortle: null,
    ...overrides,
});

describe('observation evidence presentation state', () => {
    it('waits for both weather data sources', () => {
        expect(resolveObservationEvidenceState({
            weatherStatus: 'ready',
            atmosphereStatus: 'loading',
            dateCoverage: 'covered',
            evidence: completeEvidence(),
        })).toBe('loading');
    });

    it('does not present failed atmosphere data as complete evidence', () => {
        expect(resolveObservationEvidenceState({
            weatherStatus: 'ready',
            atmosphereStatus: 'error',
            dateCoverage: 'covered',
            evidence: completeEvidence({ visibilityKm: null }),
        })).toBe('unavailable');
    });

    it('distinguishes dates outside the forecast from missing in-range samples', () => {
        const noCoverage = completeEvidence({ weatherSampleCount: 0, weatherCoverage: 'none' });
        expect(resolveObservationEvidenceState({
            weatherStatus: 'ready',
            atmosphereStatus: 'ready',
            dateCoverage: 'after-range',
            evidence: noCoverage,
        })).toBe('outside-range');
        expect(resolveObservationEvidenceState({
            weatherStatus: 'ready',
            atmosphereStatus: 'ready',
            dateCoverage: 'missing',
            evidence: noCoverage,
        })).toBe('missing');
    });

    it('keeps partial interval coverage distinct from complete evidence', () => {
        expect(resolveObservationEvidenceState({
            weatherStatus: 'ready',
            atmosphereStatus: 'ready',
            dateCoverage: 'covered',
            evidence: completeEvidence({ weatherCoverage: 'partial' }),
        })).toBe('partial');
    });

    it('requires all three displayed metric ranges before returning ready', () => {
        expect(resolveObservationEvidenceState({
            weatherStatus: 'ready',
            atmosphereStatus: 'ready',
            dateCoverage: 'covered',
            evidence: completeEvidence({ totalCloudPercent: null }),
        })).toBe('unavailable');
        expect(resolveObservationEvidenceState({
            weatherStatus: 'ready',
            atmosphereStatus: 'ready',
            dateCoverage: 'covered',
            evidence: completeEvidence(),
        })).toBe('ready');
    });
});

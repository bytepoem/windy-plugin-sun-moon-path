import type { ObservationWindowEvidence } from './observationPlanner';
import type { WeatherDateCoverage, WeatherLoadStatus } from './weather';

export type ObservationEvidenceState =
    | 'loading'
    | 'ready'
    | 'partial'
    | 'outside-range'
    | 'missing'
    | 'unavailable';

/**
 * Resolves whether compact observation evidence can be presented as complete.
 * Data-source failures, incomplete interval coverage, and missing core metrics
 * remain distinct so the UI never presents partial evidence as authoritative.
 */
export const resolveObservationEvidenceState = ({
    weatherStatus,
    atmosphereStatus,
    dateCoverage,
    evidence,
}: {
    weatherStatus: WeatherLoadStatus;
    atmosphereStatus: WeatherLoadStatus;
    dateCoverage: WeatherDateCoverage;
    evidence: ObservationWindowEvidence;
}): ObservationEvidenceState => {
    if (weatherStatus === 'idle' || weatherStatus === 'loading'
        || atmosphereStatus === 'idle' || atmosphereStatus === 'loading') {
        return 'loading';
    }
    if (weatherStatus === 'error' || weatherStatus === 'empty'
        || atmosphereStatus === 'error' || atmosphereStatus === 'empty') {
        return 'unavailable';
    }
    if ((dateCoverage === 'before-range' || dateCoverage === 'after-range')
        && evidence.weatherCoverage === 'none') {
        return 'outside-range';
    }
    if (evidence.weatherCoverage === 'none') {
        return 'missing';
    }
    if (evidence.weatherCoverage === 'partial') {
        return 'partial';
    }
    if (!evidence.totalCloudPercent || !evidence.precipitationMm || !evidence.visibilityKm) {
        return 'unavailable';
    }
    return 'ready';
};

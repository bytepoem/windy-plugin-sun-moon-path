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
    visibilityStatus,
    dateCoverage,
    evidence,
}: {
    weatherStatus: WeatherLoadStatus;
    visibilityStatus: WeatherLoadStatus;
    dateCoverage: WeatherDateCoverage;
    evidence: ObservationWindowEvidence;
}): ObservationEvidenceState => {
    if (weatherStatus === 'idle' || weatherStatus === 'loading'
        || visibilityStatus === 'idle' || visibilityStatus === 'loading') {
        return 'loading';
    }
    if (weatherStatus === 'error' || weatherStatus === 'empty'
        || visibilityStatus === 'error' || visibilityStatus === 'empty') {
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

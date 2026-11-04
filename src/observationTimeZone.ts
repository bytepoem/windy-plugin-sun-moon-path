import { RequestFailure, withRequestDiagnostics } from './requestDiagnostics';

export type ObservationPlannerErrorCode = 'TIME_ZONE_UNAVAILABLE' | 'TIME_ZONE_INVALID';

export type TimeZoneDiagnosticDetails = {
    step: 'timezone_validation';
    reason: 'empty' | 'unexpected_type' | 'nautical_label' | 'intl_rejected';
    inputType: 'string' | 'null' | 'undefined' | 'other';
    hasNauticalPrefix: boolean;
    rawIntlSupported: boolean;
    normalizedIntlSupported: boolean;
};

export class ObservationPlannerError extends Error {
    constructor(readonly code: ObservationPlannerErrorCode, readonly details?: TimeZoneDiagnosticDetails, options?: ErrorOptions) {
        super(code, options);
        this.name = 'ObservationPlannerError';
    }
}

/** Keep host request failures separate from extracting the returned zone label. */
export const loadObservationTimeZone = async (load: () => Promise<{ data: { TZname: string } }>): Promise<string> => {
    const response = await withRequestDiagnostics('windy-timezone', 'request', undefined, load);
    return withRequestDiagnostics('windy-timezone', 'parse', undefined, async () => response.data.TZname);
};

/** Preserve the domain failure code and a local cause; diagnostics only copy validated categories. */
export const unavailableObservationTimeZone = (cause: unknown): ObservationPlannerError =>
    new ObservationPlannerError('TIME_ZONE_UNAVAILABLE', undefined, {
        cause: cause instanceof RequestFailure ? cause : new RequestFailure(cause, 'windy-timezone', 'request'),
    });

const intlSupports = (value: string): boolean => {
    try {
        new Intl.DateTimeFormat(undefined, { timeZone: value }).format();
        return true;
    } catch {
        return false;
    }
};

/** Resolve Windy's zone label; retain only classified input features on failure. */
export const resolveObservationTimeZone = (candidate: unknown): string => {
    const inputType = candidate === null ? 'null' : candidate === undefined ? 'undefined'
        : typeof candidate === 'string' ? 'string' : 'other';
    const value = typeof candidate === 'string' ? candidate : '';
    const hasNauticalPrefix = value.startsWith('Nautical:');
    // Preserve Etc/GMT's reversed sign and land zones' DST rules; never guess an offset.
    const normalized = /^Nautical: (Etc\/GMT(?:[+-]\d{1,2})?)$/.exec(value)?.[1] ?? value;
    const rawIntlSupported = value !== '' && intlSupports(value);
    const normalizedIntlSupported = normalized === value ? rawIntlSupported : intlSupports(normalized);
    if (normalizedIntlSupported) { return normalized; }
    throw new ObservationPlannerError('TIME_ZONE_INVALID', {
        step: 'timezone_validation',
        reason: inputType !== 'string' ? 'unexpected_type' : !value ? 'empty'
            : hasNauticalPrefix ? 'nautical_label' : 'intl_rejected',
        inputType, hasNauticalPrefix, rawIntlSupported, normalizedIntlSupported,
    });
};

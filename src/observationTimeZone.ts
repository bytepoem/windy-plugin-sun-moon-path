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
    constructor(readonly code: ObservationPlannerErrorCode, readonly details?: TimeZoneDiagnosticDetails) {
        super(code);
        this.name = 'ObservationPlannerError';
    }
}

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

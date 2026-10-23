import { describe, expect, it } from 'vitest';
import { resolveObservationTimeZone } from './observationTimeZone';
import { sanitizeDiagnosticError } from './pluginDiagnostics';

describe('time zone boundary diagnostics', () => {
    it.each([
        ['', 'empty', 'string', false],
        [null, 'unexpected_type', 'null', false],
        [undefined, 'unexpected_type', 'undefined', false],
        [{ private: 'secret' }, 'unexpected_type', 'other', false],
        ['Nautical: secret', 'nautical_label', 'string', true],
        ['secret', 'intl_rejected', 'string', false],
    ])('classifies invalid input without copying it: %j', (input, reason, inputType, hasNauticalPrefix) => {
        let failure: unknown;
        try { resolveObservationTimeZone(input); } catch (error) { failure = error; }
        const safe = sanitizeDiagnosticError(failure);
        expect(safe).toMatchObject({
            code: 'TIME_ZONE_INVALID',
            details: {
                step: 'timezone_validation', reason, inputType, hasNauticalPrefix,
                rawIntlSupported: false, normalizedIntlSupported: false,
            },
        });
        expect(JSON.stringify(safe)).not.toMatch(/secret|private/);
    });

    it.each(['Asia/Shanghai', 'America/New_York', 'Asia/Kathmandu'])('preserves land zone %s', zone => {
        expect(resolveObservationTimeZone(zone)).toBe(zone);
    });
});

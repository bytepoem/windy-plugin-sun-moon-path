import { describe, expect, it } from 'vitest';
import { loadObservationTimeZone, resolveObservationTimeZone, unavailableObservationTimeZone } from './observationTimeZone';
import { sanitizeDiagnosticError } from './pluginDiagnostics';

describe('time zone boundary diagnostics', () => {
    it.each([
        [new TypeError('Failed to fetch https://private.example?location=secret'), 'network'],
        [new DOMException('secret URL', 'TimeoutError'), 'timeout'],
        [new Error('secret response'), 'unknown'],
    ] as const)('preserves classified request failures behind the domain error: %s', async (cause, kind) => {
        let failure: unknown;
        try {
            await loadObservationTimeZone(async () => { throw cause; });
        } catch (error) {
            failure = unavailableObservationTimeZone(error);
        }
        expect(sanitizeDiagnosticError(failure)).toMatchObject({
            code: 'TIME_ZONE_UNAVAILABLE',
            request: { request: 'windy-timezone', phase: 'request', kind },
        });
        expect(JSON.stringify(sanitizeDiagnosticError(failure))).not.toMatch(/secret|private|https:/);
    });

    it('separates malformed response access from a valid response containing an invalid zone', async () => {
        let failure: unknown;
        try {
            await loadObservationTimeZone(async () => ({ data: null } as any));
        } catch (error) {
            failure = unavailableObservationTimeZone(error);
        }
        expect(sanitizeDiagnosticError(failure)).toMatchObject({
            code: 'TIME_ZONE_UNAVAILABLE',
            request: { request: 'windy-timezone', phase: 'parse', kind: 'parse' },
        });
        const zone = await loadObservationTimeZone(async () => ({ data: { TZname: 'private-zone' } }));
        expect(() => resolveObservationTimeZone(zone)).toThrow('TIME_ZONE_INVALID');
    });

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

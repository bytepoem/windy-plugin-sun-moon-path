import { describe, expect, it, vi } from 'vitest';
import { RequestFailure, withRequestDiagnostics } from './requestDiagnostics';
import { createPluginDiagnostics, sanitizeDiagnosticError } from './pluginDiagnostics';

describe('request failure ownership and privacy', () => {
    it('checks cancellation before and after providers that ignore abort', async () => {
        const controller = new AbortController();
        const operation = vi.fn(async () => {
            controller.abort();
            return 'stale';
        });
        await expect(withRequestDiagnostics('windy-weather', 'request', controller.signal, operation))
            .rejects.toMatchObject({ name: 'AbortError', requestDetails: { kind: 'cancelled' } });
        await expect(withRequestDiagnostics('windy-weather', 'request', controller.signal, operation))
            .rejects.toMatchObject({ name: 'AbortError' });
        expect(operation).toHaveBeenCalledOnce();
    });

    it.each([
        [new DOMException('secret coordinates', 'AbortError'), 'abort'],
        [new DOMException('secret URL', 'TimeoutError'), 'timeout'],
        [new TypeError('Failed to fetch https://private.example'), 'network'],
        [new SyntaxError('secret response'), 'parse'],
    ] as const)('classifies %s without exposing its text', async (cause, kind) => {
        let failure: unknown;
        try {
            await withRequestDiagnostics('open-meteo-aod', 'parse', undefined, async () => { throw cause; });
        } catch (error) { failure = error; }
        const safe = sanitizeDiagnosticError(failure);
        expect(safe.request).toEqual({ request: 'open-meteo-aod', phase: 'parse', kind });
        expect(JSON.stringify(safe)).not.toMatch(/secret|https:|coordinates/);
    });

    it('preserves HTTP status and separates endpoints and statuses in deduplication', () => {
        const send = vi.fn();
        const diagnostics = createPluginDiagnostics({
            build: { id: 'test', commit: 'test', local: true }, version: 'test', send,
        });
        for (const request of ['open-meteo-aod', 'open-meteo-visibility'] as const) {
            for (const status of [403, 429]) {
                diagnostics.error('atmosphere', new RequestFailure(new Error('private URL'), request, 'request', undefined, status));
            }
        }
        expect(send).toHaveBeenCalledTimes(4);
        expect(send.mock.calls[0][0].properties.error.request).toEqual({
            request: 'open-meteo-aod', phase: 'request', kind: 'http', status: 403,
        });
        expect(JSON.stringify(send.mock.calls)).not.toContain('private');
    });

    it('does not mistake Chromium gzip errors for network failures', async () => {
        await expect(withRequestDiagnostics('light-pollution', 'decompress', undefined, async () => {
            throw new TypeError('Failed to fetch');
        })).rejects.toMatchObject({ requestDetails: { phase: 'decompress', kind: 'decompress' } });
    });

    it('does not serialize private causes or unexpected metadata fields', () => {
        const failure = new RequestFailure(new Error('secret'), 'update-manifest', 'request', undefined, 503);
        Object.assign(failure.requestDetails, { url: 'secret', status: 999 });
        const safe = sanitizeDiagnosticError(failure);
        expect(safe.request).toEqual({ request: 'update-manifest', phase: 'request', kind: 'http' });
        expect(JSON.stringify(safe)).not.toContain('secret');
        Object.assign(failure.requestDetails, { request: 'secret' });
        expect(sanitizeDiagnosticError(failure).request).toBeUndefined();
    });
});

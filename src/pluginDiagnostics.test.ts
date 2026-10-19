import { describe, expect, it, vi } from 'vitest';
import { createPluginDiagnostics, sanitizeDiagnosticError } from './pluginDiagnostics';

const build = { id: 'build-one', commit: 'abc123', local: true };

describe('bounded plugin diagnostics', () => {
    it('preserves exact generated locations without leaking arbitrary text or URL data', () => {
        const error = new RangeError('Unable to resolve local date: 2026-10-13 (private-location) key=secret');
        error.stack = 'RangeError: secret\n at privateFunction (https://windy-plugins.com/1/windy-plugin-sun-moon-path/0.11.4/plugin.min.js:2:345)\n at https://private.example/path?key=secret:2:10';
        const safe = sanitizeDiagnosticError(error);
        expect(safe).toEqual({ name: 'RangeError', message: 'Unable to resolve local date [redacted]', frames: ['plugin.min.js:2:345'] });
        expect(JSON.stringify(safe)).not.toMatch(/secret|private|2026/);
        expect(sanitizeDiagnosticError(new Error('31.123,121.456 APIKEY-EXAMPLE'))).toEqual({
            name: 'Error', message: 'Message omitted to protect private data', frames: [],
        });
        expect(() => sanitizeDiagnosticError(new Proxy(new Error(), { get() { throw new Error(); } }))).not.toThrow();
    });

    it('separates DOM readiness from data state, and never reports normal hidden/empty states as failures', () => {
        const send = vi.fn();
        const diagnostics = createPluginDiagnostics({ build, version: 'test', send });
        diagnostics.mounted();
        diagnostics.dom(false, false);
        expect(diagnostics.state).toBe('mounted');
        diagnostics.context({ astronomy: 'empty', weather: 'loading', mode: 'collapsed' });
        diagnostics.dom(true, true);
        expect(diagnostics.state).toBe('ready');
        expect(send).not.toHaveBeenCalled();
    });

    it('allowlists context and limits repeated errors and breadcrumbs', () => {
        const send = vi.fn();
        const diagnostics = createPluginDiagnostics({ build, version: 'test', send });
        diagnostics.context({ tab: 'clouds', astronomy: 'private-data', location: 'secret' } as any);
        for (let index = 0; index < 200; index++) {
            diagnostics.begin('weather');
            diagnostics.error('weather', new TypeError('Failed to fetch https://private.example'));
        }
        const report = JSON.parse(diagnostics.report());
        expect(report.context).toEqual({ tab: 'clouds' });
        expect(report.entries).toHaveLength(80);
        expect(report.errors).toHaveLength(1);
        expect(send).toHaveBeenCalledOnce();
        expect(JSON.stringify(send.mock.calls)).not.toMatch(/private|secret/);
    });

    it('preserves startup failure and does not emit late work after close', () => {
        const send = vi.fn(() => { throw new Error('transport failure'); });
        const diagnostics = createPluginDiagnostics({ build, version: 'test', send });
        expect(() => diagnostics.error('galactic', new RangeError('Unable to resolve local date'), 1, true)).not.toThrow();
        diagnostics.mounted();
        expect(diagnostics.state).toBe('failed');
        expect(send.mock.calls[0]).toEqual([expect.objectContaining({ event: 'plugin_start_failed' })]);
        diagnostics.close();
        const previous = diagnostics.report();
        diagnostics.end('weather', 2);
        diagnostics.error('weather', new Error());
        expect(diagnostics.report()).toBe(previous);
    });

    it('uses new instance and operation identities when continuing a logical opening', () => {
        const first = createPluginDiagnostics({ build, version: 'test' });
        const second = createPluginDiagnostics({ build, version: 'test', sessionId: first.sessionId });
        expect(first.sessionId).toBe(second.sessionId);
        expect(first.instanceId).not.toBe(second.instanceId);
        expect(first.begin('astronomy')).not.toBe(first.begin('astronomy'));
    });
});

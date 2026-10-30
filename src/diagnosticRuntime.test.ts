import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    consent: true, local: false, sequence: 0,
    listeners: new Map<number, () => void>(),
    transports: [] as { sendDiagnostic: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn>; pending: number; idle: () => void }[],
}));
vi.mock('@windy/store', () => ({ default: {
    get: () => ({ analytics: state.consent }),
    on: (_event: string, listener: () => void) => {
        state.listeners.set(++state.sequence, listener);
        return state.sequence;
    },
    off: (id: number) => state.listeners.delete(id),
} }));
vi.mock('virtual:diagnostic-build', () => ({ default: { id: 'test', commit: 'test', get local() { return state.local; } } }));
vi.mock('./posthogUsageConfig', () => ({ postHogUsageConfig: {} }));
vi.mock('./posthogUsageTransport', () => ({ createPostHogUsageTransport: (
    _allowed: unknown, _id: unknown, _config: unknown, _fetch: unknown, idle: () => void,
) => {
    const transport = { sendDiagnostic: vi.fn(), destroy: vi.fn(), pending: 1, idle };
    state.transports.push(transport);
    return transport;
} }));

describe('diagnostic lifecycle and consent', () => {
    let page: EventTarget & { visibilityState: string };
    let browser: EventTarget & { location: { href: string } };
    beforeEach(() => {
        vi.resetModules();
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
        state.consent = true;
        state.local = false;
        state.listeners.clear();
        state.transports.length = 0;
        page = Object.assign(new EventTarget(), { visibilityState: 'visible' });
        browser = Object.assign(new EventTarget(), { location: { href: 'https://www.windy.com/' }, innerWidth: 400, innerHeight: 800 });
        vi.stubGlobal('document', page);
        vi.stubGlobal('window', browser);
        vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 Android Chrome/121.0.0.0' });
        vi.stubGlobal('requestAnimationFrame', (callback: () => void) => setTimeout(callback, 16));
        vi.stubGlobal('cancelAnimationFrame', (id: ReturnType<typeof setTimeout>) => clearTimeout(id));
    });
    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });
    const consent = (allowed: boolean) => {
        state.consent = allowed;
        state.listeners.forEach(listener => listener());
    };
    const element = (visible: boolean, complete: boolean) => ({ querySelector: () => ({
        getClientRects: () => visible ? [{}] : [],
        getBoundingClientRect: () => ({ width: 400, height: 800 }),
        querySelector: () => complete ? {} : null,
    }) }) as unknown as HTMLElement;

    it('does not backfill errors on consent, aborts on revocation and removes every observer on stop', async () => {
        const add = vi.spyOn(browser, 'addEventListener');
        const remove = vi.spyOn(browser, 'removeEventListener');
        const { startDiagnosticRuntime } = await import('./diagnosticRuntime');
        consent(false);
        const runtime = startDiagnosticRuntime();
        runtime.error('weather', new Error('before consent'));
        consent(true);
        expect(state.transports).toHaveLength(0);
        runtime.error('astronomy', new RangeError('Unable to resolve local date'));
        expect(state.transports).toHaveLength(1);
        expect(state.transports[0].sendDiagnostic).toHaveBeenCalledOnce();
        consent(false);
        expect(state.transports[0].destroy).toHaveBeenCalledWith(true);
        runtime.stop();
        expect(state.listeners.size).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
        expect(remove.mock.calls).toEqual(add.mock.calls);
    });

    it('keeps local build reports available without any remote sends', async () => {
        state.local = true;
        const { startDiagnosticRuntime } = await import('./diagnosticRuntime');
        const runtime = startDiagnosticRuntime();
        runtime.error('construct', new Error(), true);
        runtime.stop('failure');
        expect(JSON.parse(runtime.report()).state).toBe('failed');
        expect(state.transports).toHaveLength(0);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('ignores host failures but captures an attributed plugin rejection once', async () => {
        const { startDiagnosticRuntime } = await import('./diagnosticRuntime');
        const runtime = startDiagnosticRuntime();
        const error = new TypeError('Cannot read properties of undefined');
        error.stack = 'at https://www.windy.com/host.js:1:2';
        browser.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: error }));
        expect(state.transports).toHaveLength(0);
        error.stack = 'at https://windy-plugins.com/1/windy-plugin-sun-moon-path/0.11.4/plugin.min.js:1:2';
        runtime.error('galactic', error);
        browser.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: error }));
        expect(state.transports[0].sendDiagnostic).toHaveBeenCalledOnce();
        runtime.stop();
    });

    it('counts only visible startup time and never labels a hidden panel as incomplete', async () => {
        const { startDiagnosticRuntime } = await import('./diagnosticRuntime');
        const runtime = startDiagnosticRuntime();
        runtime.mounted(element(true, false));
        vi.advanceTimersByTime(4_000);
        page.visibilityState = 'hidden';
        page.dispatchEvent(new Event('visibilitychange'));
        vi.advanceTimersByTime(60_000);
        expect(state.transports).toHaveLength(0);
        page.visibilityState = 'visible';
        page.dispatchEvent(new Event('visibilitychange'));
        vi.advanceTimersByTime(10_000);
        expect(state.transports).toHaveLength(0);
        vi.advanceTimersByTime(1_100);
        expect(state.transports[0].sendDiagnostic.mock.calls[0][0].event).toBe('plugin_ui_incomplete');
        runtime.stop();
        const hidden = startDiagnosticRuntime();
        hidden.mounted(element(false, false));
        vi.advanceTimersByTime(20_000);
        expect(state.transports).toHaveLength(1);
        hidden.stop();
    });

    it('stops startup observation once DOM is ready and distinguishes replacements from later opens', async () => {
        const { startDiagnosticRuntime } = await import('./diagnosticRuntime');
        const runtime = startDiagnosticRuntime();
        runtime.mounted(element(true, true));
        vi.advanceTimersByTime(20);
        expect(runtime.diagnostics.state).toBe('ready');
        expect(vi.getTimerCount()).toBe(0);
        runtime.stop('replacement');
        const replacement = startDiagnosticRuntime();
        expect(replacement.diagnostics.sessionId).toBe(runtime.diagnostics.sessionId);
        expect(replacement.diagnostics.instanceId).not.toBe(runtime.diagnostics.instanceId);
        replacement.stop();
        const later = startDiagnosticRuntime();
        expect(later.diagnostics.sessionId).not.toBe(runtime.diagnostics.sessionId);
        later.stop();
    });

    it('hands off the session when the new instance starts before the old overlay owner retires', async () => {
        const { startDiagnosticRuntime } = await import('./diagnosticRuntime');
        const old = startDiagnosticRuntime();
        const next = startDiagnosticRuntime();
        old.stop('replacement');
        expect(next.diagnostics.sessionId).toBe(old.diagnostics.sessionId);
        expect(next.diagnostics.state).toBe('starting');
        next.stop();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('keeps a pending failure report revocable and ignores an old sender completion', async () => {
        const { startDiagnosticRuntime } = await import('./diagnosticRuntime');
        const runtime = startDiagnosticRuntime();
        runtime.error('weather', new Error());
        const old = state.transports[0];
        consent(false);
        consent(true);
        runtime.error('construct', new RangeError(), true);
        const current = state.transports[1];
        runtime.stop('failure');
        expect(vi.getTimerCount()).toBe(0);
        expect(state.listeners.size).toBe(1);
        old.idle();
        expect(current.destroy).not.toHaveBeenCalled();
        consent(false);
        expect(current.destroy).toHaveBeenCalledWith(true);
        expect(state.listeners.size).toBe(0);
        runtime.stop();
    });

    it.each(['settled', 'closed'])('releases the failure upload owner when %s', async reason => {
        const { startDiagnosticRuntime } = await import('./diagnosticRuntime');
        const runtime = startDiagnosticRuntime();
        runtime.error('construct', new Error(), true);
        runtime.stop('failure');
        if (reason === 'settled') { state.transports[0].idle(); }
        else { runtime.stop(); }
        expect(state.transports[0].destroy).toHaveBeenCalledWith(true);
        expect(state.listeners.size).toBe(0);
    });

    it('identifies Edge ahead of its Chrome compatibility token', async () => {
        vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 Windows Chrome/121.0 Safari/537.36 Edg/122.0' });
        const { diagnosticEnvironment } = await import('./diagnosticRuntime');
        expect(diagnosticEnvironment()).toMatchObject({ browser: 'Edg', browserVersion: '122.0' });
    });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    consent: true,
    listeners: new Map<number, () => void>(),
    sequence: 0,
    transports: [] as { send: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> }[],
    pageviews: [] as { trackOpen: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> }[],
    identities: [] as string[],
}));

vi.mock('@windy/store', () => ({ default: {
    get: () => ({ analytics: state.consent }),
    on: (_event: string, listener: () => void) => {
        state.listeners.set(++state.sequence, listener);
        return state.sequence;
    },
    off: (id: number) => state.listeners.delete(id),
} }));

vi.mock('./baiduUsageTransport', () => ({
    createBaiduUsageTransport: () => {
        const transport = { trackOpen: vi.fn(), destroy: vi.fn() };
        state.pageviews.push(transport);
        return transport;
    },
}));

vi.mock('./posthogUsageConfig', () => ({ postHogUsageConfig: {} }));
vi.mock('./posthogUsageTransport', () => ({
    createPostHogUsageTransport: (_allowed: () => boolean, distinctId: string) => {
        const transport = { send: vi.fn(), destroy: vi.fn() };
        state.transports.push(transport);
        state.identities.push(distinctId);
        return transport;
    },
}));

describe('plugin usage lifecycle', () => {
    let page: EventTarget & { visibilityState: string };
    let browser: EventTarget & { location: { href: string } };

    beforeEach(() => {
        vi.resetModules();
        vi.useFakeTimers();
        state.consent = true;
        state.listeners.clear();
        state.transports.length = 0;
        state.pageviews.length = 0;
        state.identities.length = 0;
        page = Object.assign(new EventTarget(), { visibilityState: 'visible' });
        browser = Object.assign(new EventTarget(), { location: { href: 'https://www.windy.com/' } });
        vi.stubGlobal('document', page);
        vi.stubGlobal('window', browser);
        const items = new Map<string, string>([['sun-moon-path-usage-browser-id-v1', crypto.randomUUID()]]);
        vi.stubGlobal('localStorage', {
            getItem: vi.fn((key: string) => items.get(key) ?? null),
            setItem: vi.fn((key: string, value: string) => items.set(key, value)),
            removeItem: vi.fn((key: string) => items.delete(key)),
        });
        vi.stubGlobal('navigator', { locks: { request: vi.fn((_key, _options, callback) => {
            callback();
            return Promise.resolve();
        }) } });
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

    it('pairs pagehide and BFCache restore without duplicate closes or plugin openings', async () => {
        const { startPluginUsage } = await import('./pluginUsage');
        const usage = startPluginUsage({ localBuild: false, tab: 'events' });
        browser.dispatchEvent(new Event('pagehide'));
        browser.dispatchEvent(new Event('pagehide'));
        browser.dispatchEvent(new Event('pageshow'));
        browser.dispatchEvent(new Event('pageshow'));
        usage.stop();
        usage.stop();
        const calls = state.transports[0].send.mock.calls;
        expect(calls.map(([event]) => event.action).filter(action => action.startsWith('$')))
            .toEqual(['$pageleave', '$pageview', '$pageleave']);
        expect(calls.filter(([event]) => event.action === 'open')).toHaveLength(1);
        expect(new Set(calls.map(([, id]) => id)).size).toBe(1);
        expect(calls[0][1].split('-')[2]).toMatch(/^7/);
    });

    it('reports only one valid plugin mount measurement and discards it after revocation', async () => {
        const { startPluginUsage } = await import('./pluginUsage');
        const usage = startPluginUsage({ localBuild: false, tab: 'events' });
        usage.recordMountDuration(NaN);
        usage.recordMountDuration(-1);
        usage.recordMountDuration(12.5);
        usage.recordMountDuration(99);
        expect(state.transports[0].send.mock.calls.filter(([event]) => event.category === 'performance'))
            .toEqual([[{ category: 'performance', action: 'plugin_mount_setup', durationMs: 12.5 }, expect.any(String)]]);
        usage.stop();
        const second = startPluginUsage({ localBuild: false, tab: 'events' });
        consent(false);
        consent(true);
        second.recordMountDuration(20);
        expect(state.transports).toHaveLength(2);
        second.stop();
    });

    it('renews an expired standard session without reusing an invalid timestamp', async () => {
        const { startPluginUsage } = await import('./pluginUsage');
        const usage = startPluginUsage({ localBuild: false, tab: 'events' });
        const original = state.transports[0].send.mock.calls[0][1];
        vi.setSystemTime(Date.now() + 86_400_000);
        usage.setTab('weather', true);
        expect(state.transports[0].send.mock.calls.at(-1)?.[1]).not.toBe(original);
        usage.stop();
        const newSessionEvents = state.transports[0].send.mock.calls.filter(([, id]) => id !== original);
        expect(newSessionEvents[0][0].action).toBe('$pageview');
        expect(newSessionEvents.at(-1)?.[0].action).toBe('$pageleave');
        expect(newSessionEvents.filter(([event]) => event.action === '$pageview')).toHaveLength(1);
    });

    it.each(['close', 'restore', 'grant'] as const)('keeps browsing boundaries on expired session %s', async scenario => {
        state.consent = scenario !== 'grant';
        const { startPluginUsage } = await import('./pluginUsage');
        const usage = startPluginUsage({ localBuild: false, tab: 'events' });
        if (scenario === 'grant') {
            consent(true);
            usage.setTab('weather', true);
        }
        if (scenario === 'restore') { browser.dispatchEvent(new Event('pagehide')); }
        const transport = state.transports[0];
        const original = transport.send.mock.calls[0][1];
        vi.setSystemTime(Date.now() + 86_400_000);
        if (scenario === 'restore') { browser.dispatchEvent(new Event('pageshow')); }
        if (scenario === 'grant') { usage.setTab('about', true); }
        usage.stop();
        const events = transport.send.mock.calls.filter(([, id]) => id !== original).map(([event]) => event.action);
        if (scenario === 'grant') {
            expect(events).not.toContain('$pageview');
            expect(events).not.toContain('$pageleave');
        } else {
            expect(events.filter(action => action === '$pageview' || action === '$pageleave'))
                .toEqual(['$pageview', '$pageleave']);
        }
    });

    it('queues mount measurement behind identity creation and cancels on close', async () => {
        localStorage.removeItem('sun-moon-path-usage-browser-id-v1');
        const pending: (() => void)[] = [];
        vi.mocked(navigator.locks.request).mockImplementation((_name: unknown, _options: unknown, callback: unknown) => {
            pending.push(callback as () => void);
            return Promise.resolve();
        });
        const { startPluginUsage } = await import('./pluginUsage');
        const usage = startPluginUsage({ localBuild: false, tab: 'events' });
        usage.recordMountDuration(25);
        expect(state.transports).toHaveLength(0);
        pending.splice(0).forEach(callback => callback());
        expect(state.transports[0].send.mock.calls.map(([event]) => event.action)).toEqual(['open', 'plugin_mount_setup']);
        usage.stop();
        localStorage.removeItem('sun-moon-path-usage-browser-id-v1');
        const closed = startPluginUsage({ localBuild: false, tab: 'events' });
        closed.recordMountDuration(30);
        closed.stop();
        pending.forEach(callback => callback());
        expect(state.transports).toHaveLength(1);
    });

    it('forwards restored and selected subviews through timing, background and close', async () => {
        let now = 0;
        vi.spyOn(performance, 'now').mockImplementation(() => now);
        const { startPluginUsage } = await import('./pluginUsage');
        const usage = startPluginUsage({ localBuild: false, tab: 'clouds', cloudView: 'tide' });
        now = 10_000;
        usage.setTab('clouds', true, 'rainbow');
        now = 25_000;
        page.visibilityState = 'hidden';
        page.dispatchEvent(new Event('visibilitychange'));
        now = 100_000;
        usage.stop();
        const events = state.transports[0].send.mock.calls.map(([event]) => event);
        expect(events.filter(event => event.action === 'tab_seconds')).toEqual([
            { category: 'usage', action: 'tab_seconds', label: 'tide', value: 10 },
            { category: 'usage', action: 'tab_seconds', label: 'rainbow', value: 15 },
        ]);
        expect(events.filter(event => event.category === 'tab')).toEqual([
            { category: 'tab', action: 'select', label: 'rainbow' },
        ]);
        expect(events.some(event => event.label === 'clouds')).toBe(false);
        expect(vi.getTimerCount()).toBe(0);
        expect(state.listeners.size).toBe(0);
    });

    it('never loads the SDK or installs listeners/timers in local development', async () => {
        const { startPluginUsage } = await import('./pluginUsage');
        const usage = startPluginUsage({ localBuild: true, tab: 'events' });
        vi.advanceTimersByTime(180_000);
        usage.setTab('clouds', true);
        usage.stop();
        expect(state.transports).toHaveLength(0);
        expect(state.pageviews).toHaveLength(0);
        expect(state.listeners.size).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
        expect(localStorage.getItem).not.toHaveBeenCalled();
        expect(localStorage.setItem).not.toHaveBeenCalled();
        expect(localStorage.removeItem).not.toHaveBeenCalled();
    });

    it('destroys the transport immediately on revocation and never replays opening', async () => {
        const { startPluginUsage } = await import('./pluginUsage');
        const usage = startPluginUsage({ localBuild: false, tab: 'events' });
        expect(state.transports[0].send).toHaveBeenCalledWith({ category: 'plugin', action: 'open' }, expect.any(String));
        consent(false);
        expect(state.transports[0].destroy).toHaveBeenCalledOnce();
        expect(state.transports[0].destroy).toHaveBeenCalledWith(true);
        expect(state.pageviews[0].destroy).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
        consent(true);
        usage.setTab('clouds', true);
        expect(state.transports[1].send).toHaveBeenCalledExactlyOnceWith({ category: 'tab', action: 'select', label: 'obstruction' }, expect.any(String));
        expect(state.identities[1]).not.toBe(state.identities[0]);
        expect(state.pageviews).toHaveLength(1);
        usage.stop();
        expect(state.listeners.size).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('pauses on background/pagehide and releases every registration on close', async () => {
        const { startPluginUsage } = await import('./pluginUsage');
        const usage = startPluginUsage({ localBuild: false, tab: 'events' });
        page.visibilityState = 'hidden';
        page.dispatchEvent(new Event('visibilitychange'));
        expect(vi.getTimerCount()).toBe(0);
        page.visibilityState = 'visible';
        page.dispatchEvent(new Event('visibilitychange'));
        expect(vi.getTimerCount()).toBe(1);
        browser.dispatchEvent(new Event('pagehide'));
        expect(vi.getTimerCount()).toBe(0);
        browser.dispatchEvent(new Event('pageshow'));
        expect(vi.getTimerCount()).toBe(1);
        usage.stop();
        const calls = state.transports[0].send.mock.calls.length;
        page.dispatchEvent(new Event('visibilitychange'));
        browser.dispatchEvent(new Event('pageshow'));
        consent(true);
        vi.advanceTimersByTime(180_000);
        expect(vi.getTimerCount()).toBe(0);
        expect(state.transports[0].send.mock.calls).toHaveLength(calls);
        expect(state.transports[0].destroy).toHaveBeenCalledOnce();
    });

    it('hands off only an explicit internal reopen; a manual reopen starts again', async () => {
        const { startPluginUsage } = await import('./pluginUsage');
        const first = startPluginUsage({ localBuild: false, tab: 'events' });
        first.stop(true);
        const second = startPluginUsage({ localBuild: false, tab: 'events' });
        first.stop(); // A late destroy of the old instance must not affect the new one.
        expect(state.transports).toHaveLength(1);
        second.setTab('clouds', true);
        expect(state.identities[1]).toBe(state.identities[0]);
        expect(state.pageviews).toHaveLength(1);
        second.stop();
        const third = startPluginUsage({ localBuild: false, tab: 'events' });
        expect(state.transports.at(-1)?.send).toHaveBeenCalledWith({ category: 'plugin', action: 'open' }, expect.any(String));
        expect(state.identities.at(-1)).toBe(state.identities[0]);
        const firstSession = state.transports[0].send.mock.calls[0][1];
        expect(state.transports[1].send.mock.calls[0][1]).toBe(firstSession);
        expect(state.transports.at(-1)?.send.mock.calls[0][1]).not.toBe(firstSession);
        expect(state.pageviews).toHaveLength(2);
        third.stop();
    });

    it('sends only opening PV to Baidu and all semantic events to PostHog', async () => {
        const { startPluginUsage } = await import('./pluginUsage');
        const usage = startPluginUsage({ localBuild: false, tab: 'events' });
        usage.setTab('clouds', true);
        vi.advanceTimersByTime(180_000);
        usage.stop();
        expect(state.pageviews).toHaveLength(1);
        expect(state.pageviews[0].trackOpen).toHaveBeenCalledOnce();
        const actions = state.transports[0].send.mock.calls.map(([event]) => event.action);
        expect(actions).toContain('open');
        expect(actions).toContain('select');
        expect(actions).toContain('foreground_seconds');
        expect(actions).toContain('tab_seconds');
        expect(actions).toContain('reached_3min');
    });

    it('clears an old identifier without reading it when opening without consent', async () => {
        state.consent = false;
        const { startPluginUsage } = await import('./pluginUsage');
        const usage = startPluginUsage({ localBuild: false, tab: 'events' });
        expect(localStorage.removeItem).toHaveBeenCalledOnce();
        expect(localStorage.getItem).not.toHaveBeenCalled();
        expect(localStorage.setItem).not.toHaveBeenCalled();
        expect(state.transports).toHaveLength(0);
        consent(true);
        usage.setTab('weather', true);
        expect(state.transports[0].send.mock.calls.map(([event]) => event.action)).toEqual(['select']);
        usage.stop();
    });

    it.each(['sun-moon-path-usage-browser-id-v1', null])('stops on cross-tab deletion of %s and removes its listener on close', async key => {
        const { startPluginUsage } = await import('./pluginUsage');
        const usage = startPluginUsage({ localBuild: false, tab: 'events' });
        const event = Object.assign(new Event('storage'), { key, newValue: null, storageArea: localStorage });
        browser.dispatchEvent(Object.assign(new Event('storage'), { key: 'unrelated', newValue: null, storageArea: localStorage }));
        expect(state.transports[0].destroy).not.toHaveBeenCalled();
        localStorage.removeItem('sun-moon-path-usage-browser-id-v1');
        browser.dispatchEvent(event);
        expect(state.transports[0].destroy).toHaveBeenCalledWith(true);
        expect(vi.getTimerCount()).toBe(0);
        usage.setTab('weather', true);
        expect(state.transports).toHaveLength(1);
        consent(true);
        usage.setTab('about', true);
        expect(state.identities[1]).not.toBe(state.identities[0]);
        usage.stop();
        const reads = vi.mocked(localStorage.getItem).mock.calls.length;
        browser.dispatchEvent(event);
        expect(vi.mocked(localStorage.getItem).mock.calls).toHaveLength(reads);
        expect(state.listeners.size).toBe(0);
    });

    it('counts a new three-minute threshold after revocation instead of carrying old engagement', async () => {
        const { startPluginUsage } = await import('./pluginUsage');
        const usage = startPluginUsage({ localBuild: false, tab: 'events' });
        vi.advanceTimersByTime(180_000);
        expect(state.transports[0].send.mock.calls.filter(([event]) => event.action === 'reached_3min')).toHaveLength(1);
        consent(false);
        consent(true);
        vi.advanceTimersByTime(180_000);
        expect(state.transports[1].send.mock.calls.filter(([event]) => event.action === 'reached_3min')).toHaveLength(1);
        expect(state.transports[1].send.mock.calls[0][1]).not.toBe(state.transports[0].send.mock.calls[0][1]);
        usage.stop();
    });

    it('discards an internal handoff when consent is absent at the next mount', async () => {
        const { startPluginUsage } = await import('./pluginUsage');
        const first = startPluginUsage({ localBuild: false, tab: 'events' });
        vi.advanceTimersByTime(180_000);
        const oldSessionId = state.transports[0].send.mock.calls[0][1];
        first.stop(true);
        state.consent = false;
        const next = startPluginUsage({ localBuild: false, tab: 'events' });
        consent(true);
        next.setTab('weather', true);
        expect(state.identities[1]).not.toBe(state.identities[0]);
        expect(state.transports[1].send.mock.calls[0][1]).not.toBe(oldSessionId);
        vi.advanceTimersByTime(180_000);
        expect(state.transports[1].send.mock.calls.filter(([event]) => event.action === 'reached_3min')).toHaveLength(1);
        next.stop();
    });

    it('keeps events working when the Baidu transport cannot initialize', async () => {
        const baidu = await import('./baiduUsageTransport');
        vi.spyOn(baidu, 'createBaiduUsageTransport').mockImplementationOnce(() => { throw new Error('blocked'); });
        const { startPluginUsage } = await import('./pluginUsage');
        const usage = startPluginUsage({ localBuild: false, tab: 'events' });
        expect(state.transports[0].send).toHaveBeenCalledWith({ category: 'plugin', action: 'open' }, expect.any(String));
        usage.setTab('clouds', true);
        expect(state.transports[0].send).toHaveBeenCalledWith({ category: 'tab', action: 'select', label: 'obstruction' }, expect.any(String));
        usage.stop();
    });

    it('keeps opening PV working when the PostHog transport cannot initialize', async () => {
        const posthog = await import('./posthogUsageTransport');
        vi.spyOn(posthog, 'createPostHogUsageTransport').mockImplementationOnce(() => { throw new Error('blocked'); });
        const { startPluginUsage } = await import('./pluginUsage');
        const usage = startPluginUsage({ localBuild: false, tab: 'events' });
        expect(state.pageviews[0].trackOpen).toHaveBeenCalledOnce();
        expect(state.transports).toHaveLength(0);
        usage.stop();
    });
});

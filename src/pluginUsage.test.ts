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
    });

    it('destroys the transport immediately on revocation and never replays opening', async () => {
        const { startPluginUsage } = await import('./pluginUsage');
        const usage = startPluginUsage({ localBuild: false, tab: 'events' });
        expect(state.transports[0].send).toHaveBeenCalledWith({ category: 'plugin', action: 'open' });
        consent(false);
        expect(state.transports[0].destroy).toHaveBeenCalledOnce();
        expect(state.transports[0].destroy).toHaveBeenCalledWith(true);
        expect(state.pageviews[0].destroy).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
        consent(true);
        usage.setTab('clouds', true);
        expect(state.transports[1].send).toHaveBeenCalledExactlyOnceWith({ category: 'tab', action: 'select', label: 'clouds' });
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
        expect(state.transports.at(-1)?.send).toHaveBeenCalledWith({ category: 'plugin', action: 'open' });
        expect(state.identities.at(-1)).not.toBe(state.identities[0]);
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

    it('keeps events working when the Baidu transport cannot initialize', async () => {
        const baidu = await import('./baiduUsageTransport');
        vi.spyOn(baidu, 'createBaiduUsageTransport').mockImplementationOnce(() => { throw new Error('blocked'); });
        const { startPluginUsage } = await import('./pluginUsage');
        const usage = startPluginUsage({ localBuild: false, tab: 'events' });
        expect(state.transports[0].send).toHaveBeenCalledWith({ category: 'plugin', action: 'open' });
        usage.setTab('clouds', true);
        expect(state.transports[0].send).toHaveBeenCalledWith({ category: 'tab', action: 'select', label: 'clouds' });
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

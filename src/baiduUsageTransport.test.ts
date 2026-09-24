import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBaiduUsageTransport } from './baiduUsageTransport';

describe('disposable Baidu transport', () => {
    let allowed: boolean;
    let script: { onload: (() => void) | null; onerror: (() => void) | null; src: string; referrerPolicy: string };
    let context: {
        _hmt: { push: ReturnType<typeof vi.fn> } | unknown[];
        Image: typeof Image;
        history: { replaceState: ReturnType<typeof vi.fn> };
        sessionStorage: { removeItem: ReturnType<typeof vi.fn> };
    };
    let frame: { remove: ReturnType<typeof vi.fn>; contentWindow: typeof context; contentDocument: object };
    let appendFrame: ReturnType<typeof vi.fn>;
    let requests: string[];
    let pixel: FakePixel | null;

    class FakePixel extends EventTarget {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        referrerPolicy = '';
        set src(value: string) { requests.push(value); }
    }

    beforeEach(() => {
        vi.useFakeTimers();
        allowed = true;
        requests = [];
        pixel = null;
        script = { onload: null, onerror: null, src: '', referrerPolicy: '' };
        context = {
            _hmt: [],
            Image: FakePixel as unknown as typeof Image,
            history: { replaceState: vi.fn() },
            sessionStorage: { removeItem: vi.fn() },
        };
        const frameDocument = {
            referrer: 'https://www.windy.com/?sensitive-map-parameters',
            open: vi.fn(), write: vi.fn(), close: vi.fn(),
            createElement: () => script,
            head: { appendChild: vi.fn() },
        };
        frame = {
            remove: vi.fn(), contentWindow: context, contentDocument: frameDocument,
        };
        Object.assign(frame, { setAttribute: vi.fn() });
        appendFrame = vi.fn();
        vi.stubGlobal('Image', FakePixel);
        vi.stubGlobal('document', { createElement: () => frame, body: { appendChild: appendFrame } });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    /** Simulate SDK readiness; real SDK request formatting is browser-validated. */
    const sdkReady = () => {
        let sending = false;
        context._hmt = { push: vi.fn((command: unknown[]) => {
            if (command[0] === '_setAutoTracking') {
                sending = command[1] === true;
            }
            if (command[0] === '_trackPageview' && sending) {
                pixel = new context.Image() as unknown as FakePixel;
                pixel.onload = vi.fn();
                pixel.src = 'https://hm.baidu.com/hm.gif';
            }
        }) };
        script.onload?.();
        return context._hmt.push;
    };

    it('does not create a document or fetch a script without consent', () => {
        allowed = false;
        const transport = createBaiduUsageTransport(() => allowed);
        transport.trackOpen();
        expect(appendFrame).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
        transport.destroy();
    });

    it('sets a fixed URL and empty referrer before SDK loading; queues only permitted events', () => {
        const transport = createBaiduUsageTransport(() => allowed);
        transport.trackOpen();
        expect(context.history.replaceState).toHaveBeenCalledWith(null, '', '/plugins/sun-moon-path/usage');
        expect(frame.contentDocument).toHaveProperty('referrer', '');
        expect(context._hmt).toContainEqual(['_setAutoTracking', false]);
        expect(context._hmt).toContainEqual(['_setAutoPageview', false]);
        expect(script.referrerPolicy).toBe('origin');
        expect(requests).toEqual([]);
        const push = sdkReady();
        expect(push.mock.calls.map(([command]) => command)).toEqual([
            ['_setAutoTracking', true],
            ['_trackPageview', '/plugins/sun-moon-path/usage'],
            ['_setAutoTracking', false],
        ]);
        expect(vi.getTimerCount()).toBe(0);
        transport.destroy();
    });

    it('invalidates a pending load on revocation and ignores its late callback', () => {
        const transport = createBaiduUsageTransport(() => allowed);
        transport.trackOpen();
        const lateLoad = script.onload;
        allowed = false;
        transport.destroy();
        const push = sdkReady();
        lateLoad?.();
        expect(push).not.toHaveBeenCalledWith(['_trackPageview', '/plugins/sun-moon-path/usage']);
        expect(requests).toEqual([]);
        expect(script.onload).toBeNull();
        expect(script.onerror).toBeNull();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('fails closed for an empty SDK response, script error and a hung load', () => {
        for (const failure of ['empty', 'error', 'timeout']) {
            const transport = createBaiduUsageTransport(() => allowed);
            transport.trackOpen();
            if (failure === 'empty') { script.onload?.(); }
            if (failure === 'error') { script.onerror?.(); }
            if (failure === 'timeout') { vi.advanceTimersByTime(10_000); }
            expect(vi.getTimerCount()).toBe(0);
            expect(script.onload).toBeNull();
            expect(requests).toEqual([]);
            transport.trackOpen();
        }
        expect(appendFrame).toHaveBeenCalledTimes(3);
    });

    it('keeps submitted pixels independent of iframe teardown, with no remaining callbacks', () => {
        const transport = createBaiduUsageTransport(() => allowed);
        transport.trackOpen();
        const push = sdkReady();
        expect(requests).toHaveLength(1);
        expect(pixel).toHaveProperty('referrerPolicy', 'no-referrer');
        transport.destroy();
        expect(pixel).toHaveProperty('onload', null);
        expect(pixel).toHaveProperty('onerror', null);
        expect(frame.remove).toHaveBeenCalledOnce();
        expect(context.sessionStorage.removeItem).toHaveBeenCalledWith('Hm_unsent_1bc918b521d751eba5d2d965e88caf3b');
        const count = push.mock.calls.length;
        transport.trackOpen();
        expect(push.mock.calls).toHaveLength(count);
        expect(vi.getTimerCount()).toBe(0);
    });
});

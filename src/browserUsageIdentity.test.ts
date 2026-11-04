import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserUsageIdentity } from './browserUsageIdentity';

const KEY = 'sun-moon-path-usage-browser-id-v1';
const EXISTING_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('consented persistent browser identity', () => {
    let items: Map<string, string>;
    let allowed: boolean;
    let lockQueue: Promise<unknown>;

    beforeEach(() => {
        items = new Map();
        allowed = true;
        lockQueue = Promise.resolve();
        vi.stubGlobal('localStorage', {
            getItem: vi.fn((key: string) => items.get(key) ?? null),
            setItem: vi.fn((key: string, value: string) => items.set(key, value)),
            removeItem: vi.fn((key: string) => items.delete(key)),
        });
        vi.stubGlobal('navigator', { locks: {
            request: vi.fn((_name, options, callback) => {
                const result = lockQueue.then(() => {
                    if (options.signal.aborted) { throw new DOMException('Aborted', 'AbortError'); }
                    return callback();
                });
                lockQueue = result.catch(() => undefined);
                return result;
            }),
        } });
    });

    afterEach(() => vi.unstubAllGlobals());
    const flush = async () => {
        await lockQueue;
        await Promise.resolve();
        await Promise.resolve();
    };

    it('never reads, writes or requests a lock before consent', () => {
        allowed = false;
        const send = vi.fn();
        const identity = createBrowserUsageIdentity(() => allowed);
        identity.send(send);
        expect(localStorage.getItem).not.toHaveBeenCalled();
        expect(localStorage.setItem).not.toHaveBeenCalled();
        expect(navigator.locks.request).not.toHaveBeenCalled();
        expect(send).not.toHaveBeenCalled();
        identity.destroy();
    });

    it('shares one identity across simultaneous first opens and new module instances', async () => {
        const send = vi.fn();
        const first = createBrowserUsageIdentity(() => allowed);
        const second = createBrowserUsageIdentity(() => allowed);
        first.send(send);
        second.send(send);
        await flush();
        expect(send).toHaveBeenCalledTimes(2);
        expect(send.mock.calls[0][0]).toBe(send.mock.calls[1][0]);
        expect(localStorage.setItem).toHaveBeenCalledOnce();
        first.destroy();
        second.destroy();
        vi.resetModules();
        const reloaded = await import('./browserUsageIdentity');
        const third = reloaded.createBrowserUsageIdentity(() => allowed);
        third.send(send);
        expect(send.mock.calls[2][0]).toBe(send.mock.calls[0][0]);
        third.destroy();
    });

    it.each(['revoke', 'destroy', 'consent'] as const)('cancels a waiting creation on %s', async action => {
        const send = vi.fn();
        const identity = createBrowserUsageIdentity(() => allowed);
        identity.send(send);
        if (action === 'consent') { allowed = false; }
        else { identity[action](); }
        await flush();
        expect(localStorage.setItem).not.toHaveBeenCalled();
        expect(send).not.toHaveBeenCalled();
        identity.destroy();
    });

    it('deletes on revocation and creates a different identity after a new grant', async () => {
        items.set(KEY, EXISTING_ID);
        const send = vi.fn();
        const identity = createBrowserUsageIdentity(() => allowed);
        identity.send(send);
        allowed = false;
        identity.revoke();
        expect(items.has(KEY)).toBe(false);
        allowed = true;
        identity.send(send);
        await flush();
        expect(send.mock.calls[1][0]).not.toBe(EXISTING_ID);
        identity.destroy();
    });

    it.each(['getItem', 'setItem'] as const)('excludes blocked %s without an ephemeral fallback', async method => {
        vi.mocked(localStorage[method]).mockImplementation(() => { throw new Error('Denied'); });
        const send = vi.fn();
        const identity = createBrowserUsageIdentity(() => allowed);
        identity.send(send);
        await flush();
        expect(send).not.toHaveBeenCalled();
        identity.destroy();
    });

    it('does not create without locks', () => {
        vi.stubGlobal('navigator', {});
        const send = vi.fn();
        const identity = createBrowserUsageIdentity(() => allowed);
        identity.send(send);
        expect(items.size).toBe(0);
        expect(send).not.toHaveBeenCalled();
        identity.destroy();
    });

    it('bounds pending creation and aborts all waiting requests on close', async () => {
        const send = vi.fn();
        const identity = createBrowserUsageIdentity(() => allowed);
        for (let index = 0; index < 100; index++) { identity.send(send); }
        expect(navigator.locks.request).toHaveBeenCalledTimes(16);
        identity.destroy();
        await flush();
        expect(send).not.toHaveBeenCalled();
        expect(items.size).toBe(0);
    });

    it('rejects malformed stored values and tolerates deletion denial', async () => {
        items.set(KEY, 'not-an-anonymous-uuid');
        const send = vi.fn();
        const identity = createBrowserUsageIdentity(() => allowed);
        identity.send(send);
        await flush();
        expect(send.mock.calls[0][0]).not.toBe('not-an-anonymous-uuid');
        vi.mocked(localStorage.removeItem).mockImplementation(() => { throw new Error('Denied'); });
        expect(() => identity.revoke()).not.toThrow();
        identity.destroy();
    });
});

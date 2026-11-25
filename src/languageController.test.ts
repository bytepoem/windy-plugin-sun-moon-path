import { describe, expect, it, vi } from 'vitest';
import { createLanguageController } from './languageController';
import { resolveUiLanguage, type UiLanguage } from './uiLanguage';

const pending = () => {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
const setup = () => {
    let host: unknown = 'zh';
    const requests = new Map<UiLanguage, ReturnType<typeof pending>>();
    const apply = vi.fn();
    const persist = vi.fn();
    const status = vi.fn();
    const committed = vi.fn();
    const controller = createLanguageController({
        initial: { language: 'zh', preference: 'auto' },
        usedLang: () => host, apply, persist, status, committed,
        prepare: language => {
            const request = pending();
            requests.set(language, request);
            return request.promise;
        },
    });
    return { controller, requests, apply, persist, status, committed, host: (value: unknown) => { host = value; } };
};

describe('Windy language selection contract', () => {
    it('follows the language actually used by Windy and validates unknown host values', () => {
        expect(resolveUiLanguage('auto', 'zh-TW')).toBe('zh-TW');
        expect(resolveUiLanguage('auto', 'fr')).toBe('fr');
        expect(resolveUiLanguage('ja', 'fr')).toBe('ja');
        expect(() => Reflect.apply(resolveUiLanguage, null, ['constructor', 'zh'])).toThrow('Unsupported plugin language preference');
        for (const value of ['auto', 'unsupported', '__proto__', null]) {
            expect(() => resolveUiLanguage('auto', value)).toThrow('Unsupported Windy language');
        }
    });

    it('applies and persists only the last selection when completions arrive out of order', async () => {
        const test = setup();
        const first = test.controller.select('fr');
        const last = test.controller.select('ja');
        test.requests.get('ja')!.resolve();
        await last;
        test.requests.get('fr')!.resolve();
        await first;
        expect(test.apply.mock.calls).toEqual([[{ language: 'ja', preference: 'ja' }]]);
        expect(test.persist.mock.calls).toEqual([['ja']]);
        expect(test.committed.mock.calls).toEqual([[{ language: 'ja', preference: 'ja' }, true]]);
    });

    it('keeps the displayed selection on failure, then permits retry', async () => {
        const test = setup();
        const failed = test.controller.select('de');
        test.requests.get('de')!.reject(new Error('decode failed'));
        await failed;
        expect(test.apply).not.toHaveBeenCalled();
        expect(test.persist).not.toHaveBeenCalled();
        expect(test.committed).not.toHaveBeenCalled();
        expect(test.status).toHaveBeenLastCalledWith(false, true);
        const retry = test.controller.retry();
        test.requests.get('de')!.resolve();
        await retry;
        expect(test.persist).toHaveBeenCalledWith('de');
        expect(test.status).toHaveBeenLastCalledWith(false, false);
    });

    it('does not let a host event replace a pending manual choice and can return to following', async () => {
        const test = setup();
        const manual = test.controller.select('ar');
        test.host('fr');
        await test.controller.syncHost();
        expect(test.requests.has('fr')).toBe(false);
        test.requests.get('ar')!.resolve();
        await manual;
        const follow = test.controller.select('auto');
        test.requests.get('fr')!.resolve();
        await follow;
        expect(test.apply).toHaveBeenLastCalledWith({ language: 'fr', preference: 'auto' });
        expect(test.persist).toHaveBeenLastCalledWith('auto');
        test.host('ko');
        const changed = test.controller.syncHost();
        test.requests.get('ko')!.resolve();
        await changed;
        expect(test.apply).toHaveBeenLastCalledWith({ language: 'ko', preference: 'auto' });
        expect(test.persist).toHaveBeenCalledTimes(2);
    });

    it('ignores a late completion and all host events after destruction', async () => {
        const test = setup();
        const request = test.controller.select('he');
        test.controller.destroy();
        test.requests.get('he')!.resolve();
        await request;
        expect(test.apply).not.toHaveBeenCalled();
        expect(test.persist).not.toHaveBeenCalled();
        expect(test.status).toHaveBeenCalledTimes(1);
        test.host('fr');
        await test.controller.syncHost();
        expect(test.requests.has('fr')).toBe(false);
    });

    it('persists an explicit return to following even when the host changes during loading', async () => {
        const test = setup();
        const manual = test.controller.select('en');
        test.requests.get('en')!.resolve();
        await manual;
        test.host('fr');
        const following = test.controller.select('auto');
        test.host('de');
        const newerHost = test.controller.syncHost();
        test.requests.get('de')!.resolve();
        await newerHost;
        test.requests.get('fr')!.resolve();
        await following;
        expect(test.apply).toHaveBeenLastCalledWith({ language: 'de', preference: 'auto' });
        expect(test.persist.mock.calls).toEqual([['en'], ['auto']]);
    });

    it('keeps an explicit override when Windy adds an unsupported runtime language', async () => {
        const test = setup();
        test.host('future-language');
        await test.controller.syncHost();
        expect(test.apply).not.toHaveBeenCalled();
        expect(test.status).toHaveBeenLastCalledWith(false, true);
        const manual = test.controller.select('en');
        test.requests.get('en')!.resolve();
        await manual;
        expect(test.apply).toHaveBeenLastCalledWith({ language: 'en', preference: 'en' });
    });

    it('retries a failed automatic selection without requiring a different dropdown value', async () => {
        const test = setup();
        test.host('future-language');
        await test.controller.syncHost();
        expect(test.status).toHaveBeenLastCalledWith(false, true);
        test.host('ja');
        const retry = test.controller.retry();
        test.requests.get('ja')!.resolve();
        await retry;
        expect(test.apply).toHaveBeenLastCalledWith({ language: 'ja', preference: 'auto' });
        expect(test.persist).toHaveBeenCalledWith('auto');
    });
});

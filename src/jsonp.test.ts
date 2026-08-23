import { afterEach, describe, expect, it, vi } from 'vitest';

import { requestJsonp } from './jsonp';

type FakeScript = {
    async: boolean;
    src: string;
    onerror: (() => void) | null;
    remove: ReturnType<typeof vi.fn>;
};

const installDom = () => {
    const script: FakeScript = {
        async: false,
        src: '',
        onerror: null,
        remove: vi.fn(),
    };
    const appendChild = vi.fn();
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', {
        createElement: vi.fn(() => script),
        head: { appendChild },
    });
    return { appendChild, script };
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('JSONP requests', () => {
    it('removes the script and callback after a successful response', async () => {
        const { appendChild, script } = installDom();
        const response = requestJsonp<{ status: number }>({
            url: new URL('https://example.com/suggestion'),
        });
        const callbackName = new URL(script.src).searchParams.get('callback') as string;
        const [registryName, callbackId] = callbackName.split('.');
        const registry = (window as unknown as Record<string, Record<string, (value: unknown) => void>>)[registryName];

        expect(appendChild).toHaveBeenCalledWith(script);
        expect(typeof registry[callbackId]).toBe('function');
        registry[callbackId]({ status: 0 });

        await expect(response).resolves.toEqual({ status: 0 });
        expect(script.remove).toHaveBeenCalledOnce();
        expect(Object.hasOwn(registry, callbackId)).toBe(false);
    });

    it('absorbs a late JSONP response after the request is aborted', async () => {
        const { script } = installDom();
        const controller = new AbortController();
        const response = requestJsonp({
            url: new URL('https://example.com/suggestion'),
            signal: controller.signal,
        });
        const callbackName = new URL(script.src).searchParams.get('callback') as string;
        const [registryName, callbackId] = callbackName.split('.');
        const registry = (window as unknown as Record<string, Record<string, (value: unknown) => void>>)[registryName];

        controller.abort();

        await expect(response).rejects.toMatchObject({ name: 'AbortError' });
        expect(script.remove).toHaveBeenCalledOnce();
        expect(Object.hasOwn(registry, callbackId)).toBe(false);
        expect(() => registry[callbackId]({ status: 0 })).not.toThrow();
    });
});

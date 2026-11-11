import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { languageResourceFixture } from './test/languageResourceFixture';
import { languageManifest } from './languageManifest';

const storage = new Map<string, string>();
beforeEach(() => {
    vi.resetModules();
    storage.clear();
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
});
afterEach(() => vi.unstubAllGlobals());

describe('immutable language loading', () => {
    it('separates local test paths and cache from release resources', async () => {
        const fetcher = vi.fn(async (url: string) => languageResourceFixture(url));
        vi.stubGlobal('fetch', fetcher);
        const local = await import('./languageResources');
        local.configureLanguageLocation(undefined, true);
        await local.loadLanguageResource('fr');
        expect(fetcher.mock.calls[0][0]).toBe('https://localhost:9999/languages/local/' + languageManifest.version + '/fr.json');
        expect(storage.has('sun-path:language:local:' + languageManifest.version + ':fr')).toBe(true);
        vi.resetModules();
        const release = await import('./languageResources');
        release.configureLanguageLocation({ source: 'ip', cc: 'US' });
        await release.loadLanguageResource('fr');
        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(fetcher.mock.calls[1][0]).toContain('raw.githubusercontent.com/bytepoem/windy-plugin-sun-moon-path/update-metadata/languages/release/');
        expect(storage.has('sun-path:language:release:' + languageManifest.version + ':fr')).toBe(true);
    });

    it('deduplicates only the selected language, verifies cache again, and isolates versions', async () => {
        const fetcher = vi.fn(async (url: string) => languageResourceFixture(url));
        vi.stubGlobal('fetch', fetcher);
        const loader = await import('./languageResources');
        await Promise.all([loader.loadLanguageResource('fr'), loader.loadLanguageResource('fr')]);
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(String(fetcher.mock.calls[0][0])).toContain('/fr.json');
        expect([...storage.keys()]).toEqual(['sun-path:language:release:' + languageManifest.version + ':fr']);
        await loader.loadLanguageResource('fr');
        expect(fetcher).toHaveBeenCalledTimes(1);
        storage.set('sun-path:language:release:old:ja', 'old catalog');
        await loader.loadLanguageResource('ja');
        expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('rejects changed bytes without caching them, then permits a clean retry', async () => {
        const loader = await import('./languageResources');
        loader.configureLanguageLocation({ source: 'ip', cc: 'US' });
        const raw = await languageResourceFixture('https://example.com/languages/version/fr.json').text();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(raw.replace('fr', 'de')))
            .mockResolvedValueOnce(new Response(raw)));
        await expect(loader.loadLanguageResource('fr')).rejects.toThrow('checksum');
        expect(storage.size).toBe(0);
        await expect(loader.loadLanguageResource('fr')).resolves.toBeInstanceOf(Map);
        expect(storage.size).toBe(1);
    });

    it('ignores corrupt cache and refuses a valid dictionary for the wrong language', async () => {
        const loader = await import('./languageResources');
        storage.set('sun-path:language:release:' + languageManifest.version + ':fr', '{}');
        vi.stubGlobal('fetch', async () => languageResourceFixture('https://example.com/languages/version/de.json'));
        loader.configureLanguageLocation({ source: 'ip', cc: 'US' });
        await expect(loader.loadLanguageResource('fr')).rejects.toThrow('checksum');
        expect(storage.get('sun-path:language:release:' + languageManifest.version + ':fr')).toBe('{}');
    });

    it('cancels one subscriber independently and aborts transport when the last closes', async () => {
        let transport: AbortSignal | undefined;
        vi.stubGlobal('fetch', (_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
            transport = options.signal!;
            transport.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')));
        }));
        const loader = await import('./languageResources');
        const first = new AbortController();
        const last = new AbortController();
        const a = loader.loadLanguageResource('fr', first.signal);
        const b = loader.loadLanguageResource('fr', last.signal);
        first.abort();
        await expect(a).rejects.toMatchObject({ name: 'AbortError' });
        expect(transport?.aborted).toBe(false);
        last.abort();
        await expect(b).rejects.toMatchObject({ name: 'AbortError' });
        expect(transport?.aborted).toBe(true);
        expect(storage.size).toBe(0);
    });

    it('does not request language resources for built-in Chinese or English', async () => {
        const fetcher = vi.fn();
        vi.stubGlobal('fetch', fetcher);
        const { prepareUiLanguage } = await import('./localeMessages');
        await prepareUiLanguage('zh');
        await prepareUiLanguage('en');
        expect(fetcher).not.toHaveBeenCalled();
    });
});

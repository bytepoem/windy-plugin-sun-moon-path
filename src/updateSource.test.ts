import { describe, expect, it, vi } from 'vitest';
import { checkPluginUpdate, fetchUpdateJson, selectUpdateSource } from './pluginUpdate';
import notesSource from '../release-notes/0.11.1.json?raw';
import previousSource from '../release-notes/0.11.0.json?raw';

const notes = JSON.parse(notesSource);
const previous = JSON.parse(previousSource);

const repositoryUrl = 'https://github.com/bytepoem/windy-plugin-sun-moon-path';
const manifest = { name: 'windy-plugin-sun-moon-path', version: '0.11.1', notesUrl: './0.11.1/notes.json' };
const snapshot = { version: '0.11.1', seriesNotes: [notes, previous] };
const envelope = (path: string, value: unknown) => ({
    type: 'file', path, encoding: 'base64', content: Buffer.from(JSON.stringify(value)).toString('base64'),
});

describe('regional update sources', () => {
    it.each([
        [{ source: 'ip', cc: 'cn' }, 'gitee'],
        [{ source: 'ip', cc: 'CN' }, 'gitee'],
        [{ source: 'ip', cc: 'us' }, 'github'],
        [{ source: 'ip', cc: 'hk' }, 'github'],
        [{ source: 'gps', cc: 'us' }, 'gitee'],
        [{ source: 'fallback', cc: 'us' }, 'gitee'],
        [{ source: 'ip' }, 'gitee'],
        [null, 'gitee'],
    ] as const)('routes %j to %s', (location, expected) => {
        expect(selectUpdateSource(location)).toBe(expected);
    });

    it.each(['gitee', 'github'] as const)('loads a complete UTF-8 series via %s', async source => {
        const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async url => {
            const path = String(url).includes('latest.json') ? 'latest.json' : '0.11.1/notes.json';
            const value = path === 'latest.json' ? manifest : snapshot;
            return new Response(JSON.stringify(source === 'gitee' ? envelope(path, value) : value));
        });
        const result = await checkPluginUpdate({ source, currentVersion: '0.11.0', repositoryUrl, fetchImpl, sessionCache: null });
        expect(result).toMatchObject({ status: 'available', notesStatus: 'loaded', notes });
        expect(result.seriesNotes.map(note => note.version)).toEqual(['0.11.1', '0.11.0']);
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(fetchImpl.mock.calls.every(([url]) => String(url).includes(source === 'gitee' ? 'gitee.com/api/' : 'raw.githubusercontent.com/'))).toBe(true);
    });

    it('isolates cached results between sources', async () => {
        const values = new Map<string, string>();
        const sessionCache = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
        const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async url => {
            const path = String(url).includes('latest.json') ? 'latest.json' : '0.11.1/notes.json';
            const value = path === 'latest.json' ? manifest : snapshot;
            return new Response(JSON.stringify(String(url).includes('gitee.com') ? envelope(path, value) : value));
        });
        for (const source of ['gitee', 'github', 'gitee'] as const) {
            await checkPluginUpdate({ source, currentVersion: '0.11.0', repositoryUrl, fetchImpl, sessionCache });
        }
        expect(fetchImpl).toHaveBeenCalledTimes(4);
    });

    it('propagates cancellation and never switches source on a failed manifest', async () => {
        const controller = new AbortController();
        controller.abort();
        const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new DOMException('Aborted', 'AbortError'));
        await expect(checkPluginUpdate({ source: 'gitee', currentVersion: '0.11.0', repositoryUrl, fetchImpl, sessionCache: null, signal: controller.signal }))
            .rejects.toMatchObject({ name: 'AbortError' });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(fetchImpl.mock.calls[0][1]?.signal).toBe(controller.signal);
    });

    it.each([
        { ...envelope('latest.json', manifest), encoding: 'plain' },
        envelope('other.json', manifest),
        { ...envelope('latest.json', manifest), content: '%%%invalid' },
    ])('rejects malformed Gitee responses', async value => {
        await expect(fetchUpdateJson('gitee', 'latest.json', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(value)))))
            .rejects.toThrow();
    });
});

import { describe, expect, it } from 'vitest';

import { checkPluginUpdate } from './pluginUpdate';

import formalNotesSource from '../release-notes/0.10.3.json?raw';
import betaNotesSource from '../release-notes/beta.json?raw';
import packageSource from '../package.json?raw';
import pluginSource from './plugin.svelte?raw';
import rollupSource from '../rollup.config.js?raw';

describe('beta release notes development asset', () => {
    it('contains bilingual user-facing notes and is copied only for the local serve build', () => {
        const notes = JSON.parse(betaNotesSource) as {
            version: string;
            releasedAt: string;
            zh: { items: unknown[] };
            en: { items: unknown[] };
        };
        const formalNotes = JSON.parse(formalNotesSource) as typeof notes;

        expect(notes.version).toBe('0.10.3');
        expect(notes.releasedAt).toBe('2026-09-10');
        expect(formalNotes).toEqual(notes);
        expect(notes.zh.items.length).toBeGreaterThan(0);
        expect(notes.en.items.length).toBeGreaterThan(0);
        expect(pluginSource).toContain("import betaReleaseNotesUrl from 'virtual:beta-release-notes-url';");
        expect(pluginSource).toContain('betaNotesUrl: betaReleaseNotesUrl');
        expect(pluginSource).not.toContain('new URL(import.meta.url)');
        expect(rollupSource).toContain("const betaReleaseNotesVirtualId = 'virtual:beta-release-notes-url';");
        expect(rollupSource).toContain('betaReleaseNotesPlugin()');
        expect(rollupSource).toContain("process.env.SERVE?.trim().toLowerCase() !== 'false'");
        expect(rollupSource).toContain("return `export default ${serveBuild ? JSON.stringify(betaReleaseNotesUrl) : 'null'};`;");
        expect(rollupSource).toContain('if (!serveBuild) {');
        expect(packageSource).toContain('set \\"SERVE=false\\" && rollup -c');
    });
});

/** Exercise real release files through the same parser used by installed plugins. */
describe('release note publishing contract', () => {
    const sources = import.meta.glob('../release-notes/*.json', { query: '?raw', import: 'default', eager: true });
    it.each(['0.9.1', '0.10.1', '0.10.2', '0.10.3'])('loads the full current snapshot for installed %s', async currentVersion => {
        const manifest = JSON.parse(packageSource);
        const requested: string[] = [];
        const base = `https://raw.githubusercontent.com/bytepoem/windy-plugin-sun-moon-path/${manifest.version}/release-notes/`;
        const result = await checkPluginUpdate({
            currentVersion,
            repositoryUrl: 'https://github.com/bytepoem/windy-plugin-sun-moon-path',
            sessionCache: null,
            fetchImpl: async url => {
                const address = String(url);
                requested.push(address);
                if (address.endsWith('/main/package.json')) {
                    return new Response(packageSource, { status: 200 });
                }
                const source = address.startsWith(base)
                    ? sources[`../release-notes/${address.slice(base.length)}`]
                    : undefined;
                return new Response((source as string | undefined) ?? '', { status: source ? 200 : 404 });
            },
        });
        expect(result.status).toBe(currentVersion === manifest.version ? 'current' : 'available');
        expect(result.notesStatus).toBe('loaded');
        expect(result.seriesNotes.map(note => note.version)).toEqual(['0.10.3', '0.10.2', '0.10.1', '0.10.0']);
        expect(requested.slice(1)).toEqual([`${base}0.10.3.json`, `${base}0.10.2.json`, `${base}0.10.1.json`, `${base}0.10.0.json`]);
    });

    for (const [path, source] of Object.entries(sources)) {
        it(`loads ${path} through the production parser`, async () => {
            const notes = JSON.parse(source as string);
            const result = await checkPluginUpdate({
                currentVersion: notes.version,
                repositoryUrl: 'https://github.com/bytepoem/windy-plugin-sun-moon-path',
                betaNotesUrl: 'https://localhost:9999/release-notes/beta.json',
                sessionCache: null,
                fetchImpl: async url => String(url).endsWith('/beta.json')
                    ? new Response(JSON.stringify(notes), { status: 200 })
                    : new Response('', { status: 404 }),
            });
            expect(result.notesStatus).toBe('loaded');
            expect(result.notes).toEqual(notes);
        });
    }
});

import { describe, expect, it } from 'vitest';

import { checkPluginUpdate, compareSemanticVersions } from './pluginUpdate';
import config, { currentVersionReleasedAt } from './pluginConfig';

import formalNotesSource from '../release-notes/0.12.6.json?raw';
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

        expect(notes.version).toBe('0.13.0');
        expect(notes.releasedAt).toBe('2026-11-16');
        // Development notes retain their own version after merging a formal patch release.
        expect(formalNotes.version).toBe('0.12.6');
        expect(formalNotes.zh.items).toHaveLength(1);
        expect(formalNotes.en.items).toHaveLength(1);
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
    const manifest = JSON.parse(packageSource);
    const [major, minor, patch] = manifest.version.split('.').map(Number);
    const currentSeriesVersions = Array.from({ length: patch + 1 }, (_, index) => `${major}.${minor}.${patch - index}`);

    it('keeps published changes out of the next-minor development preview', async () => {
        const result = await checkPluginUpdate({
            currentVersion: manifest.version,
            repositoryUrl: 'https://github.com/bytepoem/windy-plugin-sun-moon-path',
            betaNotesUrl: 'https://localhost:9999/release-notes/beta.json',
            sessionCache: null,
            fetchImpl: async url => {
                const filename = String(url).split('/').at(-1);
                const source = sources[`../release-notes/${filename}`];
                return new Response(source as string | undefined, { status: source ? 200 : 404 });
            },
        });

        expect(result.channel).toBe('beta');
        expect(result.latestVersion).toBe('0.13.0');
        expect(result.notesStatus).toBe('loaded');
        expect(result.seriesNotes.map(notes => notes.version)).toEqual(['0.13.0']);
        for (const language of ['zh', 'en'] as const) {
            const publishedTexts = Object.entries(sources)
                .filter(([path]) => !path.endsWith('/beta.json'))
                .map(([, source]) => JSON.parse(source as string))
                .filter(notes => compareSemanticVersions(notes.version, result.latestVersion) < 0)
                .flatMap(notes => notes[language].items.map((item: { text: string }) => item.text));
            const preview = JSON.parse(betaNotesSource)[language];
            expect(result.notes?.[language]).toEqual(preview);
            for (const item of preview.items) {
                expect(publishedTexts).not.toContain(item.text);
            }
        }
    });

    it('aligns the package, About date and formal release notes', () => {
        const notes = JSON.parse(sources[`../release-notes/${manifest.version}.json`] as string);
        expect(config.version).toBe(manifest.version);
        expect(notes.version).toBe(manifest.version);
        expect(notes.releasedAt).toBe(currentVersionReleasedAt);
        const preview = JSON.parse(betaNotesSource);
        if (preview.version === notes.version) {
            expect(notes.zh).toEqual(preview.zh);
            expect(notes.en).toEqual(preview.en);
        }
    });

    it.each([...new Set(['0.9.1', '0.10.1', '0.10.2', '0.10.3', '0.10.4', '0.11.0', '0.11.1', '0.11.2', '0.11.3', '0.11.4', '0.12.0', '0.12.1', '0.12.2', '0.12.3', '0.12.4', '0.12.5', '0.12.6', manifest.version] as string[])])('loads the full current snapshot for installed %s', async currentVersion => {
        const requested: string[] = [];
        const base = `https://raw.githubusercontent.com/bytepoem/windy-plugin-sun-moon-path/update-metadata/${manifest.version}/`;
        const result = await checkPluginUpdate({
            source: 'github',
            currentVersion,
            repositoryUrl: 'https://github.com/bytepoem/windy-plugin-sun-moon-path',
            sessionCache: null,
            fetchImpl: async url => {
                const address = String(url);
                requested.push(address);
                if (address.endsWith('/latest.json')) {
                    return new Response(JSON.stringify({ ...manifest, notesUrl: `./${manifest.version}/notes.json` }), { status: 200 });
                }
                const seriesNotes = currentSeriesVersions.map(version =>
                    JSON.parse(sources[`../release-notes/${version}.json`] as string));
                return new Response(JSON.stringify({ version: manifest.version, seriesNotes }));
            },
        });
        expect(result.status).toBe(currentVersion === manifest.version ? 'current' : 'available');
        expect(result.notesStatus).toBe('loaded');
        expect(result.seriesNotes.map(note => note.version)).toEqual(currentSeriesVersions);
        expect(requested.slice(1)).toEqual([`${base}notes.json`]);
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

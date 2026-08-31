import { describe, expect, it } from 'vitest';

import formalNotesSource from '../release-notes/0.9.1.json?raw';
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

        expect(notes.version).toBe('0.9.1');
        expect(notes.releasedAt).toBe('2026-08-31');
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

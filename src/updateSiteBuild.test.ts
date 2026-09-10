import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { it, expect } from 'vitest';
import { parseUpdateSnapshot } from './pluginUpdate';

it('generates a complete deploy from real notes without bundling secrets or plugin scripts', async () => {
    const output = await mkdtemp(join(tmpdir(), 'windy-update-site-'));
    try {
        execFileSync(process.execPath, ['scripts/build-update-site.mjs', output]);
        const manifest = JSON.parse(await readFile(join(output, 'latest.json'), 'utf8'));
        const snapshot = JSON.parse(await readFile(join(output, manifest.notesUrl), 'utf8'));
        const notes = parseUpdateSnapshot(snapshot, manifest.version);
        expect(notes.map(note => note.version)).toEqual(['0.10.4', '0.10.3', '0.10.2', '0.10.1', '0.10.0']);
        const previous = JSON.parse(await readFile(join(output, '0.10.3/notes.json'), 'utf8'));
        expect(parseUpdateSnapshot(previous, '0.10.3')).toHaveLength(4);
        expect(manifest.pluginUrl).toBe(`https://windy-plugins.com/17629746/windy-plugin-sun-moon-path/${manifest.version}/plugin.min.js`);
        expect(await readFile(join(output, '_headers'), 'utf8')).toContain('Access-Control-Allow-Origin: *');
        execFileSync(process.execPath, ['scripts/verify-update-site.mjs', output]);
    } finally {
        await rm(output, { recursive: true, force: true });
    }
});

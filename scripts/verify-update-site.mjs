import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkPluginUpdate, updateSourceRoots } from '../src/pluginUpdate.ts';

// Execute the production parser against either generated files or the live public site.
const sourceOption = process.argv.find(value => value.startsWith('--source='));
const source = sourceOption?.split('=')[1] ?? 'gitee';
assert.ok(['gitee', 'github'].includes(source));
const directory = process.argv[2]?.startsWith('--') ? undefined : process.argv[2];
const manifest = JSON.parse(await readFile('package.json', 'utf8'));
const fetchImpl = async (url, options) => {
    if (!directory) return fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
    const path = String(url).slice(updateSourceRoots[source].length).split('?')[0];
    const body = await readFile(`${directory}/${path}`, 'utf8');
    return new Response(source === 'gitee'
        ? JSON.stringify({ type: 'file', encoding: 'base64', path, content: Buffer.from(body).toString('base64') })
        : body);
};
for (const currentVersion of [manifest.version, '0.10.0']) {
    const result = await checkPluginUpdate({ source, currentVersion, repositoryUrl: 'https://github.com/bytepoem/windy-plugin-sun-moon-path', fetchImpl, sessionCache: null });
    assert.equal(result.latestVersion, manifest.version);
    assert.equal(result.notesStatus, 'loaded');
    assert.equal(result.seriesNotes.length, Number(manifest.version.split('.')[2]) + 1);
    console.log(currentVersion, result.status, result.notesStatus, result.seriesNotes.map(note => note.version));
}
if (!directory) {
    const origin = 'https://www.windy.com';
    const response = await fetch(updateSourceRoots[source] + 'latest.json' + (source === 'gitee' ? '?ref=master' : ''), {
        signal: AbortSignal.timeout(20000), headers: { Origin: origin },
    });
    assert.ok(['*', origin].includes(response.headers.get('access-control-allow-origin')));
}

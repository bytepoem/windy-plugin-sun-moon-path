import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkPluginUpdate, updateManifestUrl } from '../src/pluginUpdate.ts';

// Execute the production parser against either generated files or the live public site.
const directory = process.argv[2];
const manifest = JSON.parse(await readFile('package.json', 'utf8'));
const fetchImpl = async (url, options) => {
    if (!directory) return fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
    const path = new URL(url).pathname;
    return new Response(await readFile(`${directory}${path}`));
};
for (const currentVersion of [manifest.version, '0.10.0']) {
    const result = await checkPluginUpdate({ currentVersion, repositoryUrl: 'https://github.com/bytepoem/windy-plugin-sun-moon-path', fetchImpl, sessionCache: null });
    assert.equal(result.latestVersion, manifest.version);
    assert.equal(result.notesStatus, 'loaded');
    assert.equal(result.seriesNotes.length, Number(manifest.version.split('.')[2]) + 1);
    console.log(currentVersion, result.status, result.notesStatus, result.seriesNotes.map(note => note.version));
}
if (!directory) {
    const response = await fetch(updateManifestUrl, { signal: AbortSignal.timeout(20000) });
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
}

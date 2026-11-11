import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { languageManifest } from '../src/languageManifest.ts';

export async function verifyLanguageResources(root, fetchImpl = fetch) {
    const { environment, ...manifest } = JSON.parse(await readFile(root + '/manifest.json', 'utf8'));
    if (environment !== 'release') throw new Error('Only release language resources may be verified online');
    if (JSON.stringify(manifest) !== JSON.stringify(languageManifest)) throw new Error('Unpinned language manifest');
    // Deliberately sequential: avoid bursting the unauthenticated Gitee contents API.
    // Any failure blocks Windy upload; rerun the idempotent publishing workflow later.
    for (const source of ['gitee', 'github']) {
        for (const [code, hash] of Object.entries(manifest.hashes)) {
            const path = `languages/release/${manifest.version}/${code}.json`;
            const url = source === 'gitee'
                ? `https://gitee.com/api/v5/repos/bytepoem/windy-plugin/contents/${path}?ref=master`
                : `https://raw.githubusercontent.com/bytepoem/windy-plugin-sun-moon-path/update-metadata/${path}`;
            const response = await fetchImpl(url, { signal: AbortSignal.timeout(30000), cache: 'no-cache', headers: { Origin: 'https://www.windy.com' } });
            if (!response.ok) throw new Error(`${source}/${code}: HTTP ${response.status}`);
            const origin = response.headers.get('access-control-allow-origin');
            if (origin !== '*' && origin !== 'https://www.windy.com') throw new Error(`${source}/${code}: missing Windy CORS`);
            let text = await response.text();
            if (source === 'gitee') {
                const envelope = JSON.parse(text);
                if (envelope.path !== path || envelope.type !== 'file' || envelope.encoding !== 'base64') throw new Error('Invalid Gitee resource');
                text = Buffer.from(envelope.content.replace(/\s/g, ''), 'base64').toString('utf8');
            }
            if (createHash('sha256').update(text).digest('hex') !== hash) throw new Error(`${source}/${code}: checksum mismatch`);
        }
        console.log(source + ': all 40 immutable language files verified');
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    await verifyLanguageResources(process.argv[2]);
}

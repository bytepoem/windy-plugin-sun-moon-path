import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compareSemanticVersions, parseUpdateSnapshot } from '../src/pluginUpdate.ts';

/** Build a complete static deploy, retaining previously published immutable snapshots. */
export async function buildUpdateSite(outputDirectory) {
    const manifest = JSON.parse(await readFile('package.json', 'utf8'));
    const version = manifest.version;
    if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Formal version required');
    const tags = execFileSync('git', ['tag', '--list'], { encoding: 'utf8' }).trim().split('\n')
        .filter(tag => /^\d+\.\d+\.\d+$/.test(tag)
            && compareSemanticVersions(tag, '0.10.3') >= 0 && compareSemanticVersions(tag, version) < 0);
    for (const target of [...tags, version]) {
        const [major, minor, patch] = target.split('.').map(Number);
        const seriesNotes = [];
        for (let index = patch; index >= 0; index--) {
            const file = `release-notes/${major}.${minor}.${index}.json`;
            const source = target === version ? await readFile(file, 'utf8')
                : execFileSync('git', ['show', `${target}:${file}`], { encoding: 'utf8' });
            seriesNotes.push(JSON.parse(source));
        }
        const snapshot = { version: target, seriesNotes };
        parseUpdateSnapshot(snapshot, target);
        await mkdir(join(outputDirectory, target), { recursive: true });
        await writeFile(join(outputDirectory, target, 'notes.json'), JSON.stringify(snapshot) + '\n');
    }
    const latest = JSON.parse(await readFile(`release-notes/${version}.json`, 'utf8'));
    await writeFile(join(outputDirectory, 'latest.json'), JSON.stringify({
        name: manifest.name, version, releasedAt: latest.releasedAt,
        pluginUrl: `https://windy-plugins.com/17629746/${manifest.name}/${version}/plugin.min.js`,
        notesUrl: `./${version}/notes.json`,
    }) + '\n');
    await writeFile(join(outputDirectory, '_headers'), '/*\n  Access-Control-Allow-Origin: *\n  X-Content-Type-Options: nosniff\n/latest.json\n  Cache-Control: public, max-age=300\n/*/notes.json\n  Cache-Control: public, max-age=31536000, immutable\n');
    await writeFile(join(outputDirectory, 'index.html'), '<!doctype html><meta charset="utf-8"><title>Sun & Moon Path updates</title><a href="latest.json">Latest version JSON</a>');
    return version;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    if (!process.argv[2]) throw new Error('Usage: node scripts/build-update-site.mjs OUTPUT_DIRECTORY');
    console.log('Generated update site', await buildUpdateSite(resolve(process.argv[2])));
}

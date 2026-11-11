import { readFile, readdir } from 'node:fs/promises';
import { gzipSync, gunzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readTranslationSources } from './translation-sources.mjs';

const root = new URL('../', import.meta.url);
const sources = JSON.parse(await readFile(new URL('src/locales/source.en.json', root), 'utf8'));
if (JSON.stringify(sources) !== JSON.stringify(await readTranslationSources())) {
    throw new Error('source.en.json does not match the English message catalogs');
}
const languages = {};
const placeholders = text => (text.match(/\{\{\d+\}\}|\{provider\}/g) ?? []).sort().join('|');
for (const [id, source] of Object.entries(sources)) {
    if (id !== 'm_' + createHash('sha256').update(source).digest('hex').slice(0, 12)) {
        throw new Error('Stale source message ID: ' + id);
    }
}
for (const filename of (await readdir(new URL('src/locales/generated/', root))).sort()) {
    if (!filename.endsWith('.json')) { continue; }
    const language = filename.slice(0, -5);
    const raw = await readFile(new URL('src/locales/generated/' + filename, root), 'utf8');
    const ids = [...raw.matchAll(/^\s*"(m_[a-f0-9]{12})"\s*:/gm)].map(match => match[1]);
    if (ids.length !== new Set(ids).size) { throw new Error('Duplicate message IDs: ' + language); }
    const catalog = JSON.parse(raw);
    if (Object.keys(catalog).sort().join('|') !== Object.keys(sources).sort().join('|')) {
        throw new Error('Mismatched message IDs: ' + language);
    }
    languages[language] = {};
    for (const [id, source] of Object.entries(sources)) {
        const target = catalog[id];
        if (typeof target !== 'string' || !target.trim() || placeholders(source) !== placeholders(target)) {
            throw new Error('Invalid translation: ' + language + '/' + id);
        }
        languages[language][id] = target;
    }
}
if (Object.keys(languages).length !== 40) { throw new Error('Expected 40 translated languages'); }
const packed = gzipSync(JSON.stringify({ sources, languages }), { level: 9 }).toString('base64');
const content = '/** Generated from source.en.json and generated/*.json; see scripts/pack-translations.mjs. */\n'
    + "export const packedTranslations = '" + packed + "';\n";
const target = new URL('src/locales/packedTranslations.ts', root);
if (process.argv.includes('--check')) {
    const existing = (await readFile(target, 'utf8')).match(/export const packedTranslations = '([A-Za-z0-9+/=]+)';/);
    // Verify content, not zlib's encoded bytes: supported Node releases may compress
    // identical catalogs differently while producing equally valid browser resources.
    if (!existing || !isDeepStrictEqual(JSON.parse(gunzipSync(Buffer.from(existing[1], 'base64')).toString()), { sources, languages })) {
        throw new Error('Packed translations are stale');
    }
    console.log('40 catalogs validated; packed translations match source.');
} else {
    // Emit a reviewable patch rather than modifying project files outside apply_patch.
    const previous = await readFile(target, 'utf8');
    console.log('*** Begin Patch\n*** Update File: ' + fileURLToPath(target) + '\n@@\n'
        + previous.trimEnd().split('\n').map(line => '-' + line).join('\n') + '\n'
        + content.trimEnd().split('\n').map(line => '+' + line).join('\n') + '\n*** End Patch');
}

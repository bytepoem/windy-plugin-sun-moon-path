import { readFileSync } from 'node:fs';
import { languageManifest } from '../languageManifest';

/** Serve real generated dictionaries through the production transport envelope. */
export const languageResourceFixture = (url: string | URL | Request): Response => {
    const path = String(url).match(/languages\/[^?]+/)![0];
    const code = path.match(/([^/]+)\.json/)![1];
    const sources: Record<string, string> = JSON.parse(readFileSync('src/locales/source.en.json', 'utf8'));
    const catalog = JSON.parse(readFileSync('src/locales/generated/' + code + '.json', 'utf8'));
    const text = JSON.stringify({ schema: 1, language: code, contract: languageManifest.contract,
        messages: Object.fromEntries(Object.entries(sources).map(([id, source]) => [source, catalog[id]])) }) + '\n';
    return new Response(String(url).includes('gitee.com') ? JSON.stringify({
        type: 'file', encoding: 'base64', path, content: Buffer.from(text).toString('base64'),
    }) : text);
};

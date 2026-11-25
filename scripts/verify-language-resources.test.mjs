import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { languageResources } from './language-resources.mjs';
import { verifyLanguageResources } from './verify-language-resources.mjs';

test('all 40 files on each mirror must match pinned bytes and permit Windy CORS', async () => {
    const root = await mkdtemp(join(tmpdir(), 'language-verify-'));
    try {
        await languageResources(root);
        let requests = 0;
        const fetcher = async url => {
            requests += 1;
            const path = new URL(url).pathname.match(/languages\/.+$/)[0];
            const text = await readFile(join(root, path), 'utf8');
            return new Response(url.includes('gitee.com') ? JSON.stringify({
                type: 'file', encoding: 'base64', path, content: Buffer.from(text).toString('base64'),
            }) : text, { headers: { 'access-control-allow-origin': '*' } });
        };
        await verifyLanguageResources(root, fetcher);
        assert.equal(requests, 80);
        await assert.rejects(verifyLanguageResources(root, async () => new Response('{}')), /CORS/);
        // Gitee actually returns HTTP 200 with [] for the unpublished resource paths.
        // Transport success must never be mistaken for a ready language dictionary.
        await assert.rejects(verifyLanguageResources(root, async () => new Response('[]', {
            headers: { 'access-control-allow-origin': '*' },
        })), /Invalid Gitee resource/);
        await assert.rejects(verifyLanguageResources(root, async () => new Response('unavailable', { status: 429 })), /HTTP 429/);
        await assert.rejects(verifyLanguageResources(root, async url => {
            const response = await fetcher(url);
            return new Response((await response.text()).replace('base64', 'invalid'), { headers: response.headers });
        }), /Invalid Gitee/);
        requests = 0;
        await assert.rejects(verifyLanguageResources(root, async url => {
            const response = await fetcher(url);
            if (url.includes('raw.githubusercontent.com') && url.endsWith('/zh-TW.json')) {
                return new Response((await response.text()) + ' ', { headers: response.headers });
            }
            return response;
        }), /github\/zh-TW: checksum mismatch/);
        assert.equal(requests, 80, 'even a checksum failure in the final file must reject the entire verification');
        await languageResources(root, 'local');
        await assert.rejects(verifyLanguageResources(root, async () => {
            assert.fail('local resources must be rejected before any online request');
        }), /Only release/);
    } finally { await rm(root, { recursive: true }); }
});

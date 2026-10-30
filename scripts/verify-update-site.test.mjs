import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createVerificationFetch, verifyUpdateSite } from './verify-update-site.mjs';
import { updateSourceRoots } from '../src/pluginUpdate.ts';

const notes = JSON.parse(await readFile(new URL('../release-notes/0.12.0.json', import.meta.url)));
const manifest = { name: 'windy-plugin-sun-moon-path', version: '0.12.0', notesUrl: './0.12.0/notes.json' };
const snapshot = { version: '0.12.0', seriesNotes: [notes] };

function response(source, path, value, headers = { 'access-control-allow-origin': '*' }) {
    const body = source === 'gitee'
        ? { type: 'file', encoding: 'base64', path, content: Buffer.from(JSON.stringify(value)).toString('base64') }
        : value;
    return new Response(JSON.stringify(body), { headers });
}

function harness(fetchImpl, options = {}) {
    const logs = [];
    const waits = [];
    const request = createVerificationFetch({
        source: 'gitee', fetchImpl, log: line => logs.push(line),
        sleep: async delay => { waits.push(delay); }, ...options,
    });
    return { request, logs, waits };
}

test('retries a connection reset and reports the source, path and underlying code', async () => {
    let calls = 0;
    const { request, logs, waits } = harness(async () => {
        if (++calls === 1) {
            throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } });
        }
        return response('gitee', '0.12.0/notes.json', snapshot);
    });
    assert.equal((await request(`${updateSourceRoots.gitee}0.12.0/notes.json?ref=master`)).status, 200);
    assert.equal(calls, 2);
    assert.equal(waits.length, 1);
    assert.match(logs.join('\n'), /gitee.*0\.12\.0\/notes\.json.*ECONNRESET/);
});

test('retries transient HTTP failures but stops after the bounded budget', async () => {
    let calls = 0;
    const { request, logs, waits } = harness(async () => {
        calls++;
        return new Response('private upstream body', { status: 503 });
    });
    await assert.rejects(request(`${updateSourceRoots.gitee}latest.json?ref=master`), /HTTP 503/);
    assert.equal(calls, 4);
    assert.equal(waits.length, 3);
    assert.doesNotMatch(logs.join('\n'), /private upstream body/);
});

test('a stalled response body is aborted and retried within the same request deadline', async () => {
    let calls = 0;
    const { request } = harness(async (_url, options) => {
        if (++calls > 1) {
            return response('gitee', 'latest.json', manifest);
        }
        return new Response(new ReadableStream({
            start(controller) {
                options.signal.addEventListener('abort', () => controller.error(options.signal.reason), { once: true });
            },
        }));
    }, { timeoutMs: 10 });
    // Keep the test process alive while AbortSignal.timeout uses its unref'ed timer.
    const keepAlive = setInterval(() => {}, 100);
    try {
        await request(`${updateSourceRoots.gitee}latest.json?ref=master`);
        assert.equal(calls, 2);
    } finally {
        clearInterval(keepAlive);
    }
});

for (const status of [401, 403, 404]) {
    test(`HTTP ${status} fails immediately instead of hiding a permanent publishing error`, async () => {
        let calls = 0;
        const { request, waits } = harness(async () => {
            calls++;
            return new Response('', { status });
        });
        await assert.rejects(request(`${updateSourceRoots.gitee}latest.json?ref=master`), new RegExp(`HTTP ${status}`));
        assert.equal(calls, 1);
        assert.equal(waits.length, 0);
    });
}

test('invalid snapshot content fails with the parser reason and is never retried', async () => {
    let calls = 0;
    const { request, logs } = harness(async () => {
        calls++;
        return response('gitee', '0.12.0/notes.json', { version: '0.12.0', seriesNotes: [] });
    });
    await assert.rejects(request(`${updateSourceRoots.gitee}0.12.0/notes.json?ref=master`), /Incomplete or invalid update snapshot/);
    assert.equal(calls, 1);
    assert.match(logs.join('\n'), /validation/);
});

test('CORS is checked on the notes endpoint as well as the manifest', async () => {
    const { request } = harness(async () => response('gitee', '0.12.0/notes.json', snapshot, {}));
    await assert.rejects(request(`${updateSourceRoots.gitee}0.12.0/notes.json?ref=master`), /CORS/);
});

test('invalid JSON and invalid Gitee envelopes produce explicit non-retryable errors', async () => {
    for (const body of ['private upstream body', JSON.stringify({ type: 'directory' })]) {
        const { request, waits, logs } = harness(async () => new Response(body, { headers: { 'access-control-allow-origin': '*' } }));
        await assert.rejects(request(`${updateSourceRoots.gitee}latest.json?ref=master`), /validation/);
        assert.equal(waits.length, 0);
        assert.doesNotMatch(logs.join('\n'), /private upstream body/);
    }
});

test('429 honors Retry-After within the bounded wait budget', async () => {
    let calls = 0;
    const { request, waits } = harness(async () => ++calls === 1
        ? new Response('', { status: 429, headers: { 'retry-after': '10' } })
        : response('gitee', 'latest.json', manifest));
    await request(`${updateSourceRoots.gitee}latest.json?ref=master`);
    assert.deepEqual(waits, [10000]);
    const limited = harness(async () => new Response('', { status: 429, headers: { 'retry-after': '120' } }));
    await assert.rejects(limited.request(`${updateSourceRoots.gitee}latest.json?ref=master`), /HTTP 429/);
    assert.equal(limited.waits.length, 0);
});

test('a rejected notes payload retains its underlying reason after the UI parser catches it', async () => {
    await assert.rejects(verifyUpdateSite({ source: 'github', version: '0.12.0', log: () => {}, fetchImpl: async url =>
        response('github', '', String(url).endsWith('latest.json') ? manifest : { version: '0.12.0', seriesNotes: [] }),
    }), /github.*0.12.0\/notes.json validation failed: Incomplete or invalid update snapshot/);
});

for (const source of ['gitee', 'github']) {
    test(`${source} verifies current and older clients using the production parser`, async () => {
        const requests = [];
        await verifyUpdateSite({ source, version: '0.12.0', log: () => {}, fetchImpl: async (url, options) => {
            requests.push(String(url));
            assert.equal(options.headers.Origin, 'https://www.windy.com');
            const path = String(url).slice(updateSourceRoots[source].length).split('?')[0];
            return response(source, path, path === 'latest.json' ? manifest : snapshot);
        } });
        assert.equal(requests.length, 4);
    });
}

test('wrong remote versions fail rather than validating another release', async () => {
    await assert.rejects(verifyUpdateSite({
        source: 'github', version: '0.12.1', log: () => {},
        fetchImpl: async url => response('github', '', String(url).endsWith('latest.json') ? manifest : snapshot),
    }), /Expected version 0.12.1/);
});

test('manifest semantic errors do not expose upstream fields in logs, errors or causes', async () => {
    const logs = [];
    await assert.rejects(verifyUpdateSite({
        source: 'github', version: '0.12.0', log: line => logs.push(line),
        fetchImpl: async () => response('github', '', { ...manifest, version: 'PRIVATE_UPSTREAM_VALUE' }),
    }), error => {
        assert.match(error.message, /Invalid manifest version/);
        assert.doesNotMatch(error.message, /PRIVATE_UPSTREAM_VALUE/);
        assert.equal(error.cause, undefined);
        return true;
    });
    assert.doesNotMatch(logs.join('\n'), /PRIVATE_UPSTREAM_VALUE/);
});

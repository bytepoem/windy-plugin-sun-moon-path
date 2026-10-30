import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { checkPluginUpdate, fetchUpdateJson, parseUpdateSnapshot, updateSourceRoots } from '../src/pluginUpdate.ts';

const origin = 'https://www.windy.com';
const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);
const retryableCodes = new Set([
    'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN',
    'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT',
]);

/** Read-only retries belong to release verification, never to upload or schema validation. */
export function createVerificationFetch({ source, fetchImpl = fetch, log = console.log, sleep: wait = sleep, timeoutMs = 20000 }) {
    return async (url, options = {}) => {
        assert.ok(String(url).startsWith(updateSourceRoots[source]), 'Unexpected update origin');
        const path = String(url).slice(updateSourceRoots[source].length).split('?')[0];
        assert.match(path, /^(latest\.json|\d+\.\d+\.\d+\/notes\.json)$/);
        const attempts = 4;
        for (let attempt = 1; attempt <= attempts; attempt++) {
            const started = Date.now();
            let response;
            let body;
            let status;
            let retryable = false;
            let retryAfterMs = 0;
            try {
                const deadline = AbortSignal.timeout(timeoutMs);
                response = await fetchImpl(url, {
                    ...options,
                    signal: options.signal ? AbortSignal.any([options.signal, deadline]) : deadline,
                    headers: { ...options.headers, Origin: origin },
                });
                status = response.status;
                if (!response.ok) {
                    retryable = retryableStatuses.has(status);
                    const retryAfter = response.headers.get('retry-after');
                    if (retryAfter) {
                        retryAfterMs = /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now();
                        // Do not retry earlier than the server allows or wait without a bound.
                        if (retryAfterMs > 30000) {
                            retryable = false;
                        }
                    }
                    await response.body?.cancel();
                    throw new Error(`HTTP ${status}`);
                }
                // Consume the body within the deadline: fetch() alone only waits for headers.
                body = await response.text();
            } catch (error) {
                const code = error.cause?.code ?? error.code;
                retryable ||= error.name === 'TimeoutError' || retryableCodes.has(code);
                if (options.signal?.aborted) {
                    retryable = false;
                }
                const detail = status && status !== 200 ? `HTTP ${status}` : `${error.name}${code ? ` ${code}` : ''}`;
                log(`[${source}] ${path} attempt=${attempt}/${attempts} stage=request status=${status ?? '-'} elapsedMs=${Date.now() - started} error=${detail}`);
                if (!retryable || attempt === attempts) {
                    throw new Error(`[${source}] ${path} request failed: ${detail}`, { cause: error });
                }
                const delay = Math.max(2000 * 2 ** (attempt - 1), Number.isFinite(retryAfterMs) ? retryAfterMs : 0);
                log(`[${source}] ${path} retryInMs=${delay}`);
                await wait(delay);
                continue;
            }

            const buffered = () => new Response(body, { status, headers: response.headers });
            try {
                assert.ok(['*', origin].includes(response.headers.get('access-control-allow-origin')), 'CORS does not allow Windy');
                // Surface the production parser's actual error before the UI turns it into notesStatus=error.
                const value = await fetchUpdateJson(source, path, async () => buffered());
                if (path.endsWith('/notes.json')) {
                    parseUpdateSnapshot(value, path.split('/')[0]);
                }
            } catch (error) {
                // JSON parser messages can quote an upstream response body; keep those out of CI logs.
                const knownReasons = new Set([
                    'CORS does not allow Windy', 'Invalid Gitee file response',
                    'Invalid update snapshot version', 'Incomplete or invalid update snapshot',
                ]);
                const detail = error instanceof SyntaxError ? 'Invalid JSON response'
                    : knownReasons.has(error.message) ? error.message : 'Invalid update data';
                log(`[${source}] ${path} attempt=${attempt}/${attempts} stage=validation status=${status} elapsedMs=${Date.now() - started} error=${detail}`);
                throw new Error(`[${source}] ${path} validation failed: ${detail}`);
            }
            log(`[${source}] ${path} attempt=${attempt}/${attempts} status=${status} elapsedMs=${Date.now() - started} validated`);
            return buffered();
        }
        throw new Error('Verification request exhausted');
    };
}

/** Exercise current and upgrading clients through the unchanged production update parser. */
export async function verifyUpdateSite({ source, version, directory, fetchImpl = fetch, log = console.log }) {
    assert.ok(['gitee', 'github'].includes(source), 'Unknown update source');
    const request = directory ? async url => {
        const path = String(url).slice(updateSourceRoots[source].length).split('?')[0];
        const body = await readFile(resolve(directory, path), 'utf8');
        return new Response(source === 'gitee'
            ? JSON.stringify({ type: 'file', encoding: 'base64', path, content: Buffer.from(body).toString('base64') })
            : body);
    } : createVerificationFetch({ source, fetchImpl, log });
    for (const currentVersion of [version, '0.10.0']) {
        let requestFailure;
        let result;
        try {
            result = await checkPluginUpdate({
                source, currentVersion, repositoryUrl: 'https://github.com/bytepoem/windy-plugin-sun-moon-path', sessionCache: null,
                fetchImpl: async (url, options) => {
                    try {
                        return await request(url, options);
                    } catch (error) {
                        requestFailure = error;
                        throw error;
                    }
                },
            });
        } catch (error) {
            if (requestFailure) {
                throw requestFailure;
            }
            // Domain errors may embed upstream fields; report a fixed reason without a raw cause.
            const detail = error.message.startsWith('Invalid semantic version:')
                ? 'Invalid manifest version' : 'Invalid update manifest or notes reference';
            log(`[${source}] stage=validation error=${detail}`);
            throw new Error(`[${source}] ${detail}`);
        }
        if (requestFailure) {
            throw requestFailure;
        }
        assert.equal(result.latestVersion, version, `Expected version ${version}, received ${result.latestVersion}`);
        assert.equal(result.notesStatus, 'loaded', `[${source}] ${currentVersion}: notes not loaded`);
        assert.equal(result.seriesNotes.length, Number(version.split('.')[2]) + 1);
        assert.equal(result.status, currentVersion === version ? 'current' : 'available');
        log(`[${source}] ${currentVersion} ${result.status} ${result.notesStatus} series=${result.seriesNotes.map(note => note.version).join(',')}`);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const source = process.argv.find(value => value.startsWith('--source='))?.split('=')[1] ?? 'gitee';
    const directory = process.argv[2]?.startsWith('--') ? undefined : process.argv[2];
    const manifest = JSON.parse(await readFile('package.json', 'utf8'));
    await verifyUpdateSite({ source, version: manifest.version, directory });
}

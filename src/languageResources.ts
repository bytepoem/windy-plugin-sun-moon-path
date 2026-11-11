import { languageManifest as manifest } from './languageManifest';
import type { UiLanguage } from './uiLanguage';

type RemoteLanguage = keyof typeof manifest.hashes;
// Build mode owns environment selection; the URL used to serve a bundle cannot change it.
let environment: 'local' | 'release' = 'release';
const pending = new Map<string, { controller: AbortController; promise: Promise<Map<string, string>>; users: number; timeout: ReturnType<typeof setTimeout> }>();
let location: { source?: string; cc?: string } | null | undefined;
export const configureLanguageLocation = (value: typeof location, local = false) => {
    location = value;
    environment = local ? 'local' : 'release';
};
const digest = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), byte => byte.toString(16).padStart(2, '0')).join('');
const placeholders = (text: string) => (text.match(/\{\{\d+\}\}|\{provider\}/g) ?? []).sort().join('|');

/** Validate both pinned bytes and the message contract before any cache or UI mutation. */
export const validateLanguageResource = async (text: string, language: RemoteLanguage): Promise<Map<string, string>> => {
    if (await digest(text) !== manifest.hashes[language]) { throw new Error('Language checksum mismatch'); }
    const payload = JSON.parse(text);
    if (payload.schema !== 1 || payload.language !== language || payload.contract !== manifest.contract
        || !payload.messages || typeof payload.messages !== 'object') { throw new Error('Invalid language metadata'); }
    const entries = Object.entries(payload.messages);
    if (entries.length !== manifest.count || await digest(JSON.stringify(entries.map(([source]) => source).sort())) !== manifest.contract) {
        throw new Error('Incomplete language resource');
    }
    for (const [source, target] of entries) {
        if (typeof target !== 'string' || !target.trim() || placeholders(source) !== placeholders(target)) { throw new Error('Invalid language message'); }
    }
    return new Map(entries as [string, string][]);
};

/** Separate transport from update logs: only immutable language paths are accepted. */
const download = async (language: RemoteLanguage, signal: AbortSignal): Promise<string> => {
    const path = 'languages/' + environment + '/' + manifest.version + '/' + language + '.json';
    const local = environment === 'local';
    const github = location?.source === 'ip' && /^[a-z]{2}$/i.test(location.cc ?? '') && location.cc?.toLowerCase() !== 'cn';
    const url = local ? 'https://localhost:9999/' + path : github
        ? 'https://raw.githubusercontent.com/bytepoem/windy-plugin-sun-moon-path/update-metadata/' + path
        : 'https://gitee.com/api/v5/repos/bytepoem/windy-plugin/contents/' + path + '?ref=master';
    const response = await fetch(url, { signal, credentials: 'omit' });
    if (!response.ok) { throw new Error('Language request failed: ' + response.status); }
    const text = await response.text();
    if (local || github) { return text; }
    const envelope = JSON.parse(text);
    if (envelope.type !== 'file' || envelope.encoding !== 'base64' || envelope.path !== path || typeof envelope.content !== 'string') {
        throw new Error('Invalid Gitee language response');
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(envelope.content.replace(/\s/g, '')), character => character.charCodeAt(0)));
};

/** Deduplicate active requests. Each caller owns its cancellation; the last departing
 * caller aborts transport. Storage failure never prevents a validated session load. */
export const loadLanguageResource = async (language: UiLanguage, signal?: AbortSignal): Promise<Map<string, string>> => {
    if (!Object.hasOwn(manifest.hashes, language)) { throw new Error('Not a remote language'); }
    signal?.throwIfAborted();
    const code = language as RemoteLanguage;
    const key = 'sun-path:language:' + environment + ':' + manifest.version + ':' + language;
    let entry = pending.get(key);
    if (!entry || entry.controller.signal.aborted) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        const promise = (async () => {
            let cached: string | null = null;
            try { cached = localStorage.getItem(key); } catch { /* Storage can be blocked. */ }
            if (cached) {
                try { return await validateLanguageResource(cached, code); } catch { /* Ignore invalid cached bytes. */ }
            }
            controller.signal.throwIfAborted();
            const text = await download(code, controller.signal);
            const messages = await validateLanguageResource(text, code);
            controller.signal.throwIfAborted();
            try { localStorage.setItem(key, text); } catch { /* Session remains usable without persistence. */ }
            return messages;
        })();
        entry = { controller, promise, users: 0, timeout };
        pending.set(key, entry);
        const created = entry;
        void promise.finally(() => {
            clearTimeout(timeout);
            if (pending.get(key) === created) { pending.delete(key); }
        }).catch(() => undefined);
    }
    entry.users += 1;
    const owned = entry;
    return new Promise((resolve, reject) => {
        let settled = false;
        function finish(error: unknown, messages?: Map<string, string>) {
            if (settled) { return; }
            settled = true;
            signal?.removeEventListener('abort', abort);
            owned.users -= 1;
            if (owned.users === 0) {
                clearTimeout(owned.timeout);
                owned.controller.abort();
            }
            if (error) { reject(error); } else { resolve(messages!); }
        }
        function abort() { finish(new DOMException('Language load cancelled', 'AbortError')); }
        signal?.addEventListener('abort', abort, { once: true });
        owned.promise.then(messages => finish(null, messages), error => finish(error));
        if (signal?.aborted) { abort(); }
    });
};

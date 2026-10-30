import { ObservationPlannerError, type TimeZoneDiagnosticDetails } from './observationTimeZone';

/** Bounded, in-memory diagnostics. Only allowlisted state and sanitized errors leave this module. */
export type DiagnosticStage = 'construct' | 'mount' | 'dom' | 'open' | 'galactic'
    | 'astronomy' | 'map' | 'weather' | 'atmosphere' | 'clouds' | 'light-pollution' | 'update' | 'runtime' | 'comparison';
export type DiagnosticState = 'starting' | 'mounted' | 'ready' | 'failed' | 'closed';
export type DiagnosticContext = {
    tab?: 'events' | 'weather' | 'clouds' | 'settings' | 'about';
    view?: 'obstruction' | 'rainbow' | 'horizon' | 'tide';
    mode?: 'desktop' | 'collapsed' | 'compact' | 'fullscreen';
    source?: 'windy' | 'open-meteo';
    astronomy?: string;
    weather?: string;
    atmosphere?: string;
    clouds?: string;
};
export type DiagnosticBuild = { id: string; commit: string; local: boolean };
export type DiagnosticError = {
    name: string; message: string; frames: string[];
    code?: 'TIME_ZONE_INVALID' | 'TIME_ZONE_UNAVAILABLE';
    details?: TimeZoneDiagnosticDetails;
};
type DiagnosticEntry = { elapsedMs: number; stage: DiagnosticStage; result: string; operation: number };
export type DiagnosticEvent = {
    event: 'plugin_start_failed' | 'plugin_runtime_error' | 'plugin_ui_incomplete';
    properties: {
        diagnostic_schema: number;
        build_id: string;
        instance_id: string;
        stage: DiagnosticStage;
        operation: number;
        fingerprint: string;
        error: DiagnosticError;
        context: DiagnosticContext;
        state: DiagnosticState;
        elapsedMs: number;
        breadcrumbs: DiagnosticEntry[];
    };
};

const MAX_ENTRIES = 80;
const MAX_ERRORS = 20;
const MAX_UPLOADED_ENTRIES = 10;
let serial = 0;

/** Independent of crypto.randomUUID, storage, network, Intl and the main component. */
export const diagnosticId = () => `${Date.now().toString(36)}-${++serial}-${Math.random().toString(36).slice(2, 10)}`;

/** Do not upload arbitrary exception text: URLs, coordinates, keys and search text can all occur there. */
export const sanitizeDiagnosticError = (value: unknown): DiagnosticError => {
    try {
        const error = value instanceof Error ? value : null;
        const name = error && /^(?:Error|TypeError|RangeError|ReferenceError|SyntaxError|ObservationPlannerError)$/.test(error.name)
            ? error.name : 'Error';
        const rawMessage = error?.message ?? '';
        const messages: [RegExp, string][] = [
            [/Unable to resolve local date/, 'Unable to resolve local date [redacted]'],
            [/Invalid calendar date/, 'Invalid calendar date [redacted]'],
            [/TIME_ZONE_UNAVAILABLE/, 'TIME_ZONE_UNAVAILABLE'],
            [/TIME_ZONE_INVALID/, 'TIME_ZONE_INVALID'],
            [/Cannot read (?:properties|property) of (?:undefined|null)/, 'Cannot read property of null or undefined'],
            [/is not a function/, 'Value is not a function'],
            [/is not defined/, 'Reference is not defined'],
            [/Failed to fetch|NetworkError|Load failed/, 'Network request failed'],
            [/Windy map center is unavailable/, 'Windy map center is unavailable'],
            [/^Startup did not complete within visible-time budget$/, 'Startup did not complete within visible-time budget'],
        ];
        const message = messages.find(([pattern]) => pattern.test(rawMessage))?.[1]
            ?? 'Message omitted to protect private data';
        // Keep only generated bundle locations. Never retain function arguments or URL query strings.
        const frames = [...(error?.stack ?? '').matchAll(/(?:\/|\b)(plugin(?:\.min)?\.js):(\d+):(\d+)\b/g)]
            .slice(0, 12).map(match => `${match[1]}:${match[2]}:${match[3]}`);
        const safe: DiagnosticError = { name, message, frames };
        if (error instanceof ObservationPlannerError
            && ['TIME_ZONE_INVALID', 'TIME_ZONE_UNAVAILABLE'].includes(error.code)) {
            safe.code = error.code;
            const details = error.details;
            // Copy individual fields only after validation; never spread an exception payload.
            if (details?.step === 'timezone_validation'
                && ['empty', 'unexpected_type', 'nautical_label', 'intl_rejected'].includes(details.reason)
                && ['string', 'null', 'undefined', 'other'].includes(details.inputType)
                && typeof details.hasNauticalPrefix === 'boolean'
                && typeof details.rawIntlSupported === 'boolean'
                && typeof details.normalizedIntlSupported === 'boolean') {
                safe.details = {
                    step: details.step, reason: details.reason, inputType: details.inputType,
                    hasNauticalPrefix: details.hasNauticalPrefix,
                    rawIntlSupported: details.rawIntlSupported,
                    normalizedIntlSupported: details.normalizedIntlSupported,
                };
            }
        }
        return safe;
    } catch {
        return { name: 'Error', message: 'Unreadable exception', frames: [] };
    }
};

const CONTEXT_VALUES: Record<keyof DiagnosticContext, ReadonlyArray<string>> = {
    tab: ['events', 'weather', 'clouds', 'settings', 'about'],
    view: ['obstruction', 'rainbow', 'horizon', 'tide'],
    mode: ['desktop', 'collapsed', 'compact', 'fullscreen'],
    source: ['windy', 'open-meteo'],
    astronomy: ['idle', 'loading', 'ready', 'empty', 'error'],
    weather: ['idle', 'loading', 'ready', 'empty', 'error'],
    atmosphere: ['idle', 'loading', 'ready', 'empty', 'error'],
    clouds: ['idle', 'loading', 'ready', 'empty', 'error'],
};

export const createPluginDiagnostics = (options: {
    build: DiagnosticBuild;
    version: string;
    sessionId?: string;
    now?: () => number;
    send?: (event: DiagnosticEvent) => void;
}) => {
    const now = options.now ?? (() => performance.now());
    const started = now();
    const instanceId = diagnosticId();
    const sessionId = options.sessionId ?? diagnosticId();
    let state: DiagnosticState = 'starting';
    let context: DiagnosticContext = {};
    let sequence = 0;
    const seen = new Set<string>();
    const seenErrors = new WeakSet<object>();
    const errors: { stage: DiagnosticStage; operation: number; error: DiagnosticError; fingerprint: string }[] = [];
    const entries: DiagnosticEntry[] = [];
    const record = (stage: DiagnosticStage, result: string, operation = 0) => {
        if (state === 'closed' || state === 'failed') { return; }
        entries.push({ elapsedMs: Math.max(0, Math.round(now() - started)), stage, result, operation });
        if (entries.length > MAX_ENTRIES) { entries.shift(); }
    };
    record('construct', 'start');

    return {
        sessionId,
        instanceId,
        get state() { return state; },
        context(next: DiagnosticContext) {
            if (state === 'closed' || state === 'failed') { return; }
            const safe: DiagnosticContext = {};
            for (const key of Object.keys(CONTEXT_VALUES) as (keyof DiagnosticContext)[]) {
                const value = next[key];
                if (value !== undefined && CONTEXT_VALUES[key].includes(value)) {
                    Object.assign(safe, { [key]: value });
                }
            }
            context = safe;
        },
        begin(stage: DiagnosticStage) {
            const operation = ++sequence;
            record(stage, 'start', operation);
            return operation;
        },
        end(stage: DiagnosticStage, operation: number, result: 'ready' | 'empty' | 'cancelled' = 'ready') {
            record(stage, result, operation);
        },
        mounted() {
            if (state !== 'starting') { return; }
            state = 'mounted';
            record('mount', 'ready');
        },
        dom(visible: boolean, complete: boolean) {
            if (state !== 'mounted') { return; }
            if (!visible) { record('dom', 'hidden'); return; }
            record('dom', complete ? 'ready' : 'incomplete');
            if (complete) { state = 'ready'; }
        },
        error(stage: DiagnosticStage, value: unknown, operation = 0, fatal = false) {
            if (state === 'closed' || state === 'failed') { return; }
            if (value !== null && typeof value === 'object') {
                if (!fatal && seenErrors.has(value)) { return; }
                seenErrors.add(value);
            }
            const error = sanitizeDiagnosticError(value);
            const fingerprint = `${stage}|${error.name}|${error.message}|${error.frames[0] ?? ''}|${error.details?.reason ?? ''}`;
            if (seen.has(fingerprint) || errors.length >= MAX_ERRORS) {
                if (fatal) { state = 'failed'; }
                return;
            }
            seen.add(fingerprint);
            errors.push({ stage, operation, error, fingerprint });
            record(stage, 'error', operation);
            if (fatal) { state = 'failed'; }
            try {
                options.send?.({
                    event: fatal ? 'plugin_start_failed' : stage === 'dom' ? 'plugin_ui_incomplete' : 'plugin_runtime_error',
                    properties: {
                        diagnostic_schema: 2, build_id: options.build.id, instance_id: instanceId,
                        stage, operation, fingerprint, error, context: { ...context },
                        state, elapsedMs: Math.max(0, Math.round(now() - started)),
                        breadcrumbs: entries.slice(-MAX_UPLOADED_ENTRIES).map(entry => ({ ...entry })),
                    },
                });
            } catch { /* Diagnostics transport must never change application behavior. */ }
        },
        close() {
            if (state === 'closed') { return; }
            record('runtime', 'closed');
            state = 'closed';
        },
        report(environment: Record<string, unknown> = {}) {
            return JSON.stringify({
                schema: 2, version: options.version, build: options.build,
                sessionId, instanceId, state, context, environment, entries, errors,
            }, null, 2);
        },
    };
};

export type PluginDiagnostics = ReturnType<typeof createPluginDiagnostics>;

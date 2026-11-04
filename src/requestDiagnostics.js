// @ts-check
// Shared with the native Node update-site tools as well as the browser bundle.
/** Fixed categories identify a request without retaining its URL, coordinates or response. */
const REQUESTS = /** @type {const} */ (['windy-weather', 'windy-timezone', 'open-meteo-weather', 'open-meteo-aod', 'open-meteo-visibility',
    'light-pollution', 'update-manifest', 'update-notes']);
const PHASES = /** @type {const} */ (['request', 'response', 'parse', 'decompress']);
const FAILURES = /** @type {const} */ (['cancelled', 'abort', 'timeout', 'network', 'http', 'parse', 'decompress', 'unknown']);
/** @typedef {typeof REQUESTS[number]} DiagnosticRequest */
/** @typedef {typeof PHASES[number]} RequestPhase */
/** @typedef {{request: DiagnosticRequest, phase: RequestPhase, kind: typeof FAILURES[number], status?: number}} RequestFailureDetails */

/**
 * DOMException is not an Error in every browser. Never accept arbitrary thrown objects.
 * @param {unknown} value
 * @returns {Error | DOMException | null}
 */
export const diagnosticException = value =>
    value instanceof Error || (typeof DOMException !== 'undefined' && value instanceof DOMException) ? value : null;

/** Carries private cause locally; only validated categories may enter a diagnostic payload. */
export class RequestFailure extends Error {
    /**
     * @param {unknown} cause
     * @param {DiagnosticRequest} request
     * @param {RequestPhase} phase
     * @param {AbortSignal} [signal]
     * @param {number} [status]
     */
    constructor(cause, request, phase, signal, status) {
        const original = diagnosticException(cause);
        super(original?.message ?? 'Request failed', { cause });
        this.name = original?.name ?? 'Error';
        /** @type {RequestFailureDetails} */
        this.requestDetails = {
            request, phase,
            kind: signal?.aborted ? 'cancelled'
                : this.name === 'AbortError' ? 'abort'
                : this.name === 'TimeoutError' ? 'timeout'
                : status !== undefined ? 'http'
                // Chromium may use "Failed to fetch" for invalid gzip bytes. This
                // phase only reads local bytes, so the failure cannot be a download.
                : phase === 'decompress' ? 'decompress'
                : this.name === 'NetworkError' || /Failed to fetch|NetworkError|Load failed/.test(this.message) ? 'network'
                : phase === 'parse' ? 'parse'
                : 'unknown',
            ...(status !== undefined ? { status } : {}),
        };
        // Retain the original bundle frames when available, including the abort initiator.
        if (original?.stack) { this.stack = original.stack; }
    }
}

/**
 * Check cancellation on both sides even if a provider ignores the supplied signal.
 * @template Value
 * @param {DiagnosticRequest} request
 * @param {RequestPhase} phase
 * @param {AbortSignal | undefined} signal
 * @param {() => Promise<Value>} operation
 * @returns {Promise<Value>}
 */
export const withRequestDiagnostics = async (request, phase, signal, operation) => {
    try {
        signal?.throwIfAborted();
        const result = await operation();
        signal?.throwIfAborted();
        return result;
    } catch (error) {
        if (error instanceof RequestFailure) { throw error; }
        throw new RequestFailure(error, request, phase, signal);
    }
};

/**
 * Copy and validate every field; a mutated exception must not bypass the privacy boundary.
 * @param {unknown} value
 * @returns {RequestFailureDetails | undefined}
 */
export const safeRequestFailureDetails = value => {
    if (!(value instanceof RequestFailure)) { return undefined; }
    const details = value.requestDetails;
    if (!details || !REQUESTS.includes(details.request) || !PHASES.includes(details.phase)
        || !FAILURES.includes(details.kind)) { return undefined; }
    const status = details.status;
    return {
        request: details.request, phase: details.phase, kind: details.kind,
        ...(typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599 ? { status } : {}),
    };
};

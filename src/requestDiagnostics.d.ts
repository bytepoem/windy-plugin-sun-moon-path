/** Shared declarations for the browser and native Node request-diagnostics module. */
export type DiagnosticRequest = 'windy-weather' | 'windy-timezone' | 'open-meteo-weather' | 'open-meteo-aod'
    | 'open-meteo-visibility' | 'light-pollution' | 'update-manifest' | 'update-notes';
export type RequestPhase = 'request' | 'response' | 'parse' | 'decompress';
export type RequestFailureDetails = {
    request: DiagnosticRequest;
    phase: RequestPhase;
    kind: 'cancelled' | 'abort' | 'timeout' | 'network' | 'http' | 'parse' | 'decompress' | 'unknown';
    status?: number;
};
export function diagnosticException(value: unknown): Error | DOMException | null;
export class RequestFailure extends Error {
    readonly requestDetails: RequestFailureDetails;
    constructor(cause: unknown, request: DiagnosticRequest, phase: RequestPhase, signal?: AbortSignal, status?: number);
}
export function withRequestDiagnostics<Value>(request: DiagnosticRequest, phase: RequestPhase,
    signal: AbortSignal | undefined, operation: () => Promise<Value>): Promise<Value>;
export function safeRequestFailureDetails(value: unknown): RequestFailureDetails | undefined;

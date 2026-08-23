let requestSequence = 0;
const CALLBACK_REGISTRY_NAME = '__windySunPathJsonpCallbacks';
const ignoreLateResponse = () => undefined;

type JsonpCallbackRegistry = Record<string, (payload: unknown) => void>;

const getCallbackRegistry = (): JsonpCallbackRegistry => {
    const callbackTarget = window as unknown as Record<string, unknown>;
    const existingRegistry = callbackTarget[CALLBACK_REGISTRY_NAME];
    if (existingRegistry && typeof existingRegistry === 'object') {
        return existingRegistry as JsonpCallbackRegistry;
    }

    const callbacks = Object.create(null) as JsonpCallbackRegistry;
    const registry = new Proxy(callbacks, {
        get: (target, property) => {
            if (typeof property !== 'string') {
                return Reflect.get(target, property);
            }
            return Object.prototype.hasOwnProperty.call(target, property)
                ? target[property]
                : ignoreLateResponse;
        },
    });
    callbackTarget[CALLBACK_REGISTRY_NAME] = registry;
    return registry;
};

export const requestJsonp = <T>({
    url,
    signal,
    callbackParameter = 'callback',
    timeoutMs = 10_000,
}: {
    url: URL;
    signal?: AbortSignal;
    callbackParameter?: string;
    timeoutMs?: number;
}): Promise<T> => new Promise((resolve, reject) => {
    if (signal?.aborted) {
        reject(new DOMException('Request aborted', 'AbortError'));
        return;
    }

    requestSequence += 1;
    const callbackId = `request_${Date.now()}_${requestSequence}`;
    const callbackName = `${CALLBACK_REGISTRY_NAME}.${callbackId}`;
    const callbackRegistry = getCallbackRegistry();
    const script = document.createElement('script');
    let settled = false;
    let cleanup = () => undefined;

    const finish = (action: () => void) => {
        if (settled) {
            return;
        }
        settled = true;
        cleanup();
        action();
    };

    const handleAbort = () => finish(() => reject(new DOMException('Request aborted', 'AbortError')));
    const timeout = setTimeout(() => finish(() => reject(new Error('REQUEST_TIMEOUT'))), timeoutMs);
    cleanup = () => {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', handleAbort);
        script.onerror = null;
        script.remove();
        delete callbackRegistry[callbackId];
    };

    callbackRegistry[callbackId] = (payload: unknown) => finish(() => resolve(payload as T));
    url.searchParams.set(callbackParameter, callbackName);
    script.async = true;
    script.src = url.toString();
    script.onerror = () => finish(() => reject(new Error('JSONP_LOAD_FAILED')));
    signal?.addEventListener('abort', handleAbort, { once: true });
    document.head.appendChild(script);
});

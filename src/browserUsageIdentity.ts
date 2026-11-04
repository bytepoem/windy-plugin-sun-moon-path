const STORAGE_KEY = 'sun-moon-path-usage-browser-id-v1';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PENDING_EVENTS = 16;

/** Own consented browser identity access and cancellable cross-tab creation. */
export const createBrowserUsageIdentity = (isAllowed: () => boolean) => {
    let controller = new AbortController();
    let pending = 0;
    let disposed = false;
    const allowed = () => !disposed && isAllowed();
    const read = () => {
        const value = localStorage.getItem(STORAGE_KEY);
        return value && UUID_PATTERN.test(value) ? value : null;
    };
    const cancel = () => {
        controller.abort();
        controller = new AbortController();
    };

    return {
        /** No temporary fallback: an unpersisted ID must never count as a browser. */
        send(send: (browserId: string) => void) {
            if (!allowed()) { return; }
            try {
                const existing = read();
                if (existing) {
                    send(existing);
                    return;
                }
                if (!navigator.locks || pending >= MAX_PENDING_EVENTS) { return; }
                const signal = controller.signal;
                pending++;
                void navigator.locks.request(STORAGE_KEY, { signal }, () => {
                    if (signal.aborted || !allowed()) { return; }
                    let browserId = read();
                    if (!browserId) {
                        browserId = crypto.randomUUID();
                        localStorage.setItem(STORAGE_KEY, browserId);
                    }
                    send(browserId);
                }).catch(() => {
                    // Blocked storage/locks are excluded; nothing is replayed later.
                }).finally(() => { pending--; });
            } catch { /* Storage denial or event transport failure cannot interrupt use. */ }
        },
        /** Deletion/replacement in another tab invalidates this runtime as well. */
        wasInvalidated(event: StorageEvent) {
            try {
                return event.storageArea === localStorage
                    && (event.key === null || (event.key === STORAGE_KEY
                        && (event.newValue === null || (event.oldValue !== null && event.newValue !== event.oldValue))));
            } catch { return false; }
        },
        revoke() {
            cancel();
            try { localStorage.removeItem(STORAGE_KEY); } catch { /* Deletion can be denied by the browser. */ }
        },
        cancel,
        destroy() {
            disposed = true;
            controller.abort();
        },
    };
};

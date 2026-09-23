const SITE_ID = '1bc918b521d751eba5d2d965e88caf3b';
const PAGE_PATH = '/plugins/sun-moon-path/usage';
const SDK_LOAD_TIMEOUT_MS = 10_000;

type Command = [string, ...Array<string | number | boolean>];
type AnalyticsWindow = Window & {
    Image: typeof Image;
    _hmt?: { push: (command: Command) => unknown };
};

/**
 * Owns a disposable SDK document, not Windy's global _hmt. Destroying the iframe
 * releases the SDK's private timers/listeners as well as our load handlers.
 */
export const createBaiduUsageTransport = (isAllowed: () => boolean) => {
    let frame: HTMLIFrameElement | null = null;
    let script: HTMLScriptElement | null = null;
    let loadTimeout: ReturnType<typeof setTimeout> | null = null;
    let ready = false;
    let disposed = false;
    let pendingOpen = false;
    const pixels = new Map<HTMLImageElement, () => void>();

    const clearPendingRequests = () => {
        // Never replay failed requests after a close, remount or consent change.
        try { frame?.contentWindow?.sessionStorage.removeItem(`Hm_unsent_${SITE_ID}`); } catch { /* Storage may be blocked. */ }
    };

    const cancelLoad = () => {
        if (loadTimeout !== null) {
            clearTimeout(loadTimeout);
            loadTimeout = null;
        }
        if (script) {
            script.onload = null;
            script.onerror = null;
        }
    };

    const destroy = () => {
        disposed = true;
        ready = false;
        pendingOpen = false;
        cancelLoad();
        const context = frame?.contentWindow as AnalyticsWindow | null;
        try { context?._hmt?.push(['_setAutoTracking', false]); } catch { /* An unavailable SDK is harmless. */ }
        clearPendingRequests();
        // Already-submitted pixels may finish, but cannot call into a closed SDK.
        pixels.forEach((release, pixel) => {
            pixel.onload = null;
            pixel.onerror = null;
            release();
        });
        frame?.remove();
        frame = null;
        script = null;
    };

    const report = () => {
        if (!ready || disposed || !isAllowed()) {
            return;
        }
        const commands = (frame?.contentWindow as AnalyticsWindow | null)?._hmt;
        if (!commands) {
            return;
        }
        try {
            // Keep automatic reporting disabled between our synchronous commands.
            commands.push(['_setAutoTracking', true]);
            commands.push(['_trackPageview', PAGE_PATH]);
        } finally {
            commands.push(['_setAutoTracking', false]);
            clearPendingRequests();
        }
    };

    const load = () => {
        frame = document.createElement('iframe');
        frame.hidden = true;
        frame.title = 'Plugin usage statistics';
        frame.setAttribute('aria-hidden', 'true');
        frame.referrerPolicy = 'no-referrer';
        document.body.appendChild(frame);
        const context = frame.contentWindow as AnalyticsWindow | null;
        const frameDocument = frame.contentDocument;
        if (!context || !frameDocument) {
            destroy();
            return;
        }

        // document.open inherits the host origin, allowing an independent fixed
        // URL without navigating Windy or requiring another hosted web page.
        frameDocument.open();
        frameDocument.write('<!doctype html><html><head><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src https://hm.baidu.com; img-src https://hm.baidu.com; base-uri \'none\'; form-action \'none\'"><title>Sun Moon Path usage</title></head><body></body></html>');
        frameDocument.close();
        context.history.replaceState(null, '', PAGE_PATH);
        // document.open also inherits the real map URL as document.referrer.
        // Redact it in this dedicated document before any third-party code runs.
        Object.defineProperty(frameDocument, 'referrer', { value: '', configurable: true });
        clearPendingRequests();
        const initialCommands: Command[] = [
            ['_setAutoTracking', false],
            ['_setAutoPageview', false],
            ['_setReferrerOverride', ''],
            ['_trackPageview', PAGE_PATH],
        ];
        context._hmt = initialCommands;
        // A pixel owned by the iframe would be cancelled when closing, losing
        // short visits. Only the request lives in
        // the host document; the SDK and its timers remain in the disposable one.
        context.Image = new Proxy(Image, {
            construct(ImageConstructor, [width, height]) {
                const pixel = new ImageConstructor(width, height);
                pixel.referrerPolicy = 'no-referrer';
                const release = () => {
                    pixel.removeEventListener('load', release);
                    pixel.removeEventListener('error', release);
                    pixels.delete(pixel);
                };
                pixels.set(pixel, release);
                pixel.addEventListener('load', release);
                pixel.addEventListener('error', release);
                return pixel;
            },
        });
        script = frameDocument.createElement('script');
        script.src = `https://hm.baidu.com/hm.js?${SITE_ID}`;
        // Baidu may return an empty script without a site referrer. Send only the
        // Windy origin, never its map path, search parameters or fragment.
        script.referrerPolicy = 'origin';
        script.onload = () => {
            cancelLoad();
            if (disposed || !isAllowed() || !context._hmt || Array.isArray(context._hmt)) {
                destroy();
                return;
            }
            ready = true;
            const shouldReport = pendingOpen;
            pendingOpen = false;
            try {
                if (shouldReport) {
                    report();
                }
            } catch {
                destroy();
            }
        };
        script.onerror = destroy;
        loadTimeout = setTimeout(destroy, SDK_LOAD_TIMEOUT_MS);
        frameDocument.head.appendChild(script);
    };

    return {
        trackOpen() {
            if (disposed || !isAllowed()) {
                return;
            }
            try {
                if (ready) {
                    report();
                } else {
                    pendingOpen = true;
                    if (!frame) {
                        load();
                    }
                }
            } catch {
                destroy();
            }
        },
        destroy,
    };
};

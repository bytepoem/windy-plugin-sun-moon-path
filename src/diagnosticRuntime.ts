import store from '@windy/store';
import build from 'virtual:diagnostic-build';
import config from './pluginConfig';
import { createPluginDiagnostics, diagnosticId, type DiagnosticStage } from './pluginDiagnostics';
import { createPostHogUsageTransport } from './posthogUsageTransport';
import { postHogUsageConfig } from './posthogUsageConfig';
import { analyticsEnvironmentEnabled } from './usageMetrics';

const STARTUP_VISIBLE_MS = 15_000;
let continuation: { sessionId: string; time: number } | null = null;
let activeRuntime: { stop: (reason: 'close' | 'failure' | 'replacement') => void } | null = null;

/** Read only coarse browser capabilities, never host URL, location, account or storage contents. */
export const diagnosticEnvironment = () => {
    const browser = navigator.userAgent.match(/(Edg|EdgA|EdgiOS)\/(\d+(?:\.\d+)*)/)
        ?? navigator.userAgent.match(/(Firefox|FxiOS|Chrome|CriOS|Version)\/(\d+(?:\.\d+)*)/);
    const system = /Android/.test(navigator.userAgent) ? 'Android'
        : /iPhone|iPad/.test(navigator.userAgent) ? 'iOS'
        : /Windows/.test(navigator.userAgent) ? 'Windows'
        : /Macintosh/.test(navigator.userAgent) ? 'macOS' : 'other';
    let midnightHour: string | null = null;
    try {
        midnightHour = new Intl.DateTimeFormat('en-US', {
            timeZone: 'UTC', hourCycle: 'h23', hour: '2-digit',
        }).formatToParts(new Date('2020-01-01T00:00:00Z')).find(part => part.type === 'hour')?.value ?? null;
        if (midnightHour !== '00' && midnightHour !== '24') { midnightHour = 'other'; }
    } catch { /* Capability absence is itself useful; diagnostics do not depend on Intl. */ }
    return {
        browser: browser?.[1] === 'Version' ? 'Safari' : browser?.[1] ?? 'other', browserVersion: browser?.[2] ?? 'unknown', system,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        visible: document.visibilityState === 'visible', midnightHour,
    };
};

/** One owner per component lifetime. Failure/close/replacement all call stop immediately. */
export const startDiagnosticRuntime = () => {
    // A replacement begins before the old component's onDestroy/onMount handoff.
    activeRuntime?.stop('replacement');
    let stopped = false;
    let transport: ReturnType<typeof createPostHogUsageTransport> | null = null;
    let consentObservable = false;
    const enabled = analyticsEnvironmentEnabled(build.local, window.location.href);
    const allowed = () => !stopped && enabled && consentObservable && store.get('consent')?.analytics === true;
    const resume = continuation && performance.now() - continuation.time < 2_000 ? continuation : null;
    continuation = null;
    const diagnostics = createPluginDiagnostics({
        build, version: config.version, sessionId: resume?.sessionId,
        send: event => {
            if (!allowed()) { return; }
            if (!transport) {
                const nextTransport = createPostHogUsageTransport(allowed, diagnosticId(), postHogUsageConfig, fetch, () => {
                    if (stopped && transport === nextTransport) { releaseTransport(); }
                });
                transport = nextTransport;
            }
            transport.sendDiagnostic(event, diagnosticEnvironment());
        },
    });
    const consentChanged = () => {
        if (!allowed()) {
            transport?.destroy(true);
            transport = null;
            if (stopped) { releaseTransport(); }
        }
    };
    let subscription: number | null = null;
    try {
        subscription = enabled ? store.on('consent', consentChanged) : null;
        consentObservable = subscription !== null;
    }
    catch { /* A missing host subscription must not prevent plugin initialization. */ }
    function releaseTransport() {
        transport?.destroy(true);
        transport = null;
        if (subscription !== null) { store.off(subscription); subscription = null; }
    }

    // Require this plugin's full path, not just a common name such as plugin.js.
    const owned = (value: string) => /https:\/\/(?:windy-plugins\.com\/[^\s)]+\/windy-plugin-sun-moon-path\/[^\s)]+\/plugin(?:\.min)?\.js|localhost:9999\/plugin(?:\.min)?\.js)(?=[:?\s)]|$)/.test(value);
    const runtimeError = (event: ErrorEvent) => {
        if (owned(event.filename ?? '') || (event.error instanceof Error && owned(event.error.stack ?? ''))) {
            diagnostics.error('runtime', event.error);
        }
    };
    const rejected = (event: PromiseRejectionEvent) => {
        if (event.reason instanceof Error && owned(event.reason.stack ?? '')) {
            diagnostics.error('runtime', event.reason);
        }
    };
    window.addEventListener('error', runtimeError);
    window.addEventListener('unhandledrejection', rejected);

    let timer: ReturnType<typeof setTimeout> | null = null;
    let frame: number | null = null;
    let remaining = STARTUP_VISIBLE_MS;
    let visibleSince = performance.now();
    let root: HTMLElement | null = null;
    const cancelTimer = () => {
        if (timer !== null) { clearTimeout(timer); timer = null; }
    };
    const checkDom = () => {
        frame = null;
        if (stopped || !root || diagnostics.state !== 'mounted') { return; }
        const panel = root.querySelector<HTMLElement>('#sun-moon-path-panel');
        const visible = document.visibilityState === 'visible' && !!panel?.getClientRects().length;
        // The panel always has navigation, including collapsed mobile mode. Data may still be loading.
        const complete = !!panel && panel.getBoundingClientRect().width > 0
            && panel.getBoundingClientRect().height > 0 && !!panel.querySelector('[role="tablist"]');
        diagnostics.dom(visible, complete);
        if (visible && complete) { cancelTimer(); }
    };
    const scheduleCheck = () => {
        if (!stopped && frame === null) { frame = requestAnimationFrame(checkDom); }
    };
    const armTimer = () => {
        cancelTimer();
        if (stopped || diagnostics.state === 'ready' || document.visibilityState !== 'visible') { return; }
        visibleSince = performance.now();
        timer = setTimeout(() => {
            timer = null;
            checkDom();
            const panel = root?.querySelector<HTMLElement>('#sun-moon-path-panel');
            const hiddenPanel = !!panel && !panel.getClientRects().length;
            if (!stopped && !hiddenPanel && document.visibilityState === 'visible' && diagnostics.state !== 'ready') {
                diagnostics.error('dom', new Error('Startup did not complete within visible-time budget'));
            }
        }, Math.max(0, remaining));
    };
    const visibilityChanged = () => {
        if (timer !== null) { remaining -= performance.now() - visibleSince; }
        armTimer();
        scheduleCheck();
    };
    document.addEventListener('visibilitychange', visibilityChanged);
    armTimer();

    const runtime = {
        diagnostics,
        report: () => diagnostics.report(diagnosticEnvironment()),
        mounted(element: HTMLElement) {
            if (stopped) { return; }
            root = element;
            diagnostics.mounted();
            scheduleCheck();
            armTimer();
        },
        error: (stage: DiagnosticStage, error: unknown, fatal = false) => diagnostics.error(stage, error, 0, fatal),
        stop(reason: 'close' | 'failure' | 'replacement' = 'close') {
            if (stopped) {
                if (reason !== 'failure') { releaseTransport(); }
                return;
            }
            if (diagnostics.state === 'failed') { reason = 'failure'; }
            stopped = true;
            continuation = reason === 'replacement' ? { sessionId: diagnostics.sessionId, time: performance.now() } : null;
            cancelTimer();
            if (frame !== null) { cancelAnimationFrame(frame); frame = null; }
            window.removeEventListener('error', runtimeError);
            window.removeEventListener('unhandledrejection', rejected);
            document.removeEventListener('visibilitychange', visibilityChanged);
            // A failure report remains owned while displayed: only its consent subscription
            // survives until the submitted request settles, consent is revoked, or the user closes.
            if (reason !== 'failure' || !transport?.pending) { releaseTransport(); }
            if (reason !== 'failure') { diagnostics.close(); }
            root = null;
            if (activeRuntime === runtime) { activeRuntime = null; }
        },
    };
    activeRuntime = runtime;
    return runtime;
};

export type DiagnosticRuntime = ReturnType<typeof startDiagnosticRuntime>;

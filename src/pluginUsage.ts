import store from '@windy/store';
import { createBrowserUsageIdentity } from './browserUsageIdentity';
import { createBaiduUsageTransport } from './baiduUsageTransport';
import { createPostHogUsageTransport } from './posthogUsageTransport';
import { postHogUsageConfig } from './posthogUsageConfig';
import { createUsageSessionId, usageSessionExpired } from './usageSessionId';
import { analyticsEnvironmentEnabled, createUsageMetrics, type UsageCloudView, type UsageEvent, type UsageSession, type UsageTab } from './usageMetrics';

const CHECKPOINT_INTERVAL_MS = 30_000;
// Internal remounts are immediate. Never resume a later manual opening.
const INTERNAL_REOPEN_WINDOW_MS = 2_000;
let continuation: { session: UsageSession; time: number; sessionId: string | null } | null = null;

/** Bind one component lifetime to Windy consent and browser visibility. */
export const startPluginUsage = (options: { localBuild: boolean; tab: UsageTab; cloudView?: UsageCloudView }) => {
    const enabled = analyticsEnvironmentEnabled(options.localBuild, window.location.href);
    let active = true;
    let pageActive = true;
    let interval: ReturnType<typeof setInterval> | null = null;
    let transport: ReturnType<typeof createBaiduUsageTransport> | null = null;
    let eventTransport: ReturnType<typeof createPostHogUsageTransport> | null = null;
    let identityRevoked = false;
    const allowed = () => enabled && active && !identityRevoked && store.get('consent')?.analytics === true;
    const identity = createBrowserUsageIdentity(allowed);
    const mountAllowed = allowed();
    let mountReported = false;
    const resume = allowed() && continuation && performance.now() - continuation.time <= INTERNAL_REOPEN_WINDOW_MS
        ? continuation : undefined;
    let sessionId = resume?.sessionId ?? null;
    // Track dispatched browsing state separately: a leave callback runs after
    // metrics has closed its page, and identity creation may be asynchronous.
    let dispatchedPageOpen = resume?.session.pageOpen ?? false;
    let transportBrowserId: string | null = null;
    continuation = null;
    // Cleanup is the only storage operation allowed without consent.
    if (enabled && !allowed()) { identity.revoke(); }

    const sendEvent = (event: UsageEvent) => {
        if (allowed()) {
            if (event.category === 'plugin') {
                try {
                    transport ??= createBaiduUsageTransport(allowed);
                    transport.trackOpen();
                } catch { /* A PV failure must not suppress the event. */ }
            }
            try {
                identity.send(browserId => {
                    const sessionExpired = sessionId !== null && usageSessionExpired(sessionId);
                    if (!sessionId || sessionExpired) {
                        sessionId = createUsageSessionId();
                    }
                    if (transportBrowserId !== browserId) {
                        eventTransport?.destroy(true);
                        eventTransport = null;
                        transportBrowserId = browserId;
                    }
                    eventTransport ??= createPostHogUsageTransport(allowed, browserId, postHogUsageConfig);
                    // A standard session boundary starts a new view only when
                    // continuing an existing browse. Never backfill a consent grant.
                    if (sessionExpired && dispatchedPageOpen && event.category !== 'plugin'
                        && event.action !== '$pageview') {
                        eventTransport.send({ category: 'web', action: '$pageview' }, sessionId);
                    }
                    eventTransport.send(event, sessionId);
                    if (event.category === 'plugin' || event.action === '$pageview') {
                        dispatchedPageOpen = true;
                    } else if (event.action === '$pageleave') {
                        dispatchedPageOpen = false;
                    }
                });
            } catch { /* Event statistics must not interrupt plugin use. */ }
        }
    };

    const metrics = createUsageMetrics({
        now: () => performance.now(),
        allowed: allowed(),
        visible: document.visibilityState === 'visible',
        tab: options.tab,
        cloudView: options.cloudView,
        resume: resume?.session,
        send: sendEvent,
    });

    const syncTimer = () => {
        if (interval !== null) {
            clearInterval(interval);
            interval = null;
        }
        if (allowed() && pageActive && document.visibilityState === 'visible') {
            interval = setInterval(() => {
                metrics.setConsent(allowed());
                metrics.checkpoint();
            }, CHECKPOINT_INTERVAL_MS);
        }
    };

    const consentChanged = () => {
        identityRevoked = false;
        metrics.setConsent(allowed());
        if (!allowed()) {
            mountReported = true;
            transport?.destroy();
            transport = null;
            eventTransport?.destroy(true);
            eventTransport = null;
            sessionId = null;
            dispatchedPageOpen = false;
            transportBrowserId = null;
            identity.revoke();
        }
        syncTimer();
    };

    const storageChanged = (event: StorageEvent) => {
        if (!identity.wasInvalidated(event)) { return; }
        // Never recreate an identity in response to another tab's revocation.
        identityRevoked = true;
        mountReported = true;
        metrics.setConsent(false);
        transport?.destroy();
        transport = null;
        eventTransport?.destroy(true);
        eventTransport = null;
        transportBrowserId = null;
        sessionId = null;
        dispatchedPageOpen = false;
        identity.cancel();
        syncTimer();
    };

    const visibilityChanged = () => {
        metrics.setConsent(allowed());
        metrics.setVisible(pageActive && document.visibilityState === 'visible');
        syncTimer();
    };
    const pageHidden = () => {
        pageActive = false;
        visibilityChanged();
        metrics.leavePage();
    };
    const pageShown = () => {
        pageActive = true;
        visibilityChanged();
        metrics.restorePage();
    };

    const subscription = enabled ? store.on('consent', consentChanged) : null;
    if (enabled) {
        document.addEventListener('visibilitychange', visibilityChanged);
        window.addEventListener('pagehide', pageHidden);
        window.addEventListener('pageshow', pageShown);
        window.addEventListener('storage', storageChanged);
        syncTimer();
    }

    return {
        /** Measure synchronous plugin mount setup only, excluding host load and data requests. */
        recordMountDuration(durationMs: number) {
            if (mountReported || !mountAllowed || !allowed() || !Number.isFinite(durationMs) || durationMs < 0) { return; }
            mountReported = true;
            sendEvent({ category: 'performance', action: 'plugin_mount_setup', durationMs });
        },
        setTab(tab: UsageTab, userInitiated = false, cloudView?: UsageCloudView) {
            metrics.setConsent(allowed());
            metrics.setTab(tab, userInitiated, cloudView);
        },
        stop(resumeAfterInternalReopen = false) {
            if (!active) {
                return;
            }
            metrics.setConsent(allowed());
            const session = metrics.stop(resumeAfterInternalReopen);
            const allowedForContinuation = allowed();
            active = false;
            continuation = resumeAfterInternalReopen && allowedForContinuation
                ? { session, time: performance.now(), sessionId } : null;
            if (interval !== null) {
                clearInterval(interval);
                interval = null;
            }
            if (subscription !== null) {
                store.off(subscription);
            }
            document.removeEventListener('visibilitychange', visibilityChanged);
            window.removeEventListener('pagehide', pageHidden);
            window.removeEventListener('pageshow', pageShown);
            window.removeEventListener('storage', storageChanged);
            identity.destroy();
            transport?.destroy();
            transport = null;
            eventTransport?.destroy();
            eventTransport = null;
        },
    };
};

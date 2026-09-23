import store from '@windy/store';
import { createBaiduUsageTransport } from './baiduUsageTransport';
import { createPostHogUsageTransport } from './posthogUsageTransport';
import { postHogUsageConfig } from './posthogUsageConfig';
import { analyticsEnvironmentEnabled, createUsageMetrics, type UsageSession, type UsageTab } from './usageMetrics';

const CHECKPOINT_INTERVAL_MS = 30_000;
// Internal remounts are immediate. Never resume a later manual opening.
const INTERNAL_REOPEN_WINDOW_MS = 2_000;
let continuation: { session: UsageSession; time: number; distinctId: string | null } | null = null;

/** Bind one component lifetime to Windy consent and browser visibility. */
export const startPluginUsage = (options: { localBuild: boolean; tab: UsageTab }) => {
    const enabled = analyticsEnvironmentEnabled(options.localBuild, window.location.href);
    let active = true;
    let pageActive = true;
    let interval: ReturnType<typeof setInterval> | null = null;
    let transport: ReturnType<typeof createBaiduUsageTransport> | null = null;
    let eventTransport: ReturnType<typeof createPostHogUsageTransport> | null = null;
    const allowed = () => enabled && active && store.get('consent')?.analytics === true;
    const resume = continuation && performance.now() - continuation.time <= INTERNAL_REOPEN_WINDOW_MS
        ? continuation : undefined;
    let distinctId = resume?.distinctId ?? null;
    continuation = null;

    const metrics = createUsageMetrics({
        now: () => performance.now(),
        allowed: allowed(),
        visible: document.visibilityState === 'visible',
        tab: options.tab,
        resume: resume?.session,
        send: event => {
            if (allowed()) {
                if (event.category === 'plugin') {
                    try {
                        transport ??= createBaiduUsageTransport(allowed);
                        transport.trackOpen();
                    } catch { /* A PV failure must not suppress the event. */ }
                }
                try {
                    distinctId ??= crypto.randomUUID();
                    eventTransport ??= createPostHogUsageTransport(allowed, distinctId, postHogUsageConfig);
                    eventTransport.send(event);
                } catch { /* Event statistics must not interrupt plugin use. */ }
            }
        },
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
        metrics.setConsent(allowed());
        if (!allowed()) {
            transport?.destroy();
            transport = null;
            eventTransport?.destroy(true);
            eventTransport = null;
            distinctId = null;
        }
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
    };
    const pageShown = () => {
        pageActive = true;
        visibilityChanged();
    };

    const subscription = enabled ? store.on('consent', consentChanged) : null;
    if (enabled) {
        document.addEventListener('visibilitychange', visibilityChanged);
        window.addEventListener('pagehide', pageHidden);
        window.addEventListener('pageshow', pageShown);
        syncTimer();
    }

    return {
        setTab(tab: UsageTab, userInitiated = false) {
            metrics.setConsent(allowed());
            metrics.setTab(tab, userInitiated);
        },
        stop(resumeAfterInternalReopen = false) {
            if (!active) {
                return;
            }
            metrics.setConsent(allowed());
            const session = metrics.stop();
            active = false;
            continuation = resumeAfterInternalReopen ? { session, time: performance.now(), distinctId } : null;
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
            transport?.destroy();
            transport = null;
            eventTransport?.destroy();
            eventTransport = null;
        },
    };
};

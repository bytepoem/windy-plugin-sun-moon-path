import type { LanguageSelection } from './languageController';

export type UsageTab = 'events' | 'weather' | 'clouds' | 'settings' | 'about';
export type UsageCloudView = 'obstruction' | 'rainbow' | 'horizon' | 'tide';
export type UsageReportTab = Exclude<UsageTab, 'clouds'> | UsageCloudView;

export type UsageEvent =
    | { category: 'web'; action: '$pageview' | '$pageleave' }
    | { category: 'performance'; action: 'plugin_mount_setup'; durationMs: number }
    | { category: 'plugin'; action: 'open' }
    | { category: 'tab'; action: 'select'; label: UsageReportTab }
    | ({ category: 'language'; action: 'language_view' | 'language_select' } & LanguageSelection)
    | { category: 'usage'; action: 'foreground_seconds'; label: 'plugin'; value: number }
    | { category: 'usage'; action: 'tab_seconds'; label: UsageReportTab; value: number }
    | { category: 'usage'; action: 'reached_3min' };

export interface UsageSession {
    foregroundMs: number;
    reachedThreeMinutes: boolean;
    pageOpen: boolean;
    pageRestorable: boolean;
}

const THREE_MINUTES_MS = 180_000;

/** Accumulates only authorized, visible time. A session contains no visitor identifier. */
export const createUsageMetrics = (options: {
    now: () => number;
    send: (event: UsageEvent) => void;
    allowed: boolean;
    visible: boolean;
    tab: UsageTab;
    cloudView?: UsageCloudView;
    resume?: UsageSession;
}) => {
    let allowed = options.allowed;
    let visible = options.visible;
    let tab = options.tab;
    let cloudView = options.cloudView ?? 'obstruction';
    let stopped = false;
    let lastTime = options.now();
    const session = options.resume ?? {
        foregroundMs: 0, reachedThreeMinutes: false, pageOpen: allowed, pageRestorable: false,
    };

    const send = (event: UsageEvent) => {
        try { options.send(event); } catch { /* Metrics must never interrupt the plugin. */ }
    };

    if (allowed && !options.resume) {
        send({ category: 'plugin', action: 'open' });
    }

    /** Each checkpoint sends a delta, never the already-reported session total. */
    const checkpoint = () => {
        if (stopped) {
            return;
        }
        const now = options.now();
        const elapsedMs = Math.max(0, now - lastTime);
        lastTime = now;
        if (!allowed || !visible || elapsedMs === 0) {
            return;
        }
        session.foregroundMs += elapsedMs;
        const seconds = elapsedMs / 1000;
        send({ category: 'usage', action: 'foreground_seconds', label: 'plugin', value: seconds });
        // Report the actual planner, never a second aggregate cloud-tab segment.
        send({ category: 'usage', action: 'tab_seconds', label: tab === 'clouds' ? cloudView : tab, value: seconds });
        if (!session.reachedThreeMinutes && session.foregroundMs >= THREE_MINUTES_MS) {
            session.reachedThreeMinutes = true;
            send({ category: 'usage', action: 'reached_3min' });
        }
    };

    /** Page departures are distinct from foreground timing and internal remounts. */
    const leavePage = () => {
        if (stopped || !allowed || !session.pageOpen) { return; }
        session.pageOpen = false;
        session.pageRestorable = true;
        send({ category: 'web', action: '$pageleave' });
    };

    return {
        checkpoint,
        leavePage,
        restorePage() {
            if (stopped || !allowed || !session.pageRestorable || session.pageOpen) { return; }
            session.pageRestorable = false;
            session.pageOpen = true;
            send({ category: 'web', action: '$pageview' });
        },
        setConsent(next: boolean) {
            if (stopped || next === allowed) {
                return;
            }
            // Revocation discards the unfinished segment; granting never backfills it.
            lastTime = options.now();
            allowed = next;
            // A new grant gets a new usage identity/session; its engagement
            // threshold must not include time reported under the revoked one.
            if (!next) {
                session.pageOpen = false;
                session.pageRestorable = false;
                session.foregroundMs = 0;
                session.reachedThreeMinutes = false;
            }
        },
        setVisible(next: boolean) {
            if (stopped || next === visible) {
                return;
            }
            checkpoint();
            visible = next;
        },
        /** Commit tab and subview together so the old view owns the elapsed segment. */
        setTab(next: UsageTab, userInitiated = false, nextCloudView = cloudView) {
            const tabChanged = next !== tab;
            const viewChanged = nextCloudView !== cloudView;
            if (stopped || (!tabChanged && !viewChanged)) {
                return;
            }
            checkpoint();
            tab = next;
            cloudView = nextCloudView;
            if (allowed && visible && userInitiated) {
                if (tabChanged || tab === 'clouds') {
                    send({ category: 'tab', action: 'select', label: tab === 'clouds' ? cloudView : tab });
                }
            }
        },
        stop(resumeAfterInternalReopen = false): UsageSession {
            checkpoint();
            if (!resumeAfterInternalReopen) { leavePage(); }
            stopped = true;
            return { ...session };
        },
    };
};

/** Local bundles and developer-mode visits must not pollute the production account. */
export const analyticsEnvironmentEnabled = (localBuild: boolean, url: string): boolean => {
    try {
        const location = new URL(url);
        return !localBuild
            && location.protocol === 'https:'
            && ['www.windy.com', 'windy.com'].includes(location.hostname)
            && !/^\/(?:developer-mode|dev)(?:\/|$)/.test(location.pathname);
    } catch {
        return false;
    }
};

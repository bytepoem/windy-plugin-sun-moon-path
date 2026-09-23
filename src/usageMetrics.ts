export type UsageTab = 'events' | 'weather' | 'clouds' | 'settings' | 'about';

export type UsageEvent =
    | { category: 'plugin'; action: 'open' }
    | { category: 'tab'; action: 'select'; label: UsageTab }
    | { category: 'usage'; action: 'foreground_seconds'; label: 'plugin'; value: number }
    | { category: 'usage'; action: 'tab_seconds'; label: UsageTab; value: number }
    | { category: 'usage'; action: 'reached_3min' };

export interface UsageSession {
    foregroundMs: number;
    reachedThreeMinutes: boolean;
}

const THREE_MINUTES_MS = 180_000;

/** Accumulates only authorized, visible time. A session contains no visitor identifier. */
export const createUsageMetrics = (options: {
    now: () => number;
    send: (event: UsageEvent) => void;
    allowed: boolean;
    visible: boolean;
    tab: UsageTab;
    resume?: UsageSession;
}) => {
    let allowed = options.allowed;
    let visible = options.visible;
    let tab = options.tab;
    let stopped = false;
    let lastTime = options.now();
    const session = options.resume ?? { foregroundMs: 0, reachedThreeMinutes: false };

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
        send({ category: 'usage', action: 'tab_seconds', label: tab, value: seconds });
        if (!session.reachedThreeMinutes && session.foregroundMs >= THREE_MINUTES_MS) {
            session.reachedThreeMinutes = true;
            send({ category: 'usage', action: 'reached_3min' });
        }
    };

    return {
        checkpoint,
        setConsent(next: boolean) {
            if (stopped || next === allowed) {
                return;
            }
            // Revocation discards the unfinished segment; granting never backfills it.
            lastTime = options.now();
            allowed = next;
        },
        setVisible(next: boolean) {
            if (stopped || next === visible) {
                return;
            }
            checkpoint();
            visible = next;
        },
        setTab(next: UsageTab, userInitiated = false) {
            if (stopped || next === tab) {
                return;
            }
            checkpoint();
            tab = next;
            if (allowed && visible && userInitiated) {
                send({ category: 'tab', action: 'select', label: tab });
            }
        },
        stop(): UsageSession {
            checkpoint();
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

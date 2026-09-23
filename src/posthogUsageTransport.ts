import type { UsageEvent } from './usageMetrics';

export interface PostHogUsageConfig {
    projectToken: string;
    pluginVersion: string;
    environment: 'production' | 'test';
}

const CAPTURE_URL = 'https://us.i.posthog.com/i/v0/e/';
const MAX_IN_FLIGHT_REQUESTS = 16;

/** Map only our explicit events; never collect the host page URL or account. */
export const postHogUsagePayload = (event: UsageEvent, distinctId: string, config: PostHogUsageConfig) => ({
    api_key: config.projectToken,
    distinct_id: distinctId,
    event: event.category === 'plugin' ? 'plugin_open'
        : event.category === 'tab' ? 'tab_select' : event.action,
    properties: {
        $process_person_profile: false,
        $geoip_disable: true,
        plugin: 'windy-plugin-sun-moon-path',
        plugin_version: config.pluginVersion,
        environment: config.environment,
        ...('label' in event && event.label !== 'plugin' ? { tab: event.label } : {}),
        ...('value' in event ? { seconds: event.value } : {}),
    },
});

/**
 * Send directly through the documented capture API. No automatic collection,
 * persistent identifiers, deferred batches, retries or third-party SDK timers.
 */
export const createPostHogUsageTransport = (
    isAllowed: () => boolean,
    distinctId: string,
    config: PostHogUsageConfig,
    fetchImpl: typeof fetch = fetch,
) => {
    let disposed = false;
    const inFlight = new Set<AbortController>();

    return {
        send(event: UsageEvent) {
            if (disposed || !isAllowed() || !config.projectToken || inFlight.size >= MAX_IN_FLIGHT_REQUESTS) {
                return;
            }
            const controller = new AbortController();
            inFlight.add(controller);
            try {
                void fetchImpl(CAPTURE_URL, {
                    method: 'POST',
                    mode: 'cors',
                    credentials: 'omit',
                    referrerPolicy: 'no-referrer',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(postHogUsagePayload(event, distinctId, config)),
                    keepalive: true,
                    signal: controller.signal,
                }).catch(() => {
                    // Failed telemetry is dropped; no later replay after revocation.
                }).finally(() => inFlight.delete(controller));
            } catch {
                inFlight.delete(controller);
            }
        },
        destroy(abortPending = false) {
            disposed = true;
            // Revocation aborts outstanding work. Normal close lets submitted final
            // segments finish; their callbacks only release transport bookkeeping.
            if (abortPending) {
                inFlight.forEach(controller => controller.abort());
            }
            inFlight.clear();
        },
    };
};

import { readUsageEnvironment, type UsageEnvironment } from './usageEnvironment';
import type { UsageEvent } from './usageMetrics';
import type { DiagnosticEvent } from './pluginDiagnostics';

export interface PostHogUsageConfig {
    projectToken: string;
    pluginVersion: string;
    environment: 'production' | 'test';
}

const CAPTURE_URL = 'https://us.i.posthog.com/i/v0/e/';
const MAX_IN_FLIGHT_REQUESTS = 16;

/** Map only our explicit events; never collect the host page URL or account. */
export const postHogUsagePayload = (event: UsageEvent, distinctId: string, config: PostHogUsageConfig, sessionId?: string) => ({
    api_key: config.projectToken,
    distinct_id: distinctId,
    event: event.category === 'plugin' ? 'plugin_open'
        : event.category === 'tab' ? 'tab_select' : event.action,
    properties: {
        $process_person_profile: false,
        // PostHog enriches consented usage from the request IP; no GPS or map location is sent.
        // Configure server-side IP discard after enrichment to avoid retaining raw IPs.
        $geoip_disable: false,
        plugin: 'windy-plugin-sun-moon-path',
        plugin_version: config.pluginVersion,
        environment: config.environment,
        ...(sessionId ? { usage_identity: 'browser_v1', usage_session_id: sessionId } : {}),
        ...('label' in event && event.label !== 'plugin' ? { tab: event.label } : {}),
        ...('value' in event ? { seconds: event.value } : {}),
    },
});

/**
 * Send directly through the documented capture API. No automatic collection,
 * storage access, deferred batches, retries or third-party SDK timers. The caller
 * owns the consented browser identifier and the separate usage session identifier.
 */
export const createPostHogUsageTransport = (
    isAllowed: () => boolean,
    distinctId: string,
    config: PostHogUsageConfig,
    fetchImpl: typeof fetch = fetch,
    onIdle: () => void = () => undefined,
) => {
    let disposed = false;
    let usageEnvironment: UsageEnvironment | null = null;
    const inFlight = new Set<AbortController>();
    const sendPayload = (payload: ReturnType<typeof postHogUsagePayload> | {
        api_key: string; distinct_id: string; event: string; properties: Record<string, unknown>;
    }) => {
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
                body: JSON.stringify(payload),
                keepalive: true,
                signal: controller.signal,
            }).catch(() => {
                // Failed telemetry is dropped; no later replay after revocation.
            }).finally(() => {
                inFlight.delete(controller);
                if (inFlight.size === 0) {
                    try { onIdle(); } catch { /* Completion bookkeeping cannot reject globally. */ }
                }
            });
        } catch {
            inFlight.delete(controller);
        }
    };

    return {
        get pending() { return inFlight.size; },
        send(event: UsageEvent, sessionId?: string) {
            if (disposed || !isAllowed() || !config.projectToken) {
                return;
            }
            usageEnvironment ??= readUsageEnvironment();
            const payload = postHogUsagePayload(event, distinctId, config, sessionId);
            const enrichedPayload = { ...payload, properties: { ...payload.properties, ...usageEnvironment } };
            sendPayload(enrichedPayload);
            // One explicit plugin opening is one pageview. Reuse only consented
            // properties; never read the host URL, referrer or map location.
            // Each request independently rechecks consent and the in-flight bound.
            if (event.category === 'plugin') {
                sendPayload({ ...enrichedPayload, event: '$pageview' });
            }
        },
        /** Ordinary diagnostic events, not PostHog's SDK-specific $exception contract. */
        sendDiagnostic(event: DiagnosticEvent, environment: {
            browser: string; browserVersion: string; system: string;
            viewport: { width: number; height: number }; visible: boolean; midnightHour: string | null;
        }) {
            sendPayload({
                api_key: config.projectToken,
                distinct_id: distinctId,
                event: event.event,
                properties: {
                    ...event.properties,
                    runtime: environment,
                    $process_person_profile: false,
                    $geoip_disable: true,
                    plugin: 'windy-plugin-sun-moon-path',
                    plugin_version: config.pluginVersion,
                    environment: config.environment,
                },
            });
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

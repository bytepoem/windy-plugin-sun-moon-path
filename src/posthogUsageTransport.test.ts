import { describe, expect, it, vi } from 'vitest';
import { createPostHogUsageTransport, postHogUsagePayload } from './posthogUsageTransport';
import type { UsageEvent } from './usageMetrics';

const config = { projectToken: 'phc_test', pluginVersion: '0.10.4', environment: 'test' as const };
const open: UsageEvent = { category: 'plugin', action: 'open' };

describe('PostHog event transport', () => {
    it.each([
        [open, 'plugin_open', {}],
        [{ category: 'tab', action: 'select', label: 'clouds' }, 'tab_select', { tab: 'clouds' }],
        [{ category: 'usage', action: 'foreground_seconds', label: 'plugin', value: 30 }, 'foreground_seconds', { seconds: 30 }],
        [{ category: 'usage', action: 'tab_seconds', label: 'settings', value: 12.5 }, 'tab_seconds', { tab: 'settings', seconds: 12.5 }],
        [{ category: 'usage', action: 'reached_3min' }, 'reached_3min', {}],
    ] as [UsageEvent, string, Record<string, unknown>][])('maps %j without host page data', (event, name, properties) => {
        expect(postHogUsagePayload(event, 'random-session-id', config)).toEqual({
            api_key: 'phc_test',
            distinct_id: 'random-session-id',
            event: name,
            properties: {
                $process_person_profile: false,
                $geoip_disable: true,
                plugin: 'windy-plugin-sun-moon-path',
                plugin_version: '0.10.4',
                environment: 'test',
                ...properties,
            },
        });
    });

    it('rechecks consent and never sends cookies or referrer', async () => {
        let allowed = false;
        const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
        const transport = createPostHogUsageTransport(() => allowed, 'session', config, fetchMock);
        transport.send(open);
        expect(fetchMock).not.toHaveBeenCalled();
        allowed = true;
        transport.send(open);
        expect(fetchMock).toHaveBeenCalledWith('https://us.i.posthog.com/i/v0/e/', expect.objectContaining({
            method: 'POST', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true,
        }));
        allowed = false;
        transport.send(open);
        expect(fetchMock).toHaveBeenCalledOnce();
        transport.destroy(true);
        expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
        await Promise.resolve();
    });

    it('allows the submitted final segment to finish after normal close but accepts no more events', () => {
        const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
        const transport = createPostHogUsageTransport(() => true, 'session', config, fetchMock);
        transport.send(open);
        transport.destroy();
        expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false);
        transport.send(open);
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('bounds in-flight requests and aborts them on revocation without retry', () => {
        const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
        const transport = createPostHogUsageTransport(() => true, 'session', config, fetchMock);
        for (let index = 0; index < 100; index++) {
            transport.send(open);
        }
        expect(fetchMock).toHaveBeenCalledTimes(16);
        transport.destroy(true);
        expect(fetchMock.mock.calls.every(([, options]) => options.signal.aborted)).toBe(true);
    });

    it('drops network errors, synchronous failures and missing configuration', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error('blocked'));
        const transport = createPostHogUsageTransport(() => true, 'session', config, fetchMock);
        transport.send(open);
        await Promise.resolve();
        await Promise.resolve();
        expect(fetchMock).toHaveBeenCalledOnce();
        fetchMock.mockImplementation(() => { throw new Error('unavailable'); });
        expect(() => transport.send(open)).not.toThrow();
        const unconfigured = createPostHogUsageTransport(() => true, 'session', { ...config, projectToken: '' }, fetchMock);
        unconfigured.send(open);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        transport.destroy(true);
    });
});

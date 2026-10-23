import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPostHogUsageTransport, postHogUsagePayload } from './posthogUsageTransport';
import type { UsageEvent } from './usageMetrics';

const config = { projectToken: 'phc_test', pluginVersion: '0.10.4', environment: 'test' as const };
const open: UsageEvent = { category: 'plugin', action: 'open' };

describe('PostHog event transport', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('reads coarse device information only after consent and sends no raw user agent', () => {
        let allowed = false;
        const readAgent = vi.fn(() => 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36 Edg/130.0');
        vi.stubGlobal('navigator', { get userAgent() { return readAgent(); }, maxTouchPoints: 0 });
        const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
        const transport = createPostHogUsageTransport(() => allowed, 'session', config, fetchMock);
        transport.send(open);
        expect(readAgent).not.toHaveBeenCalled();
        allowed = true;
        transport.send(open);
        const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(payload.properties).toMatchObject({ $browser: 'Microsoft Edge', $os: 'Windows', $device_type: 'Desktop' });
        expect(JSON.stringify(payload)).not.toContain('Mozilla');
        expect(payload.properties).not.toHaveProperty('$user_agent');
        allowed = false;
        transport.send(open);
        expect(fetchMock).toHaveBeenCalledOnce();
        transport.destroy();
    });

    it.each([
        [open, 'plugin_open', {}],
        [{ category: 'tab', action: 'select', label: 'obstruction' }, 'tab_select', { tab: 'obstruction' }],
        [{ category: 'usage', action: 'foreground_seconds', label: 'plugin', value: 30 }, 'foreground_seconds', { seconds: 30 }],
        [{ category: 'usage', action: 'tab_seconds', label: 'settings', value: 12.5 }, 'tab_seconds', { tab: 'settings', seconds: 12.5 }],
        [{ category: 'usage', action: 'reached_3min' }, 'reached_3min', {}],
        [{ category: 'tab', action: 'select', label: 'rainbow' }, 'tab_select', { tab: 'rainbow' }],
        [{ category: 'usage', action: 'tab_seconds', label: 'tide', value: 12.5 }, 'tab_seconds', { tab: 'tide', seconds: 12.5 }],
    ] as [UsageEvent, string, Record<string, unknown>][])('maps %j without host page data', (event, name, properties) => {
        expect(postHogUsagePayload(event, 'random-session-id', config)).toEqual({
            api_key: 'phc_test',
            distinct_id: 'random-session-id',
            event: name,
            properties: {
                $process_person_profile: false,
                $geoip_disable: false,
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

    it('keeps diagnostics outside geographic enrichment', () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
        const transport = createPostHogUsageTransport(() => true, 'session', config, fetchMock);
        transport.sendDiagnostic({
            event: 'plugin_runtime_error',
            properties: {
                diagnostic_schema: 1, build_id: 'test', instance_id: 'instance',
                stage: 'runtime', operation: 1, fingerprint: 'runtime|Error',
                error: { name: 'Error', message: 'Network request failed', frames: [] }, context: {},
            },
        }, {
            browser: 'test', browserVersion: '1', system: 'test',
            viewport: { width: 100, height: 100 }, visible: true, midnightHour: null,
        });
        const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(payload.properties.$geoip_disable).toBe(true);
        expect(payload.properties.$process_person_profile).toBe(false);
        transport.destroy();
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

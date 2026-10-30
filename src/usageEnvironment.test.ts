import { describe, expect, it } from 'vitest';
import { classifyUsageEnvironment } from './usageEnvironment';

describe('coarse usage environment', () => {
    it.each([
        ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36 Edg/130.0', 0, 'Microsoft Edge', 'Windows', 'Desktop'],
        ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15', 5, 'Safari', 'iOS', 'Tablet'],
        ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15', 0, 'Safari', 'macOS', 'Desktop'],
        ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) CriOS/130.0 Mobile/15E148 Safari/604.1', 5, 'Chrome', 'iOS', 'Mobile'],
        ['Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36 SamsungBrowser/26.0', 5, 'Samsung Internet', 'Android', 'Mobile'],
        ['Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Safari/537.36', 5, 'Chrome', 'Android', 'Tablet'],
        ['Mozilla/5.0 (X11; Linux x86_64) Firefox/130.0', 0, 'Firefox', 'Linux', 'Desktop'],
        ['', 0, 'Unknown', 'Unknown', 'Unknown'],
    ])('classifies %s without keeping raw client details', (ua, touch, browser, os, device) => {
        expect(classifyUsageEnvironment(ua, touch)).toEqual({ $browser: browser, $os: os, $device_type: device });
    });
});

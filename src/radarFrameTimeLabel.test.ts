import { describe, expect, it } from 'vitest';

import { formatRadarFrameTimeLabel } from './radarFrameTimeLabel';

describe('radar frame time label', () => {
    it('shows the actual provider frame time and provider name', () => {
        expect(formatRadarFrameTimeLabel({
            language: 'zh',
            provider: 'rainviewer',
            status: 'ready',
            timestampMs: Date.parse('2026-08-30T11:10:00Z'),
        })).toMatch(/^RainViewer · 08\/30 \d{2}:10$/);
    });

    it('distinguishes loading, out-of-range and hidden states', () => {
        expect(formatRadarFrameTimeLabel({
            language: 'zh',
            provider: 'rainviewer',
            status: 'loading',
            timestampMs: null,
        })).toBe('RainViewer · 加载中…');
        expect(formatRadarFrameTimeLabel({
            language: 'en',
            provider: 'rainviewer',
            status: 'out-of-range',
            timestampMs: null,
        })).toBe('RainViewer · No matching frame');
        expect(formatRadarFrameTimeLabel({
            language: 'zh',
            provider: 'none',
            status: 'disabled',
            timestampMs: null,
        })).toBeNull();
    });
});

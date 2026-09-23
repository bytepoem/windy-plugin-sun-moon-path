import { describe, expect, it } from 'vitest';
import { analyticsEnvironmentEnabled, createUsageMetrics, type UsageEvent, type UsageSession } from './usageMetrics';

const fixture = (allowed = true, resume?: UsageSession) => {
    let now = 0;
    const events: UsageEvent[] = [];
    const metrics = createUsageMetrics({
        now: () => now,
        send: event => events.push(event),
        allowed,
        visible: true,
        tab: 'events',
        resume,
    });
    return { metrics, events, advance: (milliseconds: number) => { now += milliseconds; } };
};

const durations = (events: UsageEvent[], action = 'foreground_seconds') => events
    .filter((event): event is Extract<UsageEvent, { value: number }> => event.action === action && 'value' in event)
    .reduce((total, event) => total + event.value, 0);

describe('authorized plugin usage', () => {
    it('does not backfill an opening, time or selections before consent', () => {
        const { metrics, events, advance } = fixture(false);
        advance(40_000);
        metrics.setTab('clouds', true);
        metrics.checkpoint();
        expect(events).toEqual([]);
        metrics.setConsent(true);
        advance(10_000);
        metrics.stop();
        expect(durations(events)).toBe(10);
        expect(events.some(event => event.category === 'plugin' || event.category === 'tab')).toBe(false);
    });

    it('pauses background time and does not double-count repeated checkpoints', () => {
        const { metrics, events, advance } = fixture();
        advance(12_500);
        metrics.setVisible(false);
        advance(600_000);
        metrics.checkpoint();
        metrics.setVisible(true);
        advance(7_500);
        metrics.checkpoint();
        metrics.checkpoint();
        metrics.stop();
        metrics.stop();
        expect(durations(events)).toBe(20);
        expect(events.filter(event => event.action === 'open')).toHaveLength(1);
        expect(events.some(event => event.action === 'reached_3min')).toBe(false);
    });

    it('attributes each segment to the old tab and only counts actual user switches', () => {
        const { metrics, events, advance } = fixture();
        advance(10_000);
        metrics.setTab('clouds', true);
        metrics.setTab('clouds', true);
        advance(20_000);
        metrics.setTab('events'); // Mobile collapse is programmatic.
        advance(5_000);
        metrics.setTab('clouds'); // Expand restores the tab.
        advance(15_000);
        metrics.setTab('about', true); // Same entry point for keyboard navigation.
        metrics.stop();
        expect(events.filter(event => event.category === 'tab')).toEqual([
            { category: 'tab', action: 'select', label: 'clouds' },
            { category: 'tab', action: 'select', label: 'about' },
        ]);
        expect(events.filter(event => event.action === 'tab_seconds')).toEqual([
            { category: 'usage', action: 'tab_seconds', label: 'events', value: 10 },
            { category: 'usage', action: 'tab_seconds', label: 'clouds', value: 20 },
            { category: 'usage', action: 'tab_seconds', label: 'events', value: 5 },
            { category: 'usage', action: 'tab_seconds', label: 'clouds', value: 15 },
        ]);
        expect(durations(events)).toBe(50);
    });

    it('drops the unfinished segment on revocation and starts fresh when reallowed', () => {
        const { metrics, events, advance } = fixture();
        advance(30_000);
        metrics.checkpoint();
        advance(19_000);
        metrics.setConsent(false);
        const beforeRevocation = events.length;
        advance(500_000);
        metrics.setTab('settings', true);
        metrics.checkpoint();
        expect(events).toHaveLength(beforeRevocation);
        metrics.setConsent(true);
        advance(11_000);
        metrics.stop();
        expect(durations(events)).toBe(41);
    });

    it('continues the milestone across internal remounts without another opening', () => {
        const first = fixture();
        first.advance(100_000);
        const session = first.metrics.stop();
        const second = fixture(true, session);
        second.advance(80_000);
        second.metrics.checkpoint();
        second.advance(180_000);
        second.metrics.stop();
        expect(second.events.filter(event => event.action === 'open')).toHaveLength(0);
        expect(second.events.filter(event => event.action === 'reached_3min')).toHaveLength(1);
        expect(durations([...first.events, ...second.events])).toBe(360);
        expect(fixture().events.filter(event => event.action === 'open')).toHaveLength(1);
    });

    it('does not let a failed transport break timing or throw into the UI', () => {
        let now = 0;
        const metrics = createUsageMetrics({
            now: () => now,
            send: () => { throw new Error('blocked'); },
            allowed: true,
            visible: true,
            tab: 'events',
        });
        now = 30_000;
        expect(metrics.stop().foregroundMs).toBe(30_000);
    });
});

describe('analytics environment boundary', () => {
    it.each([
        [true, 'https://www.windy.com/', false],
        [false, 'https://www.windy.com/developer-mode?lat=1', false],
        [false, 'https://www.windy.com/dev/test', false],
        [false, 'https://localhost:9999/', false],
        [false, 'https://windy.com.example.com/', false],
        [false, 'http://www.windy.com/', false],
        [false, 'invalid', false],
        [false, 'https://www.windy.com/plugin/sun-moon-path', true],
        [false, 'https://windy.com/', true],
    ])('local=%s url=%s enabled=%s', (local, url, expected) => {
        expect(analyticsEnvironmentEnabled(local, url)).toBe(expected);
    });
});

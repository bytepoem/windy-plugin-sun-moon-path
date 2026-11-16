import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { compile, preprocess } from 'svelte/compiler';
import sveltePreprocess from 'svelte-preprocess';
import * as internal from 'svelte/internal';
import * as planner from './multiDayPlanner';
import * as solar from './solar';
import { comparisonIntervalLabels } from './favoriteComparisonPeriod';
import { messages } from './locales/MultiDayOverview';
import { labels, messages as comparisonMessages } from './locales/FavoriteComparison';
import { translations as weatherText } from './locales/WeatherTable';
import { messages as horizonText } from './locales/EventHorizon';
import { messages as settingsMessages } from './locales/PluginSettings';
import { translations } from './pluginTranslations';
import { UI_LANGUAGES } from './uiLanguage';

const { tick } = internal as unknown as { tick: () => Promise<void> };
const { init: svelteInit } = internal as unknown as { init: (...parameters: unknown[]) => void };
type State = {
    rows: planner.MultiDayRow[]; startDate: string; mode: 'week' | 'month'; selectedDate: string;
    dateOrientation: 'vertical' | 'horizontal';
    invalidRange: boolean; building: boolean; showSelectedWeek: () => void;
    dateLabel: (date: string, weekday?: boolean) => string;
};
type Instance = {
    $$: { fragment: unknown }; $destroy: () => void; $set: (props: Record<string, unknown>) => void;
    $capture_state: () => State; $inject_state: (state: Partial<State>) => void;
};
let code: string;
let boundaries: Record<string, unknown>;
beforeAll(async () => {
    const filename = 'src/MultiDayOverview.svelte';
    const processed = await preprocess(readFileSync(filename, 'utf8'), sveltePreprocess(), { filename });
    const compiled = compile(processed.code, { filename, generate: 'dom', dev: true, css: 'external' });
    boundaries = {};
    for (const [, bindings] of compiled.js.code.matchAll(/^import\s+(?!["'])([\s\S]*?)\s+from\s+["'][^"']+["'];/gm)) {
        const names = bindings.trim().startsWith('{') ? bindings.replace(/[{}]/g, '').split(',') : [bindings];
        for (const name of names) { boundaries[name.trim().split(/\s+as\s+/).at(-1)!] = () => undefined; }
    }
    code = compiled.js.code.replace(/^import\s+(?!["'])[\s\S]*?\s+from\s+["'][^"']+["'];\n/gm, '')
        .replace(/^import\s+["'][^"']+["'];\n/gm, '')
        .replace('export default MultiDayOverview;', 'globalThis.Compiled = MultiDayOverview;');
});
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Actual compiled instance and scheduler, without mounting a browser DOM. */
const create = () => {
    const context: Record<string, unknown> = { ...boundaries, ...internal, ...planner, ...solar,
        messages, labels, comparisonMessages, translations, weatherText, horizonText, settingsMessages, UI_LANGUAGES,
        comparisonIntervalLabels, dispatch_dev: () => undefined,
        setTimeout, clearTimeout, Date, Intl, Map, Set, JSON,
        // The scheduler test runs the real instance/init lifecycle without a
        // DOM fragment. Child components belong to the compiled render tests.
        init: (component: unknown, options: unknown, instance: unknown, _fragment: unknown, ...rest: unknown[]) =>
            Reflect.apply(svelteInit, null, [component, options, instance, () => false, ...rest]),
    };
    runInNewContext(code, context);
    internal.set_current_component({ $$: { context: new Map(), root: {} } } as never);
    try {
        const component = new (context.Compiled as new (options: unknown) => Instance)({ $$inline: true, props: {
            active: true, contextReady: true, location: { lat: 37.37, lon: 97.37 }, timeZone: 'Asia/Shanghai',
            elevationM: 0, startDate: '2027-06-12', language: 'zh', points: [], weatherStatus: 'ready',
        } });
        component.$$.fragment = false;
        return component;
    } finally { internal.set_current_component(null as never); }
};

describe('compiled multi-day calculation lifecycle', () => {
    it('changes weather presentation without rebuilding astronomy and retains it while hidden', async () => {
        const component = create();
        await vi.runAllTimersAsync();
        const rows = component.$capture_state().rows;
        expect(component.$capture_state().dateOrientation).toBe('horizontal');
        component.$inject_state({ dateOrientation:'vertical' }); await tick();
        component.$set({ active:false }); await tick();
        component.$set({ active:true }); await tick();
        expect(component.$capture_state().dateOrientation).toBe('vertical');
        expect(component.$capture_state().rows).toBe(rows);
        expect(vi.getTimerCount()).toBe(0);
        component.$destroy();
    });
    it('retains completed row identities when hiding and returning', async () => {
        const component = create();
        await vi.runAllTimersAsync();
        const rows = component.$capture_state().rows;
        expect(rows).toHaveLength(7);
        component.$set({ active: false }); await tick();
        component.$set({ active: true }); await tick();
        expect(component.$capture_state().rows).toBe(rows);
        expect(vi.getTimerCount()).toBe(0);
        component.$destroy();
    });
    it('cancels pending work when hidden and resumes without deleting completed rows', async () => {
        const component = create();
        await vi.advanceTimersToNextTimerAsync();
        const first = component.$capture_state().rows[0];
        component.$set({ active: false }); await tick();
        expect(vi.getTimerCount()).toBe(0);
        component.$set({ active: true }); await tick();
        expect(component.$capture_state().rows[0]).toBe(first);
        await vi.runAllTimersAsync();
        expect(component.$capture_state().rows).toHaveLength(7);
        component.$destroy();
    });
    it('releases a queued calculation immediately on destruction', () => {
        const component = create();
        expect(vi.getTimerCount()).toBe(1);
        component.$destroy();
        expect(vi.getTimerCount()).toBe(0);
    });
    it('rejects a selected month date whose following week cannot be calculated', async () => {
        const component = create();
        component.$inject_state({ startDate: '9999-11-28', mode: 'month', selectedDate: '9999-12-27' });
        await tick(); await vi.runAllTimersAsync();
        component.$capture_state().showSelectedWeek(); await tick();
        expect(component.$capture_state()).toMatchObject({ startDate: '9999-11-28', mode: 'month', invalidRange: true });
        component.$destroy();
    });
    it('refreshes date formatting when the language changes without rebuilding astronomy', async () => {
        const component = create(); await vi.runAllTimersAsync();
        const rows = component.$capture_state().rows;
        const chinese = component.$capture_state().dateLabel('2027-06-12', true);
        component.$set({ language: 'en' }); await tick();
        expect(component.$capture_state().dateLabel('2027-06-12', true)).not.toBe(chinese);
        expect(component.$capture_state().rows).toBe(rows);
        component.$destroy();
    });
    it('validates a date received from the parent shared clock before rendering a range', async () => {
        const component = create(); await vi.runAllTimersAsync();
        const rows = component.$capture_state().rows;
        component.$set({ startDate: '9999-12-20' }); await tick();
        expect(component.$capture_state()).toMatchObject({ startDate: '2027-06-12', invalidRange: true });
        expect(component.$capture_state().rows).toBe(rows);
        component.$destroy();
    });
});

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { compile, preprocess } from 'svelte/compiler';
import sveltePreprocess from 'svelte-preprocess';
import * as internal from 'svelte/internal';
import { labels, messages } from './locales/FavoriteComparison';
import * as periodHelpers from './favoriteComparisonPeriod';

// Svelte exposes tick at runtime here; its internal .d.ts omits that export.
const { tick } = internal as unknown as { tick: () => Promise<void> };

type CapturedState = {
    customStart: string;
    customEnd: string;
    customInterval: { start: number; end: number } | null;
    segments: Record<string, number>;
    results: unknown[];
    model: string;
    rangeLabel: (...args: unknown[]) => string;
    session: { preparedTargets: { status: 'ready'; timeZone: string }[]; loadModel: ReturnType<typeof vi.fn> } | null;
    customTimeZone: string | null;
    prepareStatus: string;
};
type Component = {
    $$: { fragment: unknown };
    $set: (props: Record<string, unknown>) => void;
    $destroy: () => void;
    $capture_state: () => CapturedState;
    $inject_state: (state: Partial<CapturedState>) => void;
};
let create: (props: Record<string, unknown>, prepare: ReturnType<typeof vi.fn>) => Component;

/** Run the real compiled client instance with the real Svelte scheduler. No DOM
 * is mounted: these tests exercise input invalidation and request ownership,
 * while rendered content and Windy layouts are verified separately.
 */
beforeAll(async () => {
    const filename = 'src/FavoriteComparison.svelte';
    const processed = await preprocess(readFileSync(filename, 'utf8'), sveltePreprocess(), { filename });
    const { js } = compile(processed.code, { filename, generate: 'dom', dev: true, css: 'external' });
    const boundaries: Record<string, unknown> = {};
    for (const [, bindings] of js.code.matchAll(/^import\s+(?!["'])([\s\S]*?)\s+from\s+["'][^"']+["'];/gm)) {
        const names = bindings.trim().startsWith('{') ? bindings.replace(/[{}]/g, '').split(',') : [bindings];
        for (const name of names) { boundaries[name.trim().split(/\s+as\s+/).at(-1)!] = () => undefined; }
    }
    const code = js.code.replace(/^import\s+(?!["'])[\s\S]*?\s+from\s+["'][^"']+["'];\n/gm, '')
        .replace(/^import\s+["'][^"']+["'];\n/gm, '')
        .replace(/export default FavoriteComparison;/, 'globalThis.CompiledComparison = FavoriteComparison;');
    create = (props, prepare) => {
        const context: Record<string, unknown> = {
            ...boundaries, ...internal, ...periodHelpers,
            // Development registration events do not form part of runtime behavior.
            dispatch_dev: () => undefined,
            labels, messages, DEFAULT_UI_LANGUAGE: 'zh',
            formatPrecipitationRangeMm: (range: { minimum: number }) => `${range.minimum} mm`,
            createFavoriteComparisonPlanner: () => ({ prepare }),
            AbortController, Date, Intl, JSON, Set, Map,
        };
        runInNewContext(code, context);
        internal.set_current_component({ $$: { context: new Map(), root: {} } } as never);
        try {
            const component = new (context.CompiledComparison as new (options: { props: Record<string, unknown>; $$inline: boolean }) => Component)({
                $$inline: true,
                props: { open: false, selectedDate: '2026-11-13', targets: [], currentInstant: new Date(), language: 'en', ...props },
            });
            // No template has been mounted; skip DOM patching while preserving
            // the actual instance update function and destruction callbacks.
            component.$$.fragment = false;
            return component;
        } finally { internal.set_current_component(null as never); }
    };
});

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
};
const flush = async () => { await Promise.resolve(); await tick(); };

describe('compiled comparison input and request lifecycle', () => {
    it.each([
        ['reopening', { open: true }],
        ['changing source', { source: 'open-meteo' }],
        ['changing date', { selectedDate: '2026-11-15' }],
        ['changing sites', { targets: [{ id: 'b', title: 'B', location: { lat: 0, lon: 0 } }] }],
    ] as const)('invalidates a previous local clock immediately when %s', async (reason, changedProps) => {
        const pending = deferred<unknown>();
        const component = create({ open: reason !== 'reopening' }, vi.fn().mockReturnValue(pending.promise));
        const previousSession = {
            preparedTargets: [{ status: 'ready' as const, timeZone: 'Asia/Shanghai' }],
            loadModel: vi.fn().mockReturnValue(pending.promise),
        };
        component.$inject_state({ session: previousSession, prepareStatus: 'ready' });
        await tick();
        expect(component.$capture_state().customTimeZone).toBe('Asia/Shanghai');
        component.$set(changedProps);
        await tick();
        expect(component.$capture_state()).toMatchObject({
            prepareStatus: 'loading', session: null, customTimeZone: null, customInterval: null,
        });
        component.$destroy();
    });

    it('waits for a prepared comparison site before interpreting local inputs', async () => {
        const pending = deferred<unknown>();
        const component = create({ open: true }, vi.fn().mockReturnValue(pending.promise));
        expect(component.$capture_state().customInterval).toBeNull();
        pending.resolve({ preparedTargets: [{ status: 'error' }, { status: 'ready', timeZone: 'Asia/Shanghai' }],
            loadModel: () => new Promise(() => undefined) });
        // The compiled VM awaits a host-realm promise before scheduling Svelte.
        // Wait for the resulting state, not just the first microtask checkpoint.
        await vi.waitFor(() => expect(component.$capture_state().customInterval).toEqual({
            start: Date.UTC(2026, 10, 13, 10), end: Date.UTC(2026, 10, 13, 15),
        }));
        component.$destroy();
    });

    it('does not count atmosphere-only timestamps as missing precipitation', () => {
        const component = create({}, vi.fn());
        const start = Date.UTC(2026, 10, 13);
        const forecastPoints: { timestamp: number; precipMm: number | null }[] = [
            { timestamp: start, precipMm: 0 }, { timestamp: start + 24 * 3_600_000, precipMm: 0 },
        ];
        const points = [forecastPoints[0], { timestamp: start + 3_600_000, precipMm: null }];
        const result = { forecastPoints, weatherStatus: 'ready' };
        const period = { points, precipitationPoints: points, intervals: [{ start, end: start + 24 * 3_600_000 }], coverage: 'full' };
        const renderRange = component.$capture_state().rangeLabel;
        expect(renderRange(result, 'precipitationMm', { precipitation: 'mm' }, period, labels.en, 'windy')).toBe('0 mm');
        forecastPoints[0].precipMm = null;
        const laterForecast = { timestamp: start + 3 * 3_600_000, precipMm: 1 };
        forecastPoints.push(laterForecast);
        points.push(laterForecast);
        expect(renderRange(result, 'precipitationMm', { precipitation: 'mm' }, period, labels.en, 'windy')).toContain('Partial coverage');
        component.$destroy();
    });

    it('prepares once when opening and changing the date and sites together', async () => {
        const pending = deferred<unknown>();
        const prepare = vi.fn().mockReturnValue(pending.promise);
        const component = create({}, prepare);
        component.$set({ open: true, selectedDate: '2026-11-15', targets: [{ id: 'b', title: 'B', location: { lat: 0, lon: 0 } }] });
        await tick();
        expect(prepare).toHaveBeenCalledTimes(1);
        expect(prepare.mock.calls[0][0]).toMatchObject({ dateInput: '2026-11-15', targets: [{ id: 'b' }] });
        component.$set({ open: false });
        await tick();
        const loadModel = vi.fn();
        pending.resolve({ preparedTargets: [], loadModel });
        await flush();
        expect(loadModel).not.toHaveBeenCalled();
        component.$destroy();
    });

    it('updates closed custom inputs and resolves their new date when context becomes ready', async () => {
        const pending = deferred<unknown>();
        const component = create({}, vi.fn().mockReturnValue(pending.promise));
        component.$set({ selectedDate: '2026-11-15' });
        await tick();
        expect(component.$capture_state()).toMatchObject({
            customStart: '2026-11-15T18:00', customEnd: '2026-11-15T23:00',
            customInterval: null,
        });
        component.$set({ open: true });
        await tick();
        pending.resolve({ preparedTargets: [{ status: 'ready', timeZone: 'UTC' }], loadModel: () => new Promise(() => undefined) });
        await vi.waitFor(() => expect(component.$capture_state().customInterval).toEqual({
            start: Date.UTC(2026, 10, 15, 18), end: Date.UTC(2026, 10, 15, 23),
        }));
        component.$destroy();
    });

    it('clears segment indices when date or sites change while closed', async () => {
        const component = create({}, vi.fn());
        component.$inject_state({ segments: { a: 1 } });
        component.$set({ selectedDate: '2026-11-17' });
        await tick();
        expect(component.$capture_state().segments).toEqual({});
        component.$inject_state({ segments: { a: 1 } });
        component.$set({ targets: [{ id: 'b', title: 'B', location: { lat: 0, lon: 0 } }] });
        await tick();
        expect(component.$capture_state().segments).toEqual({});
        component.$destroy();
    });

    it('cancels a stale preparation on source changes and ignores its late result', async () => {
        const old = deferred<unknown>();
        const current = deferred<unknown>();
        const prepare = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
        const component = create({ open: true }, prepare);
        component.$set({ source: 'open-meteo' });
        await tick();
        expect(prepare).toHaveBeenCalledTimes(2);
        expect(prepare.mock.calls[0][0].signal.aborted).toBe(true);
        const staleLoad = vi.fn();
        old.resolve({ preparedTargets: [], loadModel: staleLoad });
        await flush();
        expect(staleLoad).not.toHaveBeenCalled();
        component.$destroy();
        expect(prepare.mock.calls[1][0].signal.aborted).toBe(true);
    });

    it('ignores a late model result after a new model, close or destroy', async () => {
        const old = deferred<unknown[]>();
        const next = deferred<unknown[]>();
        const loadModel = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
        const component = create({ open: true }, vi.fn().mockResolvedValue({ preparedTargets: [], loadModel }));
        await flush();
        component.$set({ initialModel: 'gfs' });
        await flush();
        expect(loadModel.mock.calls.map(args => args[0])).toEqual(['ecmwf', 'gfs']);
        expect(loadModel.mock.calls[0][1].aborted).toBe(true);
        old.resolve([]);
        await flush();
        expect(component.$capture_state().model).toBe('gfs');
        component.$set({ open: false });
        await tick();
        expect(loadModel.mock.calls[1][1].aborted).toBe(true);
        component.$destroy();
        next.resolve([{ diagnosticError: new Error('late') }]);
        await flush();
        expect(component.$capture_state().results).toEqual([]);
    });
});

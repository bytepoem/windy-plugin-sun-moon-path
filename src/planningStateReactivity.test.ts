import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { beforeAll, describe, expect, it } from 'vitest';
import { compile, preprocess } from 'svelte/compiler';
import sveltePreprocess from 'svelte-preprocess';
import * as internal from 'svelte/internal';
import { constrainPlanningDate, createPlanningState, planningDateForLocation, transitionPlanningState, type PlanningState } from './planningState';

const { tick } = internal as unknown as { tick: () => Promise<void> };
type State = { selectedDate: string; planningState: PlanningState; timeZone: string; resolvedContextLocationKey: string };
type Instance = {
    $destroy: () => void;
    $capture_state: () => State;
    $inject_state: (state: Partial<State>) => void;
    inputDate: (date: string) => void;
};
let code: string;

/**
 * Compile the shell's actual date derivation with Svelte's real scheduler. Only
 * host/render effects are omitted. In particular, do not rewrite its dependency
 * list: the input/change gap in a bound date field is the behavior under test.
 */
beforeAll(async () => {
    const filename = 'src/plugin.svelte';
    const processed = await preprocess(readFileSync(filename, 'utf8'), sveltePreprocess(), { filename });
    const compiled = compile(processed.code, { filename, generate: 'dom', dev: true, css: 'external' });
    // Svelte attaches source offsets to ESTree nodes; its ESTree type omits them.
    const nodes = compiled.ast.instance!.content.body as unknown as { type: string; start: number; end: number }[];
    const declarations = nodes.filter(node => node.type === 'LabeledStatement'
        && /constrainPlanningDate\(|planningDateForLocation\(|planningSelection = planningState.selection/.test(processed.code.slice(node.start, node.end)));
    if (declarations.length !== 3) { throw new Error('Shell date derivation not found'); }
    const source = `<script>
        export let selectedDate = '2026-11-16';
        export let planningState = createPlanningState(Date.parse('2026-11-16T12:00:00Z'));
        let planningSelection = planningState.selection;
        export let timeZone = 'Asia/Shanghai';
        export let resolvedContextLocationKey = 'place';
        export let locationKey = 'place';
        export let minimumDate = '2025-01-01';
        ${declarations.map(node => processed.code.slice(node.start, node.end)).join('\n')}
    </script><DateInput bind:selectedDate />`;
    code = compile(source, { filename: 'PlanningDateSchedule.svelte', generate: 'dom', dev: true }).js.code
        .replace(/^import\s+[\s\S]*?\s+from\s+["'][^"']+["'];\n/gm, '')
        .replace(/^import\s+["'][^"']+["'];\n/gm, '')
        .replace('export default PlanningDateSchedule;', 'globalThis.Compiled = PlanningDateSchedule;');
});

const create = (): Instance => {
    let inputDate!: (date: string) => void;
    const context: Record<string, unknown> = { ...internal, constrainPlanningDate, createPlanningState, planningDateForLocation,
        Date, dispatch_dev: () => undefined,
        // Keep the compiler-generated parent binding. The date field's actual
        // DOM input/change handlers are exercised in Windy separately.
        DateInput: class {
            $$ = { bound: {} as Record<string, (value: string) => void>, props: { selectedDate: 0 }, ctx: [] as string[] };
            constructor({ props }: { props: { selectedDate: string } }) {
                this.$$.ctx = [props.selectedDate];
                inputDate = date => this.$$.bound[0](date);
            }
        },
    };
    runInNewContext(code, context);
    internal.set_current_component({ $$: { context: new Map(), root: {} } } as never);
    try {
        const component = new (context.Compiled as new (options: unknown) => Instance)({ $$inline: true });
        // No DOM is mounted; retain the instance scheduler and binding callback.
        (component as unknown as { $$: { fragment: unknown } }).$$.fragment = false;
        component.inputDate = inputDate;
        return component;
    } finally { internal.set_current_component(null as never); }
};

describe('compiled shell date scheduling', () => {
    it('constrains a cross-midnight window before deriving its date and normalizes relocation in the same flush', async () => {
        const component = create();
        try {
            component.$inject_state({ timeZone: 'Antarctica/Rothera',
                planningState: createPlanningState(Date.parse('2025-01-01T02:20:00Z')) });
            await tick();
            expect(component.$capture_state()).toMatchObject({ selectedDate: '2025-01-01',
                planningState: { selection: { mode: 'instant', timestamp: Date.parse('2025-01-01T03:00:00Z') } } });
            component.$inject_state({ timeZone: 'Pacific/Kiritimati',
                planningState: createPlanningState(Date.parse('2024-12-31T10:30:27Z')) });
            await tick();
            expect(component.$capture_state().selectedDate).toBe('2025-01-01');
            component.$inject_state({ timeZone: 'Pacific/Pago_Pago' });
            await tick();
            expect(component.$capture_state()).toMatchObject({ selectedDate: '2025-01-01',
                planningState: { selection: { mode: 'instant', timestamp: Date.parse('2025-01-01T11:00:00Z') } } });
        } finally { component.$destroy(); }
    });
    it('does not create a date self-dependency when only the date or host-input flag changes', async () => {
        const component = create();
        try {
            await tick();
            component.$inject_state({ selectedDate: '2026-11-18' });
            await tick();
            expect(component.$capture_state().selectedDate).toBe('2026-11-18');
            // Preview commit and host-input intent retain selection identity;
            // they must not reset a bound date between input and change either.
            component.$inject_state({ planningState: transitionPlanningState(component.$capture_state().planningState,
                { type: 'host-input' }) });
            await tick();
            expect(component.$capture_state().selectedDate).toBe('2026-11-18');
            const { planningState, timeZone } = component.$capture_state();
            component.$inject_state({ planningState: transitionPlanningState(planningState, { type: 'date', timeZone }) });
            await tick();
            expect(component.$capture_state()).toMatchObject({ selectedDate: '2026-11-18',
                planningState: { selection: { mode: 'clock', clock: '20:00' } } });
        } finally { component.$destroy(); }
    });

    it('keeps the existing bound input/change task ordering when releasing an absolute instant', async () => {
        const component = create();
        try {
            await tick();
            // Svelte invalidates transitive dependencies for a child binding in
            // both HEAD and this refactor. An input-only flush retains that
            // existing behavior; a normal input/change task releases the instant.
            component.inputDate('2026-11-18');
            await tick();
            expect(component.$capture_state().selectedDate).toBe('2026-11-16');
            component.inputDate('2026-11-18');
            const { planningState, timeZone } = component.$capture_state();
            component.$inject_state({ planningState: transitionPlanningState(planningState, { type: 'date', timeZone }) });
            await tick();
            expect(component.$capture_state()).toMatchObject({ selectedDate: '2026-11-18',
                planningState: { selection: { mode: 'clock', clock: '20:00' } } });
        } finally { component.$destroy(); }
    });

    it('waits for location context, then derives the local day of the same absolute instant', async () => {
        const component = create();
        try {
            await tick();
            component.$inject_state({ resolvedContextLocationKey: '', timeZone: 'Pacific/Auckland' });
            await tick();
            expect(component.$capture_state().selectedDate).toBe('2026-11-16');
            component.$inject_state({ resolvedContextLocationKey: 'place' });
            await tick();
            expect(component.$capture_state().selectedDate).toBe('2026-11-17');
            component.$inject_state({ planningState: transitionPlanningState(component.$capture_state().planningState,
                { type: 'clock', clock: '00:15', preview: false }) });
            await tick();
            component.$inject_state({ timeZone: 'America/New_York' });
            await tick();
            expect(component.$capture_state().selectedDate).toBe('2026-11-17');
        } finally { component.$destroy(); }
    });
});

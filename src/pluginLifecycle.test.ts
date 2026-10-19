import { describe, expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { resolve } from 'node:path';
import { rollup } from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';
import rollupSwc from 'rollup-plugin-swc3';

describe('Svelte construction failure boundary', () => {
    it('retires dirty fragments and queued child mounts before creating the diagnostic report', async () => {
        // Real installed Svelte client runtime; the fragment deliberately fails after mounting
        // a child, and parent cleanup deliberately invalidates reactive state.
        const source = `
            import { init, mount_component, SvelteComponent } from 'svelte/internal';
            import { createPluginLifecycle, PLUGIN_LIFECYCLE, constructPlugin,
                onPluginMount, onPluginDestroy } from './src/pluginLifecycle.ts';
            const resources = new Set();
            const scope = createPluginLifecycle();
            const empty = () => ({ c() {}, m() {}, d() {} });
            class Child extends SvelteComponent {
                constructor() {
                    super();
                    init(this, {}, () => {
                        onPluginMount(() => { resources.add('favChanged'); });
                        onPluginDestroy(() => { resources.delete('favChanged'); });
                        return [];
                    }, empty, () => false, {});
                }
            }
            class Parent extends SvelteComponent {
                constructor() {
                    super();
                    init(this, { target: {}, context: new Map([[PLUGIN_LIFECYCLE, scope]]) }, (_self, _props, invalidate) => {
                        onPluginDestroy(() => { invalidate(0, false); });
                        return [true];
                    }, () => {
                        const child = new Child();
                        return {
                            c() {},
                            m(target) { mount_component(child, target); throw Error('mount failed'); },
                            p() { throw Error('half-mounted fragment updated'); },
                            d() {}
                        };
                    }, () => true, {});
                }
            }
            let original = '';
            try { constructPlugin(() => new Parent()); }
            catch (error) { original = error.message; scope.abortConstruction(); scope.dispose(); }
            const report = new SvelteComponent();
            constructPlugin(() => init(report, {target:{}}, () => [], empty, () => false, {}));
            export const result = { original, leaked: [...resources], reportCreated: true };
        `;
        const entry = resolve('diagnostic-lifecycle-fixture.js');
        const bundle = await rollup({
            input: entry,
            plugins: [
                { name: 'lifecycle-fixture', resolveId: id => id === entry ? entry : null, load: id => id === entry ? source : null },
                rollupSwc({ include: ['**/*.ts'] }),
                nodeResolve({ browser: true, exportConditions: ['browser'] }),
            ],
        });
        try {
            const generated = await bundle.generate({ format: 'cjs' });
            const output = generated.output[0];
            if (output.type !== 'chunk') { throw new Error('Missing runtime fixture'); }
            const exports: Record<string, unknown> = {};
            runInNewContext(output.code, { exports }, { timeout: 1000 });
            expect(exports.result).toEqual({ original: 'mount failed', leaked: [], reportCreated: true });
        } finally { await bundle.close(); }
    });
});

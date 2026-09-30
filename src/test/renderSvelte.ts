import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { rollup } from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';
import rollupSvelte from 'rollup-plugin-svelte';
import rollupSwc from 'rollup-plugin-swc3';
import sveltePreprocess from 'svelte-preprocess';

export type RenderComponent = (props: Record<string, unknown>) => string;

const convert = (transform: (value: number, unit: string) => number) =>
    (value: number, precision = 0, unit: string) => Number(transform(value, unit).toFixed(precision));

// A deterministic host boundary, not a substitute for the plugin's unit helpers.
// No metric preferences are exposed: components must use the supplied units.
const hostMetrics = {
    distance: { convertNumber: convert((value, unit) => {
        const metresPerUnit: Record<string, number> = { km: 1000, mi: 1609.344, NM: 1852 };
        if (!(unit in metresPerUnit)) { throw new Error(`Unexpected distance unit: ${unit}`); }
        return value / metresPerUnit[unit];
    }) },
    wind: { convertNumber: convert((value, unit) => {
        if (unit !== 'm/s') { throw new Error(`Unexpected wind unit: ${unit}`); }
        return value;
    }) },
    temp: { convertNumber: convert((value, unit) => {
        if (unit !== '°C') { throw new Error(`Unexpected temperature unit: ${unit}`); }
        return value - 273.15;
    }) },
    rain: { convertNumber: convert((value, unit) => {
        if (unit !== 'mm') { throw new Error(`Unexpected rain unit: ${unit}`); }
        return value;
    }) },
};

/** Compile the actual Svelte template in memory; never assert on its source text.
 * These tests cover rendered states, not DOM events. Windy metric conversions
 * use the deterministic adapter above; all plugin components/helpers are real.
 */
export const compileRenderer = async (component: string): Promise<RenderComponent> => {
    const bundle = await rollup({
        input: resolve('src', component),
        onwarn(warning, warn) {
            if (warning.code !== 'CIRCULAR_DEPENDENCY' && warning.code !== 'UNUSED_EXTERNAL_IMPORT') {
                warn(warning);
            }
        },
        plugins: [
            {
                name: 'test-windy-metrics',
                resolveId: id => id === '@windy/metrics' ? '\0test-windy-metrics' : null,
                load: id => id === '\0test-windy-metrics'
                    ? 'export default globalThis.__testMetrics;'
                    : null,
            },
            rollupSvelte({
                emitCss: false,
                compilerOptions: { generate: 'ssr' },
                preprocess: sveltePreprocess(),
            }),
            rollupSwc({ include: ['**/*.ts', '**/*.svelte'] }),
            nodeResolve(),
        ],
    });
    try {
        const { output } = await bundle.generate({ format: 'cjs' });
        const entry = output.find(item => item.type === 'chunk' && item.isEntry);
        if (!entry || entry.type !== 'chunk') {
            throw new Error('Missing compiled component');
        }
        const module = { exports: {} as { render: (props: Record<string, unknown>) => { html: string } } };
        runInNewContext(entry.code, { module, exports: module.exports, __testMetrics: hostMetrics }, { timeout: 1000 });
        return props => module.exports.render(props).html;
    } finally {
        await bundle.close();
    }
};

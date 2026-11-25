import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { rollup } from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';
import rollupSvelte from 'rollup-plugin-svelte';
import rollupSwc from 'rollup-plugin-swc3';
import sveltePreprocess from 'svelte-preprocess';
import { createRequire } from 'node:module';
import { languageResourceFixture } from './languageResourceFixture';
import { UI_LANGUAGE_OPTIONS } from '../uiLanguage';

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
        input: '\0test-component-entry',
        onwarn(warning, warn) {
            if (warning.code !== 'CIRCULAR_DEPENDENCY' && warning.code !== 'UNUSED_EXTERNAL_IMPORT') {
                warn(warning);
            }
        },
        plugins: [
            {
                name: 'test-language-preparation',
                resolveId: id => id === '\0test-component-entry' ? id : null,
                load: id => id === '\0test-component-entry'
                    ? `export { default } from ${JSON.stringify(resolve('src', component))}; export { prepareUiLanguage } from ${JSON.stringify(resolve('src/localeMessages.ts'))};`
                    : null,
            },
            {
                name: 'test-windy-metrics',
                resolveId: id => id === '@windy/metrics' ? '\0test-windy-metrics'
                    : id === '@windy/fetch' ? '\0test-windy-fetch'
                    : id === '@windy/map' ? '\0test-windy-map' : null,
                load: id => {
                    if (id === '\0test-windy-metrics') {
                        return 'export default globalThis.__testMetrics;';
                    }
                    if (id === '\0test-windy-fetch') {
                        // SSR exercises construction/rendering; a network call is a test failure.
                        return 'export const getElevation = () => { throw new Error("Unexpected SSR elevation request"); };';
                    }
                    if (id === '\0test-windy-map') {
                        // Server rendering must not attach layers or subscribe to the map.
                        return 'export const map = new Proxy({}, {get(){throw new Error("Unexpected SSR map operation");}});';
                    }
                    return null;
                },
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
        const { output } = await bundle.generate({ format: 'cjs', exports: 'named' });
        const entry = output.find(item => item.type === 'chunk' && item.isEntry);
        if (!entry || entry.type !== 'chunk') {
            throw new Error('Missing compiled component');
        }
        const module = { exports: {} as {
            default: { render: (props: Record<string, unknown>) => { html: string } };
            prepareUiLanguage: (language: string) => Promise<void>;
        } };
        runInNewContext(entry.code, {
            module, exports: module.exports, __testMetrics: hostMetrics,
            atob, Blob, Response, DecompressionStream, AbortController, DOMException,
            crypto, TextEncoder, TextDecoder, URL, setTimeout, clearTimeout,
            fetch: async (url: string) => languageResourceFixture(url),
            require: createRequire(import.meta.url), __filename: resolve('src/test/compiled.cjs'),
        }, { timeout: 1000 });
        // Exercise the verified remote resource path before rendering a translated component.
        for (const { value } of UI_LANGUAGE_OPTIONS) { await module.exports.prepareUiLanguage(value); }
        return props => module.exports.default.render(props).html;
    } finally {
        await bundle.close();
    }
};

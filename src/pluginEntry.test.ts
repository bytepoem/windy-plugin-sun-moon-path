import { beforeAll, describe, expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { resolve } from 'node:path';
import { rollup } from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';
import rollupSwc from 'rollup-plugin-swc3';

let entryCode: string;
beforeAll(async () => {
    const stubs: Record<string, string> = {
        '@windy/store': 'export default {get:()=>globalThis.fixture.host};',
        './plugin.svelte': `export default class {
            constructor(options){fixture.mounts.push(options.props);}
            onopen(params){fixture.opens.push(params);}
            $destroy(){fixture.destroyed++;}
        }`,
        './DiagnosticReport.svelte': 'export default class {constructor(){fixture.reports++;} $destroy(){fixture.reportsDestroyed++;}}',
        './LanguageChoice.svelte': 'export default class {constructor(options){fixture.choice=options.props;} $destroy(){}}',
        './diagnosticRuntime': 'export const startDiagnosticRuntime=()=>{fixture.runtimeStarts++;return {mounted(){},stop(){},error(stage,error){fixture.errors.push(error);},report:{}};};',
        './localeMessages': 'export const prepareUiLanguage=()=>fixture.preparation;',
        './pluginPreferences': 'export const loadLanguagePreference=()=>fixture.preference; export const saveLanguagePreference=p=>fixture.saved.push(p);',
        './pluginTranslations': 'export const translations={zh:{diagnosticStartupFailed:"failed"},en:{diagnosticStartupFailed:"failed"}};',
    };
    const bundle = await rollup({
        input: resolve('src/pluginEntry.ts'),
        plugins: [
            {
                name: 'entry-boundary-fixtures',
                resolveId: (id, importer) => importer?.endsWith('/pluginEntry.ts') && id in stubs ? '\0fixture:' + id : null,
                load: id => id.startsWith('\0fixture:') ? stubs[id.slice('\0fixture:'.length)] : null,
            },
            rollupSwc({ include: ['**/*.ts'] }), nodeResolve({ browser: true, exportConditions: ['browser'] }),
        ],
    });
    try {
        const output = (await bundle.generate({ format: 'cjs' })).output[0];
        if (output.type !== 'chunk') { throw new Error('Missing entry bundle'); }
        entryCode = output.code;
    } finally { await bundle.close(); }
});

const setup = (preference = 'auto', host = 'fr') => {
    let complete!: () => void;
    let fail!: () => void;
    const fixture = {
        preference, host, preparation: new Promise<void>((yes, no) => { complete = yes; fail = () => no(Error('decode failed')); }),
        mounts: [] as { initialLanguageSelection: { language: string; preference: string } }[],
        opens: [] as unknown[], saved: [] as string[], destroyed: 0,
        reports: 0, reportsDestroyed: 0, runtimeStarts: 0, errors: [] as unknown[],
        choice: null as null | { choose: (preference: string) => void },
    };
    const element = () => ({
        style: {}, removed: false,
        insertBefore() {}, replaceChildren() {}, append() {},
        remove() { this.removed = true; },
    });
    const module = { exports: null as unknown as new (options: { target: unknown }) => {
        onopen: (params?: unknown) => void; $destroy: () => void;
    } };
    runInNewContext(entryCode, { module, fixture, document: { createElement: element }, console });
    const plugin = new module.exports({ target: element() });
    const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
    return { fixture, plugin, complete, fail, flush };
};

describe('asynchronous language bootstrap boundary', () => {
    it('loads the host language before constructing consumers and replays only the latest pending open', async () => {
        const test = setup();
        test.plugin.onopen({ lat: 1, lon: 2 });
        test.plugin.onopen({ lat: 3, lon: 4 });
        expect(test.fixture.mounts).toHaveLength(0);
        test.complete();
        await test.flush();
        expect(test.fixture.mounts[0].initialLanguageSelection).toEqual({ language: 'fr', preference: 'auto' });
        expect(test.fixture.opens).toEqual([{ lat: 3, lon: 4 }]);
        expect(test.fixture.saved).toEqual([]);
        test.plugin.$destroy();
    });

    it('never constructs or reopens after closing during preparation', async () => {
        const test = setup();
        test.plugin.onopen({ lat: 1, lon: 2 });
        test.plugin.$destroy();
        test.complete();
        await test.flush();
        expect(test.fixture.mounts).toHaveLength(0);
        expect(test.fixture.opens).toHaveLength(0);
    });

    it('preserves an existing override and constructs base languages synchronously', () => {
        const test = setup('zh', 'fr');
        expect(test.fixture.mounts[0].initialLanguageSelection).toEqual({ language: 'zh', preference: 'zh' });
        test.plugin.$destroy();
    });

    it('offers explicit recovery after failure and only saves a successfully applied recovery choice', async () => {
        const test = setup();
        test.fail();
        await test.flush();
        expect(test.fixture.mounts).toHaveLength(0);
        expect(test.fixture.saved).toEqual([]);
        expect(test.fixture.choice).not.toBeNull();
        expect(test.fixture.errors).toHaveLength(1);
        expect(test.fixture.reports).toBe(1);
        test.fixture.choice!.choose('en');
        expect(test.fixture.mounts[0].initialLanguageSelection).toEqual({ language: 'en', preference: 'en' });
        expect(test.fixture.saved).toEqual(['en']);
        expect(test.fixture.reportsDestroyed).toBe(1);
        expect(test.fixture.runtimeStarts).toBe(2);
        test.plugin.$destroy();
    });

    it('offers recovery for unknown runtime languages without silently choosing English', () => {
        const test = setup('auto', 'future-language');
        expect(test.fixture.mounts).toHaveLength(0);
        expect(test.fixture.choice).not.toBeNull();
        expect(test.fixture.saved).toEqual([]);
        test.plugin.$destroy();
        const runtimeStarts = test.fixture.runtimeStarts;
        test.fixture.choice!.choose('en');
        expect(test.fixture.runtimeStarts).toBe(runtimeStarts);
        expect(test.fixture.mounts).toHaveLength(0);
        expect(test.fixture.reportsDestroyed).toBe(1);
    });
});

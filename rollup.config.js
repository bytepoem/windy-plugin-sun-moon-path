import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';

import serve from 'rollup-plugin-serve';
import rollupSvelte from 'rollup-plugin-svelte';
import rollupSwc from 'rollup-plugin-swc3';

import { less } from 'svelte-preprocess-less';
import sveltePreprocess from 'svelte-preprocess';

import { transformCodeToESMPlugin, keyPEM, certificatePEM } from '@windycom/plugin-devtools';

const useSourceMaps = true;
const serveBuild = process.env.SERVE?.trim().toLowerCase() !== 'false';
const betaReleaseNotesSource = 'release-notes/beta.json';
const betaReleaseNotesTarget = 'dist/release-notes/beta.json';
const betaReleaseNotesVirtualId = 'virtual:beta-release-notes-url';
const resolvedBetaReleaseNotesVirtualId = `\0${betaReleaseNotesVirtualId}`;
const betaReleaseNotesUrl = 'https://localhost:9999/release-notes/beta.json';

/** Each watch rebuild gets a unique identity, including uncommitted source changes. */
const diagnosticBuildPlugin = () => {
    const virtualId = '\0virtual:diagnostic-build';
    let build;
    return {
        name: 'diagnostic-build',
        buildStart() {
            let commit = 'unavailable';
            try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); }
            catch { /* Source archives can be built without Git metadata. */ }
            build = { id: randomUUID(), commit, local: serveBuild };
        },
        resolveId: id => id === 'virtual:diagnostic-build' ? virtualId : null,
        shouldTransformCachedModule: ({ id }) => id === virtualId,
        load: id => id === virtualId ? 'export default null;' : null,
        // Rollup re-transforms cached virtual modules without re-running load during watch.
        transform: (_code, id) => id === virtualId ? { code: `export default ${JSON.stringify(build)};`, map: null } : null,
        generateBundle(_options, bundle) {
            const hashes = {};
            for (const [filename, asset] of Object.entries(bundle)) {
                const content = asset.type === 'chunk' ? asset.code : asset.source;
                hashes[filename] = createHash('sha256').update(content).digest('hex');
            }
            const entry = Object.values(bundle).find(asset => asset.type === 'chunk' && asset.isEntry);
            if (entry) {
                this.emitFile({ type: 'asset', fileName: `${entry.fileName}.build.json`, source: JSON.stringify({ ...build, sha256: hashes }, null, 2) });
            }
        },
    };
};

const betaReleaseNotesPlugin = () => ({
    name: 'beta-release-notes',
    resolveId(source) {
        return source === betaReleaseNotesVirtualId ? resolvedBetaReleaseNotesVirtualId : null;
    },
    load(id) {
        if (id !== resolvedBetaReleaseNotesVirtualId) {
            return null;
        }
        return `export default ${serveBuild ? JSON.stringify(betaReleaseNotesUrl) : 'null'};`;
    },
    buildStart() {
        if (!serveBuild) {
            return;
        }
        // Preview the same local release-note snapshot, including corrected series history.
        mkdirSync(dirname(betaReleaseNotesTarget), { recursive: true });
        for (const file of readdirSync(dirname(betaReleaseNotesSource)).filter(file => file.endsWith('.json'))) {
            const source = `release-notes/${file}`;
            this.addWatchFile(source);
            copyFileSync(source, `dist/release-notes/${file}`);
        }
    },
});

const buildConfigurations = {
    src: {
        input: 'src/pluginEntry.ts',
        out: 'plugin',
    },
    example01: {
        input: 'examples/01-hello-world/plugin.svelte',
        out: 'example01/plugin',
    },
    example02: {
        input: 'examples/02-using-vanilla-js/plugin.svelte',
        out: 'example02/plugin',
    },
    example03: {
        input: 'examples/03-boat-tracker/plugin.svelte',
        out: 'example03/plugin',
    },
    example04: {
        input: 'examples/04-aircraft-range/plugin.svelte',
        out: 'example04/plugin',
    },
    example05: {
        input: 'examples/05-airspace-map/plugin.svelte',
        out: 'example05/plugin',
    },
    example06: {
        input: 'examples/06-foehn-chart/plugin.svelte',
        out: 'example06/plugin',
    },
    example07: {
        input: 'examples/07-meteoblue-meteograms/plugin.svelte',
        out: 'example07/plugin',
    },
};

const requiredConfig = process.env.CONFIG || 'src';
const { input, out } = buildConfigurations[requiredConfig];

export default {
    input,
    output: [
        {
            file: `dist/${out}.js`,
            format: 'module',
            sourcemap: true,
        },
        {
            file: `dist/${out}.min.js`,
            format: 'module',
            sourcemap: 'hidden',
            plugins: [terser()],
        },
    ],

    onwarn(warning, warn) {
        // Preserve actionable warnings; the dependency cycle is internal to astronomy-engine.
        if (warning.code === 'CIRCULAR_DEPENDENCY'
            && warning.ids?.every(id => id.includes('/node_modules/astronomy-engine/'))) { return; }
        warn(warning);
    },
    external: id => id.startsWith('@windy/'),
    watch: {
        include: ['src/**', 'examples/**'],
        exclude: 'node_modules/**',
        clearScreen: false,
    },
    plugins: [
        betaReleaseNotesPlugin(),
        diagnosticBuildPlugin(),
        rollupSvelte({
            emitCss: false,
            preprocess: {
                style: less({
                    sourceMap: false,
                    math: 'always',
                }),
                script: data => {
                    const preprocessed = sveltePreprocess({ sourceMap: useSourceMaps });
                    return preprocessed.script(data);
                },
            },
        }),
        rollupSwc({
            include: ['**/*.ts', '**/*.svelte'],
            sourceMaps: useSourceMaps,
        }),
        resolve({
            browser: true,
            mainFields: ['module', 'jsnext:main', 'main'],
            preferBuiltins: false,
            dedupe: ['svelte'],
        }),
        commonjs(),
        transformCodeToESMPlugin(),
        serveBuild &&
            serve({
                contentBase: 'dist',
                host: '0.0.0.0',
                port: 9999,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                },
                https: {
                    key: keyPEM,
                    cert: certificatePEM,
                },
            }),
    ],
};

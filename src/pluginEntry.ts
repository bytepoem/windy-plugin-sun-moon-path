import Plugin from './plugin.svelte';
import DiagnosticReport from './DiagnosticReport.svelte';
import { startDiagnosticRuntime } from './diagnosticRuntime';
import { loadLanguagePreference } from './pluginPreferences';
import { translations } from './pluginTranslations';
import { constructPlugin, createPluginLifecycle, PLUGIN_LIFECYCLE } from './pluginLifecycle';
import type { LatLon } from '@windy/interfaces.d';

/** Minimal Windy entry: diagnostic ownership starts before the main Svelte constructor. */
export default class DiagnosticPlugin {
    private readonly runtime = startDiagnosticRuntime();
    private readonly lifecycle = createPluginLifecycle();
    private readonly container: HTMLDivElement;
    private app: Plugin | null = null;
    private failureReport: DiagnosticReport | null = null;
    private failure: unknown = null;
    private closed = false;

    constructor(options: { target: HTMLElement; anchor?: HTMLElement }) {
        this.container = document.createElement('div');
        this.container.style.display = 'contents';
        options.target.insertBefore(this.container, options.anchor ?? null);
        try {
            this.app = constructPlugin(() => new Plugin({
                target: this.container,
                context: new Map([[PLUGIN_LIFECYCLE, this.lifecycle]]),
                props: {
                    diagnosticRuntime: this.runtime,
                    startupFailed: (error: unknown) => { this.failure = error; },
                },
            }));
            if (this.failure !== null) {
                this.showFailure(this.failure, 'mount');
            } else {
                this.runtime.mounted(this.container);
            }
        } catch (error) {
            this.showFailure(error, 'construct');
        }
    }

    onopen(params?: LatLon) {
        if (this.closed || !this.app) { return; }
        try {
            this.app.onopen(params);
            this.runtime.mounted(this.container);
        } catch (error) {
            this.showFailure(error, 'open');
        }
    }

    $destroy() {
        if (this.closed) { return; }
        this.closed = true;
        this.lifecycle.dispose();
        try {
            this.app?.$destroy();
            this.failureReport?.$destroy();
        } finally {
            this.runtime.stop();
            this.container.remove();
        }
    }

    private showFailure(error: unknown, stage: 'construct' | 'mount' | 'open') {
        this.runtime.error(stage, error, true);
        if (!this.app) { this.lifecycle.abortConstruction(); }
        this.lifecycle.dispose();
        // Abort every created child's resources, even if no root instance was returned.
        try {
            if (this.app) { this.app.$destroy(); }
        } catch (cleanupError) {
            // A host teardown exception must not hide the original failure report.
            console.error('[sun-moon-path] cleanup failed', cleanupError instanceof Error ? cleanupError.name : 'Error');
        }
        this.app = null;
        this.runtime.stop('failure');
        this.container.replaceChildren();
        const language = loadLanguagePreference() ?? 'zh';
        const message = document.createElement('p');
        message.textContent = translations[language].diagnosticStartupFailed;
        message.style.cssText = 'padding:16px;color:inherit;line-height:1.5';
        this.container.append(message);
        this.failureReport = new DiagnosticReport({ target: this.container, props: { report: this.runtime.report, uiLanguage: language } });
    }
}

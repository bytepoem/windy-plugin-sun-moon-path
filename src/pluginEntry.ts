import store from '@windy/store';
import { DEFAULT_UI_LANGUAGE, UI_LANGUAGES, resolveUiLanguage, type UiLanguage, type UiLanguagePreference } from './uiLanguage';
import { prepareUiLanguage } from './localeMessages';
import Plugin from './plugin.svelte';
import DiagnosticReport from './DiagnosticReport.svelte';
import LanguageChoice from './LanguageChoice.svelte';
import { startDiagnosticRuntime } from './diagnosticRuntime';
import { loadLanguagePreference, saveLanguagePreference } from './pluginPreferences';
import { translations } from './pluginTranslations';
import { constructPlugin, createPluginLifecycle, PLUGIN_LIFECYCLE } from './pluginLifecycle';
import type { LatLon } from '@windy/interfaces.d';

/** Minimal Windy entry: diagnostic ownership starts before the main Svelte constructor. */
export default class DiagnosticPlugin {
    private runtime = startDiagnosticRuntime();
    private readonly lifecycle = createPluginLifecycle();
    private readonly container: HTMLDivElement;
    private app: Plugin | null = null;
    private failureReport: DiagnosticReport | null = null;
    private languageChoice: LanguageChoice | null = null;
    private failure: unknown = null;
    private closed = false;
    private language: UiLanguage = DEFAULT_UI_LANGUAGE;
    private pendingOpen: { params?: LatLon } | null = null;
    private bootstrapRevision = 0;
    private languageFailed = false;

    constructor(options: { target: HTMLElement; anchor?: HTMLElement }) {
        this.container = document.createElement('div');
        this.container.style.display = 'contents';
        // Windy keeps the same control order across languages; the plugin follows it.
        this.container.dir = 'ltr';
        options.target.insertBefore(this.container, options.anchor ?? null);
        this.bootstrap(loadLanguagePreference());
    }

    onopen(params?: LatLon) {
        if (this.closed) { return; }
        if (!this.app) { this.pendingOpen = { params }; return; }
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
        this.bootstrapRevision += 1;
        this.pendingOpen = null;
        this.lifecycle.dispose();
        try {
            this.app?.$destroy();
            this.failureReport?.$destroy();
            this.languageChoice?.$destroy();
        } finally {
            this.runtime.stop();
            this.container.remove();
        }
    }

    /** Prepare copy before constructing any consumer. Closing invalidates pending work;
     * opening during preparation is delivered once after the main component exists. */
    private bootstrap(preference: UiLanguagePreference, persist = false) {
        if (this.closed) { return; }
        const revision = ++this.bootstrapRevision;
        this.languageChoice?.$destroy();
        this.languageChoice = null;
        this.failureReport?.$destroy();
        this.failureReport = null;
        if (this.languageFailed) {
            this.runtime.stop();
            this.runtime = startDiagnosticRuntime();
            this.languageFailed = false;
        }
        let language: UiLanguage;
        try {
            language = resolveUiLanguage(preference, store.get('usedLang'));
        } catch (error) {
            this.showLanguageFailure(error);
            return;
        }
        if (language === 'zh' || language === 'en') {
            this.mount(language, preference, persist);
            return;
        }
        const loading = document.createElement('p');
        loading.textContent = translations.en.languageLoadingLabel;
        loading.lang = UI_LANGUAGES.en.locale;
        loading.style.padding = '16px';
        this.container.replaceChildren(loading);
        void prepareUiLanguage(language).then(() => {
            if (!this.closed && revision === this.bootstrapRevision) { this.mount(language, preference, persist); }
        }, error => {
            if (!this.closed && revision === this.bootstrapRevision) { this.showLanguageFailure(error); }
        });
    }

    private mount(language: UiLanguage, preference: UiLanguagePreference, persist: boolean) {
        if (this.closed) { return; }
        this.language = language;
        this.container.replaceChildren();
        try {
            this.app = constructPlugin(() => new Plugin({
                target: this.container,
                context: new Map([[PLUGIN_LIFECYCLE, this.lifecycle]]),
                props: {
                    diagnosticRuntime: this.runtime,
                    initialLanguageSelection: { language, preference },
                    startupFailed: (error: unknown) => { this.failure = error; },
                },
            }));
            if (this.failure !== null) {
                this.showFailure(this.failure, 'mount');
            } else {
                this.runtime.mounted(this.container);
                if (persist) { saveLanguagePreference(preference); }
                if (this.pendingOpen) {
                    const { params } = this.pendingOpen;
                    this.pendingOpen = null;
                    this.onopen(params);
                }
            }
        } catch (error) {
            this.showFailure(error, 'construct');
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
        const language = this.language;
        const message = document.createElement('p');
        message.textContent = translations[language].diagnosticStartupFailed;
        message.lang = UI_LANGUAGES[language].locale;
        message.style.cssText = 'padding:16px;color:inherit;line-height:1.5';
        this.container.append(message);
        this.failureReport = new DiagnosticReport({ target: this.container, props: { report: this.runtime.report, uiLanguage: language } });
    }

    /** A catalog/bootstrap failure offers an explicit choice and retry; it does not
     * silently replace the saved language. This screen creates no host subscriptions. */
    private showLanguageFailure(error: unknown) {
        this.runtime.error('construct', error, true);
        this.runtime.stop('failure');
        this.languageFailed = true;
        this.container.replaceChildren();
        const language = store.get('usedLang') === 'zh' ? 'zh' : 'en';
        this.languageChoice = new LanguageChoice({ target: this.container, props: {
            language,
            initialPreference: loadLanguagePreference(),
            choose: (preference: UiLanguagePreference) => this.bootstrap(preference, true),
        } });
        this.failureReport = new DiagnosticReport({ target: this.container, props: {
            report: this.runtime.report, uiLanguage: language,
        } });
    }
}

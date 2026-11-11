import { UI_LANGUAGES, type UiLanguage } from './uiLanguage';
import { packedTranslations } from './locales/packedTranslations';

type Translator = (source: string, ...values: unknown[]) => string;
const LOCALIZE = Symbol('localized-message');
type LocalizedFunction<Args extends unknown[]> = ((...args: Args) => string) & {
    [LOCALIZE]: (language: UiLanguage) => (...args: Args) => string;
};

let dictionaries: Map<string, Map<string, string>> | null = null;
let loading: Promise<void> | null = null;
const fixedTemplates = new Map<string, { source: string; values: unknown[] }>();
const interpolate = (source: string, values: unknown[]) => source.replace(/\{\{(\d+)\}\}/g, (_, index: string) => String(values[Number(index)]));
const placeholders = (source: string) => (source.match(/\{\{\d+\}\}|\{provider\}/g) ?? []).sort().join('|');

/** The complete catalog travels inside the bundle. Install it atomically after validation;
 * a failed decode can be retried and never leaves partially translated components. */
export const prepareUiLanguage = async (language: UiLanguage): Promise<void> => {
    if (language === 'zh' || language === 'en' || dictionaries) { return; }
    if (!loading) {
        loading = (async () => {
            const bytes = Uint8Array.from(atob(packedTranslations), character => character.charCodeAt(0));
            const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
            const payload: { sources: Record<string, string>; languages: Record<string, Record<string, string>> } = await new Response(stream).json();
            const sources = Object.entries(payload.sources);
            const next = new Map<string, Map<string, string>>();
            for (const code of Object.keys(UI_LANGUAGES).filter(value => value !== 'zh' && value !== 'en')) {
                const catalog = payload.languages[code];
                if (!catalog || Object.keys(catalog).length !== sources.length || sources.length === 0) {
                    throw new Error('Incomplete language catalog: ' + code);
                }
                const translated = new Map<string, string>();
                for (const [id, source] of sources) {
                    const target = catalog[id];
                    if (typeof target !== 'string' || !target.trim() || placeholders(source) !== placeholders(target)) {
                        throw new Error('Invalid language message: ' + code + '/' + id);
                    }
                    translated.set(source, target);
                }
                next.set(code, translated);
            }
            dictionaries = next;
        })().finally(() => { loading = null; });
    }
    await loading;
};

const translator = (language: UiLanguage): Translator => (source, ...values) => {
    if (!source) { return ''; }
    const target = language === 'en' ? source : dictionaries?.get(language)?.get(source);
    if (target === undefined) { throw new Error('Language message is not ready: ' + language + '/' + source); }
    return interpolate(target, values);
};

/** Preserve typed parameters and branch logic while translating the source pattern
 * before interpolation, so names, dates and measured values are never translated. */
export const localized = <Args extends unknown[]>(render: (t: Translator, ...args: Args) => string): LocalizedFunction<Args> => {
    const forLanguage = (language: UiLanguage) => (...args: Args) => render(translator(language), ...args);
    return Object.assign(forLanguage('en'), { [LOCALIZE]: forLanguage });
};

/** Static templates (for example the comparison limit) retain their public string type. */
export const localizedText = (source: string, ...values: unknown[]): string => {
    const rendered = interpolate(source, values);
    fixedTemplates.set(rendered, { source, values });
    return rendered;
};

const localizeValue = (value: unknown, language: UiLanguage): unknown => {
    if (typeof value === 'string') {
        const template = fixedTemplates.get(value);
        return template ? translator(language)(template.source, ...template.values) : translator(language)(value);
    }
    if (typeof value === 'function') {
        const factory = (value as LocalizedFunction<unknown[]>)[LOCALIZE];
        if (!factory) { throw new Error('Unregistered dynamic message'); }
        return factory(language);
    }
    if (Array.isArray(value)) { return value.map(entry => localizeValue(entry, language)); }
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, localizeValue(entry, language)]));
    }
    return value;
};

/** Chinese defines the contract; English must match it. Generated catalogs use that
 * same structure, and their lazy getters are only accessed after prepareUiLanguage. */
export const defineMessages = <T>(messages: { zh: T; en: NoInfer<T> }): Record<UiLanguage, T> => {
    const result = { ...messages } as Record<UiLanguage, T>;
    for (const code of Object.keys(UI_LANGUAGES) as UiLanguage[]) {
        if (code === 'zh' || code === 'en') { continue; }
        let translated: T;
        Object.defineProperty(result, code, { enumerable: true, get: () => {
            // Assign only after the full object succeeds, permitting retries after a load failure.
            translated ??= localizeValue(messages.en, code) as T;
            return translated;
        } });
    }
    return result;
};

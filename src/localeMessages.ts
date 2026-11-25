import { UI_LANGUAGES, type UiLanguage } from './uiLanguage';
import { loadLanguageResource } from './languageResources';

type Translator = (source: string, ...values: unknown[]) => string;
const LOCALIZE = Symbol('localized-message');
type LocalizedFunction<Args extends unknown[]> = ((...args: Args) => string) & {
    [LOCALIZE]: (language: UiLanguage) => (...args: Args) => string;
};

const dictionaries = new Map<string, Map<string, string>>();
const fixedTemplates = new Map<string, { source: string; values: unknown[] }>();
const interpolate = (source: string, values: unknown[]) => source.replace(/\{\{(\d+)\}\}/g, (_, index: string) => String(values[Number(index)]));

/** Built-ins require no request. Install only a complete, verified selected catalog. */
export const prepareUiLanguage = async (language: UiLanguage, signal?: AbortSignal): Promise<void> => {
    signal?.throwIfAborted();
    if (language === 'zh' || language === 'en' || dictionaries.has(language)) { return; }
    const messages = await loadLanguageResource(language, signal);
    signal?.throwIfAborted();
    dictionaries.set(language, messages);
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

/** Plugin-owned language metadata. Adding a language also requires every message catalog.
 * Search capabilities and translated image/release assets are explicit choices, independent
 * of date formatting or an assumption that every non-Chinese language behaves like English.
 */
interface UiLanguageDefinition {
    nativeName: string;
    secondaryName: string;
    secondaryLocale: string;
    locale: string;
    clockLocale: string;
    placeSearch: boolean;
    compactCloudHeadings: boolean;
    releaseNotesLanguage: 'zh' | 'en';
    cloudHelpImage: string;
}

export const UI_LANGUAGES = {
    zh: {
        nativeName: '简体中文', secondaryName: 'Simplified Chinese', secondaryLocale: 'en',
        locale: 'zh-CN', clockLocale: 'zh-CN', placeSearch: true, compactCloudHeadings: true,
        releaseNotesLanguage: 'zh',
        cloudHelpImage: 'https://community.windy.com/assets/uploads/files/1788950340643-74dd941b-faef-4f81-b2a6-7471c71b5d2e-download.png',
    },
    en: {
        nativeName: 'English', secondaryName: '英语', secondaryLocale: 'zh-CN',
        locale: 'en-US', clockLocale: 'en-GB', placeSearch: false, compactCloudHeadings: false,
        releaseNotesLanguage: 'en',
        cloudHelpImage: 'https://community.windy.com/assets/uploads/files/1788952298003-bccb52a8-6794-482b-888f-2274e302e450-download-1.png',
    },
} as const satisfies Record<string, UiLanguageDefinition>;

export type UiLanguage = keyof typeof UI_LANGUAGES;
export const DEFAULT_UI_LANGUAGE: UiLanguage = 'zh';
export const UI_LANGUAGE_OPTIONS = Object.entries(UI_LANGUAGES).map(([value, definition]) => ({
    value: value as UiLanguage,
    ...definition,
}));

/** Stored and DOM values must name an own entry; inherited object keys are invalid. */
export const isUiLanguage = (value: unknown): value is UiLanguage =>
    typeof value === 'string' && Object.prototype.hasOwnProperty.call(UI_LANGUAGES, value);

/** Infer the schema from Chinese, then require the same keys and parameter types in every language. */
export const defineMessages = <T>(messages: { zh: T } & Record<UiLanguage, NoInfer<T>>): Record<UiLanguage, T> => messages;

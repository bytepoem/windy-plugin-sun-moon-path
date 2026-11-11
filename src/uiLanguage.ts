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

const language = (nativeName: string, locale: string, options: Partial<UiLanguageDefinition> = {}): UiLanguageDefinition => ({
    nativeName, secondaryName: new Intl.DisplayNames(['en'], { type: 'language' }).of(new Intl.Locale(locale).baseName) ?? nativeName,
    secondaryLocale: 'en', locale, clockLocale: locale, placeSearch: false,
    compactCloudHeadings: false, releaseNotesLanguage: 'en',
    cloudHelpImage: 'https://community.windy.com/assets/uploads/files/1788952298003-bccb52a8-6794-482b-888f-2274e302e450-download-1.png',
    ...options,
});

export const UI_LANGUAGES = {
    // Lead shared manual-language dropdowns with Chinese variants, then English.
    zh: {
        nativeName: '简体中文', secondaryName: 'Simplified Chinese', secondaryLocale: 'en',
        locale: 'zh-CN', clockLocale: 'zh-CN', placeSearch: true, compactCloudHeadings: true,
        releaseNotesLanguage: 'zh',
        cloudHelpImage: 'https://community.windy.com/assets/uploads/files/1788950340643-74dd941b-faef-4f81-b2a6-7471c71b5d2e-download.png',
    },
    'zh-TW': language('繁体中文', 'zh-TW', { placeSearch: true, compactCloudHeadings: true, releaseNotesLanguage: 'zh',
        cloudHelpImage: 'https://community.windy.com/assets/uploads/files/1788950340643-74dd941b-faef-4f81-b2a6-7471c71b5d2e-download.png' }),
    en: language('English', 'en-US', { secondaryName: '英语', secondaryLocale: 'zh-CN', clockLocale: 'en-GB' }),
    ar: language('عربي', 'ar'),
    bg: language('български език', 'bg'),
    bn: language('বাংলা', 'bn'),
    ca: language('català', 'ca'),
    cs: language('čeština', 'cs'),
    da: language('dansk', 'da'),
    de: language('Deutsch', 'de'),
    el: language('ελληνικά', 'el'),
    es: language('español', 'es'),
    et: language('eesti', 'et'),
    // The host's ISO date controls use the Gregorian calendar in every UI language.
    fa: language('فارسی', 'fa-u-ca-gregory'),
    fi: language('suomi', 'fi'),
    fr: language('français', 'fr'),
    he: language('עברית', 'he'),
    hi: language('हिंदी', 'hi'),
    hr: language('hrvatski jezik', 'hr'),
    hu: language('magyar', 'hu'),
    id: language('Bahasa Indonesia', 'id'),
    is: language('Íslenska', 'is'),
    it: language('Italiano', 'it'),
    ja: language('日本語', 'ja', { compactCloudHeadings: true }),
    ko: language('한국어', 'ko', { compactCloudHeadings: true }),
    lt: language('lietuvių kalba', 'lt'),
    nb: language('Norsk', 'nb'),
    nl: language('Nederlands', 'nl'),
    pl: language('polszczyzna', 'pl'),
    pt: language('Português', 'pt'),
    ro: language('Română', 'ro'),
    ru: language('русский', 'ru'),
    sk: language('slovenčina', 'sk'),
    sl: language('slovenščina', 'sl'),
    sq: language('Shqip', 'sq'),
    sr: language('српски језик', 'sr'),
    sv: language('svenska', 'sv'),
    ta: language('தமிழ்', 'ta'),
    th: language('ไทย', 'th-u-ca-gregory'),
    tr: language('Türkçe', 'tr'),
    uk: language('Українська', 'uk'),
    vi: language('Tiếng Việt', 'vi'),
} as const satisfies Record<string, UiLanguageDefinition>;

export type UiLanguage = keyof typeof UI_LANGUAGES;
export type UiLanguagePreference = UiLanguage | 'auto';
export const DEFAULT_UI_LANGUAGE: UiLanguage = 'zh';
export const UI_LANGUAGE_OPTIONS = Object.entries(UI_LANGUAGES).map(([value, definition]) => ({
    value: value as UiLanguage,
    ...definition,
}));

/** Stored and DOM values must name an own entry; inherited object keys are invalid. */
export const isUiLanguage = (value: unknown): value is UiLanguage =>
    typeof value === 'string' && Object.prototype.hasOwnProperty.call(UI_LANGUAGES, value);

export const isUiLanguagePreference = (value: unknown): value is UiLanguagePreference =>
    value === 'auto' || isUiLanguage(value);

/** `lang` may be auto. Windy's usedLang names the language actually displayed. */
export const resolveUiLanguage = (preference: UiLanguagePreference, usedLang: unknown): UiLanguage => {
    if (isUiLanguage(preference)) { return preference; }
    if (preference !== 'auto') { throw new Error('Unsupported plugin language preference'); }
    if (isUiLanguage(usedLang)) { return usedLang; }
    throw new Error('Unsupported Windy language: ' + String(usedLang));
};

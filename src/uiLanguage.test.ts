import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_UI_LANGUAGE, isUiLanguage, UI_LANGUAGES, UI_LANGUAGE_OPTIONS, type UiLanguage } from './uiLanguage';
import { translations } from './pluginTranslations';
import { compileRenderer, type RenderComponent } from './test/renderSvelte';

const catalogs = import.meta.glob<Record<string, Record<UiLanguage, unknown>>>('./locales/*.ts', { eager: true });

/** Check nested copy and array cardinality, so a new locale cannot omit an entire feature or row. */
const checkShape = (reference: unknown, value: unknown, path: string): void => {
    expect(typeof value, path).toBe(typeof reference);
    if (Array.isArray(reference)) {
        expect(Array.isArray(value), path).toBe(true);
        expect((value as unknown[]).length, path).toBe(reference.length);
        reference.forEach((item, index) => checkShape(item, (value as unknown[])[index], `${path}[${index}]`));
    } else if (reference !== null && typeof reference === 'object') {
        expect(Object.keys(value as object).sort(), path).toEqual(Object.keys(reference).sort());
        for (const [key, item] of Object.entries(reference)) {
            checkShape(item, (value as Record<string, unknown>)[key], `${path}.${key}`);
        }
    }
};

describe('plugin language registration', () => {
    it('accepts registered values and rejects stale or inherited storage/DOM values', () => {
        for (const { value } of UI_LANGUAGE_OPTIONS) {
            expect(isUiLanguage(value)).toBe(true);
        }
        for (const value of [null, undefined, '', 'fr', 'constructor', '__proto__', 'toString', 1]) {
            expect(isUiLanguage(value)).toBe(false);
        }
        expect(isUiLanguage(DEFAULT_UI_LANGUAGE)).toBe(true);
    });

    it('keeps locale formats and existing search/asset choices explicit', () => {
        expect(UI_LANGUAGES.zh.placeSearch).toBe(true);
        expect(UI_LANGUAGES.en.placeSearch).toBe(false);
        expect(UI_LANGUAGES.en.locale).toBe('en-US');
        expect(UI_LANGUAGES.en.clockLocale).toBe('en-GB');
        for (const option of UI_LANGUAGE_OPTIONS) {
            expect(new Intl.DateTimeFormat(option.locale).resolvedOptions().locale).toBeTruthy();
            expect(option.cloudHelpImage).toMatch(/^https:\/\//);
            expect(['zh', 'en']).toContain(option.releaseNotesLanguage);
        }
    });

    it('provides the same complete message schema for every registered language', () => {
        const tables = { shared: { translations }, ...catalogs };
        for (const [moduleName, module] of Object.entries(tables)) {
            for (const [catalogName, catalog] of Object.entries(module)) {
                expect(Object.keys(catalog).sort(), `${moduleName}.${catalogName}`).toEqual(Object.keys(UI_LANGUAGES).sort());
                for (const { value } of UI_LANGUAGE_OPTIONS) {
                    checkShape(catalog[DEFAULT_UI_LANGUAGE], catalog[value], `${moduleName}.${catalogName}.${value}`);
                }
            }
        }
    });
});

let renderNavigation: RenderComponent;
let renderTimeline: RenderComponent;
let renderHelp: RenderComponent;
let renderChoice: RenderComponent;
let renderSearch: RenderComponent;
beforeAll(async () => {
    [renderNavigation, renderTimeline, renderHelp, renderChoice, renderSearch] = await Promise.all([
        compileRenderer('CloudNavigation.svelte'),
        compileRenderer('CloudTimeline.svelte'),
        compileRenderer('CloudHelp.svelte'),
        compileRenderer('LanguageChoice.svelte'),
        compileRenderer('LocationSearch.svelte'),
    ]);
}, 20_000);

describe('compiled language consumers', () => {
    it('constructs search with the default language and preserves each language’s search capabilities', () => {
        const props = {
            apiKeys: { amap: '', baidu: '', tencent: '' }, location: { lat: 23, lon: 113 },
            units: { wind: 'm/s', temperature: '°C', precipitation: 'mm', distance: 'km', elevation: 'm' },
        };
        const chinese = renderSearch(props);
        expect(chinese).toContain('地点搜索');
        expect(chinese).toContain('API Key');
        expect(chinese).not.toContain('id="location-search-latitude"');
        const english = renderSearch({ ...props, language: 'en' });
        expect(english).toContain('id="location-search-latitude"');
        expect(english).toContain('WGS84');
        expect(english).not.toContain('API Key');
    });
    it.each([
        ['zh', '彩虹', '选择当地日期和时间', '云层遮挡说明'],
        ['en', 'Rainbow', 'Choose local date and time', 'Cloud planning guide'],
    ])('renders navigation, timeline and the correct diagram in %s', (language, navigation, dateLabel, helpTitle) => {
        const typedLanguage = language as UiLanguage;
        expect(renderNavigation({ language, active: true, view: 'rainbow' })).toContain(navigation);
        expect(renderTimeline({ language, clock: '16:30', date: '2026-11-10', dateLabel: '11/10' })).toContain(dateLabel);
        const help = renderHelp({ language });
        expect(help).toContain(helpTitle);
        expect(help).toContain(UI_LANGUAGES[typedLanguage].cloudHelpImage);
    });

    it('renders first-use choices from the complete registry', () => {
        const html = renderChoice({});
        for (const option of UI_LANGUAGE_OPTIONS) {
            expect(html).toContain(`value="${option.value}"`);
            expect(html).toContain(option.nativeName);
        }
    });
});

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { languageResourceFixture } from './test/languageResourceFixture';
import { DEFAULT_UI_LANGUAGE, isUiLanguage, UI_LANGUAGES, UI_LANGUAGE_OPTIONS, type UiLanguage } from './uiLanguage';
import { translations } from './pluginTranslations';
import { prepareUiLanguage } from './localeMessages';
import { createCloudSettings } from './cloudProfile';
import { messages as cloudMessages } from './locales/CloudObstruction';
import { compileRenderer, type RenderComponent } from './test/renderSvelte';

const catalogs = import.meta.glob<Record<string, Record<UiLanguage, unknown>>>('./locales/*.ts', { eager: true });
beforeAll(async () => {
    vi.stubGlobal('fetch', async (url: string) => languageResourceFixture(url));
    for (const { value } of UI_LANGUAGE_OPTIONS) { await prepareUiLanguage(value); }
});

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
        for (const value of [null, undefined, '', 'unsupported', 'constructor', '__proto__', 'toString', 1]) {
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
            expect(new Intl.DateTimeFormat(option.locale).resolvedOptions().calendar).toBe('gregory');
            expect(new Intl.DateTimeFormat(option.clockLocale).resolvedOptions().calendar).toBe('gregory');
            expect(option.cloudHelpImage).toMatch(/^https:\/\//);
            expect(['zh', 'en']).toContain(option.releaseNotesLanguage);
        }
    });

    it('provides the same complete message schema for every registered language', () => {
        const tables = { shared: { translations }, ...catalogs };
        for (const [moduleName, module] of Object.entries(tables)) {
            for (const [catalogName, catalog] of Object.entries(module)) {
                if (!catalog || typeof catalog !== 'object' || !Object.hasOwn(catalog, 'zh')) { continue; }
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
let renderClouds: RenderComponent;
beforeAll(async () => {
    [renderNavigation, renderTimeline, renderHelp, renderChoice, renderSearch, renderClouds] = await Promise.all([
        compileRenderer('CloudNavigation.svelte'),
        compileRenderer('CloudTimeline.svelte'),
        compileRenderer('CloudHelp.svelte'),
        compileRenderer('LanguageChoice.svelte'),
        compileRenderer('LocationSearch.svelte'),
        compileRenderer('CloudObstruction.svelte'),
    ]);
}, 20_000);

describe('compiled language consumers', () => {
    it.each(['fr', 'ja', 'zh-TW', 'ar'] as UiLanguage[])('renders cloud column headings as complete phrases in %s', language => {
        const html = renderClouds({
            language, location: { lat: 23, lon: 113 }, forecast: null, status: 'idle', model: 'ecmwf',
            timeZone: 'UTC', timestamp: null, settings: createCloudSettings(), lineOpacity: 100,
            units: { wind: 'm/s', temperature: '°C', precipitation: 'mm', distance: 'km', elevation: 'm' },
            syncError: false, syncing: false,
        });
        expect(html).toMatch(/<thead(?:\s|>)/);
        const table = html.slice(html.indexOf('<thead'), html.indexOf('</thead>'));
        for (const label of [cloudMessages[language].cloudsAtHorizon, cloudMessages[language].tangentDistance, cloudMessages[language].furthestNoClouds]) {
            expect(table).toContain(label);
        }
    });

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

    it('offers following Windy and every manual choice on the startup recovery screen', () => {
        const html = renderChoice({});
        expect(html).toContain('value="auto"');
        expect(html).toContain('跟随 Windy');
        for (const option of UI_LANGUAGE_OPTIONS) {
            expect(html).toContain(`value="${option.value}"`);
            expect(html).toContain(option.nativeName);
        }
    });
});

import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { languageManifest } from './languageManifest';
import { languageResourceFixture } from './test/languageResourceFixture';
import { prepareUiLanguage } from './localeMessages';
import { translations } from './pluginTranslations';
import { messages as pluginMessages } from './locales/plugin';
import { labels as favoriteLabels } from './locales/FavoriteLocations';
import { UI_LANGUAGE_OPTIONS } from './uiLanguage';

const sources: Record<string, string> = JSON.parse(readFileSync('src/locales/source.en.json', 'utf8'));
const resource = (code: string) => {
    const catalog = JSON.parse(readFileSync('src/locales/generated/' + code + '.json', 'utf8'));
    return JSON.stringify({ schema: 1, language: code, contract: languageManifest.contract,
        messages: Object.fromEntries(Object.entries(sources).map(([id, source]) => [source, catalog[id]])) }) + '\n';
};
beforeAll(async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => languageResourceFixture(url)));
    // Runtime consumers below intentionally exercise every language, loading each independently.
    for (const { value } of UI_LANGUAGE_OPTIONS) { await prepareUiLanguage(value); }
});
const placeholders = (text: string) => (text.match(/\{\{\d+\}\}|\{provider\}/g) ?? []).sort();
const properNames = ['Windy', 'Open-Meteo', 'RainViewer', 'ECMWF', 'GFS', 'ICON', 'CAMS', 'WGS84', 'GCJ-02', 'DNI', 'SQM', 'MSL', 'AMSL', 'AGL', 'Bortle'];

describe('complete translated language payload', () => {
    it('retains astronomy context for new/full moon instead of reusing update labels', () => {
        expect(translations.de.phases[4].toLowerCase()).toContain('vollmond');
        expect(translations.fr.phases[4].toLowerCase()).toContain('lune');
        expect(translations.ja.phases[4]).toContain('満月');
        expect(translations['zh-TW'].phases[4]).toContain('滿月');
        for (const { value } of UI_LANGUAGE_OPTIONS) {
            expect(translations[value].phases[0]).not.toBe(translations[value].aboutUpdateTypeLabels.new);
        }
    });

    it('matches the 42 language codes observed in Windy settings', () => {
        const windy = 'en,zh-TW,zh,ja,fr,ko,it,ru,nl,cs,tr,pl,sv,fi,ro,el,hu,hr,ca,da,ar,fa,hi,ta,sk,uk,bg,he,is,lt,et,vi,sl,sr,id,th,sq,pt,nb,es,de,bn';
        expect(UI_LANGUAGE_OPTIONS.map(option => option.value).sort()).toEqual(windy.split(',').sort());
    });

    it('contains exactly the readable catalogs with complete messages and preserved parameters', () => {
        const source: Record<string, string> = JSON.parse(readFileSync('src/locales/source.en.json', 'utf8'));

        const files = readdirSync('src/locales/generated').filter(file => file.endsWith('.json'));
        expect(files).toHaveLength(40);
        for (const filename of files) {
            const catalog: Record<string, string> = JSON.parse(readFileSync('src/locales/generated/' + filename, 'utf8'));
            expect(Object.keys(catalog).sort(), filename).toEqual(Object.keys(source).sort());
            expect(createHash('sha256').update(resource(filename.slice(0, -5))).digest('hex')).toBe(languageManifest.hashes[filename.slice(0, -5) as keyof typeof languageManifest.hashes]);
            for (const [id, target] of Object.entries(catalog)) {
                expect(target.trim(), filename + '/' + id).not.toBe('');
                expect(placeholders(target), filename + '/' + id).toEqual(placeholders(source[id]));
                for (const name of properNames) {
                    if (source[id].includes(name)) { expect(target, filename + '/' + id).toContain(name); }
                }
                // Proper names and units can match English, full explanatory paragraphs cannot.
                if (source[id].length > 100) { expect(target, filename + '/' + id).not.toBe(source[id]); }
            }
        }
        expect(() => execFileSync(process.execPath, ['scripts/language-resources.mjs', '--check'])).not.toThrow();
    });

    it.each(UI_LANGUAGE_OPTIONS)('interpolates dynamic values and both conditional branches in $nativeName', ({ value }) => {
        const text = translations[value];
        expect(text.locationCopyLabel('TEST_LOCATION')).toContain('TEST_LOCATION');
        expect(text.aboutCopyLatestPluginLink('9.99.8')).toContain('9.99.8');
        expect(text.astronomyEventsLabel('DATE_123', false)).toContain('DATE_123');
        expect(text.astronomyEventsLabel('DATE_123', true)).not.toContain('DATE_123');
        expect(pluginMessages[value].unavailableEvent('EVENT_123', true, 'always-up')).toContain('EVENT_123');
        expect(pluginMessages[value].unavailableEvent('EVENT_456', false, 'always-down')).toContain('EVENT_456');
        expect(text.weatherLegend.windSpeedDescription('3', '5', 'm/s', true)).toContain('m/s');
        expect(favoriteLabels[value].compareHint).toContain('5');
        expect(favoriteLabels[value].compareSelection(2)).toContain('2');
        expect(text.weatherLegend.precipitationDescription('1', '2', 'mm')).not.toMatch(/\{\{\d+\}\}/);
    });
});

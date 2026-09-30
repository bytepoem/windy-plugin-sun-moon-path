import { beforeAll, describe, expect, it } from 'vitest';
import { compileRenderer, type RenderComponent } from './test/renderSvelte';
import type { PluginUpdateResult } from './pluginUpdate';

let renderAbout: RenderComponent;
let renderSettings: RenderComponent;
beforeAll(async () => {
    [renderAbout, renderSettings] = await Promise.all([
        compileRenderer('PluginAbout.svelte'),
        compileRenderer('PluginSettings.svelte'),
    ]);
}, 20_000);

const notes = {
    version: '0.11.0', releasedAt: '2026-09-30',
    zh: { title: '规划改进', summary: '更新摘要', items: [{ type: 'fixed' as const, text: '修正视线' }] },
    en: { title: 'Planning improvements', summary: 'Update summary', items: [{ type: 'fixed' as const, text: 'Sightline fix' }] },
};
const available: PluginUpdateResult = {
    status: 'available', channel: 'formal', latestVersion: '0.11.0', releasedAt: notes.releasedAt,
    releaseUrl: null, notes, seriesNotes: [notes], notesStatus: 'loaded',
};
const aboutProps = {
    uiLanguage: 'zh', pluginUpdateStatus: 'available', pluginUpdateResult: available,
    latestPluginVersion: '0.11.0', pluginLinkCopyStatus: 'idle', pluginUpdateNotesRetrying: false,
    copyLatestPluginLink: () => undefined, retryPluginUpdate: () => undefined,
    retryPluginUpdateNotes: () => undefined,
};

describe('compiled about panel states', () => {
    it('distinguishes formal updates, beta previews and the current version', () => {
        expect(renderAbout(aboutProps)).toContain('发现新版本');
        const beta = renderAbout({ ...aboutProps, pluginUpdateResult: { ...available, channel: 'beta' } });
        expect(beta).toContain('测试版更新预览');
        expect(beta).not.toContain('发现新版本');
        const current = renderAbout({ ...aboutProps, pluginUpdateStatus: 'current',
            pluginUpdateResult: { ...available, status: 'current' } });
        expect(current).not.toContain('发现新版本');
        expect(current).toContain('修正视线');
    });

    it('renders the selected language and only that language in the release notes', () => {
        const chinese = renderAbout(aboutProps);
        const english = renderAbout({ ...aboutProps, uiLanguage: 'en' });
        expect(chinese).toContain('规划改进');
        expect(chinese).toContain('修正视线');
        expect(chinese).not.toContain('Sightline fix');
        expect(english).toContain('Planning improvements');
        expect(english).toContain('Sightline fix');
        expect(english).not.toContain('规划改进');
    });

    it('keeps partial notes visible and disables retry while a notes retry is pending', () => {
        const html = renderAbout({
            ...aboutProps,
            pluginUpdateResult: { ...available, notesStatus: 'error' },
            pluginUpdateNotesRetrying: true,
        });
        expect(html).toContain('修正视线');
        expect(html).toMatch(/<button[^>]*disabled[^>]*>\s*正在重新加载/);
        expect(html).toContain('复制 0.11.0 插件链接');
    });

    it('shows a failure or loading state without leaking a previous successful result', () => {
        const failed = renderAbout({ ...aboutProps, pluginUpdateStatus: 'error' });
        expect(failed).not.toContain('修正视线');
        expect(failed).not.toContain('复制 0.11.0 插件链接');
        const loading = renderAbout({ ...aboutProps, pluginUpdateStatus: 'loading' });
        expect(loading).toContain('aria-busy="true"');
        expect(loading).not.toContain('修正视线');
    });

    it('renders clipboard success and failure from the shell without changing update state', () => {
        expect(renderAbout({ ...aboutProps, pluginLinkCopyStatus: 'copied' })).toContain('已复制 0.11.0 插件链接');
        expect(renderAbout({ ...aboutProps, pluginLinkCopyStatus: 'error' })).toContain('复制失败，请重试');
    });
});

const settingsProps = {
    uiLanguage: 'zh', settingsPage: 'preferences',
    units: { wind: 'm/s', temperature: '°C', precipitation: 'mm', distance: 'km', elevation: 'm' },
    initialOverlayPreference: 'satellite', initialOverlayOptions: [{ value: 'satellite' }],
    radarProvider: 'none', radarOverlayStatus: 'disabled', radarOpacityPercent: 65,
    hideLocationSearch: false, directionLineOpacityPercent: 85, showExtendedDistanceMarker: false,
    savedApiKeyProvider: null, locationApiKeyDrafts: { amap: '', baidu: '', tencent: '' },
    locationApiKeys: { amap: '', baidu: '', tencent: '' },
    toggleLanguage: () => undefined, changeInitialOverlayPreference: () => undefined,
    changeRadarProvider: () => undefined, changeRadarOpacity: () => undefined,
    toggleLocationSearch: () => undefined, changeDirectionLineOpacity: () => undefined,
    toggleExtendedDistanceMarker: () => undefined, saveLocationApiKey: () => undefined,
    updateLocationApiKeyDraft: () => undefined, clearLocationApiKey: () => undefined,
};

describe('compiled settings panel states', () => {
    it('renders current preferences and recalculates distance labels on unit changes', () => {
        expect(renderSettings(settingsProps)).toContain('显示 600 km 点');
        const miles = renderSettings({ ...settingsProps, units: { ...settingsProps.units, distance: 'mi' } });
        expect(miles).toContain('373 mi');
        expect(miles).not.toContain('600 km');
        expect(miles).toContain('65%');
        expect(miles).toContain('85%');
    });

    it('switches between preferences and the real guide without showing both', () => {
        const guide = renderSettings({ ...settingsProps, settingsPage: 'guide' });
        expect(guide).not.toContain('id="radar-provider"');
        expect(guide).toContain('银河');
        expect(renderSettings(settingsProps)).toContain('id="radar-provider"');
    });

    it('only renders provider key controls in Chinese and prevents empty saves', () => {
        const chinese = renderSettings(settingsProps);
        expect(chinese).toContain('id="amap-api-key"');
        expect(chinese).toMatch(/<button[^>]*type="submit"[^>]*disabled/);
        const english = renderSettings({ ...settingsProps, uiLanguage: 'en' });
        expect(english).not.toContain('id="amap-api-key"');
        expect(english).toContain('Preferences');
    });
});

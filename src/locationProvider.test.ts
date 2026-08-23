import { describe, expect, it } from 'vitest';

import {
    applyLocationApiKey,
    locationSearchFailureMessage,
} from './locationProvider';

describe('location provider settings', () => {
    it('activates the provider whose API key was saved', () => {
        expect(applyLocationApiKey({
            amap: 'amap-key',
            baidu: '',
            tencent: '',
        }, 'baidu', 'baidu-key')).toEqual({
            provider: 'baidu',
            apiKeys: {
                amap: 'amap-key',
                baidu: 'baidu-key',
                tencent: '',
            },
        });
    });

    it('preserves a provider error instead of replacing it with a generic API key warning', () => {
        expect(locationSearchFailureMessage(
            new Error('此key每日调用量已达到上限'),
            '腾讯',
            '地址搜索失败，请检查 API Key 或稍后重试。',
            'zh',
        )).toBe('腾讯：此key每日调用量已达到上限');
    });

    it('turns known Baidu loader failures into actionable messages', () => {
        expect(locationSearchFailureMessage(
            new Error('BAIDU_SDK_TIMEOUT'),
            '百度',
            '地址搜索失败，请检查 API Key 或稍后重试。',
            'zh',
        )).toBe('百度：地图服务加载超时，请稍后重试。');
    });

    it('explains a Baidu Referer or service permission denial', () => {
        expect(locationSearchFailureMessage(
            new Error('BAIDU_PERMISSION_DENIED'),
            '百度',
            '地址搜索失败，请检查 API Key 或稍后重试。',
            'zh',
        )).toBe('百度：Key 无权限调用地点搜索，请确认已开启 JavaScript API 服务，且 Referer 白名单包含 www.windy.com。');
    });
});

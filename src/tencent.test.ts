import { describe, expect, it, vi } from 'vitest';

import {
    parseTencentSuggestions,
    suggestTencentLocations,
} from './tencent';

describe('Tencent location search', () => {
    it('normalizes suggestions, removes duplicates, and converts GCJ-02 coordinates', () => {
        const results = parseTencentSuggestions([
            {
                id: 'one',
                title: '天安门',
                address: '东长安街',
                location: { lat: 39.908722, lng: 116.397499 },
                ad_info: { province: '北京市', city: '北京市', district: '东城区' },
            },
            {
                id: 'one',
                title: '重复天安门',
                location: { lat: 39.908722, lng: 116.397499 },
            },
            { id: 'missing-location', title: '无坐标' },
        ], { lat: 39.9, lon: 116.4 });

        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({
            id: 'one',
            name: '天安门',
            province: '北京市',
            city: '北京市',
            area: '东城区',
            address: '东长安街',
        });
        expect(results[0].wgs84.lat).toBeCloseTo(39.9073, 3);
        expect(results[0].wgs84.lon).toBeCloseTo(116.3913, 3);
    });

    it('builds a JSONP suggestion request with GCJ-02 location bias', async () => {
        const requestedUrls: URL[] = [];
        const requester = vi.fn(async ({ url: requestUrl }: { url: URL }) => {
            requestedUrls.push(new URL(requestUrl));
            return { status: 0, data: [] };
        });

        await suggestTencentLocations({
            apiKey: ' tencent-test-key ',
            keyword: ' 广州塔 ',
            origin: { lat: 23.105, lon: 113.319 },
            requester,
        });

        const url = requestedUrls[0];
        expect(url.host).toBe('apis.map.qq.com');
        expect(url.pathname).toBe('/ws/place/v1/suggestion');
        expect(url.searchParams.get('key')).toBe('tencent-test-key');
        expect(url.searchParams.get('keyword')).toBe('广州塔');
        expect(url.searchParams.get('output')).toBe('jsonp');
        expect(url.searchParams.get('location')).toMatch(/^23\.10\d+,113\.32\d+$/);
    });

    it('surfaces Tencent API errors', async () => {
        const requester = vi.fn(async () => ({ status: 311, message: 'key格式错误' }));

        await expect(suggestTencentLocations({
            apiKey: 'bad-key',
            keyword: '天安门',
            requester,
        })).rejects.toThrow('key格式错误');
    });
});

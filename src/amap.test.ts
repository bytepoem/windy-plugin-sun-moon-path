import { describe, expect, it, vi } from 'vitest';

import {
    gcj02ToWgs84,
    parseAmapDistrict,
    suggestAmapLocations,
    wgs84ToGcj02,
} from './amap';

describe('Amap location search', () => {
    it('round-trips mainland coordinates between WGS84 and GCJ-02', () => {
        const wgs84 = { lat: 39.90735, lon: 116.39125 };
        const gcj02 = wgs84ToGcj02(wgs84);
        const restored = gcj02ToWgs84(gcj02);

        expect(gcj02.lat).not.toBeCloseTo(wgs84.lat, 4);
        expect(gcj02.lon).not.toBeCloseTo(wgs84.lon, 4);
        expect(restored.lat).toBeCloseTo(wgs84.lat, 6);
        expect(restored.lon).toBeCloseTo(wgs84.lon, 6);
    });

    it('leaves coordinates outside mainland China unchanged', () => {
        const london = { lat: 51.5074, lon: -0.1278 };

        expect(wgs84ToGcj02(london)).toEqual(london);
        expect(gcj02ToWgs84(london)).toEqual(london);
    });

    it('normalizes input tips and discards suggestions without coordinates', async () => {
        const requestedUrls: string[] = [];
        const fetcher = vi.fn(async (input: string | URL | Request) => {
            requestedUrls.push(String(input));
            return new Response(JSON.stringify({
                status: '1',
                tips: [
                    { id: 'one', name: '天安门', district: '北京市东城区', address: '东长安街', location: '116.397499,39.908722' },
                    { id: 'district', name: '北京市', district: '北京市', location: [] },
                    { id: 'empty-latitude', name: '无效地点', district: '北京市', location: '116.3,' },
                    { id: 'invalid-longitude', name: '无效地点', district: '北京市', location: '181,39.9' },
                    { id: 'extra-coordinate', name: '无效地点', district: '北京市', location: '116.3,39.9,1' },
                ],
            }), { status: 200 });
        });

        const results = await suggestAmapLocations({
            apiKey: 'test-key',
            keyword: '天安门',
            origin: { lat: 39.9, lon: 116.4 },
            fetcher,
        });

        const requestUrls = requestedUrls.map(value => new URL(value));
        expect(requestUrls.map(url => url.host)).toEqual(['restapi.amap.com']);
        expect(requestUrls.map(url => url.pathname)).toEqual(['/v3/assistant/inputtips']);
        expect(requestUrls.every(url => url.searchParams.get('key') === 'test-key')).toBe(true);
        expect(requestUrls[0].searchParams.get('datatype')).toBe('poi');
        expect(requestUrls.every(url => !url.searchParams.has('location'))).toBe(true);
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('天安门');
        expect(results[0].city).toBe('北京市');
        expect(results[0].area).toBe('东城区');
        expect(results[0].distanceKm).toBeGreaterThan(0);
        expect(results[0].wgs84.lat).toBeCloseTo(39.9073, 3);
        expect(results[0].wgs84.lon).toBeCloseTo(116.3913, 3);
    });

    it('sorts matching places by straight-line distance from the observer', async () => {
        const fetcher = vi.fn(async () => new Response(JSON.stringify({
            status: '1',
            tips: [
                { id: 'zunyi', name: '沙坝水库', district: '贵州省遵义市播州区', location: '106.993847,27.477121' },
                { id: 'qingyuan', name: '沙坝水库', district: '广东省清远市阳山县', location: '112.914137,24.577072' },
                { id: 'wenshan', name: '沙坝水库', district: '云南省文山壮族苗族自治州广南县', location: '105.060485,24.007466' },
            ],
        }), { status: 200 }));

        const results = await suggestAmapLocations({
            apiKey: 'test-key',
            keyword: '沙坝水库',
            origin: { lat: 23.05, lon: 113.37 },
            fetcher,
        });

        expect(results.map(result => result.id)).toEqual(['qingyuan', 'zunyi', 'wenshan']);
        expect(results[0].city).toBe('清远市');
        expect(results[0].area).toBe('阳山县');
        expect(results[2].city).toBe('文山壮族苗族自治州');
        expect(results[2].area).toBe('广南县');
    });

    it('splits direct municipalities and autonomous regions into city and area labels', () => {
        expect(parseAmapDistrict('重庆市梁平区')).toEqual({
            province: '重庆市',
            city: '重庆市',
            area: '梁平区',
        });
        expect(parseAmapDistrict('广西壮族自治区桂林市阳朔县')).toEqual({
            province: '广西壮族自治区',
            city: '桂林市',
            area: '阳朔县',
        });
    });

    it('surfaces Amap API errors without returning partial results', async () => {
        const fetcher = vi.fn(async () => new Response(JSON.stringify({
            status: '0',
            info: 'INVALID_USER_KEY',
        }), { status: 200 }));

        await expect(suggestAmapLocations({
            apiKey: 'bad-key',
            keyword: '天安门',
            fetcher,
        })).rejects.toThrow('INVALID_USER_KEY');
    });
});

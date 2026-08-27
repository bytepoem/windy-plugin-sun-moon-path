import { describe, expect, it } from 'vitest';

import {
    favoriteDistanceLabel,
    filterFavoritePlaceItems,
    favoriteLocationSelection,
    favoritePlaceItems,
    locationFavorites,
    matchingLocationFavorite,
    setLocationFavoriteState,
    type LocationFavorite,
} from './favoritePlaces';
import { favoriteMetricsLocationKey, type FavoriteMetricUpdate } from './favoriteMetrics';

const favorite = (
    id: string,
    title: string,
    lat: number,
    lon: number,
    updated = 1,
): LocationFavorite => ({
    id,
    title,
    lat,
    lon,
    type: 'fav',
    updated,
});

describe('favorite places', () => {
    it('keeps only ordinary saved locations with valid coordinates', () => {
        const favorites = locationFavorites([
            favorite('place', '观测点', 23.1, 113.3),
            {
                id: 'airport',
                title: 'Airport',
                lat: 23.4,
                lon: 113.2,
                type: 'airport',
                icao: 'ZGGG',
                updated: 1,
            },
            favorite('invalid', '无效坐标', Number.NaN, 113.3),
        ]);

        expect(favorites.map(item => item.id)).toEqual(['place']);
    });

    it('matches only the same stored coordinate within one metre', () => {
        const samePlace = favorite('same', '同一地点', 23.100005, 113.3);

        expect(matchingLocationFavorite([samePlace], { lat: 23.1, lon: 113.3 }, '当前地点')?.id)
            .toBe('same');
        expect(matchingLocationFavorite(
            [favorite('nearby', '附近不同地点', 23.1001, 113.3)],
            { lat: 23.1, lon: 113.3 },
            '当前地点',
        )).toBeNull();
    });

    it('matches the same named place within 100 metres without merging a differently named nearby place', () => {
        const sameNamed = favorite('same-named', '北亭村, 小谷围街道 · 广州市', 23.052047, 113.369387);
        const differentlyNamed = favorite('different', '附近观测点', 23.052047, 113.369387);
        const currentLocation = { lat: 23.052, lon: 113.37 };

        expect(matchingLocationFavorite(
            [differentlyNamed, sameNamed],
            currentLocation,
            '北亭村, 小谷围街道 · 广州市',
        )?.id).toBe('same-named');
        expect(matchingLocationFavorite(
            [differentlyNamed],
            currentLocation,
            '北亭村, 小谷围街道 · 广州市',
        )).toBeNull();
    });

    it('applies the 100 metre same-name boundary and normalizes equivalent titles', () => {
        const currentLocation = { lat: 0, lon: 0 };
        const withinBoundary = favorite('within', ' 北亭村,   小谷围街道 · 广州市 ', 0.000899, 0);
        const outsideBoundary = favorite('outside', '北亭村, 小谷围街道 · 广州市', 0.00091, 0);

        expect(matchingLocationFavorite(
            [outsideBoundary, withinBoundary],
            currentLocation,
            '北亭村, 小谷围街道 · 广州市',
        )?.id).toBe('within');
        expect(matchingLocationFavorite(
            [outsideBoundary],
            currentLocation,
            '北亭村, 小谷围街道 · 广州市',
        )).toBeNull();
    });

    it('chooses only the nearest current item when several historical duplicates remain', () => {
        const title = '北亭村, 小谷围街道 · 广州市';
        const currentLocation = { lat: 23.052, lon: 113.37 };
        const nearest = favorite('nearest', title, 23.052047, 113.369387);
        const farther = favorite('farther', title, 23.052012, 113.369233);

        const items = favoritePlaceItems(
            [farther, nearest],
            currentLocation,
            null,
            title,
        );

        expect(items.filter(item => item.isCurrent).map(item => item.favorite.id)).toEqual(['nearest']);
    });

    it('sorts strictly by GPS distance even when the selected favorite is farther away', () => {
        const current = favorite('current', '当前', 23.2, 113.2);
        const near = favorite('near', '附近', 23.01, 113);
        const far = favorite('far', '远处', 24, 113);

        const items = favoritePlaceItems(
            [far, current, near],
            { lat: 23.2, lon: 113.2 },
            { lat: 23, lon: 113 },
        );

        expect(items.map(item => item.favorite.id)).toEqual(['near', 'current', 'far']);
        expect(items[1].isCurrent).toBe(true);
    });

    it('filters favorite names locally without changing their existing order', () => {
        const items = favoritePlaceItems(
            [
                favorite('yingde', '英德市', 24.2, 113.4),
                favorite('beiting', '北亭村, 小谷围街道 · 广州市', 23.05, 113.37),
                favorite('shaoguan', '韶关市', 24.8, 113.6),
            ],
            { lat: 23.05, lon: 113.37 },
            null,
            '北亭村, 小谷围街道 · 广州市',
        );

        expect(filterFavoritePlaceItems(items, '  小谷围  ').map(item => item.favorite.id))
            .toEqual(['beiting']);
        expect(filterFavoritePlaceItems(items, '').map(item => item.favorite.id))
            .toEqual(items.map(item => item.favorite.id));
    });

    it('sorts by the most recent favorite timestamp when recent order is selected', () => {
        const items = favoritePlaceItems(
            [
                favorite('oldest', '最早收藏', 23.1, 113.1, 10),
                favorite('newest', '最近收藏', 24.1, 114.1, 30),
                favorite('middle', '中间收藏', 25.1, 115.1, 20),
            ],
            { lat: 23.1, lon: 113.1 },
            { lat: 23.1, lon: 113.1 },
            '最早收藏',
            'recent',
        );

        expect(items.map(item => item.favorite.id)).toEqual(['newest', 'middle', 'oldest']);
    });

    it('sorts known elevations from high to low and keeps missing values last', () => {
        const low = favorite('low', '低海拔', 23.1, 113.1, 10);
        const highOld = favorite('high-old', '高海拔旧收藏', 24.1, 114.1, 20);
        const highRecent = favorite('high-recent', '高海拔新收藏', 25.1, 115.1, 30);
        const missing = favorite('missing', '无海拔', 26.1, 116.1, 40);
        const metrics: Record<string, FavoriteMetricUpdate> = {
            [favoriteMetricsLocationKey(low)]: { elevationM: 20 },
            [favoriteMetricsLocationKey(highOld)]: { elevationM: 800 },
            [favoriteMetricsLocationKey(highRecent)]: { elevationM: 800 },
            [favoriteMetricsLocationKey(missing)]: { elevationM: null },
        };

        const items = favoritePlaceItems(
            [missing, low, highOld, highRecent],
            { lat: 23.1, lon: 113.1 },
            null,
            '低海拔',
            'elevation',
            metrics,
        );

        expect(items.map(item => item.favorite.id)).toEqual(['high-recent', 'high-old', 'low', 'missing']);
    });

    it('sorts known light-pollution levels from low to high and keeps missing values last', () => {
        const darkest = favorite('darkest', '暗空', 23.1, 113.1, 10);
        const middle = favorite('middle', '中等', 24.1, 114.1, 20);
        const brightest = favorite('brightest', '明亮', 25.1, 115.1, 30);
        const missing = favorite('missing', '无数据', 26.1, 116.1, 40);
        const point = (estimatedBortle: number): NonNullable<FavoriteMetricUpdate['lightPollution']> => ({
            year: 2025,
            sqm: 20,
            brightnessRatio: 2,
            estimatedBortle,
            observingConditions: {
                milkyWay: 'hard-to-discern',
                zodiacalLight: 'faint',
                andromedaGalaxy: 'visible',
                triangulumGalaxy: 'not-visible',
                groundVisibility: 'distant-objects',
            },
        });
        const metrics: Record<string, FavoriteMetricUpdate> = {
            [favoriteMetricsLocationKey(darkest)]: { lightPollution: point(2.1) },
            [favoriteMetricsLocationKey(middle)]: { lightPollution: point(5.4) },
            [favoriteMetricsLocationKey(brightest)]: { lightPollution: point(8.8) },
            [favoriteMetricsLocationKey(missing)]: { lightPollution: null },
        };

        const items = favoritePlaceItems(
            [missing, brightest, middle, darkest],
            { lat: 23.1, lon: 113.1 },
            null,
            '暗空',
            'lightPollution',
            metrics,
        );

        expect(items.map(item => item.favorite.id)).toEqual(['darkest', 'middle', 'brightest', 'missing']);
    });

    it('uses the displayed one-decimal pollution level before the recent-time tie-breaker', () => {
        const older = favorite('older', '旧收藏', 23.1, 113.1, 10);
        const recent = favorite('recent', '新收藏', 24.1, 114.1, 20);
        const point = (estimatedBortle: number): NonNullable<FavoriteMetricUpdate['lightPollution']> => ({
            year: 2025,
            sqm: 21,
            brightnessRatio: 1,
            estimatedBortle,
            observingConditions: {
                milkyWay: 'broad-structure',
                zodiacalLight: 'zenith-visible',
                andromedaGalaxy: 'very-obvious',
                triangulumGalaxy: 'averted-barely-visible',
                groundVisibility: 'distant-large-objects',
            },
        });
        const metrics: Record<string, FavoriteMetricUpdate> = {
            [favoriteMetricsLocationKey(older)]: { lightPollution: point(3.41) },
            [favoriteMetricsLocationKey(recent)]: { lightPollution: point(3.44) },
        };

        const items = favoritePlaceItems(
            [older, recent],
            { lat: 23.1, lon: 113.1 },
            null,
            '旧收藏',
            'lightPollution',
            metrics,
        );

        expect(items.map(item => item.favorite.id)).toEqual(['recent', 'older']);
        expect(items.map(item => item.lightPollutionLevel)).toEqual([3.4, 3.4]);
    });

    it('formats compact distance labels and builds a normal location selection', () => {
        expect(favoriteDistanceLabel(0.62, false)).toBe('620 m');
        expect(favoriteDistanceLabel(74.4, false)).toBe('74 km');
        expect(favoriteDistanceLabel(null, false)).toBe('--');
        expect(favoriteDistanceLabel(10, true)).toBe('current');

        expect(favoriteLocationSelection(
            favorite('saved', '南昆山观景台', 23.63, 114.02),
            { lat: 23.13, lon: 113.26 },
            {
                elevationM: 658,
                lightPollution: {
                    year: 2025,
                    sqm: 20.49,
                    brightnessRatio: 2.5,
                    estimatedBortle: 5,
                    observingConditions: {
                        milkyWay: 'broad-structure',
                        zodiacalLight: 'zenith-visible',
                        andromedaGalaxy: 'very-obvious',
                        triangulumGalaxy: 'averted-barely-visible',
                        groundVisibility: 'distant-large-objects',
                    },
                },
            },
        )).toMatchObject({
            id: 'favorite:saved',
            name: '南昆山观景台',
            wgs84: { lat: 23.63, lon: 114.02 },
            elevationM: 658,
            lightPollution: {
                year: 2025,
                sqm: 20.49,
                estimatedBortle: 5,
            },
        });
    });

    it('re-reads favorites before writing and never removes a nearby distinct place', async () => {
        const nearby = favorite('nearby', '附近收藏', 23.1002, 113.3);
        const added: unknown[] = [];
        const removed: string[] = [];

        const outcome = await setLocationFavoriteState({
            api: {
                getAll: async () => [nearby],
                add: async item => {
                    added.push(item);
                    return 'new-favorite';
                },
                remove: async id => {
                    removed.push(id);
                },
            },
            location: { lat: 23.1, lon: 113.3 },
            title: '当前地点',
            targetState: 'saved',
        });

        expect(outcome).toBe('saved');
        expect(added).toHaveLength(1);
        expect(removed).toEqual([]);
    });

    it('does not add another favorite when the same named place is already saved nearby', async () => {
        const added: unknown[] = [];
        const outcome = await setLocationFavoriteState({
            api: {
                getAll: async () => [favorite(
                    'existing',
                    '北亭村, 小谷围街道 · 广州市',
                    23.052047,
                    113.369387,
                )],
                add: async item => {
                    added.push(item);
                    return 'new-favorite';
                },
                remove: async () => undefined,
            },
            location: { lat: 23.052, lon: 113.37 },
            title: '北亭村, 小谷围街道 · 广州市',
            targetState: 'saved',
        });

        expect(outcome).toBe('unchanged');
        expect(added).toEqual([]);
    });

    it('removes the exact current favorite using the latest SDK snapshot', async () => {
        const removed: string[] = [];
        const outcome = await setLocationFavoriteState({
            api: {
                getAll: async () => [favorite('current', '当前地点', 23.1, 113.3)],
                add: async () => null,
                remove: async id => {
                    removed.push(id);
                },
            },
            location: { lat: 23.1, lon: 113.3 },
            title: '当前地点',
            targetState: 'removed',
        });

        expect(outcome).toBe('removed');
        expect(removed).toEqual(['current']);
    });

    it('removes every historical duplicate matching the current place', async () => {
        const removed: string[] = [];
        const title = '北亭村, 小谷围街道 · 广州市';
        const outcome = await setLocationFavoriteState({
            api: {
                getAll: async () => [
                    favorite('nearest', title, 23.052047, 113.369387),
                    favorite('farther', title, 23.052012, 113.369233),
                    favorite('different', '附近观测点', 23.052047, 113.369387),
                ],
                add: async () => null,
                remove: async id => {
                    removed.push(id);
                },
            },
            location: { lat: 23.052, lon: 113.37 },
            title,
            targetState: 'removed',
        });

        expect(outcome).toBe('removed');
        expect(removed).toEqual(['nearest', 'farther']);
    });

    it('keeps a save action as save when another surface already added the location', async () => {
        const added: unknown[] = [];
        const removed: string[] = [];
        const outcome = await setLocationFavoriteState({
            api: {
                getAll: async () => [favorite('external', '外部新增', 23.1, 113.3)],
                add: async item => {
                    added.push(item);
                    return 'new-favorite';
                },
                remove: async id => {
                    removed.push(id);
                },
            },
            location: { lat: 23.1, lon: 113.3 },
            title: '当前地点',
            targetState: 'saved',
        });

        expect(outcome).toBe('unchanged');
        expect(added).toEqual([]);
        expect(removed).toEqual([]);
    });

    it('keeps a remove action as remove when another surface already removed the location', async () => {
        const added: unknown[] = [];
        const removed: string[] = [];
        const outcome = await setLocationFavoriteState({
            api: {
                getAll: async () => [],
                add: async item => {
                    added.push(item);
                    return 'new-favorite';
                },
                remove: async id => {
                    removed.push(id);
                },
            },
            location: { lat: 23.1, lon: 113.3 },
            title: '当前地点',
            targetState: 'removed',
        });

        expect(outcome).toBe('unchanged');
        expect(added).toEqual([]);
        expect(removed).toEqual([]);
    });
});

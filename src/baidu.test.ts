import { describe, expect, it, vi } from 'vitest';

import {
    bd09ToGcj02,
    disposeBaiduSdk,
    parseBaiduPois,
    suggestBaiduLocations,
} from './baidu';

describe('Baidu location search', () => {
    it('converts BD-09 coordinates to GCJ-02', () => {
        const converted = bd09ToGcj02({ lat: 39.915, lon: 116.404 });

        expect(converted.lat).toBeCloseTo(39.90865, 4);
        expect(converted.lon).toBeCloseTo(116.39763, 4);
    });

    it('normalizes local search results and discards invalid or duplicate POIs', () => {
        const results = parseBaiduPois([
            {
                uid: 'one',
                title: '天安门',
                province: '北京市',
                city: '北京市',
                address: '东长安街',
                point: { lng: 116.403874, lat: 39.914889 },
            },
            {
                uid: 'one',
                title: '重复天安门',
                point: { lng: 116.403874, lat: 39.914889 },
            },
            { uid: 'missing-point', title: '无坐标' },
        ], { lat: 39.9, lon: 116.4 });

        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({
            id: 'one',
            name: '天安门',
            province: '北京市',
            city: '北京市',
            address: '东长安街',
        });
        expect(results[0].wgs84.lat).toBeCloseTo(39.9073, 3);
        expect(results[0].wgs84.lon).toBeCloseTo(116.3913, 3);
        expect(results[0].distanceKm).toBeGreaterThan(0);
    });

    it('passes the trimmed key, keyword, and abort signal to the JSAPI searcher', async () => {
        const controller = new AbortController();
        const origin = { lat: 23.105, lon: 113.319 };
        const searcher = vi.fn(async () => [{
            uid: 'one',
            title: '广州塔',
            point: { lng: 113.3307, lat: 23.113 },
        }]);

        const results = await suggestBaiduLocations({
            apiKey: ' baidu-test-key ',
            keyword: ' 广州塔 ',
            origin,
            signal: controller.signal,
            searcher,
        });

        expect(searcher).toHaveBeenCalledWith('baidu-test-key', '广州塔', origin, controller.signal);
        expect(results[0].name).toBe('广州塔');
    });

    it('uses the current WGS84 location as the LocalSearch region', async () => {
        let searchLocation: unknown;
        class Point {
            constructor(public lng: number, public lat: number) {}
        }
        class LocalSearch {
            private callback: ((result: {
                getCurrentNumPois: () => number;
                getPoi: () => null;
            }) => void) | null = null;

            constructor(location: unknown) {
                searchLocation = location;
            }

            setSearchCompleteCallback(callback: typeof this.callback) {
                this.callback = callback;
            }

            search() {
                this.callback?.({
                    getCurrentNumPois: () => 0,
                    getPoi: () => null,
                });
            }

            getStatus() {
                return 0;
            }

            clearResults() {}
        }
        vi.stubGlobal('window', { BMap: { LocalSearch, Point } });

        try {
            await suggestBaiduLocations({
                apiKey: 'test-key',
                keyword: '潘家洞',
                origin: { lat: 24.91, lon: 112.659 },
            });

            expect(searchLocation).toBeInstanceOf(Point);
            expect(searchLocation).toMatchObject({
                lat: expect.closeTo(24.913, 2),
                lng: expect.closeTo(112.67, 2),
            });
        } finally {
            disposeBaiduSdk();
            vi.unstubAllGlobals();
        }
    });

    it('does not clear SDK results from inside the search-complete callback', async () => {
        const clearResults = vi.fn();
        class LocalSearch {
            private callback: ((result: {
                getCurrentNumPois: () => number;
                getPoi: () => null;
            }) => void) | null = null;

            setSearchCompleteCallback(callback: typeof this.callback) {
                this.callback = callback;
            }

            search() {
                this.callback?.({
                    getCurrentNumPois: () => 0,
                    getPoi: () => null,
                });
            }

            getStatus() {
                return 0;
            }

            clearResults() {
                clearResults();
            }
        }
        vi.stubGlobal('window', { BMap: { LocalSearch } });

        try {
            await suggestBaiduLocations({ apiKey: 'test-key', keyword: '广州' });

            expect(clearResults).not.toHaveBeenCalled();
        } finally {
            disposeBaiduSdk();
            vi.unstubAllGlobals();
        }
    });

    it('retries loading the JSAPI after a previous script load failure', async () => {
        const scripts: {
            async: boolean;
            src: string;
            onerror: (() => void) | null;
            remove: ReturnType<typeof vi.fn>;
        }[] = [];
        vi.stubGlobal('window', {});
        vi.stubGlobal('document', {
            createElement: () => {
                const script = {
                    async: false,
                    src: '',
                    onerror: null,
                    remove: vi.fn(),
                };
                scripts.push(script);
                return script;
            },
            head: {
                appendChild: vi.fn(),
            },
        });

        try {
            const firstSearch = suggestBaiduLocations({ apiKey: 'test-key', keyword: '广州' });
            expect(scripts).toHaveLength(1);
            scripts[0].onerror?.();
            await expect(firstSearch).rejects.toThrow('BAIDU_SDK_LOAD_FAILED');

            const retrySearch = suggestBaiduLocations({ apiKey: 'test-key', keyword: '广州' });
            expect(scripts).toHaveLength(2);
            scripts[1].onerror?.();
            await expect(retrySearch).rejects.toThrow('BAIDU_SDK_LOAD_FAILED');
        } finally {
            disposeBaiduSdk();
            vi.unstubAllGlobals();
        }
    });

    it('cleans up a pending JSAPI load when the search is aborted', async () => {
        const script = {
            async: false,
            src: '',
            onerror: null as (() => void) | null,
            remove: vi.fn(),
        };
        vi.stubGlobal('window', {});
        vi.stubGlobal('document', {
            createElement: () => script,
            head: { appendChild: vi.fn() },
        });
        const controller = new AbortController();
        const search = suggestBaiduLocations({
            apiKey: 'test-key',
            keyword: '广州',
            signal: controller.signal,
        });

        try {
            const callbackName = new URL(script.src).searchParams.get('callback') as string;
            controller.abort();

            await expect(search).rejects.toMatchObject({ name: 'AbortError' });
            expect(script.remove).toHaveBeenCalledOnce();
            expect((window as unknown as Record<string, unknown>)[callbackName]).toBeUndefined();
        } finally {
            disposeBaiduSdk();
            await search.catch(() => undefined);
            vi.unstubAllGlobals();
        }
    });

    it('does not let a stale load event clear a newer API key load', async () => {
        const scripts: {
            async: boolean;
            src: string;
            onerror: (() => void) | null;
            remove: ReturnType<typeof vi.fn>;
        }[] = [];
        vi.stubGlobal('window', {});
        vi.stubGlobal('document', {
            createElement: () => {
                const script = {
                    async: false,
                    src: '',
                    onerror: null,
                    remove: vi.fn(),
                };
                scripts.push(script);
                return script;
            },
            head: { appendChild: vi.fn() },
        });
        const firstSearch = suggestBaiduLocations({ apiKey: 'first-key', keyword: '广州' });
        const staleError = scripts[0].onerror;
        const secondSearch = suggestBaiduLocations({ apiKey: 'second-key', keyword: '深圳' });

        try {
            const currentCallbackName = new URL(scripts[1].src).searchParams.get('callback') as string;
            expect(scripts[0].onerror).toBeNull();
            staleError?.();
            expect(typeof (window as unknown as Record<string, unknown>)[currentCallbackName]).toBe('function');
        } finally {
            disposeBaiduSdk();
            await Promise.allSettled([firstSearch, secondSearch]);
            vi.unstubAllGlobals();
        }
    });

    it('returns no results when LocalSearch cannot locate the keyword', async () => {
        class EmptyLocalSearch {
            private callback: ((result: {
                getCurrentNumPois: () => number;
                getPoi: () => null;
            }) => void) | null = null;

            setSearchCompleteCallback(callback: typeof this.callback) {
                this.callback = callback;
            }

            search() {
                this.callback?.({
                    getCurrentNumPois: () => 0,
                    getPoi: () => null,
                });
            }

            getStatus() {
                return 2;
            }

            clearResults() {}
        }
        vi.stubGlobal('window', { BMap: { LocalSearch: EmptyLocalSearch } });

        try {
            await expect(suggestBaiduLocations({
                apiKey: 'test-key',
                keyword: '不存在的地点',
            })).resolves.toEqual([]);
        } finally {
            disposeBaiduSdk();
            vi.unstubAllGlobals();
        }
    });

    it('surfaces a LocalSearch permission denial', async () => {
        class FailedLocalSearch {
            private callback: ((result: {
                getCurrentNumPois: () => number;
                getPoi: () => null;
            }) => void) | null = null;

            setSearchCompleteCallback(callback: typeof this.callback) {
                this.callback = callback;
            }

            search() {
                this.callback?.({
                    getCurrentNumPois: () => 0,
                    getPoi: () => null,
                });
            }

            getStatus() {
                return 6;
            }

            clearResults() {}
        }
        vi.stubGlobal('window', { BMap: { LocalSearch: FailedLocalSearch } });

        try {
            await expect(suggestBaiduLocations({
                apiKey: 'test-key',
                keyword: '广州',
            })).rejects.toThrow('BAIDU_PERMISSION_DENIED');
        } finally {
            disposeBaiduSdk();
            vi.unstubAllGlobals();
        }
    });

    it('loads the JSAPI, completes LocalSearch, and cleans loader resources', async () => {
        const script = {
            async: false,
            src: '',
            onerror: null as (() => void) | null,
            remove: vi.fn(),
        };
        class SuccessfulLocalSearch {
            private callback: ((result: {
                getCurrentNumPois: () => number;
                getPoi: () => {
                    uid: string;
                    title: string;
                    point: { lng: number; lat: number };
                };
            }) => void) | null = null;

            setSearchCompleteCallback(callback: typeof this.callback) {
                this.callback = callback;
            }

            search() {
                this.callback?.({
                    getCurrentNumPois: () => 1,
                    getPoi: () => ({
                        uid: 'tower',
                        title: '广州塔',
                        point: { lng: 113.3307, lat: 23.113 },
                    }),
                });
            }

            getStatus() {
                return 0;
            }

            clearResults() {}
        }
        vi.stubGlobal('window', {});
        vi.stubGlobal('document', {
            createElement: () => script,
            head: { appendChild: vi.fn() },
        });
        const search = suggestBaiduLocations({ apiKey: 'test-key', keyword: '广州塔' });

        try {
            const callbackName = new URL(script.src).searchParams.get('callback') as string;
            (window as unknown as Record<string, unknown>).BMap = { LocalSearch: SuccessfulLocalSearch };
            ((window as unknown as Record<string, unknown>)[callbackName] as () => void)();

            await expect(search).resolves.toMatchObject([{ id: 'tower', name: '广州塔' }]);
            expect(script.remove).toHaveBeenCalledOnce();
            expect((window as unknown as Record<string, unknown>)[callbackName]).toBeUndefined();
        } finally {
            disposeBaiduSdk();
            await search.catch(() => undefined);
            vi.unstubAllGlobals();
        }
    });
});

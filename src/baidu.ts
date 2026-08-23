import { gcj02ToWgs84, wgs84ToGcj02 } from './amap';
import { distanceKm as calculateDistanceKm, type Coordinates } from './solar';
import type { LocationSearchOptions, LocationSearchResult } from './locationProvider';

const BAIDU_JS_API_URL = 'https://api.map.baidu.com/api';
const X_PI = Math.PI * 3000 / 180;

type BaiduPoint = {
    lat?: unknown;
    lng?: unknown;
};

export type BaiduRawPoi = {
    uid?: unknown;
    title?: unknown;
    address?: unknown;
    province?: unknown;
    city?: unknown;
    point?: BaiduPoint;
};

type BaiduLocalSearchResult = {
    getCurrentNumPois: () => number;
    getPoi: (index: number) => BaiduRawPoi | null;
};

type BaiduLocalSearchInstance = {
    search: (keyword: string) => void;
    getStatus: () => number;
    setSearchCompleteCallback: (callback: (result: BaiduLocalSearchResult) => void) => void;
};

type BaiduPointInstance = {
    lat: number;
    lng: number;
};

type BaiduApi = {
    Point: new (lng: number, lat: number) => BaiduPointInstance;
    LocalSearch: new (
        location: string | BaiduPointInstance,
        options?: { pageCapacity?: number },
    ) => BaiduLocalSearchInstance;
};

type BaiduWindow = Window & typeof globalThis & {
    BMap?: BaiduApi;
};

type BaiduSearchRunner = (
    apiKey: string,
    keyword: string,
    origin?: Coordinates,
    signal?: AbortSignal,
) => Promise<BaiduRawPoi[]>;

export type BaiduSearchOptions = LocationSearchOptions & {
    searcher?: BaiduSearchRunner;
};

let sdkPromise: Promise<BaiduApi> | null = null;
let sdkKey = '';
let ownsBaiduGlobal = false;
let sdkSequence = 0;
let sdkGeneration = 0;
let cancelSdkLoad: ((reason: Error) => void) | null = null;

const textValue = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

const BAIDU_EMPTY_SEARCH_STATUSES = new Set([1, 2, 3]);
const BAIDU_SEARCH_FAILURE_CODES: Record<number, string> = {
    4: 'BAIDU_INVALID_KEY',
    5: 'BAIDU_INVALID_REQUEST',
    6: 'BAIDU_PERMISSION_DENIED',
    7: 'BAIDU_SERVICE_UNAVAILABLE',
    8: 'BAIDU_SEARCH_TIMEOUT',
};

export const bd09ToGcj02 = ({ lat, lon }: Coordinates): Coordinates => {
    const x = lon - 0.0065;
    const y = lat - 0.006;
    const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * X_PI);
    const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * X_PI);
    return {
        lat: z * Math.sin(theta),
        lon: z * Math.cos(theta),
    };
};

export const gcj02ToBd09 = ({ lat, lon }: Coordinates): Coordinates => {
    const z = Math.sqrt(lon * lon + lat * lat) + 0.00002 * Math.sin(lat * X_PI);
    const theta = Math.atan2(lat, lon) + 0.000003 * Math.cos(lon * X_PI);
    return {
        lat: z * Math.sin(theta) + 0.006,
        lon: z * Math.cos(theta) + 0.0065,
    };
};

const parsePoint = (value: BaiduPoint | undefined): Coordinates | null => {
    const lat = Number(value?.lat);
    const lon = Number(value?.lng);
    return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
        ? { lat, lon }
        : null;
};

export const parseBaiduPois = (value: unknown, origin?: Coordinates): LocationSearchResult[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    const seen = new Set<string>();
    const results = value.flatMap((rawValue): LocationSearchResult[] => {
        const raw = rawValue as BaiduRawPoi;
        const name = textValue(raw.title);
        const bd09 = parsePoint(raw.point);
        if (!name || !bd09) {
            return [];
        }

        const id = textValue(raw.uid) || `${name}|${bd09.lon}|${bd09.lat}`;
        if (seen.has(id)) {
            return [];
        }
        seen.add(id);

        const wgs84 = gcj02ToWgs84(bd09ToGcj02(bd09));
        const province = textValue(raw.province);
        const city = textValue(raw.city);
        return [{
            id,
            name,
            district: [province, city].filter(Boolean).join(''),
            address: textValue(raw.address),
            province,
            city,
            area: '',
            distanceKm: origin ? calculateDistanceKm(origin, wgs84) : null,
            wgs84,
        }];
    });

    if (origin) {
        results.sort((first, second) => (first.distanceKm ?? Infinity) - (second.distanceKm ?? Infinity));
    }
    return results.slice(0, 10);
};

export const disposeBaiduSdk = () => {
    const cancelPendingLoad = cancelSdkLoad;
    sdkGeneration += 1;
    cancelSdkLoad = null;
    sdkPromise = null;
    sdkKey = '';
    cancelPendingLoad?.(new DOMException('Request aborted', 'AbortError'));
    if (ownsBaiduGlobal) {
        delete (window as BaiduWindow).BMap;
        ownsBaiduGlobal = false;
    }
};

const waitForSdk = (promise: Promise<BaiduApi>, signal?: AbortSignal): Promise<BaiduApi> => {
    if (!signal) {
        return promise;
    }
    if (signal.aborted) {
        if (sdkPromise === promise) {
            disposeBaiduSdk();
        }
        return Promise.reject(new DOMException('Request aborted', 'AbortError'));
    }

    return new Promise((resolve, reject) => {
        const handleAbort = () => {
            if (sdkPromise === promise) {
                disposeBaiduSdk();
            }
            reject(new DOMException('Request aborted', 'AbortError'));
        };
        const cleanup = () => signal.removeEventListener('abort', handleAbort);
        signal.addEventListener('abort', handleAbort, { once: true });
        promise.then(
            api => {
                cleanup();
                resolve(api);
            },
            error => {
                cleanup();
                reject(error);
            },
        );
    });
};

const loadBaiduSdk = (apiKey: string, signal?: AbortSignal): Promise<BaiduApi> => {
    const baiduWindow = window as BaiduWindow;
    if (signal?.aborted) {
        return Promise.reject(new DOMException('Request aborted', 'AbortError'));
    }
    if (baiduWindow.BMap?.LocalSearch && (!ownsBaiduGlobal || sdkKey === apiKey)) {
        return Promise.resolve(baiduWindow.BMap);
    }
    if (sdkPromise && sdkKey === apiKey) {
        return waitForSdk(sdkPromise, signal);
    }

    disposeBaiduSdk();
    sdkKey = apiKey;
    sdkSequence += 1;
    sdkGeneration += 1;
    const generation = sdkGeneration;
    const callbackName = `__windySunPathBaiduReady_${Date.now()}_${sdkSequence}`;
    const callbackTarget = window as unknown as Record<string, unknown>;
    const script = document.createElement('script');
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let rejectLoad: (reason: unknown) => void = () => undefined;
    let resolveLoad: (api: BaiduApi) => void = () => undefined;
    const promise = new Promise<BaiduApi>((resolve, reject) => {
        resolveLoad = resolve;
        rejectLoad = reject;
    });

    const cleanup = () => {
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }
        delete callbackTarget[callbackName];
        script.onerror = null;
        script.remove();
    };
    const isCurrentLoad = () => sdkGeneration === generation && sdkPromise === promise;
    const fail = (error: Error) => {
        if (settled) {
            return;
        }
        settled = true;
        cleanup();
        if (isCurrentLoad()) {
            cancelSdkLoad = null;
            sdkPromise = null;
            sdkKey = '';
        }
        rejectLoad(error);
    };
    const succeed = (api: BaiduApi) => {
        if (settled) {
            return;
        }
        settled = true;
        cleanup();
        if (!isCurrentLoad()) {
            rejectLoad(new DOMException('Request aborted', 'AbortError'));
            return;
        }
        cancelSdkLoad = null;
        ownsBaiduGlobal = true;
        resolveLoad(api);
    };

    sdkPromise = promise;
    cancelSdkLoad = fail;
    callbackTarget[callbackName] = () => {
        const api = (window as BaiduWindow).BMap;
        if (!api?.LocalSearch) {
            fail(new Error('BAIDU_SDK_UNAVAILABLE'));
            return;
        }
        succeed(api);
    };

    const url = new URL(BAIDU_JS_API_URL);
    url.searchParams.set('v', '4.0');
    url.searchParams.set('ak', apiKey);
    url.searchParams.set('callback', callbackName);
    script.async = true;
    script.src = url.toString();
    script.onerror = () => fail(new Error('BAIDU_SDK_LOAD_FAILED'));
    timeout = setTimeout(() => fail(new Error('BAIDU_SDK_TIMEOUT')), 10_000);
    document.head.appendChild(script);
    return waitForSdk(promise, signal);
};

const runBaiduLocalSearch: BaiduSearchRunner = async (apiKey, keyword, origin, signal) => {
    if (signal?.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
    }
    const api = await loadBaiduSdk(apiKey, signal);
    if (signal?.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
    }

    return new Promise((resolve, reject) => {
        const searchLocation = origin
            ? gcj02ToBd09(wgs84ToGcj02(origin))
            : null;
        const search = new api.LocalSearch(
            searchLocation ? new api.Point(searchLocation.lon, searchLocation.lat) : '全国',
            { pageCapacity: 10 },
        );
        let settled = false;
        let cleanup = () => undefined;
        const finish = (action: () => void) => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            action();
        };
        const handleAbort = () => finish(() => reject(new DOMException('Request aborted', 'AbortError')));
        const timeout = setTimeout(() => finish(() => reject(new Error('BAIDU_SEARCH_TIMEOUT'))), 10_000);
        cleanup = () => {
            clearTimeout(timeout);
            signal?.removeEventListener('abort', handleAbort);
            search.setSearchCompleteCallback(() => undefined);
        };

        search.setSearchCompleteCallback(result => {
            const searchStatus = Number(search.getStatus());
            if (BAIDU_EMPTY_SEARCH_STATUSES.has(searchStatus)) {
                finish(() => resolve([]));
                return;
            }
            if (searchStatus !== 0) {
                finish(() => reject(new Error(BAIDU_SEARCH_FAILURE_CODES[searchStatus] || 'BAIDU_SEARCH_FAILED')));
                return;
            }
            const count = Math.max(0, Math.min(10, Number(result?.getCurrentNumPois?.()) || 0));
            const pois = Array.from({ length: count }, (_, index) => result.getPoi(index)).filter(
                (poi): poi is BaiduRawPoi => Boolean(poi),
            );
            finish(() => resolve(pois));
        });
        signal?.addEventListener('abort', handleAbort, { once: true });
        search.search(keyword);
    });
};

export const suggestBaiduLocations = async ({
    apiKey,
    keyword,
    origin,
    signal,
    searcher = runBaiduLocalSearch,
}: BaiduSearchOptions): Promise<LocationSearchResult[]> => {
    const pois = await searcher(apiKey.trim(), keyword.trim(), origin, signal);
    return parseBaiduPois(pois, origin);
};

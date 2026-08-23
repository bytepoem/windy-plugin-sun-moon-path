import { gcj02ToWgs84, wgs84ToGcj02 } from './amap';
import { requestJsonp } from './jsonp';
import { distanceKm as calculateDistanceKm, type Coordinates } from './solar';
import type { LocationSearchOptions, LocationSearchResult } from './locationProvider';

const TENCENT_SUGGESTION_URL = 'https://apis.map.qq.com/ws/place/v1/suggestion';

type TencentRawLocation = {
    lat?: unknown;
    lng?: unknown;
};

type TencentRawAdInfo = {
    province?: unknown;
    city?: unknown;
    district?: unknown;
};

type TencentRawSuggestion = {
    id?: unknown;
    title?: unknown;
    address?: unknown;
    location?: TencentRawLocation;
    ad_info?: TencentRawAdInfo;
};

type TencentSuggestionResponse = {
    status?: unknown;
    message?: unknown;
    data?: unknown;
};

type JsonpRequester = typeof requestJsonp<TencentSuggestionResponse>;

export type TencentSearchOptions = LocationSearchOptions & {
    requester?: JsonpRequester;
};

const textValue = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

const parseLocation = (value: TencentRawLocation | undefined): Coordinates | null => {
    const lat = Number(value?.lat);
    const lon = Number(value?.lng);
    return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
        ? { lat, lon }
        : null;
};

export const parseTencentSuggestions = (
    value: unknown,
    origin?: Coordinates,
): LocationSearchResult[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    const seen = new Set<string>();
    const results = value.flatMap((rawValue): LocationSearchResult[] => {
        const raw = rawValue as TencentRawSuggestion;
        const name = textValue(raw.title);
        const sourceLocation = parseLocation(raw.location);
        if (!name || !sourceLocation) {
            return [];
        }

        const id = textValue(raw.id) || `${name}|${sourceLocation.lon}|${sourceLocation.lat}`;
        if (seen.has(id)) {
            return [];
        }
        seen.add(id);

        const wgs84 = gcj02ToWgs84(sourceLocation);
        const province = textValue(raw.ad_info?.province);
        const city = textValue(raw.ad_info?.city);
        const area = textValue(raw.ad_info?.district);
        return [{
            id,
            name,
            district: [province, city, area].filter(Boolean).join(''),
            address: textValue(raw.address),
            province,
            city,
            area,
            distanceKm: origin ? calculateDistanceKm(origin, wgs84) : null,
            wgs84,
        }];
    });

    if (origin) {
        results.sort((first, second) => (first.distanceKm ?? Infinity) - (second.distanceKm ?? Infinity));
    }
    return results.slice(0, 10);
};

export const suggestTencentLocations = async ({
    apiKey,
    keyword,
    origin,
    signal,
    requester = requestJsonp,
}: TencentSearchOptions): Promise<LocationSearchResult[]> => {
    const url = new URL(TENCENT_SUGGESTION_URL);
    url.searchParams.set('key', apiKey.trim());
    url.searchParams.set('keyword', keyword.trim());
    url.searchParams.set('output', 'jsonp');
    url.searchParams.set('page_size', '10');
    if (origin) {
        const gcj02 = wgs84ToGcj02(origin);
        url.searchParams.set('location', `${gcj02.lat},${gcj02.lon}`);
    }

    const response = await requester({ url, signal });
    if (Number(response.status) !== 0) {
        throw new Error(textValue(response.message) || 'TENCENT_REQUEST_FAILED');
    }
    return parseTencentSuggestions(response.data, origin);
};

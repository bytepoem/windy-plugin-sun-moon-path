import { distanceKm as calculateDistanceKm, type Coordinates } from './solar';
import type { LocationSearchResult } from './locationProvider';

const AMAP_INPUT_TIPS_URL = 'https://restapi.amap.com/v3/assistant/inputtips';
const EARTH_RADIUS = 6378245;
const EE = 0.006693421622965943;
const DIRECT_MUNICIPALITIES = ['北京市', '天津市', '上海市', '重庆市'];

type FetchLike = typeof fetch;

type AmapRawLocation = {
    id?: unknown;
    name?: unknown;
    district?: unknown;
    address?: unknown;
    location?: unknown;
    pname?: unknown;
    cityname?: unknown;
    adname?: unknown;
};

type AmapResponse = {
    status?: unknown;
    info?: unknown;
    tips?: unknown;
};

export type AmapLocationResult = LocationSearchResult;

export type AmapSearchOptions = {
    apiKey: string;
    keyword: string;
    origin?: Coordinates;
    signal?: AbortSignal;
    fetcher?: FetchLike;
};

const isOutsideMainlandChina = ({ lat, lon }: Coordinates): boolean =>
    lon < 72.004 || lon > 137.8347 || lat < 0.8293 || lat > 55.8271;

const transformLatitude = (lon: number, lat: number): number => {
    let value = -100 + 2 * lon + 3 * lat + 0.2 * lat * lat + 0.1 * lon * lat;
    value += 0.2 * Math.sqrt(Math.abs(lon));
    value += (20 * Math.sin(6 * lon * Math.PI) + 20 * Math.sin(2 * lon * Math.PI)) * 2 / 3;
    value += (20 * Math.sin(lat * Math.PI) + 40 * Math.sin(lat / 3 * Math.PI)) * 2 / 3;
    return value + (160 * Math.sin(lat / 12 * Math.PI) + 320 * Math.sin(lat * Math.PI / 30)) * 2 / 3;
};

const transformLongitude = (lon: number, lat: number): number => {
    let value = 300 + lon + 2 * lat + 0.1 * lon * lon + 0.1 * lon * lat;
    value += 0.1 * Math.sqrt(Math.abs(lon));
    value += (20 * Math.sin(6 * lon * Math.PI) + 20 * Math.sin(2 * lon * Math.PI)) * 2 / 3;
    value += (20 * Math.sin(lon * Math.PI) + 40 * Math.sin(lon / 3 * Math.PI)) * 2 / 3;
    return value + (150 * Math.sin(lon / 12 * Math.PI) + 300 * Math.sin(lon / 30 * Math.PI)) * 2 / 3;
};

export const wgs84ToGcj02 = (location: Coordinates): Coordinates => {
    if (isOutsideMainlandChina(location)) {
        return { ...location };
    }

    const offsetLon = location.lon - 105;
    const offsetLat = location.lat - 35;
    let deltaLat = transformLatitude(offsetLon, offsetLat);
    let deltaLon = transformLongitude(offsetLon, offsetLat);
    const latitudeRadians = location.lat / 180 * Math.PI;
    const sinLatitude = Math.sin(latitudeRadians);
    const magic = 1 - EE * sinLatitude * sinLatitude;
    const sqrtMagic = Math.sqrt(magic);
    deltaLat = deltaLat * 180 / ((EARTH_RADIUS * (1 - EE) / (magic * sqrtMagic)) * Math.PI);
    deltaLon = deltaLon * 180 / (EARTH_RADIUS / sqrtMagic * Math.cos(latitudeRadians) * Math.PI);

    return {
        lat: location.lat + deltaLat,
        lon: location.lon + deltaLon,
    };
};

export const gcj02ToWgs84 = (location: Coordinates): Coordinates => {
    if (isOutsideMainlandChina(location)) {
        return { ...location };
    }

    let estimate = { ...location };
    for (let iteration = 0; iteration < 12; iteration += 1) {
        const converted = wgs84ToGcj02(estimate);
        const latitudeError = converted.lat - location.lat;
        const longitudeError = converted.lon - location.lon;
        estimate = {
            lat: estimate.lat - latitudeError,
            lon: estimate.lon - longitudeError,
        };
        if (Math.max(Math.abs(latitudeError), Math.abs(longitudeError)) < 1e-7) {
            break;
        }
    }
    return estimate;
};

const textValue = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

export const parseAmapDistrict = (district: string): { province: string; city: string; area: string } => {
    const normalized = district.trim();
    const municipality = DIRECT_MUNICIPALITIES.find(candidate => normalized.startsWith(candidate));
    if (municipality) {
        return {
            province: municipality,
            city: municipality,
            area: normalized.slice(municipality.length),
        };
    }

    const provinceMatch = normalized.match(/^(.+?(?:省|自治区|特别行政区))(.*)$/);
    const province = provinceMatch?.[1] || '';
    const remaining = provinceMatch?.[2] || normalized;
    const cityMatch = remaining.match(/^(.+?(?:自治州|地区|盟|市))(.*)$/);
    return {
        province,
        city: cityMatch?.[1] || '',
        area: cityMatch?.[2] || remaining,
    };
};

const parseLocation = (value: unknown): Coordinates | null => {
    if (typeof value !== 'string') {
        return null;
    }
    const parts = value.split(',');
    if (parts.length !== 2) {
        return null;
    }
    const [lonText, latText] = parts;
    if (!lonText?.trim() || !latText?.trim()) {
        return null;
    }
    const lon = Number(lonText);
    const lat = Number(latText);
    return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
        ? { lat, lon }
        : null;
};

const parseResults = (value: unknown, origin?: Coordinates): AmapLocationResult[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    const seen = new Set<string>();
    const results = value.flatMap((rawValue): AmapLocationResult[] => {
        const raw = rawValue as AmapRawLocation;
        const name = textValue(raw.name);
        const sourceLocation = parseLocation(raw.location);
        if (!name || !sourceLocation) {
            return [];
        }

        const id = textValue(raw.id) || `${name}|${sourceLocation.lon}|${sourceLocation.lat}`;
        if (seen.has(id)) {
            return [];
        }
        seen.add(id);

        const district = textValue(raw.district);
        const parsedDistrict = parseAmapDistrict(district);
        const wgs84 = gcj02ToWgs84(sourceLocation);

        return [{
            id,
            name,
            district,
            address: textValue(raw.address),
            province: textValue(raw.pname) || parsedDistrict.province,
            city: textValue(raw.cityname) || parsedDistrict.city,
            area: textValue(raw.adname) || parsedDistrict.area,
            distanceKm: origin ? calculateDistanceKm(origin, wgs84) : null,
            wgs84,
        }];
    });
    return results;
};

const fetchAmapResults = async (
    url: URL,
    origin: Coordinates | undefined,
    signal: AbortSignal | undefined,
    fetcher: FetchLike,
): Promise<AmapLocationResult[]> => {
    const response = await fetcher(url, { signal });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const body = await response.json() as AmapResponse;
    if (String(body.status) !== '1') {
        throw new Error(textValue(body.info) || 'AMAP_REQUEST_FAILED');
    }
    return parseResults(body.tips, origin);
};

const inputTipsUrl = (apiKey: string, keyword: string): URL => {
    const url = new URL(AMAP_INPUT_TIPS_URL);
    url.searchParams.set('key', apiKey.trim());
    url.searchParams.set('keywords', keyword.trim());
    url.searchParams.set('datatype', 'poi');
    url.searchParams.set('output', 'JSON');
    return url;
};

const mergeResults = (results: AmapLocationResult[][], origin?: Coordinates): AmapLocationResult[] => {
    const seen = new Set<string>();
    const merged = results.flat().filter(result => {
        if (seen.has(result.id)) {
            return false;
        }
        seen.add(result.id);
        return true;
    });
    if (origin) {
        merged.sort((first, second) => (first.distanceKm ?? Infinity) - (second.distanceKm ?? Infinity));
    }
    return merged.slice(0, 10);
};

export const suggestAmapLocations = async ({
    apiKey,
    keyword,
    origin,
    signal,
    fetcher = fetch,
}: AmapSearchOptions): Promise<AmapLocationResult[]> => {
    const results = await fetchAmapResults(
        inputTipsUrl(apiKey, keyword),
        origin,
        signal,
        fetcher,
    );
    return mergeResults([results], origin);
};

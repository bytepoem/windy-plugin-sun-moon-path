export const LIGHT_POLLUTION_DATA_YEAR = 2025;

const TILE_SIZE_DEGREES = 5;
const GRID_POINTS_PER_DEGREE = 120;
const GRID_POINTS_PER_TILE = TILE_SIZE_DEGREES * GRID_POINTS_PER_DEGREE;
const DECOMPRESSED_TILE_BYTES = GRID_POINTS_PER_TILE * GRID_POINTS_PER_TILE + 1;
const MIN_LATITUDE = -65;
const MAX_LATITUDE = 75;
const TILE_BASE_URL = 'https://djlorenz.github.io/astronomy/binary_tiles';
const MAX_CACHED_TILES = 8;

export type LightPollutionCoordinates = {
    lat: number;
    lon: number;
};

export type ObservationConditionKey =
    | 'not-visible'
    | 'averted-barely-visible'
    | 'averted-visible'
    | 'visible'
    | 'very-obvious'
    | 'zenith-faint'
    | 'hard-to-discern'
    | 'broad-structure'
    | 'complex-structure'
    | 'clear-structure'
    | 'casts-shadow'
    | 'faint'
    | 'zenith-visible'
    | 'clearly-visible'
    | 'dark-yellow'
    | 'striking'
    | 'bright-enough-to-read'
    | 'nearby-small-objects'
    | 'distant-objects'
    | 'distant-large-objects'
    | 'faint-distant-large-objects'
    | 'faint-nearby-large-objects'
    | 'shadows-only';

export type ObservingConditions = {
    milkyWay: ObservationConditionKey;
    zodiacalLight: ObservationConditionKey;
    andromedaGalaxy: ObservationConditionKey;
    triangulumGalaxy: ObservationConditionKey;
    groundVisibility: ObservationConditionKey;
};

export type LightPollutionPoint = {
    year: number;
    sqm: number;
    brightnessRatio: number;
    estimatedBortle: number;
    observingConditions: ObservingConditions;
};

export type LightPollutionTileAddress = {
    tileX: number;
    tileY: number;
    pointX: number;
    pointY: number;
    cacheKey: string;
    url: string;
};

export type LightPollutionResponseIdentity = {
    aborted: boolean;
    requestId: number;
    latestRequestId: number;
    requestKey: string;
    currentRequestKey: string;
};

export class LightPollutionOutOfBoundsError extends Error {
    constructor() {
        super(`Light Pollution Atlas coverage is ${Math.abs(MIN_LATITUDE)}S to ${MAX_LATITUDE}N.`);
        this.name = 'LightPollutionOutOfBoundsError';
    }
}

const tileCache = new Map<string, Int8Array>();

const cachedTile = (key: string): Int8Array | undefined => {
    const tile = tileCache.get(key);
    if (tile) {
        tileCache.delete(key);
        tileCache.set(key, tile);
    }
    return tile;
};

const cacheTile = (key: string, tile: Int8Array) => {
    tileCache.set(key, tile);
    if (tileCache.size > MAX_CACHED_TILES) {
        const oldestKey = tileCache.keys().next().value as string | undefined;
        if (oldestKey) {
            tileCache.delete(oldestKey);
        }
    }
};

const modulo = (value: number, divisor: number): number =>
    ((value % divisor) + divisor) % divisor;

export const resolveLightPollutionTile = (
    coordinates: LightPollutionCoordinates,
    year = LIGHT_POLLUTION_DATA_YEAR,
): LightPollutionTileAddress => {
    if (!Number.isFinite(coordinates.lat) || !Number.isFinite(coordinates.lon)) {
        throw new Error('Light pollution coordinates must be finite numbers.');
    }
    if (coordinates.lat < MIN_LATITUDE || coordinates.lat >= MAX_LATITUDE) {
        throw new LightPollutionOutOfBoundsError();
    }

    const longitudeFromDateLine = modulo(coordinates.lon + 180, 360);
    const latitudeFromStart = coordinates.lat - MIN_LATITUDE;
    const tileX = Math.floor(longitudeFromDateLine / TILE_SIZE_DEGREES) + 1;
    const tileY = Math.floor(latitudeFromStart / TILE_SIZE_DEGREES) + 1;
    const pointX = Math.round(GRID_POINTS_PER_DEGREE * (
        longitudeFromDateLine - TILE_SIZE_DEGREES * (tileX - 1) + 1 / (GRID_POINTS_PER_DEGREE * 2)
    ));
    const pointY = Math.round(GRID_POINTS_PER_DEGREE * (
        latitudeFromStart - TILE_SIZE_DEGREES * (tileY - 1) + 1 / (GRID_POINTS_PER_DEGREE * 2)
    ));
    const cacheKey = `${year}:${tileX}:${tileY}`;

    return {
        tileX,
        tileY,
        pointX,
        pointY,
        cacheKey,
        url: `${TILE_BASE_URL}/${year}/binary_tile_${tileX}_${tileY}.dat.gz`,
    };
};

export const compressedValueAt = (
    data: Int8Array,
    pointX: number,
    pointY: number,
): number => {
    if (data.length !== DECOMPRESSED_TILE_BYTES) {
        throw new Error(`Unexpected light pollution tile size: ${data.length}.`);
    }
    if (
        pointX < 1
        || pointX > GRID_POINTS_PER_TILE
        || pointY < 1
        || pointY > GRID_POINTS_PER_TILE
    ) {
        throw new Error('Light pollution grid point is outside its tile.');
    }

    let compressed = 128 * Number(data[0]) + Number(data[1]);
    for (let index = 1; index < pointY; index += 1) {
        compressed += Number(data[GRID_POINTS_PER_TILE * index + 1]);
    }
    const rowOffset = GRID_POINTS_PER_TILE * (pointY - 1) + 1;
    for (let index = 1; index < pointX; index += 1) {
        compressed += Number(data[rowOffset + index]);
    }
    return compressed;
};

export const brightnessRatioFromCompressed = (compressed: number): number =>
    (5 / 195) * (Math.exp(0.0195 * compressed) - 1);

export const sqmFromBrightnessRatio = (brightnessRatio: number): number =>
    22 - 5 * Math.log(1 + brightnessRatio) / Math.log(100);

const EQUIVALENT_BORTLE_ANCHORS = [
    { sqm: 21.99, level: 2 },
    { sqm: 21.89, level: 3 },
    { sqm: 21.69, level: 4 },
    { sqm: 20.49, level: 5 },
    { sqm: 19.5, level: 6 },
    { sqm: 18.94, level: 7 },
    { sqm: 18.38, level: 8 },
    { sqm: 17.8, level: 9 },
] as const;

export const estimateEquivalentBortle = (sqm: number): number => {
    if (!Number.isFinite(sqm)) {
        throw new Error('SQM must be a finite number.');
    }
    if (sqm >= 21.99) {
        return 1;
    }
    if (sqm <= 17.8) {
        return 9;
    }

    for (let index = 0; index < EQUIVALENT_BORTLE_ANCHORS.length - 1; index += 1) {
        const darker = EQUIVALENT_BORTLE_ANCHORS[index];
        const brighter = EQUIVALENT_BORTLE_ANCHORS[index + 1];
        if (sqm <= darker.sqm && sqm > brighter.sqm) {
            const position = (darker.sqm - sqm) / (darker.sqm - brighter.sqm);
            return darker.level + position * (brighter.level - darker.level);
        }
    }

    throw new Error(`Unable to estimate equivalent Bortle level for SQM ${sqm}.`);
};

const OBSERVING_CONDITION_BANDS: {
    min: number;
    max: number;
    conditions: ObservingConditions;
}[] = [
    {
        min: 0,
        max: 18.38,
        conditions: {
            milkyWay: 'not-visible',
            zodiacalLight: 'not-visible',
            andromedaGalaxy: 'not-visible',
            triangulumGalaxy: 'not-visible',
            groundVisibility: 'bright-enough-to-read',
        },
    },
    {
        min: 18.38,
        max: 18.94,
        conditions: {
            milkyWay: 'not-visible',
            zodiacalLight: 'not-visible',
            andromedaGalaxy: 'averted-barely-visible',
            triangulumGalaxy: 'not-visible',
            groundVisibility: 'nearby-small-objects',
        },
    },
    {
        min: 18.94,
        max: 19.5,
        conditions: {
            milkyWay: 'zenith-faint',
            zodiacalLight: 'not-visible',
            andromedaGalaxy: 'averted-visible',
            triangulumGalaxy: 'not-visible',
            groundVisibility: 'nearby-small-objects',
        },
    },
    {
        min: 19.5,
        max: 20.49,
        conditions: {
            milkyWay: 'hard-to-discern',
            zodiacalLight: 'faint',
            andromedaGalaxy: 'visible',
            triangulumGalaxy: 'not-visible',
            groundVisibility: 'distant-objects',
        },
    },
    {
        min: 20.49,
        max: 21.69,
        conditions: {
            milkyWay: 'broad-structure',
            zodiacalLight: 'zenith-visible',
            andromedaGalaxy: 'very-obvious',
            triangulumGalaxy: 'averted-barely-visible',
            groundVisibility: 'distant-large-objects',
        },
    },
    {
        min: 21.69,
        max: 21.89,
        conditions: {
            milkyWay: 'complex-structure',
            zodiacalLight: 'clearly-visible',
            andromedaGalaxy: 'very-obvious',
            triangulumGalaxy: 'averted-visible',
            groundVisibility: 'faint-distant-large-objects',
        },
    },
    {
        min: 21.89,
        max: 21.99,
        conditions: {
            milkyWay: 'clear-structure',
            zodiacalLight: 'dark-yellow',
            andromedaGalaxy: 'very-obvious',
            triangulumGalaxy: 'visible',
            groundVisibility: 'faint-nearby-large-objects',
        },
    },
    {
        min: 21.99,
        max: Number.POSITIVE_INFINITY,
        conditions: {
            milkyWay: 'casts-shadow',
            zodiacalLight: 'striking',
            andromedaGalaxy: 'very-obvious',
            triangulumGalaxy: 'very-obvious',
            groundVisibility: 'shadows-only',
        },
    },
];

export const estimateObservingConditions = (sqm: number): ObservingConditions => {
    if (!Number.isFinite(sqm)) {
        throw new Error('SQM must be a finite number.');
    }
    const band = OBSERVING_CONDITION_BANDS.find(({ min, max }) => sqm >= min && sqm < max);
    if (!band) {
        throw new Error(`Unable to estimate observing conditions for SQM ${sqm}.`);
    }
    return band.conditions;
};

export const isLightPollutionResponseCurrent = (identity: LightPollutionResponseIdentity): boolean =>
    !identity.aborted
    && identity.requestId === identity.latestRequestId
    && identity.requestKey === identity.currentRequestKey;

const decompressTile = async (response: Response): Promise<Int8Array> => {
    if (!response.body) {
        throw new Error('Light pollution tile response has no body.');
    }
    if (typeof DecompressionStream === 'undefined') {
        throw new Error('This browser cannot decompress light pollution data.');
    }

    const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
    return new Int8Array(await new Response(stream).arrayBuffer());
};

export const fetchLightPollutionPoint = async (
    coordinates: LightPollutionCoordinates,
    signal?: AbortSignal,
): Promise<LightPollutionPoint> => {
    const address = resolveLightPollutionTile(coordinates);
    let tile = cachedTile(address.cacheKey);

    if (!tile) {
        const response = await fetch(address.url, { signal });
        if (!response.ok) {
            throw new Error(`Light pollution tile request failed (${response.status}).`);
        }
        tile = await decompressTile(response);
        if (signal?.aborted) {
            throw new DOMException('The operation was aborted.', 'AbortError');
        }
        if (tile.length !== DECOMPRESSED_TILE_BYTES) {
            throw new Error(`Unexpected light pollution tile size: ${tile.length}.`);
        }
        cacheTile(address.cacheKey, tile);
    }

    const compressed = compressedValueAt(tile, address.pointX, address.pointY);
    const brightnessRatio = brightnessRatioFromCompressed(compressed);
    const sqm = sqmFromBrightnessRatio(brightnessRatio);

    return {
        year: LIGHT_POLLUTION_DATA_YEAR,
        sqm,
        brightnessRatio,
        estimatedBortle: estimateEquivalentBortle(sqm),
        observingConditions: estimateObservingConditions(sqm),
    };
};

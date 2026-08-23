import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    brightnessRatioFromCompressed,
    compressedValueAt,
    estimateEquivalentBortle,
    estimateObservingConditions,
    fetchLightPollutionPoint,
    isLightPollutionResponseCurrent,
    LightPollutionOutOfBoundsError,
    resolveLightPollutionTile,
    sqmFromBrightnessRatio,
} from './lightPollution';

const gzipTile = async (tile: Int8Array): Promise<ArrayBuffer> => {
    const source = new Response(Uint8Array.from(tile).buffer).body;
    if (!source) {
        throw new Error('Unable to create test tile stream.');
    }
    return new Response(source.pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
};

describe('Lorenz light pollution atlas', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('resolves a coordinate to the documented 5 degree binary tile and grid point', () => {
        expect(resolveLightPollutionTile({ lat: 31.2304, lon: 121.4737 })).toEqual({
            tileX: 61,
            tileY: 20,
            pointX: 177,
            pointY: 148,
            cacheKey: '2025:61:20',
            url: 'https://djlorenz.github.io/astronomy/binary_tiles/2025/binary_tile_61_20.dat.gz',
        });
    });

    it('normalizes longitudes around the date line', () => {
        const west = resolveLightPollutionTile({ lat: 0, lon: -180 });
        const east = resolveLightPollutionTile({ lat: 0, lon: 180 });

        expect(east).toEqual(west);
    });

    it('rejects latitudes outside atlas coverage', () => {
        expect(() => resolveLightPollutionTile({ lat: -65.01, lon: 0 }))
            .toThrow(LightPollutionOutOfBoundsError);
        expect(() => resolveLightPollutionTile({ lat: 75, lon: 0 }))
            .toThrow(LightPollutionOutOfBoundsError);
    });

    it('decodes latitude and longitude deltas from a binary tile', () => {
        const tile = new Int8Array(600 * 600 + 1);
        tile[0] = 1;
        tile[1] = 2;
        tile[601] = 3;
        tile[602] = 4;

        expect(compressedValueAt(tile, 2, 2)).toBe(137);
    });

    it('converts compressed brightness to SQM', () => {
        const ratio = brightnessRatioFromCompressed(406);

        expect(ratio).toBeCloseTo(70.321, 3);
        expect(sqmFromBrightnessRatio(ratio)).toBeCloseTo(17.37, 1);
    });

    it('derives an equivalent Bortle level by interpolating adjacent SQM thresholds', () => {
        expect(estimateEquivalentBortle(17.72)).toBe(9);
        expect(estimateEquivalentBortle(21.81)).toBeCloseTo(3.4, 8);
        expect(estimateEquivalentBortle(20.8)).toBeCloseTo(4.74166667, 8);
        expect(estimateEquivalentBortle(22)).toBe(1);
    });

    it('preserves the equivalent Bortle endpoint rules and internal anchors', () => {
        expect(estimateEquivalentBortle(21.99)).toBe(1);
        expect(estimateEquivalentBortle(21.989)).toBeCloseTo(2.01, 8);
        expect(estimateEquivalentBortle(21.89)).toBe(3);
        expect(estimateEquivalentBortle(21.69)).toBe(4);
        expect(estimateEquivalentBortle(20.49)).toBe(5);
        expect(estimateEquivalentBortle(19.5)).toBe(6);
        expect(estimateEquivalentBortle(18.94)).toBe(7);
        expect(estimateEquivalentBortle(18.38)).toBe(8);
        expect(estimateEquivalentBortle(17.8)).toBe(9);
    });

    it.each([
        [17.72, 'not-visible', 'not-visible', 'not-visible', 'not-visible', 'bright-enough-to-read'],
        [18.38, 'not-visible', 'not-visible', 'averted-barely-visible', 'not-visible', 'nearby-small-objects'],
        [18.94, 'zenith-faint', 'not-visible', 'averted-visible', 'not-visible', 'nearby-small-objects'],
        [19.5, 'hard-to-discern', 'faint', 'visible', 'not-visible', 'distant-objects'],
        [20.49, 'broad-structure', 'zenith-visible', 'very-obvious', 'averted-barely-visible', 'distant-large-objects'],
        [21.69, 'complex-structure', 'clearly-visible', 'very-obvious', 'averted-visible', 'faint-distant-large-objects'],
        [21.81, 'complex-structure', 'clearly-visible', 'very-obvious', 'averted-visible', 'faint-distant-large-objects'],
        [21.89, 'clear-structure', 'dark-yellow', 'very-obvious', 'visible', 'faint-nearby-large-objects'],
        [21.99, 'casts-shadow', 'striking', 'very-obvious', 'very-obvious', 'shadows-only'],
    ] as const)(
        'derives darkmap observing conditions for SQM %s',
        (sqm, milkyWay, zodiacalLight, andromedaGalaxy, triangulumGalaxy, groundVisibility) => {
            expect(estimateObservingConditions(sqm)).toEqual({
                milkyWay,
                zodiacalLight,
                andromedaGalaxy,
                triangulumGalaxy,
                groundVisibility,
            });
        },
    );

    it('fetches, decompresses, and caches a binary tile', async () => {
        const tile = new Int8Array(600 * 600 + 1);
        tile[0] = 3;
        tile[1] = 21;
        const compressedTile = await gzipTile(tile);
        const fetchMock = vi.fn(async () => new Response(compressedTile, { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);

        const first = await fetchLightPollutionPoint({ lat: 0, lon: 0 });
        const second = await fetchLightPollutionPoint({ lat: 0.1, lon: 0.1 });

        expect(first.sqm).toBeCloseTo(17.388, 3);
        expect(first.estimatedBortle).toBe(9);
        expect(second.sqm).toBe(first.sqm);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('passes cancellation to an in-flight tile request', async () => {
        const controller = new AbortController();
        const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => {
                    reject(init.signal?.reason);
                }, { once: true });
            }));
        vi.stubGlobal('fetch', fetchMock);

        const request = fetchLightPollutionPoint({ lat: 10, lon: 10 }, controller.signal);
        controller.abort();

        await expect(request).rejects.toMatchObject({ name: 'AbortError' });
        expect(fetchMock).toHaveBeenCalledWith(
            'https://djlorenz.github.io/astronomy/binary_tiles/2025/binary_tile_39_16.dat.gz',
            { signal: controller.signal },
        );
    });

    it('rejects aborted, superseded, and stale-location responses', () => {
        const current = {
            aborted: false,
            requestId: 3,
            latestRequestId: 3,
            requestKey: '31|121',
            currentRequestKey: '31|121',
        };

        expect(isLightPollutionResponseCurrent(current)).toBe(true);
        expect(isLightPollutionResponseCurrent({ ...current, aborted: true })).toBe(false);
        expect(isLightPollutionResponseCurrent({ ...current, latestRequestId: 4 })).toBe(false);
        expect(isLightPollutionResponseCurrent({ ...current, currentRequestKey: '22|113' })).toBe(false);
    });
});

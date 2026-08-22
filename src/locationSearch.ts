import type { Coordinates } from './solar';

export type ElevationSearchResult = {
    id: string;
    wgs84: Coordinates;
};

export const loadElevationsWithConcurrency = async <T extends ElevationSearchResult>({
    results,
    concurrency = 3,
    loadElevation,
    isCurrent,
    onResult,
}: {
    results: T[];
    concurrency?: number;
    loadElevation: (result: T) => Promise<number>;
    isCurrent: () => boolean;
    onResult: (id: string, elevationM: number | null) => void;
}): Promise<void> => {
    let nextIndex = 0;
    const worker = async () => {
        while (isCurrent()) {
            const index = nextIndex;
            nextIndex += 1;
            if (index >= results.length) {
                return;
            }

            const result = results[index];
            let elevationM: number | null = null;
            try {
                const value = await loadElevation(result);
                elevationM = Number.isFinite(value) ? value : null;
            } catch {
                elevationM = null;
            }

            if (!isCurrent()) {
                return;
            }
            onResult(result.id, elevationM);
        }
    };

    const workerCount = Math.min(Math.max(1, Math.floor(concurrency)), results.length);
    await Promise.all(Array.from({ length: workerCount }, worker));
};

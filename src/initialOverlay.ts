import type { overlays } from '@windy/rootScope';

export type WindyOverlay = (typeof overlays)[number];

export const KEEP_CURRENT_OVERLAY = 'keep-current';
export const DEFAULT_INITIAL_OVERLAY: WindyOverlay = 'satellite';
export const INITIAL_OVERLAY_PRIORITY = [
    'satellite',
    'clouds',
    'hclouds',
    'mclouds',
    'lclouds',
    'radar',
    'visibility',
    'wind',
    'temp',
    'rain',
] as const satisfies ReadonlyArray<WindyOverlay>;

export type InitialOverlayPreference = typeof KEEP_CURRENT_OVERLAY | WindyOverlay;

/**
 * Places astronomy-relevant overlays first while preserving the source order
 * of every unlisted Windy overlay.
 */
export const orderInitialOverlayOptions = <T extends { value: WindyOverlay }>(
    options: ReadonlyArray<T>,
): T[] => {
    const priorityByOverlay = new Map<WindyOverlay, number>(
        INITIAL_OVERLAY_PRIORITY.map((overlay, index) => [overlay, index]),
    );
    return options
        .map((option, index) => ({ option, index }))
        .sort((left, right) => {
            const leftPriority = priorityByOverlay.get(left.option.value);
            const rightPriority = priorityByOverlay.get(right.option.value);
            if (leftPriority === undefined && rightPriority === undefined) {
                return left.index - right.index;
            }
            if (leftPriority === undefined) {
                return 1;
            }
            if (rightPriority === undefined) {
                return -1;
            }
            return leftPriority - rightPriority;
        })
        .map(({ option }) => option);
};

/**
 * Resolves the persisted startup overlay against the overlays exposed by the
 * current Windy runtime. Unknown persisted values return to the product
 * default instead of being passed into Windy's overlay store.
 */
export const normalizeInitialOverlayPreference = (
    value: string | null,
    availableOverlays: ReadonlyArray<WindyOverlay>,
): InitialOverlayPreference => {
    if (value === KEEP_CURRENT_OVERLAY) {
        return KEEP_CURRENT_OVERLAY;
    }
    return availableOverlays.includes(value as WindyOverlay)
        ? value as WindyOverlay
        : DEFAULT_INITIAL_OVERLAY;
};

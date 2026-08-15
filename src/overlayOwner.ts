export interface OverlayOwner {
    deactivateForReplacement: () => void;
}

let activeOwner: OverlayOwner | null = null;

/** Keep one map overlay owner across Windy fullscreen panel remounts. */
export const claimOverlayOwner = (nextOwner: OverlayOwner): (() => void) => {
    activeOwner?.deactivateForReplacement();
    activeOwner = nextOwner;

    return () => {
        if (activeOwner === nextOwner) {
            activeOwner = null;
        }
    };
};

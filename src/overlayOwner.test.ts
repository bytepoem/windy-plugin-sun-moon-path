import { describe, expect, it, vi } from 'vitest';

import { claimOverlayOwner } from './overlayOwner';

describe('overlay owner handoff', () => {
    it('deactivates the previous instance without releasing the new owner', () => {
        const firstDeactivate = vi.fn();
        const secondDeactivate = vi.fn();
        const thirdDeactivate = vi.fn();

        const releaseFirst = claimOverlayOwner({ deactivateForReplacement: firstDeactivate });
        const releaseSecond = claimOverlayOwner({ deactivateForReplacement: secondDeactivate });

        expect(firstDeactivate).toHaveBeenCalledOnce();

        releaseFirst();
        const releaseThird = claimOverlayOwner({ deactivateForReplacement: thirdDeactivate });
        expect(secondDeactivate).toHaveBeenCalledOnce();

        releaseSecond();
        expect(thirdDeactivate).not.toHaveBeenCalled();

        releaseThird();
    });
});

type ChartPoint = { pointX: number; pointY: number; type: 'H' | 'L' };

// Bounds include both text lines at the larger mobile font size and the focus target.
export const TIDE_LABEL_WIDTH = 108;
export const TIDE_LABEL_HEIGHT = 47;
export const TIDE_LABEL_TOP_OFFSET = 19;
const GAP = 8;
const MIN_CENTER = 94;
const MAX_CENTER = 530;
const clampCenter = (value: number) => Math.max(MIN_CENTER, Math.min(MAX_CENTER, value));

/** Keep same-side labels in time order, then stagger remaining collisions outwards.
 * Coordinates stay in SVG units, so the larger mobile labels also fit without a resize listener.
 * Point positions are immutable: only labels move, and the caller draws their leader lines.
 */
export const layoutTideLabels = <T extends ChartPoint>(points: T[]) => {
    const labels = points.map(point => ({ ...point, labelX: clampCenter(point.pointX),
        labelY: point.pointY + (point.type === 'H' ? -34 : 26) }));
    for (const type of ['H', 'L'] as const) {
        const group = labels.filter(label => label.type === type).sort((a, b) => a.pointX - b.pointX);
        const step = TIDE_LABEL_WIDTH + GAP;
        // If a single row cannot hold every label, retain their point alignment and stagger below.
        if ((group.length - 1) * step > MAX_CENTER - MIN_CENTER) { continue; }
        group.forEach((label, index) => {
            const left = index === 0 ? MIN_CENTER : group[index - 1].labelX + step;
            const right = MAX_CENTER - (group.length - index - 1) * step;
            label.labelX = Math.max(left, Math.min(right, label.labelX));
        });
    }
    const placed: typeof labels = [];
    for (const label of labels) {
        let collision: typeof label | undefined;
        do {
            collision = placed.find(other => Math.abs(label.labelX - other.labelX) < TIDE_LABEL_WIDTH + GAP
                && Math.abs(label.labelY - other.labelY) < TIDE_LABEL_HEIGHT + GAP);
            if (collision) {
                label.labelY = label.type === 'H'
                    ? Math.floor(collision.labelY - TIDE_LABEL_HEIGHT - GAP)
                    : Math.ceil(collision.labelY + TIDE_LABEL_HEIGHT + GAP);
            }
        } while (collision);
        placed.push(label);
    }
    return labels;
};

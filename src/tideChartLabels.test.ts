import { describe, expect, it } from 'vitest';
import { layoutTideLabels, TIDE_LABEL_HEIGHT, TIDE_LABEL_WIDTH } from './tideChartLabels';

const assertSeparated = (labels: ReturnType<typeof layoutTideLabels>) => {
    for (let index = 0; index < labels.length; index += 1) {
        const label = labels[index];
        expect(label.labelX - TIDE_LABEL_WIDTH / 2).toBeGreaterThanOrEqual(40);
        expect(label.labelX + TIDE_LABEL_WIDTH / 2).toBeLessThanOrEqual(584);
        for (const other of labels.slice(index + 1)) {
            expect(Math.abs(label.labelX - other.labelX) >= TIDE_LABEL_WIDTH + 8
                || Math.abs(label.labelY - other.labelY) >= TIDE_LABEL_HEIGHT + 8).toBe(true);
        }
    }
};

describe('tide extrema label placement', () => {
    it('separates the reported morning and late-evening clusters without reversing their order', () => {
        const points = [
            { hour: 5, height: .36, type: 'L' }, { hour: 7, height: .41, type: 'H' },
            { hour: 9, height: .26, type: 'L' }, { hour: 20, height: 1.27, type: 'H' },
            { hour: 21, height: 1.23, type: 'L' }, { hour: 23, height: 1.31, type: 'H' },
        ].map(point => ({ pointX: 42 + point.hour * 22.5,
            pointY: 164 - (point.height - .1) / 1.4 * 110, type: point.type as 'H' | 'L' }));
        const before = structuredClone(points);
        const labels = layoutTideLabels(points);
        assertSeparated(labels);
        expect(labels[3].labelX).toBeLessThan(labels[5].labelX);
        expect(labels[0].labelX).toBeLessThan(labels[2].labelX);
        expect(points).toEqual(before);
        labels.forEach((label, index) => expect(label).toMatchObject(points[index]));
    });

    it('stacks dense labels outside the plot when one horizontal row is insufficient', () => {
        const points = Array.from({ length: 12 }, (_, index) => ({ pointX: 460 + index * 5,
            pointY: 100, type: index % 2 ? 'L' as const : 'H' as const }));
        const labels = layoutTideLabels(points);
        assertSeparated(labels);
        expect(labels.filter(label => label.type === 'H').some(label => label.labelY < 0)).toBe(true);
        expect(labels.filter(label => label.type === 'L').some(label => label.labelY > 230)).toBe(true);
    });

    it('keeps isolated labels in their original positions and handles an empty day', () => {
        expect(layoutTideLabels([])).toEqual([]);
        expect(layoutTideLabels([{ pointX: 300, pointY: 100, type: 'H' }]))
            .toEqual([{ pointX: 300, pointY: 100, type: 'H', labelX: 300, labelY: 66 }]);
    });
});

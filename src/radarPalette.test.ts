import { describe, expect, it } from 'vitest';

import {
    mapRainViewerPixelToNmc,
    NMC_RADAR_COLOR_BANDS,
    NMC_RADAR_PIXEL_TRANSFORM,
    nmcRadarColorForDbz,
    type RadarRgba,
} from './radarPalette';

const expectMapped = (source: RadarRgba, targetDbz: number) => {
    const expected = nmcRadarColorForDbz(targetDbz);
    expect(mapRainViewerPixelToNmc(source)).toEqual(expected);
};

describe('NMC radar color bands', () => {
    it('preserves the supplied dBZ boundaries', () => {
        expect(nmcRadarColorForDbz(0)).toEqual([0, 0, 35, 255]);
        expect(nmcRadarColorForDbz(0.1)).toEqual([0, 0, 239, 255]);
        expect(nmcRadarColorForDbz(4.99)).toEqual([0, 0, 239, 255]);
        expect(nmcRadarColorForDbz(5)).toEqual([65, 157, 241, 255]);
        expect(nmcRadarColorForDbz(30)).toEqual([255, 255, 0, 255]);
        expect(nmcRadarColorForDbz(45)).toEqual([255, 0, 0, 255]);
        expect(nmcRadarColorForDbz(60)).toEqual([255, 0, 240, 255]);
        expect(nmcRadarColorForDbz(70)).toEqual([175, 145, 240, 255]);
        expect(nmcRadarColorForDbz(80)).toEqual([255, 255, 250, 255]);
        expect(nmcRadarColorForDbz(255)).toEqual([255, 255, 255, 255]);
        expect(NMC_RADAR_COLOR_BANDS).toHaveLength(18);
    });

    it('maps RainViewer low-reflectivity alpha bands to the NMC blues', () => {
        expect(mapRainViewerPixelToNmc([0, 0, 0, 0])).toEqual([0, 0, 0, 0]);
        expectMapped([130, 123, 105, 73], 0);
        expectMapped([133, 125, 106, 78], 0.1);
        expectMapped([146, 136, 113, 100], 5);
        expectMapped([194, 180, 130, 140], 5);
        expectMapped([206, 192, 135, 150], 10);
        expectMapped([222, 208, 151, 190], 10);
    });

    it('maps RainViewer opaque bands to the NMC green, yellow, red and purple bands', () => {
        expectMapped([136, 221, 238, 255], 15);
        expectMapped([27, 174, 226, 255], 15);
        expectMapped([0, 163, 224, 255], 20);
        expectMapped([0, 127, 180, 255], 20);
        expectMapped([0, 119, 170, 255], 25);
        expectMapped([0, 91, 142, 255], 25);
        expectMapped([0, 85, 136, 255], 30);
        expectMapped([0, 71, 104, 255], 30);
        expectMapped([255, 238, 0, 255], 35);
        expectMapped([255, 183, 0, 255], 35);
        expectMapped([255, 170, 0, 255], 40);
        expectMapped([255, 129, 0, 255], 40);
        expectMapped([255, 68, 0, 255], 45);
        expectMapped([205, 13, 0, 255], 45);
        expectMapped([193, 0, 0, 255], 50);
        expectMapped([93, 0, 0, 255], 50);
        expectMapped([255, 170, 255, 255], 55);
        expectMapped([255, 129, 255, 255], 55);
        expectMapped([255, 119, 255, 255], 60);
        expectMapped([255, 78, 255, 255], 60);
    });

    it('maps RainViewer collapsed extreme colors to the nearest recoverable NMC classes', () => {
        expectMapped([255, 255, 255, 255], 65);
        expectMapped([0, 255, 0, 255], 70);
    });

    it('provides the Windy custom raster shader contract', () => {
        expect(NMC_RADAR_PIXEL_TRANSFORM).toContain('vec4 pixelTransform(vec4 color, bool isPrimary)');
        expect(NMC_RADAR_PIXEL_TRANSFORM).toContain('color.rgb / color.a');
        expect(NMC_RADAR_PIXEL_TRANSFORM).toContain('150.0 / 255.0, 0.0 / 255.0, 180.0 / 255.0');
        expect(NMC_RADAR_PIXEL_TRANSFORM).toContain('175.0 / 255.0, 145.0 / 255.0, 240.0 / 255.0');
    });
});

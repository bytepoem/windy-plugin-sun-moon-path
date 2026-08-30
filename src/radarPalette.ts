export type RadarRgba = readonly [red: number, green: number, blue: number, alpha: number];

type RadarColorBand = {
    minDbz: number;
    maxDbz: number;
    color: RadarRgba;
};

/** Central Meteorological Observatory reflectivity colors supplied for this plugin. */
export const NMC_RADAR_COLOR_BANDS: ReadonlyArray<RadarColorBand> = [
    { minDbz: 0, maxDbz: 0, color: [0, 0, 35, 255] },
    { minDbz: 0.1, maxDbz: 4.99, color: [0, 0, 239, 255] },
    { minDbz: 5, maxDbz: 9.99, color: [65, 157, 241, 255] },
    { minDbz: 10, maxDbz: 14.99, color: [100, 231, 235, 255] },
    { minDbz: 15, maxDbz: 19.99, color: [109, 250, 61, 255] },
    { minDbz: 20, maxDbz: 24.99, color: [0, 216, 0, 255] },
    { minDbz: 25, maxDbz: 29.99, color: [1, 144, 0, 255] },
    { minDbz: 30, maxDbz: 34.99, color: [255, 255, 0, 255] },
    { minDbz: 35, maxDbz: 39.99, color: [231, 192, 0, 255] },
    { minDbz: 40, maxDbz: 44.99, color: [255, 145, 0, 255] },
    { minDbz: 45, maxDbz: 49.99, color: [255, 0, 0, 255] },
    { minDbz: 50, maxDbz: 54.99, color: [215, 0, 0, 255] },
    { minDbz: 55, maxDbz: 59.99, color: [190, 0, 0, 255] },
    { minDbz: 60, maxDbz: 64.99, color: [255, 0, 240, 255] },
    { minDbz: 65, maxDbz: 69.99, color: [150, 0, 180, 255] },
    { minDbz: 70, maxDbz: 79.99, color: [175, 145, 240, 255] },
    { minDbz: 80, maxDbz: 81, color: [255, 255, 250, 255] },
    { minDbz: 81.01, maxDbz: 255, color: [255, 255, 255, 255] },
];

const colorForBandStart = (minDbz: number): RadarRgba => {
    const band = NMC_RADAR_COLOR_BANDS.find(candidate => candidate.minDbz === minDbz);
    if (!band) {
        throw new Error(`Missing NMC radar color band at ${minDbz} dBZ`);
    }
    return band.color;
};

/** Resolve the exact supplied NMC color band for a reflectivity value. */
export const nmcRadarColorForDbz = (dbz: number): RadarRgba => {
    const band = NMC_RADAR_COLOR_BANDS.find(candidate => dbz >= candidate.minDbz && dbz <= candidate.maxDbz);
    return band?.color || NMC_RADAR_COLOR_BANDS.at(-1)?.color || [255, 255, 255, 255];
};

const opaqueRadarColor = (color: RadarRgba): RadarRgba => [
    color[0],
    color[1],
    color[2],
    255,
];

/**
 * CPU reference for the GPU shader. RainViewer's unsmoothed Universal Blue tiles encode
 * low reflectivity in alpha and higher reflectivity in discrete RGB bands.
 */
export const mapRainViewerPixelToNmc = ([red, green, blue, alpha]: RadarRgba): RadarRgba => {
    if (alpha === 0) {
        return [0, 0, 0, 0];
    }
    if (alpha < 255) {
        if (alpha <= 73) {
            return opaqueRadarColor(colorForBandStart(0));
        }
        if (alpha <= 94) {
            return opaqueRadarColor(colorForBandStart(0.1));
        }
        if (alpha <= 140) {
            return opaqueRadarColor(colorForBandStart(5));
        }
        return opaqueRadarColor(colorForBandStart(10));
    }

    if (red >= 250 && green >= 250 && blue >= 250) {
        // Universal Blue collapses 65–74 dBZ into one white source color.
        return colorForBandStart(65);
    }
    if (red <= 5 && green >= 250 && blue <= 5) {
        // Universal Blue also collapses 75 dBZ and above into one green source color.
        return colorForBandStart(70);
    }
    if (red >= 230 && blue >= 230) {
        return green >= 125 ? colorForBandStart(55) : colorForBandStart(60);
    }
    if (blue <= 5 && red >= 80) {
        if (green >= 175) {
            return colorForBandStart(35);
        }
        if (green >= 100) {
            return colorForBandStart(40);
        }
        if (green > 0) {
            return colorForBandStart(45);
        }
        return colorForBandStart(50);
    }
    if (blue >= 100 && green >= 65) {
        if (red > 10) {
            return colorForBandStart(15);
        }
        if (blue >= 175) {
            return colorForBandStart(20);
        }
        if (blue >= 139) {
            return colorForBandStart(25);
        }
        return colorForBandStart(30);
    }
    return [0, 0, 0, 0];
};

const glslColor = (minDbz: number): string => {
    const [red, green, blue] = colorForBandStart(minDbz);
    return `vec3(${red}.0 / 255.0, ${green}.0 / 255.0, ${blue}.0 / 255.0)`;
};

/** GPU equivalent of mapRainViewerPixelToNmc for Windy's LeafletGl raster layer. */
export const NMC_RADAR_PIXEL_TRANSFORM = `
vec4 nmcRadarOutput(vec3 rgb) {
    return vec4(rgb, 1.0);
}

vec4 pixelTransform(vec4 color, bool isPrimary) {
    if (color.a <= 0.001) {
        return vec4(0.0);
    }

    vec3 source = color.rgb / color.a;
    float red = source.r * 255.0;
    float green = source.g * 255.0;
    float blue = source.b * 255.0;

    if (color.a < 0.999) {
        if (color.a <= 73.5 / 255.0) {
            return nmcRadarOutput(${glslColor(0)});
        }
        if (color.a <= 94.5 / 255.0) {
            return nmcRadarOutput(${glslColor(0.1)});
        }
        if (color.a <= 140.5 / 255.0) {
            return nmcRadarOutput(${glslColor(5)});
        }
        return nmcRadarOutput(${glslColor(10)});
    }

    if (red >= 250.0 && green >= 250.0 && blue >= 250.0) {
        return nmcRadarOutput(${glslColor(65)});
    }
    if (red <= 5.0 && green >= 250.0 && blue <= 5.0) {
        return nmcRadarOutput(${glslColor(70)});
    }
    if (red >= 230.0 && blue >= 230.0) {
        return nmcRadarOutput(green >= 125.0 ? ${glslColor(55)} : ${glslColor(60)});
    }
    if (blue <= 5.0 && red >= 80.0) {
        if (green >= 175.0) {
            return nmcRadarOutput(${glslColor(35)});
        }
        if (green >= 100.0) {
            return nmcRadarOutput(${glslColor(40)});
        }
        if (green > 0.0) {
            return nmcRadarOutput(${glslColor(45)});
        }
        return nmcRadarOutput(${glslColor(50)});
    }
    if (blue >= 100.0 && green >= 65.0) {
        if (red > 10.0) {
            return nmcRadarOutput(${glslColor(15)});
        }
        if (blue >= 175.0) {
            return nmcRadarOutput(${glslColor(20)});
        }
        if (blue >= 139.0) {
            return nmcRadarOutput(${glslColor(25)});
        }
        return nmcRadarOutput(${glslColor(30)});
    }

    return vec4(0.0);
}
`;

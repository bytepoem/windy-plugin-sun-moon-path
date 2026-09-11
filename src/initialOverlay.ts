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

/** Plugin-owned labels follow the plugin language, never Windy's global UI language. */
const INITIAL_OVERLAY_LABELS: Record<WindyOverlay, readonly [string, string]> = {
    radar: ['气象雷达', 'Weather radar'],
    satellite: ['卫星', 'Satellite'],
    wind: ['风', 'Wind'],
    gust: ['阵风', 'Wind gusts'],
    gustAccu: ['最大阵风', 'Maximum wind gusts'],
    turbulence: ['湍流', 'Turbulence'],
    icing: ['结冰', 'Icing'],
    rain: ['雨、雷暴', 'Rain, thunder'],
    rainAccu: ['降雨量', 'Rain accumulation'],
    snowAccu: ['新雪', 'New snow'],
    snowcover: ['积雪深度', 'Snow depth'],
    ptype: ['降水类型', 'Precipitation type'],
    thunder: ['雷暴', 'Thunderstorms'],
    temp: ['温度', 'Temperature'],
    dewpoint: ['露点', 'Dew point'],
    rh: ['湿度', 'Humidity'],
    deg0: ['零度层高度', 'Freezing altitude'],
    wetbulbtemp: ['湿球温度', 'Wet-bulb temperature'],
    solarpower: ['太阳辐射', 'Solar radiation'],
    uvindex: ['紫外线指数', 'UV index'],
    clouds: ['云', 'Clouds'],
    hclouds: ['高云', 'High clouds'],
    mclouds: ['中云', 'Medium clouds'],
    lclouds: ['低云', 'Low clouds'],
    fog: ['雾', 'Fog'],
    cloudtop: ['云顶', 'Cloud tops'],
    cbase: ['云底', 'Cloud base'],
    visibility: ['能见度', 'Visibility'],
    cape: ['对流有效位能', 'CAPE index'],
    ccl: ['对流凝结高度', 'Convective cloud base'],
    waves: ['海浪', 'Waves'],
    swell1: ['涌浪', 'Swell'],
    swell2: ['第二涌浪', 'Swell 2'],
    swell3: ['第三涌浪', 'Swell 3'],
    wwaves: ['风浪', 'Wind waves'],
    sst: ['海水温度', 'Sea temperature'],
    currents: ['洋流', 'Currents'],
    currentsTide: ['潮流', 'Tidal currents'],
    wavePower: ['波浪能', 'Wave power'],
    aqi: ['空气质量指数', 'Air quality index'],
    no2: ['二氧化氮', 'Nitrogen dioxide'],
    pm2p5: ['细颗粒物 PM2.5', 'PM2.5'],
    aod550: ['气溶胶光学厚度', 'Aerosol optical depth'],
    gtco3: ['臭氧总量', 'Total ozone'],
    tcso2: ['二氧化硫总量', 'Total sulphur dioxide'],
    go3: ['地面臭氧', 'Surface ozone'],
    cosc: ['一氧化碳', 'Carbon monoxide'],
    dustsm: ['沙尘', 'Dust'],
    pressure: ['气压', 'Pressure'],
    efiTemp: ['极端温度预报指数', 'Extreme temperature index'],
    efiWind: ['极端风速预报指数', 'Extreme wind index'],
    efiRain: ['极端降雨预报指数', 'Extreme rain index'],
    capAlerts: ['天气预警', 'Weather warnings'],
    avalancheDanger: ['雪崩危险', 'Avalanche danger'],
    soilMoisture40: ['土壤湿度（0–40厘米）', 'Soil moisture (0–40 cm)'],
    soilMoisture100: ['土壤湿度（0–100厘米）', 'Soil moisture (0–100 cm)'],
    moistureAnom40: ['土壤湿度距平（0–40厘米）', 'Moisture anomaly (0–40 cm)'],
    moistureAnom100: ['土壤湿度距平（0–100厘米）', 'Moisture anomaly (0–100 cm)'],
    drought40: ['干旱强度（0–40厘米）', 'Drought intensity (0–40 cm)'],
    drought100: ['干旱强度（0–100厘米）', 'Drought intensity (0–100 cm)'],
    fwi: ['火险指数', 'Fire danger'],
    dfm10h: ['可燃物湿度（10小时）', 'Fuel moisture (10 hours)'],
    dfm100h: ['可燃物湿度（100小时）', 'Fuel moisture (100 hours)'],
    dfm1000h: ['可燃物湿度（1000小时）', 'Fuel moisture (1000 hours)'],
    heatmaps: ['热点', 'Active fires'],
    topoMap: ['地形图', 'Topographic map'],
    hurricanes: ['飓风跟踪器', 'Hurricane tracker'],
};

export const initialOverlayLabel = (overlay: WindyOverlay, language: 'zh' | 'en'): string =>
    INITIAL_OVERLAY_LABELS[overlay][language === 'zh' ? 0 : 1];

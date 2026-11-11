import { defineMessages, localized } from '../localeMessages';
/** plugin interface copy, checked against the same schema in every language. */
export const messages = defineMessages({
    zh: {
        compass: ['北', '东北', '东', '东南', '南', '西南', '西', '西北'],
        blueHours: { dawn: '晨间蓝调', dusk: '暮间蓝调' },
        countdown: '倒计时',
        compactRemaining: (hours: number, minutes: number) => hours > 0 ? `${hours}h${minutes}m` : `${minutes}m`,
        unavailableEvent: (name: string, moon: boolean, reason: string) => {
            const body = moon ? '月亮' : '太阳';
            if (reason === 'always-up') {
                return `当天${body}始终在地平线以上，没有可用的${name}时刻。`;
            }
            if (reason === 'always-down') {
                return `当天${body}始终在地平线以下，没有可用的${name}时刻。`;
            }
            return `当天没有可用的${name}时刻。`;
        },
        centreRainbowSkyChart: '居中彩虹方向图',
        fitHorizonRadius: '适配地平线范围',
        fitAllCloudReferenceLines: '显示全部云层参考线',
        focusCloudHorizonAndIntersections: '聚焦云层地平线与遮挡交点',
        liveBodies: { sun: '太阳 · 实时', moon: '月亮 · 实时' },
        ended: '已结束',
        rainbowPlanningRequiresASingleEvent: '彩虹规划需选择单个事件',
        cloudPlanningRequiresASingleEvent: '云层规划需选择单个事件',
        coordinatesCopied: '经纬度已复制',
        copyFailedTryAgain: '复制失败，请重试',
        weatherModelForecast: '天气模式预报',
    },
    en: {
        compass: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
        blueHours: { dawn: 'Morning blue hour', dusk: 'Evening blue hour' },
        countdown: 'Next',
        compactRemaining: localized((t, hours: number, minutes: number) => hours > 0 ? t("{{0}}h {{1}}m", hours, minutes) : t("{{0}}m", minutes)),
        unavailableEvent: localized((t, name: string, moon: boolean, reason: string) => {
            const body = moon ? t("moon") : t("sun");
            if (reason === 'always-up') {
                return t("The {{0}} stays above the horizon today; no {{1}} time is available.", body, name);
            }
            if (reason === 'always-down') {
                return t("The {{0}} stays below the horizon today; no {{1}} time is available.", body, name);
            }
            return t("No {{0}} time is available today.", name);
        }),
        centreRainbowSkyChart: 'Centre rainbow sky chart',
        fitHorizonRadius: 'Fit horizon radius',
        fitAllCloudReferenceLines: 'Fit all cloud reference lines',
        focusCloudHorizonAndIntersections: 'Focus cloud horizon and intersections',
        liveBodies: { sun: 'Sun · Live', moon: 'Moon · Live' },
        ended: 'Ended',
        rainbowPlanningRequiresASingleEvent: 'Rainbow planning requires a single event',
        cloudPlanningRequiresASingleEvent: 'Cloud planning requires a single event',
        coordinatesCopied: 'Coordinates copied',
        copyFailedTryAgain: 'Copy failed. Try again',
        weatherModelForecast: 'Weather model forecast',
    },
});

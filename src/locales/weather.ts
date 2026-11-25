import { defineMessages, localized } from '../localeMessages';
/** weather interface copy, checked against the same schema in every language. */
export const messages = defineMessages({
    zh: {
        snowGrades: { trace: '微量降雪', light: '小雪', moderate: '中雪', heavy: '大雪', snowstorm: '暴雪', heavySnowstorm: '大暴雪', extremeSnowstorm: '特大暴雪' },
        snowConditions: { snow: '雪', wetSnow: '湿雪', rainAndSnow: '雨夹雪', snowGrains: '雪粒', snowShowers: '阵雪' },
        dateGroup: (month: number, day: number) => `${month}/${day}`,
        conditions: ['未知', '晴', '大部晴朗', '多云', '阴', '大部晴朗有雨', '多云有雨', '阴有雨', '大部晴朗有雪', '多云有雪', '阴有雪', '雨夹雪', '雨夹雪', '雨夹雪', '雷雨', '雷雪', '雷雨夹雪', '雾', '阵雨', '阵雨', '阵雨', '雷阵雨', '晴有雾', '雷暴', '多云有雷暴'],
    },
    en: {
        snowGrades: { trace: 'Trace snowfall', light: 'Light snow', moderate: 'Moderate snow', heavy: 'Heavy snow', snowstorm: 'Snowstorm', heavySnowstorm: 'Heavy snowstorm', extremeSnowstorm: 'Extreme snowstorm' },
        snowConditions: { snow: 'Snow', wetSnow: 'Wet snow', rainAndSnow: 'Rain and snow', snowGrains: 'Snow grains', snowShowers: 'Snow showers' },
        dateGroup: localized((t, month: number, day: number) => t("{{0}}/{{1}}", month, day)),
        conditions: ['Unknown', 'Clear', 'Mostly clear', 'Partly cloudy', 'Overcast', 'Mostly clear with rain', 'Cloudy with rain', 'Overcast with rain', 'Mostly clear with snow', 'Cloudy with snow', 'Overcast with snow', 'Rain and snow', 'Rain and snow', 'Rain and snow', 'Thunderstorm', 'Thunder snow', 'Thunder rain and snow', 'Fog', 'Showers', 'Showers', 'Showers', 'Thunder showers', 'Clear with fog', 'Thunderstorm', 'Partly cloudy thunderstorm'],
    },
});

import { defineMessages, localized } from '../localeMessages';
/** weather interface copy, checked against the same schema in every language. */
export const messages = defineMessages({
    zh: {
        dateGroup: (month: number, day: number) => `${month}.${day}`,
        conditions: ['未知', '晴', '大部晴朗', '多云', '阴', '局部有雨', '多云有雨', '阴有雨', '局部有雪', '多云有雪', '阴有雪', '雨夹雪', '雨夹雪', '雨夹雪', '雷雨', '雷雪', '雷雨夹雪', '雾', '阵雨', '阵雨', '阵雨', '雷阵雨', '晴雾', '雷暴', '局部雷暴'],
    },
    en: {
        dateGroup: localized((t, month: number, day: number) => t("{{0}}/{{1}}", month, day)),
        conditions: ['Unknown', 'Clear', 'Mostly clear', 'Partly cloudy', 'Overcast', 'Mostly clear with rain', 'Cloudy with rain', 'Overcast with rain', 'Mostly clear with snow', 'Cloudy with snow', 'Overcast with snow', 'Rain and snow', 'Rain and snow', 'Rain and snow', 'Thunderstorm', 'Thunder snow', 'Thunder rain and snow', 'Fog', 'Showers', 'Showers', 'Showers', 'Thunder showers', 'Clear with fog', 'Thunderstorm', 'Partly cloudy thunderstorm'],
    },
});

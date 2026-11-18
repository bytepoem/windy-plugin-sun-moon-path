import { defineMessages } from '../localeMessages';
/** PluginSettings interface copy, checked against the same schema in every language. */
export const messages = defineMessages({
    zh: {
        preferences: '设置',
        userGuide: '说明',
        snowDisplay: '雪况显示',
        snowDisplayAuto: '有雪时显示',
        snowDisplayAlways: '始终显示',
        snowDisplayHidden: '隐藏',
    },
    en: {
        preferences: 'Settings',
        userGuide: 'Guide',
        snowDisplay: 'Snow display',
        snowDisplayAuto: 'Show when snow is forecast',
        snowDisplayAlways: 'Always show',
        snowDisplayHidden: 'Hide',
    },
});

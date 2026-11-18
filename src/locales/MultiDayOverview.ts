import { defineMessages } from '../localeMessages';

export const messages = defineMessages({
    zh: {
        single: '单日事件', overview: '多日总览', week: '7 天总览', month: '月度天文',
        nightRule: '夜间按当地中午至翌日中午归属；月相取当日中午。',
        monthRule: '仅比较天文条件；条长表示窗口时长，不表示天气或成功概率。',
        guide: '天文 → 多日总览：查看 7 天窗口与天气，或按月度天文选日期。选择窗口进入单日事件。',
        range: '预报范围', continues: '跨中午延续',
        snowRule: '新雪和雪水当量保留相交的完整累计时段；积雪取窗口内的预报时次。',
        vertical: '竖向', horizontal: '横向',
    },
    en: {
        single: 'Single-day events', overview: 'Multi-day overview', week: '7-day overview', month: 'Monthly astronomy',
        nightRule: 'Nights run from local noon to the next noon; moon phase is measured at noon.',
        monthRule: 'Astronomy only; bar length shows window duration, not weather or success probability.',
        guide: 'Astro → Multi-day overview: seven days of windows and weather, or monthly astronomy. Choose a window to open single-day events.',
        range: 'Forecast range', continues: 'Continues across noon',
        snowRule: 'New snow and snow water equivalent retain full overlapping periods. Snow depth uses samples inside the window.',
        vertical: 'Vertical', horizontal: 'Horizontal',
    },
});

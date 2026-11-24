import type { ExternalPluginConfig } from '@windy/interfaces.d';

/** Keep this date aligned with the published GitHub Release for the configured version. */
export const currentVersionReleasedAt = '2026-11-24';

const config: ExternalPluginConfig = {
    name: 'windy-plugin-sun-moon-path',
    version: '0.13.4',
    icon: '☀️',
    title: 'Sun & Moon Path',
    description: '在 Windy 上规划日出、日落、月亮和银河拍摄，查看升落时刻、天体方位和天空盘。浏览多日拍摄窗口与天气，按时段对比收藏机位。云层距离和彩虹视线为估算。支持 42 种语言，可跟随 Windy。 Plan Sun, Moon and Milky Way shoots with a sky chart, multi-day windows and weather comparisons at favorite sites. Cloud distances and rainbow sightlines are estimates. Supports 42 languages.',
    author: 'bytepoem',
    repository: 'https://github.com/bytepoem/windy-plugin-sun-moon-path',
    desktopUI: 'rhpane',
    desktopWidth: 520,
    mobileUI: 'small',
    addToContextmenu: true,
    listenToSingleclick: true,
    routerPath: '/sun-moon-path/:lat?/:lon?',
    private: false,
};

export default config;

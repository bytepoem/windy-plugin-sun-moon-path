import type { ExternalPluginConfig } from '@windy/interfaces.d';

/** Keep this date aligned with the published GitHub Release for the configured version. */
export const currentVersionReleasedAt = '2026-09-10';

const config: ExternalPluginConfig = {
    name: 'windy-plugin-sun-moon-path',
    version: '0.10.3',
    icon: '☀️',
    title: 'Sun & Moon Path',
    description: '在 Windy 上规划日出、日落、月亮与银河拍摄。查看天体方位、升落时刻和观测窗口，估算云层遮挡距离，结合卫星云图与天气预报比较收藏机位。支持中英文。 Plan Sun, Moon and Milky Way photography with celestial directions, cloud-distance estimates, satellite imagery and weather comparisons.',
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

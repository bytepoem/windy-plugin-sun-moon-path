import type { ExternalPluginConfig } from '@windy/interfaces.d';

/** Keep this date aligned with the published GitHub Release for the configured version. */
export const currentVersionReleasedAt = '2026-10-01';

const config: ExternalPluginConfig = {
    name: 'windy-plugin-sun-moon-path',
    version: '0.11.3',
    icon: '☀️',
    title: 'Sun & Moon Path',
    description: '在 Windy 上规划日出、日落、月亮、银河与彩虹拍摄。查看天体方位、升落时刻、天空盘与观测窗口，参考光污染、云层距离和天气信息，比较收藏机位。云层遮挡与彩虹视线均为估算，不保证可见。支持中英文。 Plan Sun, Moon, Milky Way and rainbow photography with sky views, event times, light pollution, cloud-distance estimates and weather comparisons. Visibility is not guaranteed.',
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

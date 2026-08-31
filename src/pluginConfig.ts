import type { ExternalPluginConfig } from '@windy/interfaces.d';

/** Keep this date aligned with the published GitHub Release for the configured version. */
export const currentVersionReleasedAt = '2026-08-31';

const config: ExternalPluginConfig = {
    name: 'windy-plugin-sun-moon-path',
    version: '0.9.1',
    icon: '☀️',
    title: 'Sun & Moon Path',
    description: 'Show sunrise, sunset, moonrise, moonset and live celestial directions on Windy.',
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

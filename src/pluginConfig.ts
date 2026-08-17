import type { ExternalPluginConfig } from '@windy/interfaces.d';

type PrereleaseExternalPluginConfig = Omit<ExternalPluginConfig, 'version'> & { version: string };

const config: PrereleaseExternalPluginConfig = {
    name: 'windy-plugin-sun-path',
    version: '0.5.0-beta.1',
    icon: '☀️',
    title: 'Sun & Moon Path',
    description: 'Show sunrise, sunset, moonrise, moonset and live celestial directions on Windy.',
    author: 'bytepoem',
    repository: 'https://github.com/bytepoem/windy-plugin-sun-path',
    desktopUI: 'rhpane',
    desktopWidth: 520,
    mobileUI: 'small',
    addToContextmenu: true,
    listenToSingleclick: true,
    routerPath: '/sun-path/:lat?/:lon?',
    private: false,
};

export default config as ExternalPluginConfig;

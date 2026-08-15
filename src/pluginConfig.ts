import type { ExternalPluginConfig } from '@windy/interfaces.d';

const config: ExternalPluginConfig = {
    name: 'windy-plugin-sun-path',
    version: '0.2.0',
    icon: '☀️',
    title: 'Sun & Moon Path',
    description: 'Show sunrise, sunset, moonrise, moonset and live celestial directions on Windy.',
    author: 'bytepoem',
    repository: 'https://github.com/bytepoem/windy-plugin-sun-path',
    desktopUI: 'embedded',
    mobileUI: 'fullscreen',
    addToContextmenu: true,
    listenToSingleclick: true,
    routerPath: '/sun-path/:lat?/:lon?',
    private: true,
};

export default config;

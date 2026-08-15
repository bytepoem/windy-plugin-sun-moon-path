import type { ExternalPluginConfig } from '@windy/interfaces.d';

const config: ExternalPluginConfig = {
    name: 'windy-plugin-sun-path',
    version: '0.1.0',
    icon: '☀️',
    title: '日出日落方向线工具',
    description: '在 Windy 地图上显示日出、日落及前后 30 分钟方向线。',
    author: 'Void',
    repository: 'https://github.com/bytepoem/windy-plugin-sun-path',
    desktopUI: 'embedded',
    mobileUI: 'fullscreen',
    addToContextmenu: true,
    listenToSingleclick: true,
    routerPath: '/sun-path/:lat?/:lon?',
    private: true,
};

export default config;

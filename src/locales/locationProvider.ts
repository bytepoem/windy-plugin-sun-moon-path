import { defineMessages } from '../uiLanguage';
export const KNOWN_LOCATION_SEARCH_FAILURES = defineMessages({
    zh: {
        BAIDU_SDK_LOAD_FAILED: '地图服务加载失败，请检查网络后重试。',
        BAIDU_SDK_TIMEOUT: '地图服务加载超时，请稍后重试。',
        BAIDU_SDK_UNAVAILABLE: '地图服务未完成加载，请重试。',
        BAIDU_INVALID_KEY: 'Key 无效，请检查设置中保存的 Key。',
        BAIDU_INVALID_REQUEST: '地点搜索请求无效，请更换关键词后重试。',
        BAIDU_PERMISSION_DENIED: 'Key 无权限调用地点搜索，请确认已开启 JavaScript API 服务，且 Referer 白名单包含 www.windy.com。',
        BAIDU_SERVICE_UNAVAILABLE: '地图服务暂时不可用，请稍后重试。',
        BAIDU_SEARCH_TIMEOUT: '地点搜索超时，请稍后重试。',
        BAIDU_SEARCH_FAILED: '地点搜索失败，请确认 Key 已开启 JavaScript API 服务，且 Referer 白名单包含 www.windy.com。',
        JSONP_LOAD_FAILED: '搜索服务加载失败，请检查网络后重试。',
        REQUEST_TIMEOUT: '搜索服务请求超时，请稍后重试。',
    },
    en: {
        BAIDU_SDK_LOAD_FAILED: 'Map service failed to load. Check the network and try again.',
        BAIDU_SDK_TIMEOUT: 'Map service loading timed out. Try again later.',
        BAIDU_SDK_UNAVAILABLE: 'Map service did not finish loading. Try again.',
        BAIDU_INVALID_KEY: 'The Key is invalid. Check the Key saved in Settings.',
        BAIDU_INVALID_REQUEST: 'The place search request is invalid. Change the keyword and try again.',
        BAIDU_PERMISSION_DENIED: 'The Key cannot use place search. Confirm that JavaScript API is enabled and that www.windy.com is in its Referer allowlist.',
        BAIDU_SERVICE_UNAVAILABLE: 'Map service is temporarily unavailable. Try again later.',
        BAIDU_SEARCH_TIMEOUT: 'Place search timed out. Try again later.',
        BAIDU_SEARCH_FAILED: 'Place search failed. Confirm that JavaScript API is enabled for the Key and that www.windy.com is in its Referer allowlist.',
        JSONP_LOAD_FAILED: 'Search service failed to load. Check the network and try again.',
        REQUEST_TIMEOUT: 'Search service request timed out. Try again later.',
    },
});
export const messages = defineMessages({
    zh: { providerError: (provider: string, detail: string) => `${provider}：${detail}` },
    en: { providerError: (provider: string, detail: string) => `${provider}: ${detail}` },
});

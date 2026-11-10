import { defineMessages } from '../uiLanguage';
export const messages = defineMessages({
    zh: {
        noFrame: (source: string) => `${source} · 无对应时次`,
        loading: (source: string) => `${source} · 加载中…`,
    },
    en: {
        noFrame: (source: string) => `${source} · No matching frame`,
        loading: (source: string) => `${source} · Loading…`,
    },
});

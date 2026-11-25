import { defineMessages, localized } from '../localeMessages';
export const messages = defineMessages({
    zh: {
        noFrame: (source: string) => `${source} · 无对应时次`,
        loading: (source: string) => `${source} · 加载中…`,
    },
    en: {
        noFrame: localized((t, source: string) => t("{{0}} · No matching frame", source)),
        loading: localized((t, source: string) => t("{{0}} · Loading…", source)),
    },
});

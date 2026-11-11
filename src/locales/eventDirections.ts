import { defineMessages, localized } from '../localeMessages';
export const messages = defineMessages({
    zh: {
        before: (name: string) => `${name}前 30m`,
        after: (name: string) => `${name}后 30m`,
    },
    en: {
        before: localized((t, name: string) => t("30m before {{0}}", name)),
        after: localized((t, name: string) => t("30m after {{0}}", name)),
    },
});

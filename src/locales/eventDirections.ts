import { defineMessages } from '../uiLanguage';
export const messages = defineMessages({
    zh: {
        before: (name: string) => `${name}前 30m`,
        after: (name: string) => `${name}后 30m`,
    },
    en: {
        before: (name: string) => `30m before ${name}`,
        after: (name: string) => `30m after ${name}`,
    },
});

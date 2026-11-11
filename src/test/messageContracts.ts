import { defineMessages } from '../localeMessages';

/** Compile-only negative cases: translations must preserve keys, nesting and interpolation inputs. */
export const verifyMessageContracts = (): void => {
    defineMessages({
        zh: { title: '标题', count: (value: number) => `${value}` },
        // @ts-expect-error A translated catalog must provide every key.
        en: { title: 'Title' },
    });
    defineMessages({
        zh: { count: (value: number) => `${value}` },
        // @ts-expect-error Interpolation arguments are part of the translation contract.
        en: { count: (value: string) => value },
    });
    // @ts-expect-error A registered language cannot be omitted.
    defineMessages({ zh: { title: '标题' } });
};

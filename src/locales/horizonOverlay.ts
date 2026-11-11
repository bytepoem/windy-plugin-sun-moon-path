import { defineMessages, localized } from '../localeMessages';
/** Map labels for the geographic event horizon overlay. */
export const messages = defineMessages({
    zh: {
        events: { sunrise: '日出', sunset: '日落', moonrise: '月出', moonset: '月落', milkywayrise: '银心升起', milkywayset: '银心落下' },
        shortEvents: { sunrise: '日出', sunset: '日落', moonrise: '月出', moonset: '月落', milkywayrise: '银心升', milkywayset: '银心落' },
        horizon: (event: string) => `${event}地平线`,
        selectedLocation: '所选位置',
    },
    en: {
        events: { sunrise: 'Sunrise', sunset: 'Sunset', moonrise: 'Moonrise', moonset: 'Moonset', milkywayrise: 'Galactic centre rise', milkywayset: 'Galactic centre set' },
        shortEvents: { sunrise: 'Sunrise', sunset: 'Sunset', moonrise: 'Moonrise', moonset: 'Moonset', milkywayrise: 'GC rise', milkywayset: 'GC set' },
        horizon: localized((t, event: string) => t("{{0}} horizon", event)),
        selectedLocation: 'Selected location',
    },
});

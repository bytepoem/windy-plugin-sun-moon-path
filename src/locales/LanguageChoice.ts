import { defineMessages } from '../uiLanguage';
/** The first-use prompt deliberately shows Chinese and English before a language is confirmed.
 * The choices themselves come from the full registry and use each language's native name.
 */
export const messages = defineMessages({
    zh: {
        title: '选择语言',
        description: '请选择插件的显示语言。',
        defaultLabel: '默认',
        hint: '之后可在「设置」中随时修改。',
        confirm: '确认',
    },
    en: {
        title: 'Choose your language',
        description: 'Select the language for this plugin.',
        defaultLabel: 'Default',
        hint: 'You can change this later in Settings.',
        confirm: 'Confirm',
    },
});

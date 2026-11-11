<script lang="ts">
    import { UI_LANGUAGES, UI_LANGUAGE_OPTIONS, DEFAULT_UI_LANGUAGE, type UiLanguage, type UiLanguagePreference } from './uiLanguage';
    import { translations, temporaryEnglishAction } from './pluginTranslations';

    export let language: UiLanguage = DEFAULT_UI_LANGUAGE;
    export let initialPreference: UiLanguagePreference = 'auto';
    export let choose: (preference: UiLanguagePreference) => void = () => undefined;
    export let useEnglish: () => void = () => undefined;
    let selected = initialPreference;
    $: text = translations[language];
</script>

<section class="language-recovery" lang={UI_LANGUAGES[language].locale} dir="ltr" aria-label={text.languageLabel}>
    <p role="alert">{text.languageLoadErrorLabel}</p>
    <form on:submit|preventDefault={() => choose(selected)}>
        <label for="startup-language">{text.languageLabel}</label>
        <select id="startup-language" bind:value={selected}>
            <option value="auto">{text.followWindyLanguageLabel}</option>
            {#each UI_LANGUAGE_OPTIONS as option}
                <option value={option.value} lang={option.locale}>{option.nativeName}</option>
            {/each}
        </select>
        <button type="submit">{text.retry}</button>
    </form>
    <button type="button" on:click={useEnglish}>{temporaryEnglishAction[UI_LANGUAGES[language].releaseNotesLanguage]}</button>
</section>

<style>
    .language-recovery { padding: 16px; color: inherit; font: 13px/1.5 sans-serif; }
    p { margin: 0 0 10px; }
    form { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    select, button {
        min-height: 36px; padding: 4px 8px; border: 1px solid #485364;
        border-radius: 6px; color: #f2f4fa; background: #17202d; font: inherit;
    }
    select { max-width: 180px; }
    button { cursor: pointer; }
    select:focus-visible, button:focus-visible { outline: 2px solid #6ed9ee; outline-offset: 2px; }
</style>

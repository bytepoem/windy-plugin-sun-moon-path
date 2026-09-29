<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import type { UiLanguage } from './pluginTranslations';

    const dispatch = createEventDispatcher<{ confirm: UiLanguage }>();
    let selectedLanguage: UiLanguage = 'zh';
    let dialog: HTMLDialogElement;

    // Native modality traps focus and blocks background input; removal releases it immediately.
    onMount(() => {
        dialog.showModal();
        return () => dialog.close();
    });
</script>

<!-- Native dialog is interactive; this Svelte compiler predates its accessibility mapping. -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<dialog class="language-choice" bind:this={dialog} aria-labelledby="language-choice-title"
    aria-describedby="language-choice-description" on:cancel|preventDefault
    on:keydown|stopPropagation on:wheel|stopPropagation on:touchmove|stopPropagation>
    <form on:submit|preventDefault={() => dispatch('confirm', selectedLanguage)}>
        <div class="language-choice-heading">
            <span class="language-choice-eyebrow">Sun &amp; Moon Path</span>
            <h2 id="language-choice-title"><span lang="zh-CN">选择语言</span><span lang="en">Choose your language</span></h2>
            <p id="language-choice-description"><span lang="zh-CN">请选择插件的显示语言。</span><span lang="en">Select the language for this plugin.</span></p>
        </div>
        <div class="language-choice-options">
            <label class:selected={selectedLanguage === 'zh'}>
                <input type="radio" name="plugin-language" value="zh" bind:group={selectedLanguage} />
                <span><strong lang="zh-CN">简体中文</strong><small lang="en">Simplified Chinese</small></span>
                <span class="language-choice-default"><span lang="zh-CN">默认</span> / <span lang="en">Default</span></span>
            </label>
            <label class:selected={selectedLanguage === 'en'}>
                <input type="radio" name="plugin-language" value="en" bind:group={selectedLanguage} />
                <span><strong lang="en">English</strong><small lang="zh-CN">英语</small></span>
            </label>
        </div>
        <p class="language-choice-hint"><span lang="zh-CN">之后可在「设置」中随时修改。</span><span lang="en">You can change this later in Settings.</span></p>
        <button type="submit"><span lang="zh-CN">确认</span><span aria-hidden="true"> / </span><span lang="en">Confirm</span></button>
    </form>
</dialog>

<style>
    .language-choice {
        box-sizing: border-box;
        width: min(420px, calc(100vw - 32px));
        max-height: calc(100dvh - 32px);
        margin: auto;
        padding: 26px;
        overflow-y: auto;
        border: 1px solid #485364;
        border-radius: 16px;
        background: #17202d;
        color: #f2f4fa;
        font-family: inherit;
        box-shadow: 0 20px 64px #0008;
    }
    .language-choice::backdrop { background: #070d16b8; }
    form { display: flex; flex-direction: column; gap: 20px; margin: 0; }
    .language-choice-eyebrow { color: #6ed9ee; font-size: 12px; letter-spacing: .04em; }
    h2 { display: flex; flex-direction: column; gap: 5px; margin: 12px 0; font-size: 23px; line-height: 1.3; font-weight: 600; }
    h2 span[lang='en'] { font-size: 19px; }
    p { display: flex; flex-direction: column; gap: 3px; margin: 0; color: #b9c2ce; font-size: 13px; line-height: 1.5; }
    .language-choice-options { display: flex; flex-direction: column; gap: 10px; }
    label { display: flex; align-items: center; gap: 12px; min-height: 72px; box-sizing: border-box; padding: 12px; border: 1px solid #485364; border-radius: 10px; cursor: pointer; background: #101923; }
    label.selected { border-color: #6ed9ee; background: #203745; }
    input { margin: 0; width: 16px; height: 16px; flex-shrink: 0; accent-color: #6ed9ee; }
    label > span:not(.language-choice-default) { display: flex; flex-direction: column; gap: 3px; }
    strong { font-size: 15px; font-weight: 600; }
    small { color: #b9c2ce; font-size: 12px; }
    .language-choice-default { margin-left: auto; color: #6ed9ee; font-size: 11px; white-space: nowrap; }
    .language-choice-hint { font-size: 12px; }
    button { min-height: 44px; padding: 10px 16px; border: 1px solid #6ed9ee; border-radius: 8px; color: #10202b; background: #6ed9ee; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
    button:hover { background: #98e6f4; }
    input:focus-visible, button:focus-visible { outline: 2px solid #f2f4fa; outline-offset: 3px; }
    @media (max-width: 380px) {
        .language-choice { padding: 20px; }
        label { gap: 8px; padding: 10px; }
    }
</style>

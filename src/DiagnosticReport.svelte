<script lang="ts">
    import { onDestroy } from 'svelte';
    import { translations, type UiLanguage } from './pluginTranslations';

    export let report: () => string;
    export let uiLanguage: UiLanguage = 'zh';
    let content = '';
    let expanded = false;
    let copyState: 'idle' | 'copied' | 'error' = 'idle';
    let active = true;
    $: text = translations[uiLanguage];

    const toggle = () => {
        expanded = !expanded;
        if (expanded) {
            content = report();
            copyState = 'idle';
        }
    };
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(content);
            if (active) { copyState = 'copied'; }
        } catch {
            if (active) { copyState = 'error'; }
        }
    };
    onDestroy(() => { active = false; });
</script>

<section class="diagnostic-report" aria-label={text.diagnosticTitle}>
    <button type="button" aria-expanded={expanded} on:click={toggle}>{text.diagnosticTitle}</button>
    {#if expanded}
        <div class="diagnostic-content">
            <p>{text.diagnosticHint}</p>
            <textarea readonly aria-label={text.diagnosticTitle} value={content} rows="6"></textarea>
            <div class="diagnostic-actions">
                <button type="button" on:click={copy}>{text.diagnosticCopy}</button>
                <span role="status" class:error={copyState === 'error'}>{copyState === 'copied' ? text.diagnosticCopied : copyState === 'error' ? text.diagnosticCopyError : ''}</span>
            </div>
        </div>
    {/if}
</section>

<style>
    .diagnostic-report {
        min-width: 0;
        margin: 0;
        padding-top: 8px;
        border-top: 1px solid rgba(153, 181, 235, 0.2);
        color: var(--panel-text, #edf3ff);
        font-size: 11px;
        line-height: 1.4;
    }

    .diagnostic-content { display: grid; gap: 6px; padding: 6px 0; }

    p { margin: 0; color: var(--panel-muted, #bac6d8); }

    textarea {
        display: block;
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        padding: 6px 8px;
        border: 1px solid rgba(153, 181, 235, 0.2);
        border-radius: 5px;
        background: rgba(0, 0, 0, 0.14);
        color: var(--panel-text, #edf3ff);
        font: 11px/1.4 monospace;
        resize: vertical;
    }

    .diagnostic-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }

    button {
        min-height: 28px;
        padding: 0 8px;
        border: 1px solid rgba(99, 185, 238, 0.42);
        border-radius: 5px;
        color: var(--panel-text, #edf3ff);
        background: rgba(99, 185, 238, 0.1);
        font: inherit;
        font-weight: 700;
        cursor: pointer;
        touch-action: manipulation;
    }

    button:hover { border-color: rgba(99, 185, 238, 0.72); background: rgba(99, 185, 238, 0.18); }
    button:focus-visible, textarea:focus-visible {
        outline: 2px solid var(--panel-accent, #8dd2ff);
        outline-offset: 2px;
    }

    span { color: #91dfaa; font-size: 10px; }
    span.error { color: #f8aa68; }

    @media (pointer: coarse) {
        button { min-height: 32px; }
    }
</style>

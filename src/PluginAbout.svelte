<script lang="ts">
    import config, { currentVersionReleasedAt } from './pluginConfig';
    import { translations } from './pluginTranslations';
    import { UI_LANGUAGES, type UiLanguage } from './uiLanguage';
    import DiagnosticReport from './DiagnosticReport.svelte';
    import type { PluginUpdateResult } from './pluginUpdate';

    // Presentation only: update requests and clipboard results stay in the shell.
    export let uiLanguage: UiLanguage;
    export let pluginUpdateStatus: 'idle' | 'loading' | 'current' | 'available' | 'error';
    export let pluginUpdateResult: PluginUpdateResult | null;
    export let latestPluginVersion: string;
    export let pluginLinkCopyStatus: 'idle' | 'copied' | 'error';
    export let pluginUpdateNotesRetrying: boolean;
    export let copyLatestPluginLink: () => void;
    export let retryPluginUpdate: () => void;
    export let retryPluginUpdateNotes: () => void;
    export let diagnosticReport: (() => string) | null = null;

    const { author: pluginAuthor, repository: repositoryUrl, title, version: pluginVersion } = config;
    const issuesUrl = `${repositoryUrl}/issues`;
    $: text = translations[uiLanguage];
    $: localizedUpdateNotes = pluginUpdateResult?.seriesNotes.map(notes => ({
        version: notes.version,
        releasedAt: notes.releasedAt,
        notes: notes[UI_LANGUAGES[uiLanguage].releaseNotesLanguage],
    })) ?? [];
</script>

<section class="module-about" aria-label={text.aboutHeading}>
    <div class="about-hero">
        <div class="about-hero__header">
            <div class="about-hero__copy">
                <span>{text.aboutHeading}</span>
                <strong>{title}</strong>
            </div>
            <dl class="about-meta">
                <div>
                    <dt>{text.aboutAuthorLabel}</dt>
                    <dd>{pluginAuthor}</dd>
                </div>
                <div>
                    <dt>{text.aboutVersionLabel}</dt>
                    <dd>{pluginVersion}</dd>
                </div>
                <div class="about-meta__date">
                    <dt>{text.aboutCurrentVersionDateLabel}</dt>
                    <dd>
                        <time datetime={currentVersionReleasedAt}>{currentVersionReleasedAt}</time>
                    </dd>
                </div>
            </dl>
        </div>
        <div class="about-actions" aria-label={text.aboutLinksLabel}>
            <a class="about-actions__github" href={repositoryUrl} target="_blank" rel="noreferrer">{text.aboutGithubLabel}</a>
            <a class="about-actions__issues" href={issuesUrl} target="_blank" rel="noreferrer">{text.aboutIssuesLabel}</a>
            <a class="about-actions__star" href={repositoryUrl} target="_blank" rel="noreferrer">{text.aboutStarLabel}</a>
            <a class="about-actions__xiaohongshu" href="https://xhslink.cn/o/rXpBcBK0Qy" target="_blank" rel="noopener noreferrer" aria-label={text.aboutXiaohongshuHint} title={text.aboutXiaohongshuHint}>{text.aboutXiaohongshuLabel}</a>
            <a class="about-actions__feedback" href="https://tally.so/r/jeoe2Q" target="_blank" rel="noopener noreferrer" title={text.aboutFeedbackHint}>
                <span>{text.aboutFeedbackLabel}</span>
                <svg class="about-feedback-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                    <path d="M6 3H3v10h10v-3M9 3h4v4M7 9l6-6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
                </svg>
            </a>
        </div>
        <p>{text.aboutStarHint}</p>
        <div
            class="about-update"
            class:about-update--compact={pluginUpdateStatus !== 'available' && pluginUpdateStatus !== 'current'}
            class:about-update--available={pluginUpdateStatus === 'available' || pluginUpdateStatus === 'current'}
            class:about-update--error={pluginUpdateStatus === 'error'}
            aria-busy={pluginUpdateStatus === 'idle' || pluginUpdateStatus === 'loading'}
        >
            {#if pluginUpdateStatus === 'idle' || pluginUpdateStatus === 'loading'}
                <span class="about-update__status" role="status" aria-live="polite">
                    {text.aboutUpdateChecking}
                </span>
            {:else if (pluginUpdateStatus === 'current' || pluginUpdateStatus === 'available') && pluginUpdateResult}
                <div class="about-update__header" role="status" aria-live="polite">
                    <strong>
                        {pluginUpdateStatus === 'current'
                            ? text.aboutUpdateCurrent
                            : pluginUpdateResult.channel === 'beta'
                            ? text.aboutBetaAvailable
                            : text.aboutUpdateAvailable}
                    </strong>
                </div>
                {#if latestPluginVersion}
                    <div class="about-update__actions">
                        <button type="button" on:click={copyLatestPluginLink}>
                            {text.aboutCopyLatestPluginLink(latestPluginVersion)}
                        </button>
                        {#if pluginLinkCopyStatus !== 'idle'}
                            <span
                                class:about-update__copy-feedback--error={pluginLinkCopyStatus === 'error'}
                                class="about-update__copy-feedback"
                                role="status"
                                aria-live="polite"
                                aria-atomic="true"
                            >
                                {pluginLinkCopyStatus === 'copied'
                                    ? text.aboutPluginLinkCopied(latestPluginVersion)
                                    : text.aboutPluginLinkCopyError}
                            </span>
                        {/if}
                    </div>
                {/if}
                {#if localizedUpdateNotes.length > 0}
                    <div class="about-update__notes">
                        {#each localizedUpdateNotes as releaseNote}
                            <section class="about-update__release-note" lang={UI_LANGUAGES[uiLanguage].releaseNotesLanguage} dir="ltr">
                                <div class="about-update__release-note-header">
                                    <strong>{releaseNote.version}</strong>
                                    <time datetime={releaseNote.releasedAt}>{releaseNote.releasedAt}</time>
                                </div>
                                <strong class="about-update__title">{releaseNote.notes.title}</strong>
                                <p>{releaseNote.notes.summary}</p>
                                <ul>
                                    {#each releaseNote.notes.items as item}
                                        <li>
                                            <span class={`about-update__type about-update__type--${item.type}`} lang={UI_LANGUAGES[uiLanguage].locale}>
                                                {text.aboutUpdateTypeLabels[item.type]}
                                            </span>
                                            <span>{item.text}</span>
                                        </li>
                                    {/each}
                                </ul>
                            </section>
                        {/each}
                    </div>
                    {#if pluginUpdateResult.notesStatus === 'error'}
                        <button
                            type="button"
                            disabled={pluginUpdateNotesRetrying}
                            on:click={retryPluginUpdateNotes}
                        >
                            {pluginUpdateNotesRetrying
                                ? text.aboutUpdateNotesRetrying
                                : text.aboutUpdateNotesRetry}
                        </button>
                    {/if}
                {:else}
                    <p>{text.aboutUpdateNotesUnavailable}</p>
                    {#if pluginUpdateResult.notesStatus === 'error'}
                        <button
                            type="button"
                            disabled={pluginUpdateNotesRetrying}
                            on:click={retryPluginUpdateNotes}
                        >
                            {pluginUpdateNotesRetrying
                                ? text.aboutUpdateNotesRetrying
                                : text.aboutUpdateNotesRetry}
                        </button>
                    {/if}
                {/if}
            {:else}
                <span class="about-update__status" role="status" aria-live="polite">
                    {text.aboutUpdateError}
                </span>
                <button type="button" on:click={retryPluginUpdate}>{text.aboutUpdateRetry}</button>
            {/if}
        </div>

    </div>
    {#if diagnosticReport}
        <DiagnosticReport report={diagnosticReport} {uiLanguage} />
    {/if}
</section>

<style>

    :global(.sun-path-panel.mobile_ui) .module-about:not(.module-settings) {
        padding: 6px 10px 10px;
    }

    :global(.sun-path-panel:not(.mobile_ui)) .module-about {
        overscroll-behavior-y: auto;
    }

    .module-about {
        box-sizing: border-box;
        height: 100%;
        overflow-y: auto;
        display: grid;
        align-content: start;
        gap: 10px;
        padding: 12px;
        color: var(--panel-muted);
        background: rgba(0, 0, 0, 0.14);
        font-size: 12px;
    }

    .module-about__title {
        margin-bottom: 6px;
        color: var(--panel-text);
        font-weight: 600;
    }

    .module-about p {
        margin: 6px 0 0;
    }

    .module-about p:first-child {
        margin-top: 0;
    }

    .about-hero {
        display: grid;
        gap: 8px;
        padding: 10px 12px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 8px;
        background: linear-gradient(135deg, rgba(42, 55, 86, 0.92), rgba(18, 28, 48, 0.94));
        color: var(--panel-text);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
    }

    .about-hero p {
        margin: 0;
        color: var(--panel-muted);
        font-size: 11px;
        line-height: 1.35;
    }

    .about-hero__header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        align-items: end;
    }

    .about-hero__copy {
        display: grid;
        gap: 2px;
        min-width: 0;
    }

    .about-hero__copy span {
        color: var(--panel-muted);
        font-size: 11px;
        line-height: 1.2;
    }

    .about-hero__copy strong {
        color: var(--panel-text);
        font-size: 12px;
        line-height: 1.2;
    }

    .about-meta {
        display: grid;
        grid-template-columns: repeat(3, auto);
        grid-template-rows: auto auto;
        grid-auto-flow: column;
        column-gap: 8px;
        row-gap: 1px;
        align-items: baseline;
        margin: 0;
    }

    .about-meta div {
        display: contents;
    }

    .about-meta dt,
    .about-meta dd {
        margin: 0;
        text-align: right;
    }

    .about-meta dt {
        color: var(--panel-muted);
        font-size: 10px;
        line-height: 1.2;
    }

    .about-meta dd {
        color: var(--panel-text);
        font-size: 12px;
        font-weight: 700;
        line-height: 1.2;
        white-space: nowrap;
    }

    .about-update {
        box-sizing: border-box;
        display: grid;
        gap: 6px;
        min-height: 32px;
        padding: 0;
        border-top: 1px solid rgba(153, 181, 235, 0.2);
        border-bottom: 1px solid rgba(153, 181, 235, 0.2);
    }

    .about-update--compact {
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        padding: 0;
    }

    .about-update--available {
        padding: 7px 0;
        border-color: rgba(99, 185, 238, 0.5);
    }

    .about-update--error {
        border-color: rgba(248, 170, 104, 0.28);
    }

    .about-update__status,
    .about-update__header strong,
    .about-update__title {
        color: var(--panel-text);
        line-height: 1.35;
    }

    .about-update__header {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 5px;
    }

    .about-update__status {
        align-self: center;
        font-size: 11px;
    }

    .about-update--compact .about-update__status {
        padding: 7px 0;
    }

    .about-update__header strong {
        font-size: 12px;
    }

    .about-update__notes {
        display: grid;
        gap: 8px;
    }

    .about-update__release-note {
        display: grid;
        gap: 5px;
        margin: 0;
        padding: 0;
    }

    .about-update__release-note + .about-update__release-note {
        padding-top: 8px;
        border-top: 1px solid rgba(153, 181, 235, 0.2);
    }

    .about-update__release-note-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        color: var(--panel-muted);
        font-size: 10px;
        line-height: 1.35;
    }

    .about-update__release-note-header strong {
        color: var(--panel-text);
        font-size: 11px;
    }

    .about-update__title {
        font-size: 12px;
    }

    .about-update__notes p,
    .about-update > p {
        margin: 0;
        color: var(--panel-muted);
        font-size: 11px;
        line-height: 1.45;
    }

    .about-update__notes ul {
        display: grid;
        gap: 6px;
        margin: 2px 0 0;
        padding: 0;
        list-style: none;
    }

    .about-update__notes li {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 6px;
        align-items: start;
        color: var(--panel-text);
        font-size: 11px;
        line-height: 1.4;
    }

    .about-update__type {
        min-width: 30px;
        padding: 1px 4px;
        border: 1px solid currentColor;
        border-radius: 4px;
        font-size: 9px;
        font-weight: 700;
        line-height: 1.35;
        text-align: center;
        white-space: nowrap;
    }

    .about-update__type--new {
        color: #8dd2ff;
    }

    .about-update__type--improved {
        color: #f7cf79;
    }

    .about-update__type--fixed {
        color: #91dfaa;
    }

    .about-update button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        justify-self: start;
        min-height: 28px;
        padding: 0 8px;
        border: 1px solid rgba(99, 185, 238, 0.42);
        border-radius: 5px;
        color: var(--panel-text) !important;
        background: rgba(99, 185, 238, 0.1);
        font: inherit;
        font-size: 11px;
        font-weight: 700;
        line-height: 1.2;
        text-decoration: none;
        cursor: pointer;
        touch-action: manipulation;
    }

    .about-update button:hover {
        border-color: rgba(99, 185, 238, 0.72);
        background: rgba(99, 185, 238, 0.18);
    }

    .about-update button:disabled {
        cursor: default;
        opacity: 0.55;
    }

    .about-update button:focus-visible {
        outline: 2px solid var(--panel-accent);
        outline-offset: 2px;
    }

    :global(.sun-path-panel.mobile_ui) .about-update button {
        min-height: 32px;
    }

    .about-update__actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
    }

    .about-update__copy-feedback {
        color: #91dfaa;
        font-size: 10px;
        line-height: 1.35;
    }

    .about-update__copy-feedback--error {
        color: #f8aa68;
    }

    .about-actions {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
    }

    .about-actions a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 0;
        height: 36px;
        box-sizing: border-box;
        padding: 0 6px;
        border: 1px solid var(--about-action-border, #bac6d8);
        border-radius: 8px;
        color: var(--about-action-text, #27354b) !important;
        background: var(--about-action-bg, #e2e8f0) !important;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
        font-size: 12px;
        font-weight: 700;
        line-height: 1.15;
        text-align: center;
        text-decoration: none;
        cursor: pointer;
        transition: background-color 180ms ease, border-color 180ms ease, color 180ms ease;
    }

    .about-actions a:hover {
        filter: brightness(1.08);
    }

    .about-actions a:active {
        filter: brightness(0.94);
    }

    .about-actions a:focus-visible {
        outline: 2px solid var(--panel-accent);
        outline-offset: 2px;
    }

    .about-actions a.about-actions__feedback {
        grid-column: 1 / -1;
        gap: 6px;
    }

    .about-feedback-icon {
        width: 14px;
        height: 14px;
        flex-shrink: 0;
    }

    .about-actions__issues,
    .about-actions__feedback {
        --about-action-border: #90c4e8;
        --about-action-text: #164c70;
        --about-action-bg: #cce8fa;
    }

    .about-actions__star {
        --about-action-border: #edc568;
        --about-action-text: #694609;
        --about-action-bg: #ffe49a;
    }

    .about-actions__xiaohongshu {
        --about-action-border: #efacb8;
        --about-action-text: #992c44;
        --about-action-bg: #ffdae2;
    }
</style>

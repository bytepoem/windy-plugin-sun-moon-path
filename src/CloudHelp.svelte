<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { messages } from './locales/CloudHelp';
    import { UI_LANGUAGES, type UiLanguage } from './uiLanguage';
    import { onPluginMount as onMount } from './pluginLifecycle';

    export let language: UiLanguage;

    $: imageUrl = UI_LANGUAGES[language].cloudHelpImage;
    const dispatch = createEventDispatcher<{ close: void }>();
    let dialog: HTMLDialogElement;
    let image: HTMLImageElement | undefined;
    let imageState: 'loading' | 'ready' | 'error' = 'loading';
    let attempt = 0;
    let zoomed = false;

    // A changed language creates a new image node and resets its loading state.
    $: if (imageUrl) {
        imageState = 'loading';
        zoomed = false;
    }

    /** This component only exists while open. Native modality owns focus and background isolation. */
    onMount(() => {
        dialog.showModal();
        return () => {
            image?.removeAttribute('src');
            dialog.close();
        };
    });

    const close = () => dispatch('close');
    const retry = () => {
        imageState = 'loading';
        attempt += 1;
    };

</script>

<!-- Native dialog is interactive; this Svelte compiler predates its accessibility mapping. -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<dialog bind:this={dialog} class="cloud-help" tabindex="-1" aria-labelledby="cloud-help-title"
    on:cancel|preventDefault={close} on:keydown|stopPropagation
    on:wheel|stopPropagation on:touchmove|stopPropagation
    on:click={event => { if (event.target === dialog) {close();} }}>
    <div class="help-shell">
        <header>
            <h2 id="cloud-help-title">{messages[language].cloudPlanningGuide}</h2>
            <button class="close" type="button" aria-label={messages[language].closeGuide} on:click={close}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
        </header>
        <div class="diagram">
            <div class="image-toolbar">
                <span>{messages[language].sunsetExampleMClouds}</span>
                <div class="image-actions">
                    <button type="button" disabled={imageState !== 'ready'} aria-pressed={zoomed}
                        on:click={() => { zoomed = !zoomed; }}>
                        {zoomed ? (messages[language].fitWidth) : (messages[language].zoomIn)}
                    </button>
                    <a href={imageUrl} target="_blank" rel="noopener noreferrer">{messages[language].openImage}</a>
                </div>
            </div>
            <!-- Keyboard users need a focusable scroll region for the enlarged image. -->
            <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
            <div class="image-scroll" class:image-pending={imageState !== 'ready'} tabindex="0" role="region"
                aria-busy={imageState === 'loading'} aria-label={messages[language].scrollableDiagram}>
                {#if imageState === 'loading'}
                    <div class="image-loading" role="status">
                        <span class="loading-spinner" aria-hidden="true"></span>
                        <p class="loading-title">{messages[language].loadingDiagram}</p>
                        <p class="loading-hint">{messages[language].zoomInToExploreOnceTheImage}</p>
                    </div>
                {/if}
                {#if imageState === 'error'}
                    <div class="image-error" role="status">
                        <p>{messages[language].couldNotLoadTheDiagramRetryOr}</p>
                        <button type="button" on:click={retry}>{messages[language].retry}</button>
                    </div>
                {/if}
                {#key `${imageUrl}:${attempt}`}
                    <img bind:this={image} src={imageUrl} class:zoomed hidden={imageState !== 'ready'}
                        alt={messages[language].sideAndMapViewsMCloudsHorizon}
                        on:load={() => { imageState = 'ready'; }} on:error={() => { imageState = 'error'; }} />
                {/key}
            </div>
        </div>
    </div>
</dialog>

<style>
    .cloud-help { position: fixed; inset: 0; width: min(1080px, calc(100vw - 40px)); height: min(900px, calc(100dvh - 48px)); max-width: none; max-height: none; margin: auto; padding: 0; border: 1px solid #485364; border-radius: 12px; background: #172231; color: #edf2f7; font: 14px/1.6 sans-serif; overflow: hidden; color-scheme: dark; }
    .cloud-help::backdrop { background: rgba(0, 0, 0, .62); }
    .help-shell { height: 100%; display: flex; flex-direction: column; min-height: 0; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 20px; }
    h2 { font-size: 18px; margin: 0; color: inherit; }
    button, a { font: inherit; }
    button { cursor: pointer; color: inherit; background: #223448; border: 1px solid #485364; border-radius: 6px; padding: 6px 12px; min-height: 36px; }
    button:hover { border-color: #6ed9ee; }
    button:disabled { opacity: .45; cursor: default; }
    .close { display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-sizing: border-box; width: 40px; height: 40px; padding: 0; background: transparent; }
    .close svg { display: block; width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; }
    a { color: #6ed9ee; text-underline-offset: 3px; }
    :is(button, a, [tabindex]):focus-visible { outline: 2px solid #6ed9ee; outline-offset: -2px; }
    .diagram { flex: 1; min-height: 0; display: flex; flex-direction: column; }
    [hidden] { display: none !important; }
    .image-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding: 10px 20px; font-size: 12px; color: #b9c2ce; }
    .image-actions { display: flex; align-items: center; gap: 14px; }
    .image-scroll { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; touch-action: pan-x pan-y pinch-zoom; padding: 12px; }
    /* Reserve the same viewing area during loading and failure; the toolbar never moves. */
    .image-pending { display: grid; place-items: center; background: radial-gradient(ellipse at center, rgba(110, 217, 238, .045), transparent 65%); }
    .image-loading { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 28px 20px; text-align: center; }
    .image-loading p { margin: 0; }
    .loading-spinner { display: block; box-sizing: border-box; width: 36px; height: 36px; margin-bottom: 6px; border: 3px solid rgba(110, 217, 238, .15); border-top-color: #6ed9ee; border-radius: 50%; animation: loading-spin 1s linear infinite; }
    .loading-title { color: #edf2f7; font-size: 14px; font-weight: 600; }
    .loading-hint { color: #aab8c9; font-size: 12px; }
    @keyframes loading-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .loading-spinner { animation: none; } }
    img { display: block; width: 100%; max-width: none; height: auto; }
    img.zoomed { width: 1800px; }
    .image-error { padding: 24px; text-align: center; }
    @media (max-width: 640px) {
        .cloud-help { width: 100%; height: 100dvh; border: 0; border-radius: 0; }
        header { padding: max(10px, env(safe-area-inset-top)) 12px 8px; }
        .image-toolbar { padding-left: 12px; padding-right: 12px; }
        button { min-height: 44px; }
        .close { width: 44px; }
        .image-actions a { display: inline-flex; align-items: center; min-height: 44px; }
        .image-scroll { padding: 0 0 env(safe-area-inset-bottom); }
    }
</style>

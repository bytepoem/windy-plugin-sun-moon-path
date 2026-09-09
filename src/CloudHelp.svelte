<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';

    export let zh: boolean;

    $: imageUrl = zh
        ? 'https://community.windy.com/assets/uploads/files/1788950340643-74dd941b-faef-4f81-b2a6-7471c71b5d2e-download.png'
        : 'https://community.windy.com/assets/uploads/files/1788952298003-bccb52a8-6794-482b-888f-2274e302e450-download-1.png';
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
            <h2 id="cloud-help-title">{zh ? '云层遮挡说明' : 'Cloud planning guide'}</h2>
            <button class="close" type="button" aria-label={zh ? '关闭说明' : 'Close guide'} on:click={close}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
        </header>
        <div class="diagram">
            <div class="image-toolbar">
                <span>{zh ? '示例：太阳日落 · 云高 2000 m' : 'Sunset example · 2,000 m clouds'}</span>
                <div class="image-actions">
                    <button type="button" disabled={imageState !== 'ready'} aria-pressed={zoomed}
                        on:click={() => { zoomed = !zoomed; }}>
                        {zoomed ? (zh ? '适应宽度' : 'Fit width') : (zh ? '放大查看' : 'Zoom in')}
                    </button>
                    <a href={imageUrl} target="_blank" rel="noopener noreferrer">{zh ? '打开原图' : 'Open image'}</a>
                </div>
            </div>
            <!-- Keyboard users need a focusable scroll region for the enlarged image. -->
            <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
            <div class="image-scroll" tabindex="0" role="region" aria-label={zh ? '可滚动图解' : 'Scrollable diagram'}>
                {#if imageState === 'loading'}<p role="status">{zh ? '正在加载图解…' : 'Loading diagram…'}</p>{/if}
                {#if imageState === 'error'}
                    <div class="image-error" role="status">
                        <p>{zh ? '图解加载失败，请重试或打开原图。' : 'Could not load the diagram. Retry or open the image directly.'}</p>
                        <button type="button" on:click={retry}>{zh ? '重试' : 'Retry'}</button>
                    </div>
                {/if}
                {#key `${imageUrl}:${attempt}`}
                    <img bind:this={image} src={imageUrl} class:zoomed hidden={imageState !== 'ready'}
                        alt={zh ? '云层遮挡侧视与地图图解：云高 2000 米，地平线云距 160 公里，遮蔽太阳云距 185.80 公里，擦地云距 319 公里，最远无云距 479 公里。'
                            : 'Side and map views: 2,000 m clouds; horizon 160 km, sightline intersection 185.80 km, tangent 319 km, farthest clear reference 479 km.'}
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

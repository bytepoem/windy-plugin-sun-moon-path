<script lang="ts">
    import { createEventDispatcher, tick } from 'svelte';
    import { translations } from './pluginTranslations';
    import { messages } from './locales/MultiDayOverview';
    import type { UiLanguage } from './uiLanguage';

    export let active: boolean;
    export let view: 'single' | 'overview' = 'single';
    export let language: UiLanguage;
    const dispatch = createEventDispatcher<{ activate: void; tabkeydown: KeyboardEvent }>();
    let open = false;
    let root: HTMLDivElement;
    let menu: HTMLDivElement;
    let trigger: HTMLButtonElement;
    $: text = messages[language];
    $: if (!active) { open = false; }

    /** Opening the menu never activates a view or changes the shared clock. */
    const toggle = async () => {
        open = !open;
        if (open) {
            await tick();
            menu?.querySelector<HTMLButtonElement>(`[data-view="${view}"]`)?.focus();
        }
    };
    const select = (next: typeof view) => {
        view = next;
        open = false;
        dispatch('activate');
        trigger?.focus();
    };
    const dismiss = (event: Event) => {
        if (open && event.target instanceof Node && !root?.contains(event.target)) { open = false; }
    };
    const keydown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            open = false;
            trigger?.focus();
        } else if (open && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const buttons = [...menu.querySelectorAll<HTMLButtonElement>('button')];
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
                : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
        }
    };
</script>

<!-- Svelte owns these listeners and releases them at component destruction. -->
<svelte:window on:pointerdown={dismiss} on:focusin={dismiss} on:keydown={event => {
    if (event.key === 'Escape') { keydown(event); }
}} />
<div class="event-navigation" class:active bind:this={root} role="presentation">
    <button id="summary-tab-events" type="button" role="tab" aria-controls="summary-panel"
        aria-selected={active} tabindex={active ? 0 : -1} on:click={() => dispatch('activate')}
        on:keydown={event => dispatch('tabkeydown', event)}><span class="tab-label" title={translations[language].eventTab}>{translations[language].eventTab}</span></button>
    <button class="arrow" bind:this={trigger} type="button" aria-label={text.overview}
        aria-haspopup="menu" aria-expanded={open} aria-controls="event-view-menu" on:click={toggle}
        on:keydown={event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                if (!open) { void toggle(); }
            }
        }}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"></path></svg>
    </button>
    {#if open}
        <div id="event-view-menu" class="menu" role="menu" aria-label={text.overview} tabindex="-1"
            bind:this={menu} on:keydown={keydown}>
            {#each ['single', 'overview'] as value}
                <button type="button" role="menuitemradio" aria-checked={view === value} tabindex="-1"
                    data-view={value} on:click={() => select(value === 'single' ? 'single' : 'overview')}>
                    <span aria-hidden="true">{view === value ? '✓' : ''}</span>{value === 'single' ? text.single : text.overview}
                </button>
            {/each}
        </div>
    {/if}
</div>

<style>
    .event-navigation { position:relative; display:flex; min-width:0; border-left:1px solid rgba(255,255,255,.08); border-right:1px solid rgba(255,255,255,.08); border-bottom:2px solid transparent; }
    .active { background:rgba(99,185,238,.14); border-bottom-color:var(--panel-accent); }
    button { border:0; background:transparent; color:var(--panel-muted); font:inherit; font-size:15px; cursor:pointer; min-height:36px; }
    button:focus-visible { outline:2px solid var(--panel-accent); outline-offset:-2px; }
    button:hover, .active > button { color:var(--panel-text); }
    button[role=tab] { flex:1; min-width:0; padding:0 2px; }
    .tab-label { display:block; width:100%; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .arrow { flex:0 0 24px; align-self:center; display:flex; align-items:center; justify-content:center; width:24px; min-height:28px; margin:4px 2px; padding:0; border-radius:4px; color:var(--panel-text); background:rgba(255,255,255,.06); }
    .arrow:hover, .arrow[aria-expanded=true] { background:rgba(99,185,238,.2); }
    .arrow svg { width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; }
    .menu { position:absolute; top:100%; left:0; z-index:20; width:auto; max-width:min(260px,80vw); min-width:164px; padding:4px; border:1px solid var(--panel-border); border-radius:6px; background:#1d263d; box-shadow:0 4px 16px rgba(0,0,0,.3); }
    /* Keep menu rows and arrow spacing identical to CloudNavigation on touch devices too. */
    .menu button { position:relative; width:100%; min-height:30px; padding:0 24px; text-align:center; overflow-wrap:break-word; }
    .menu button span { position:absolute; left:6px; top:50%; width:16px; transform:translateY(-50%); text-align:center; }
    .menu button[aria-checked=true], .menu button:hover { color:var(--panel-text); background:rgba(99,185,238,.14); }
    :global(.mobile_ui) button { font-size:13px; }
</style>

<script lang="ts">
    import { createEventDispatcher, tick } from 'svelte';

    export let active: boolean;
    export let view: 'obstruction' | 'rainbow' = 'obstruction';
    export let language: 'zh' | 'en';

    const dispatch = createEventDispatcher<{ activate: void; tabkeydown: KeyboardEvent }>();
    const views = ['obstruction', 'rainbow'] as const;
    let open = false;
    let root: HTMLDivElement;
    let trigger: HTMLButtonElement;
    let menu: HTMLDivElement;
    $: labels = language === 'zh' ? ['云层遮挡', '彩虹'] : ['Clouds', 'Rainbow'];
    $: if (!active) { open = false; }

    // Open from either navigation state, then focus the current function.
    const toggle = async () => {
        dispatch('activate');
        open = !open;
        if (open) {
            await tick();
            menu?.querySelector<HTMLButtonElement>(`[data-view="${view}"]`)?.focus();
        }
    };

    const select = (value: typeof view) => {
        view = value;
        open = false;
        dispatch('activate');
        trigger?.focus();
    };

    const menuKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            open = false;
            trigger?.focus();
        } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const items = [...menu.querySelectorAll<HTMLButtonElement>('button')];
            const index = items.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
                : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
            items[next]?.focus();
        }
    };

    const dismissEscape = (event: KeyboardEvent) => {
        if (open && event.key === 'Escape') {
            event.preventDefault();
            open = false;
            trigger?.focus();
        }
    };

    // Svelte releases window listeners when this navigation component is destroyed.
    const dismissOutside = (event: Event) => {
        if (open && event.target instanceof Node && !root?.contains(event.target)) { open = false; }
    };
</script>

<svelte:window on:pointerdown={dismissOutside} on:focusin={dismissOutside} on:keydown={dismissEscape} />

<div class="cloud-navigation" class:active role="presentation" bind:this={root}>
    <button
        id="summary-tab-clouds"
        type="button"
        role="tab"
        aria-controls="summary-panel"
        aria-selected={active}
        tabindex={active ? 0 : -1}
        on:click={() => dispatch('activate')}
        on:keydown={event => dispatch('tabkeydown', event)}
    ><span class="tab-label">{labels[views.indexOf(view)]}</span></button>
    <button
        class="arrow"
        bind:this={trigger}
        type="button"
        aria-label={language === 'zh' ? '选择云层或彩虹功能' : 'Choose clouds or rainbow'}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="cloud-function-menu"
        on:click={toggle}
        on:keydown={event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                if (!open) { toggle(); }
            }
        }}
    >
        <svg class="chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="m4 6 4 4 4-4"></path>
        </svg>
    </button>
    {#if open}
        <div id="cloud-function-menu" class="menu" role="menu" aria-label={language === 'zh' ? '摄影规划功能' : 'Photography planning'} bind:this={menu} on:keydown={menuKeydown}>
            {#each views as value, index}
                <button type="button" role="menuitemradio" aria-checked={view === value} tabindex="-1" data-view={value} on:click={() => select(value)}>
                    <span class="menu-check" aria-hidden="true">{view === value ? '✓' : ''}</span><span class="menu-label">{labels[index]}</span>
                </button>
            {/each}
        </div>
    {/if}
</div>

<style>
    .cloud-navigation {
        position: relative;
        display: flex;
        min-width: 0;
        border-left: 1px solid rgba(255, 255, 255, 0.08);
        border-right: 1px solid rgba(255, 255, 255, 0.08);
        border-bottom: 2px solid transparent;
    }
    .active { background: rgba(99, 185, 238, 0.14); border-bottom-color: var(--panel-accent); }
    button {
        border: 0;
        background: transparent;
        color: var(--panel-muted);
        font: inherit;
        font-size: 15px;
        cursor: pointer;
        min-height: 36px;
    }
    button:focus-visible { outline: 2px solid var(--panel-accent); outline-offset: -2px; }
    button:hover, .active > button { color: var(--panel-text); }
    button[role='tab'] { flex: 1; min-width: 0; padding: 0; text-align: center; }
    .tab-label { display: block; width: 100%; text-align: center; }
    /* Reserve real layout space so the entire button, not just its glyph, clears the title. */
    .arrow { flex: 0 0 28px; align-self: center; display: flex; align-items: center; justify-content: center; width: 28px; min-height: 28px; margin: 4px 5px 4px 6px; padding: 0; border-radius: 4px; color: var(--panel-text); background: rgba(255, 255, 255, 0.06); }
    .arrow:hover, .arrow[aria-expanded='true'] { background: rgba(99, 185, 238, 0.2); }
    .chevron { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
    .arrow[aria-expanded='true'] .chevron { transform: rotate(180deg); }
    .menu {
        position: absolute;
        top: 100%;
        right: 0;
        z-index: 20;
        min-width: 164px;
        padding: 4px;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        background: #1d263d;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    }
    .menu button {
        position: relative;
        width: 100%;
        min-height: 30px;
        padding: 0 24px;
        text-align: center;
    }
    .menu button[aria-checked='true'], .menu button:hover { color: var(--panel-text); background: rgba(99, 185, 238, 0.14); }
    .menu-check { position: absolute; left: 6px; top: 50%; width: 16px; transform: translateY(-50%); text-align: center; }
    .menu-label { display: block; width: 100%; text-align: center; }
    :global(.mobile_ui) button { font-size: 13px; }
</style>

<script lang="ts">
    import { createEventDispatcher, tick } from 'svelte';

    export let active: boolean;
    export let view: 'obstruction' | 'sea' = 'obstruction';
    export let language: 'zh' | 'en';

    const dispatch = createEventDispatcher<{ activate: void; tabkeydown: KeyboardEvent }>();
    const views = ['obstruction', 'sea'] as const;
    let open = false;
    let root: HTMLDivElement;
    let trigger: HTMLButtonElement;
    let menu: HTMLDivElement;
    $: labels = language === 'zh' ? ['云层遮挡', '云海预报'] : ['Clouds', 'Sea of clouds'];
    $: if (!active) { open = false; }

    /** Open from either navigation state, then focus the current function. */
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

    /** Svelte releases window listeners when this navigation component is destroyed. */
    const dismissOutside = (event: Event) => {
        if (open && event.target instanceof Node && !root?.contains(event.target)) { open = false; }
    };
</script>

<svelte:window on:pointerdown={dismissOutside} on:focusin={dismissOutside} on:keydown={dismissEscape} />

<div class="cloud-navigation" class:active bind:this={root} role="presentation">
    <button
        id="summary-tab-clouds"
        bind:this={trigger}
        type="button"
        role="tab"
        aria-controls="summary-panel"
        aria-selected={active}
        aria-haspopup="menu"
        aria-expanded={open}
        tabindex={active ? 0 : -1}
        on:click={() => active ? toggle() : dispatch('activate')}
        on:keydown={event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                if (!open) { toggle(); }
            } else { dispatch('tabkeydown', event); }
        }}
    >{labels[view === 'obstruction' ? 0 : 1]}</button>
    <button
        class="arrow"
        type="button"
        aria-label={language === 'zh' ? '选择云层功能' : 'Choose cloud function'}
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
    >▾</button>
    {#if open}
        <div id="cloud-function-menu" class="menu" role="menu" aria-label={language === 'zh' ? '云层功能' : 'Cloud functions'} bind:this={menu} on:keydown={menuKeydown}>
            {#each views as value, index}
                <button type="button" role="menuitemradio" aria-checked={view === value} tabindex="-1" data-view={value} on:click={() => select(value)}>
                    <span aria-hidden="true">{view === value ? '✓' : ''}</span>{labels[index]}
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
    button[role='tab'] { flex: 1; min-width: 0; padding: 0 2px; }
    .arrow { width: 24px; flex-shrink: 0; padding: 0; }
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
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        min-height: 30px;
        padding: 0 6px;
        text-align: left;
    }
    .menu button[aria-checked='true'], .menu button:hover { color: var(--panel-text); background: rgba(99, 185, 238, 0.14); }
    .menu span { width: 16px; }
    :global(.mobile_ui) button { font-size: 13px; }
</style>

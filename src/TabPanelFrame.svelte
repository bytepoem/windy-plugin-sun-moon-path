<script lang="ts">
    /** The shell chooses the display mode; business Tabs never choose a height. */
    export let mode: 'desktop' | 'mobile' | 'collapsed' = 'desktop';
    export let id: string;
    export let labelledBy: string;
    export let collapsedLabel: string;
</script>

<div
    {id}
    class="tab-panel-frame"
    class:mobile={mode === 'mobile'}
    class:collapsed={mode === 'collapsed'}
    role={mode === 'collapsed' ? 'region' : 'tabpanel'}
    aria-label={mode === 'collapsed' ? collapsedLabel : undefined}
    aria-labelledby={mode === 'collapsed' ? undefined : labelledBy}
>
    <slot />
</div>

<style>
    /* Own the viewport and clipping only. Each business view owns its scroller. */
    .tab-panel-frame {
        --tab-content-height: 280px;

        box-sizing: border-box;
        height: var(--tab-content-height);
        min-height: 0;
        overflow: hidden;
        background: #1d263d;
    }

    .tab-panel-frame.mobile {
        --tab-content-height: 270px;
    }

    .tab-panel-frame.collapsed {
        height: auto;
    }

    @media (orientation: landscape) {
        .tab-panel-frame.mobile {
            --tab-content-height: 276px;
        }
    }
</style>

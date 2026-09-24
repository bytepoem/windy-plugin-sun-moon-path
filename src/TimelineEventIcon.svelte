<script lang="ts">
    // Match the event selector's symbols while retaining a spoken name in either language.
    export let kind: string;
    export let label: string;
    $: twilight = kind === 'dawn' || kind === 'dusk';
    $: downward = kind.endsWith('set') || kind === 'dusk';
</script>

<span class="timeline-icon" class:timeline-icon--event={kind !== 'countdown' && kind !== 'date'} role="img" aria-label={label}>
    <svg class="symbol" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {#if kind === 'countdown'}
            <circle cx="12" cy="12" r="8.5"></circle>
            <path d="M12 6.5V12l4 2.5"></path>
        {:else if kind === 'date'}
            <rect x="3.5" y="5" width="17" height="16" rx="2"></rect>
            <path d="M7.5 3v4M16.5 3v4M3.5 10h17"></path>
        {:else if twilight}
            <path d="M3 16h18M6.5 13a5.5 5.5 0 0 1 11 0M12 3v2M4 6l2 2M20 6l-2 2"></path>
        {:else if kind.startsWith('sun')}
            <circle class="filled" cx="12" cy="12" r="4.2"></circle>
            <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"></path>
        {:else if kind.startsWith('moon')}
            <path class="filled" d="M19.6 15.2A8.4 8.4 0 0 1 8.8 4.4A8.6 8.6 0 1 0 19.6 15.2Z"></path>
        {:else}
            <path d="M12 9c-5-5-10 1-6 6s14 3 13-3S9 2 5 7m7 8c5 5 10-1 6-6S4 6 5 12s10 10 14 5"></path>
            <circle cx="12" cy="12" r="1.5"></circle>
        {/if}
    </svg>
    {#if kind !== 'countdown' && kind !== 'date'}
        <svg class="arrow" class:downward viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M8 13V3M4.2 6.8 8 3l3.8 3.8"></path>
        </svg>
    {/if}
</span>

<style>
    .timeline-icon { display:flex; align-items:center; justify-content:center; height:16px; }
    svg { display:block; flex-shrink:0; fill:none; stroke:currentColor; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; }
    .symbol { width:16px; height:16px; }
    /* Offset the pair slightly so the celestial body sits nearer the time's centre. */
    .timeline-icon--event svg { position:relative; left:3px; }
    .filled { fill:currentColor; }
    .arrow { width:10px; height:10px; stroke-width:1.8; }
    .downward { transform:rotate(180deg); }
</style>

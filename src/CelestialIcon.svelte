<script lang="ts">
    export let body: 'sun' | 'moon';
    export let size = 14;
    export let label = '';
    export let x: number | undefined = undefined;
    export let y: number | undefined = undefined;
</script>

<svg
    class:celestial-icon--sun={body === 'sun'}
    class:celestial-icon--moon={body === 'moon'}
    class="celestial-icon"
    viewBox="0 0 24 24"
    role={label ? 'img' : undefined}
    aria-label={label || undefined}
    aria-hidden={label ? undefined : 'true'}
    focusable="false"
    {x}
    {y}
    width={size}
    height={size}
>
    {#if body === 'sun'}
        <circle cx="12" cy="12" r="4.2"></circle>
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"></path>
    {:else}
        <path d="M19.6 15.2A8.4 8.4 0 0 1 8.8 4.4A8.6 8.6 0 1 0 19.6 15.2Z"></path>
    {/if}
</svg>

<style>
    .celestial-icon {
        display: block;
        flex: 0 0 auto;
        stroke-width: 1.6;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .celestial-icon--sun {
        fill: #ffb347;
        stroke: #ffb347;
    }

    .celestial-icon--moon {
        fill: #f5efcf;
        stroke: #f5efcf;
    }
</style>

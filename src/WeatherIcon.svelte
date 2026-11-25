<script lang="ts">
    import type { SnowIntensity } from './weather';

    export let code: number | null = null;
    export let isDay = true;
    export let label = '';
    export let snowIntensity: SnowIntensity | null = null;

    const snowflakePositions: Record<SnowIntensity, number[]> = {
        light: [24],
        moderate: [18, 30],
        heavy: [12, 24, 36],
    };

    const hasCode = (value: number | null, values: number[]): boolean => value !== null && values.includes(value);

    $: showCelestial = hasCode(code, [1, 2, 3, 5, 6, 8, 9, 11, 12, 18, 19, 21, 22, 24]);
    $: showCloud = code === null || hasCode(code, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 23, 24]);
    $: showRain = hasCode(code, [5, 6, 7, 11, 12, 13, 14, 16, 18, 19, 20, 21]);
    $: showSnow = hasCode(code, [8, 9, 10, 11, 12, 13, 15, 16]);
    $: snowflakeColumns = snowIntensity ? snowflakePositions[snowIntensity] : [19, 32];
    $: showThunder = hasCode(code, [14, 15, 16, 21, 23, 24]);
    $: showFog = hasCode(code, [17, 22]);
</script>

<svg class="weather-icon" viewBox="0 0 48 48" role="img" aria-label={label} data-snow-intensity={snowIntensity ?? undefined}>
    {#if showCelestial}
        {#if isDay}
            <circle class="weather-icon__sun" cx="17" cy="17" r="8"></circle>
            <path class="weather-icon__sun-ray" d="M17 4v5M17 25v5M4 17h5M25 17h5M8 8l3.5 3.5M22.5 22.5 26 26M26 8l-3.5 3.5M11.5 22.5 8 26"></path>
        {:else}
            <path class="weather-icon__moon" d="M24 6a13 13 0 1 0 11 20A14 14 0 0 1 24 6Z"></path>
        {/if}
    {/if}

    {#if showCloud}
        <path class="weather-icon__cloud" d="M13 33h24a7 7 0 0 0 .6-14A11 11 0 0 0 17 20a7 7 0 0 0-4 13Z"></path>
    {/if}

    {#if showRain}
        <path class="weather-icon__rain" d="m18 36-2 6M27 36l-2 6M36 36l-2 6"></path>
    {/if}

    {#if showSnow}
        {#each snowflakeColumns as column (column)}
            <path class="weather-icon__snow" d="M0 37v7M-3 39l6 3M3 39l-6 3" transform={`translate(${column} 0)`}></path>
        {/each}
    {/if}

    {#if showThunder}
        <path class="weather-icon__thunder" d="M29 33h-7l3 5h-4l7 8-1-6h5Z"></path>
    {/if}

    {#if showFog}
        <path class="weather-icon__fog" d="M8 36h31M12 41h25"></path>
    {/if}
</svg>

<style>
    .weather-icon {
        display: block;
        width: 21px;
        height: 21px;
        overflow: visible;
    }

    .weather-icon__sun {
        fill: #ffd45c;
        stroke: #ffb62e;
        stroke-width: 1.5;
    }

    .weather-icon__sun-ray,
    .weather-icon__rain,
    .weather-icon__snow,
    .weather-icon__fog {
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 2.2;
    }

    .weather-icon__sun-ray {
        stroke: #ffd45c;
    }

    .weather-icon__moon {
        fill: #d7dcec;
    }

    .weather-icon__cloud {
        fill: #bac2ce;
        stroke: #e5e9ef;
        stroke-width: 1.3;
    }

    .weather-icon__rain {
        stroke: #55b8ff;
    }

    .weather-icon__snow {
        stroke: #e9f6ff;
    }

    .weather-icon__thunder {
        fill: #ffd54a;
        stroke: #f3b51d;
        stroke-linejoin: round;
        stroke-width: 1;
    }

    .weather-icon__fog {
        stroke: #d8dde6;
    }
</style>

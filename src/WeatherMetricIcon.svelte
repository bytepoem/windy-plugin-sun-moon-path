<script lang="ts">
    import type { WeatherMetric } from './weather';

    /**
     * Shared outline icon vocabulary for weather row labels and compact
     * observation evidence. Visible text owns the accessible name, so the SVG
     * remains decorative wherever it is used.
     */
    export let metric: WeatherMetric;
    export let size = 12;

    $: isCloudMetric = metric.endsWith('CloudPercent');
</script>

<svg
    class="weather-metric-icon"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    aria-hidden="true"
    focusable="false"
>
    {#if isCloudMetric}
        <path d="M6.5 18h11a4 4 0 0 0 .4-8 6 6 0 0 0-11.4 1.4A3.4 3.4 0 0 0 6.5 18Z"></path>
    {:else if metric === 'temperatureC'}
        <path d="M10 14.2V5a2 2 0 0 1 4 0v9.2a4 4 0 1 1-4 0Z"></path>
        <path d="M12 10v7"></path>
    {:else if metric === 'dewPointC'}
        <path d="M12 3.5S7.5 9 7.5 13a4.5 4.5 0 0 0 9 0c0-4-4.5-9.5-4.5-9.5Z"></path>
        <path d="M10 15.5c.7.7 1.4 1 2.4 1"></path>
    {:else if metric === 'humidityPercent'}
        <path d="M9 4S5.5 8.4 5.5 11.4a3.5 3.5 0 0 0 7 0C12.5 8.4 9 4 9 4Z"></path>
        <path d="M16.5 10.5S14 13.7 14 16a2.5 2.5 0 0 0 5 0c0-2.3-2.5-5.5-2.5-5.5Z"></path>
    {:else if metric === 'precipMm'}
        <path d="M6 13.5h11a3.5 3.5 0 0 0 .3-7 5.3 5.3 0 0 0-10 1.3A3 3 0 0 0 6 13.5Z"></path>
        <path d="m8 16-1 3M13 16l-1 3M18 16l-1 3"></path>
    {:else if metric === 'windMs'}
        <path d="M4 8h10.5a2.5 2.5 0 1 0-2.2-3.7"></path>
        <path d="M4 12h14a2 2 0 1 1-1.8 2.9"></path>
        <path d="M4 16h7"></path>
    {:else if metric === 'windDirectionDeg'}
        <circle cx="12" cy="12" r="8.5"></circle>
        <path d="m15.8 8.2-2.2 5.4-5.4 2.2 2.2-5.4 5.4-2.2Z"></path>
    {:else if metric === 'visibilityKm'}
        <path d="M3.5 12s3.2-5 8.5-5 8.5 5 8.5 5-3.2 5-8.5 5-8.5-5-8.5-5Z"></path>
        <circle cx="12" cy="12" r="2.5"></circle>
    {:else if metric === 'aod550'}
        <circle cx="8" cy="8" r="3"></circle>
        <path d="M3.5 14h17M5.5 18h13M14 6h6"></path>
    {/if}
</svg>

<style>
    .weather-metric-icon {
        display: block;
        flex: 0 0 auto;
        overflow: visible;
        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 1.65;
    }
</style>

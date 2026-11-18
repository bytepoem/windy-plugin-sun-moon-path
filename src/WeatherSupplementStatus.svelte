<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { translations } from './locales/WeatherTable';
    import type { AtmosphereMetric } from './openMeteo';
    import type { UiLanguage } from './uiLanguage';
    import type { WeatherLoadStatus } from './weather';

    export let language: UiLanguage;
    export let aod: WeatherLoadStatus;
    export let visibility: WeatherLoadStatus = 'idle';
    export let snow: WeatherLoadStatus = 'idle';

    const dispatch = createEventDispatcher<{ retry: AtmosphereMetric }>();

    $: text = translations[language];
    $: metrics = ([
        { key: 'aod', label: text.metrics.aod550[0], status: aod },
        { key: 'visibility', label: text.metrics.visibilityKm[0], status: visibility },
        { key: 'snow', label: text.metrics.snowDepthCm[0], status: snow },
    ] as const).filter(({ status }) => status === 'error' || status === 'empty' || status === 'loading');
</script>

{#if metrics.length}
    <div class="supplement-status" role="group" aria-label="Open-Meteo">
        <span class="provider">Open-Meteo</span>
        {#each metrics as { key, label, status } (key)}
            <div class="metric-status" class:failed={status === 'error'}>
                <span role="status">
                    {label} · {status === 'error' ? text.metricLoadFailed
                        : status === 'empty' ? text.metricMissingData : text.metricLoading}
                </span>
                {#if status === 'error'}
                    <button type="button" aria-label={`${text.retry} · ${label}`} on:click={() => dispatch('retry', key)}>
                        {text.retry}
                    </button>
                {/if}
            </div>
        {/each}
    </div>
{/if}

<style>
    .supplement-status {
        display: flex;
        flex: 0 0 auto;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 10px;
        padding: 4px 8px;
        border-bottom: 1px solid var(--panel-border);
        color: var(--panel-muted);
        background: rgba(0, 0, 0, 0.12);
        font-size: 11px;
        line-height: 1.3;
    }

    .provider {
        font-weight: 600;
        white-space: nowrap;
    }

    .metric-status {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        min-height: 26px;
    }

    .metric-status > span {
        overflow-wrap: anywhere;
    }

    .failed {
        color: #ffd790;
    }

    .metric-status button {
        flex: 0 0 auto;
        min-width: 44px;
        min-height: 26px;
        padding: 2px 8px;
        border: 1px solid var(--panel-border);
        border-radius: 5px;
        color: var(--panel-text);
        background: rgba(255, 255, 255, 0.08);
        font: inherit;
        cursor: pointer;
    }

    .metric-status button:hover {
        background: rgba(255, 255, 255, 0.16);
    }

    .metric-status button:focus-visible {
        outline: 2px solid #8ed0ff;
        outline-offset: -2px;
    }

    @media (pointer: coarse) {
        .metric-status button {
            min-height: 44px;
        }
    }
</style>

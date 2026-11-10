<script lang="ts">
    import { messages } from './locales/RainbowConditions';
    import { UI_LANGUAGES } from './uiLanguage';
    import { onPluginDestroy as onDestroy } from './pluginLifecycle';
    import RainbowSightlineEvidence from './RainbowSightlineEvidence.svelte';
    import { createRainbowConditionsLoader, rainbowSampleSignal, type RainbowConditions } from './rainbowConditions';
    import { PRIMARY_RAINBOW_RADIUS, type SkyDirection } from './rainbowGeometry';
    import { createRainbowSightlineLoader, type SightlineState } from './rainbowSightlines';
    import type { UiLanguage } from './uiLanguage';
    import type { Coordinates } from './solar';
    import type { WeatherModel } from './weather';

    export let location: Coordinates;
    export let source: SkyDirection | null;
    export let timestamp: number | null;
    export let model: WeatherModel;
    export let timeZone: string;
    export let language: UiLanguage;
    export let enabled: boolean;

    let state: { status: 'idle' | 'loading' | 'ready' | 'error'; result: RainbowConditions | null } = { status: 'idle', result: null };
    let sightlines: SightlineState = { status: 'idle', terrain: null, visibility: null };
    let cameraHeightM: number | undefined = 2;
    const loader = createRainbowConditionsLoader(value => { state = value; });
    const sightlineLoader = createRainbowSightlineLoader(value => { sightlines = value; });
    $: heightValid = cameraHeightM !== undefined && Number.isFinite(cameraHeightM) && cameraHeightM >= 0 && cameraHeightM <= 1000;
    $: eligible = enabled && timestamp !== null && source !== null
        && source.altitude > 0 && source.altitude < PRIMARY_RAINBOW_RADIUS;
    // Any planning-context change clears old evidence immediately, including during a fetch.
    $: contextKey = `${location.lat}|${location.lon}|${timestamp}|${model}|${enabled}|${cameraHeightM}`;
    $: {
        void contextKey;
        loader.reset();
        sightlineLoader.reset();
    }
    $: labels = messages[language].conditionLevels;
    $: timeFormat = new Intl.DateTimeFormat(UI_LANGUAGES[language].clockLocale, {
        timeZone, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    const assess = () => {
        if (eligible && heightValid && source && timestamp !== null && cameraHeightM !== undefined) {
            void loader.load({ location, source, timestamp, model });
            void sightlineLoader.load({ location, source, timestamp, model, cameraHeightM });
        }
    };
    onDestroy(() => {
        loader.destroy();
        sightlineLoader.destroy();
    });
</script>

<section class="conditions" aria-label={messages[language].primaryRainbowConditions}>
    <div class="heading">
        <strong>{messages[language].primaryBowConditions}</strong>
        <button type="button" disabled={!eligible || !heightValid} on:click={assess}>
            {state.status === 'idle' ? (messages[language].assessSelectedTime) : (messages[language].assessAgain)}
        </button>
    </div>
    <label class="height-input"><span>{messages[language].heightAboveGround}</span>
        <span class="height-field"><input type="number" min="0" max="1000" step="0.1" bind:value={cameraHeightM} aria-invalid={!heightValid} /><span aria-hidden="true">m</span></span>
    </label>
    {#if !heightValid}<p role="status">{messages[language].enterAValidHeightFromToM}</p>{/if}
    <div role="status" aria-live="polite">
        {#if !eligible}
            <p>{messages[language].availableWhenTheSunAndPartOf}</p>
        {:else if state.status === 'loading'}
            <p>{messages[language].loadingRainAndDirectSunlightAtForward}</p>
        {:else if state.status === 'error'}
            <p>{messages[language].insufficientDataTheWeatherRequestFailedTry}</p>
        {:else if state.result}
            <div class="verdict"><span>{messages[language].rainLight}</span><strong>{labels[state.result.level]}</strong><span class="confidence">{messages[language].lowConfidenceNotAProbability}</span></div>
            <p class="assessment-meta">{timeFormat.format(state.result.start)} – {timeFormat.format(state.result.end)} <span>({timeZone})</span></p>
            <p>{messages[language].sampleSummary(state.result.wetCount, state.result.litWetCount)}</p>
            {#if state.result.level === 'insufficient'}
                <p>{messages[language].someFieldsAreMissingOrTheSelected}</p>
            {/if}
            <details class="assessment-details">
                <summary>{messages[language].sampleEvidence}</summary>
                <table class="assessment-table">
                    <caption>{messages[language].rainAndSunlightSamples}</caption>
                    <thead><tr><th scope="col">{messages[language].bearing}</th><th scope="col">km</th><th scope="col">mm</th><th scope="col">W/m²</th></tr></thead>
                    <tbody>{#each state.result.samples as sample}
                        {@const signal = rainbowSampleSignal(sample)}
                        <tr class:evidence-good={signal === 'favourable'} class:evidence-risk={signal === 'no-rain' || signal === 'weak-light'} class:evidence-unknown={signal === 'missing'}>
                            <td>{sample.bearing.toFixed(0)}°<span class="evidence-label">{signal === 'favourable' ? (messages[language].favourable)
                                : signal === 'no-rain' ? (messages[language].noRainSignal)
                                    : signal === 'weak-light' ? (messages[language].weakLight) : (messages[language].missing)}</span></td>
                            <td>{sample.distanceKm}</td><td>{sample.rainMm === null ? '—' : sample.rainMm.toFixed(1)}</td><td>{sample.directWm2 === null ? '—' : sample.directWm2.toFixed(0)}</td>
                        </tr>
                    {/each}</tbody>
                </table>
                <p>{messages[language].liquidRainMmHAndHourlyMean}</p>
            </details>
        {:else}
            <p>{messages[language].sampleWeatherAlongTheLeftCentreAnd}</p>
        {/if}
    </div>
    <RainbowSightlineEvidence state={sightlines} {language} {timeZone} />
    <p class="note">Open-Meteo · {model.toUpperCase()} · {messages[language].independentOfTheWeatherTableSourceHourly}</p>
</section>

<style>
    .conditions { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--panel-border); line-height: 1.5; }
    .heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px; }
    strong { color: var(--panel-text); font-weight: 500; }
    .conditions button { box-sizing: border-box; min-height: 30px; height: 30px; margin: 0; padding: 0 8px; border: 1px solid var(--panel-border); border-radius: 5px; color: var(--panel-text); background: rgba(255, 255, 255, .06); font: inherit; line-height: 1; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: default; }
    button:hover:not(:disabled) { background: rgba(99, 185, 238, 0.12); }
    button:focus-visible { outline: 2px solid var(--panel-accent); outline-offset: -2px; }
    p { margin: 6px 0; }
    .height-input { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 8px 0; color: var(--panel-muted); }
    .height-field { display: inline-flex; align-items: center; gap: 5px; }
    .conditions input { box-sizing: border-box; width: 64px; height: 30px; min-height: 0; margin: 0; padding: 0 6px; background: rgba(8, 15, 27, .68); color: var(--panel-text); border: 1px solid var(--panel-border); border-radius: 5px; font: inherit; font-variant-numeric: tabular-nums; color-scheme: dark; }
    input:focus-visible { outline: 2px solid var(--panel-accent); outline-offset: -2px; }
    .verdict { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 8px; margin: 8px 0 4px; }
    .confidence { color: var(--panel-muted); font-size: 11px; }
    .note { color: var(--panel-muted); font-size: 11px; }
    /* Shared presentation keeps all three evidence sections aligned, including child components. */
    .conditions :global(.assessment-meta) { color: var(--panel-muted); font-size: 11px; overflow-wrap: anywhere; }
    .conditions :global(.assessment-details) { margin: 6px 0 0; color: var(--panel-muted); }
    .conditions :global(.assessment-details > summary) { box-sizing: border-box; display: list-item; min-height: 0; height: auto; margin: 0; padding: 5px 0; line-height: 20px; border: 0; border-radius: 0; background: transparent; cursor: pointer; }
    .conditions :global(.assessment-details > summary:focus-visible) { outline: 1px solid var(--panel-accent); outline-offset: -1px; border-radius: 3px; }
    .conditions :global(.assessment-details > p) { margin: 6px 0; font-size: 11px; line-height: 1.5; }
    .conditions :global(.assessment-table) { width: 100%; table-layout: fixed; border-collapse: collapse; font: inherit; font-variant-numeric: tabular-nums; color: var(--panel-text); }
    .conditions :global(.assessment-table caption) { text-align: left; padding: 3px 0; color: var(--panel-muted); font-size: 11px; }
    .conditions :global(.assessment-table th), .conditions :global(.assessment-table td) { padding: 4px 3px; text-align: right; border-bottom: 1px solid var(--panel-border); overflow-wrap: anywhere; }
    .conditions :global(.assessment-table th) { color: var(--panel-muted); font-weight: 700; }
    .conditions :global(.assessment-table th:first-child), .conditions :global(.assessment-table td:first-child) { text-align: left; }
    /* Pair row tint with a text reason so risk is readable without colour perception. */
    .conditions :global(.assessment-table .evidence-good) { color: var(--weather-tone-good); background: rgba(96, 227, 124, .09); }
    .conditions :global(.assessment-table .evidence-risk) { color: var(--panel-warning); background: rgba(246, 182, 92, .1); }
    .conditions :global(.assessment-table .evidence-unknown) { color: var(--panel-muted); }
    .conditions :global(.assessment-table .evidence-good td:first-child) { box-shadow: inset 2px 0 var(--weather-tone-good); padding-left: 7px; }
    .conditions :global(.assessment-table .evidence-risk td:first-child) { box-shadow: inset 2px 0 var(--panel-warning); padding-left: 7px; }
    .conditions :global(.evidence-label) { display: block; font-size: 10px; line-height: 1.4; font-weight: 400; }
</style>

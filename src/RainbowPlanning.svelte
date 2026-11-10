<script lang="ts">
    import { map } from '@windy/map';
    import { messages } from './locales/RainbowPlanning';
    import { onPluginMount as onMount, onPluginDestroy as onDestroy } from './pluginLifecycle';
    import CelestialIcon from './CelestialIcon.svelte';
    import RainbowConditions from './RainbowConditions.svelte';
    import { cloudBodyPosition } from './cloudGeometry';
    import { calculateRainbow, rainbowSourceAboveHorizon, SECONDARY_RAINBOW_RADIUS } from './rainbowGeometry';
    import { createRainbowOverlay } from './rainbowOverlay';
    import { rainbowWindows } from './rainbowWindows';
    import { formatLocalClock } from './solar';
    import type { UiLanguage } from './uiLanguage';
    import type { WeatherModel } from './weather';
    import type { Coordinates } from './solar';

    export let location: Coordinates;
    export let contextReady: boolean;
    export let contextError: boolean;
    export let language: UiLanguage;
    export let lineOpacity: number;
    export let model: WeatherModel;
    export let timeZone: string;
    export let selectedDate: string;
    // Parent-owned session state survives tab changes; collapsing never unmounts this view.
    export let timestamp: number | null;
    export let body: 'sun' | 'moon' = 'sun';
    export let secondary = false;
    export let fullCircle = false;
    let showHelp = false;
    let mounted = false;
    const overlay = createRainbowOverlay(map);
    const degree = (value: number | null | undefined) => value === null || value === undefined ? '—' : `${value.toFixed(1)}°`;

    // Date-level geometry is independent of clock dragging and weather requests.
    $: windows = contextReady ? rainbowWindows(selectedDate, timeZone, location, body) : null;
    const windowClock = (time: number) => time === windows?.dayEnd ? '24:00' : formatLocalClock(new Date(time), timeZone);
    const durationLabel = (start: number, end: number) => {
        const minutes = Math.round((end - start) / 60_000);
        const hours = Math.floor(minutes / 60);
        return `${hours ? `${hours}h ` : ''}${minutes % 60}m`;
    };
    $: source = timestamp === null ? null : cloudBodyPosition(body, timestamp, location);
    $: primaryArc = rainbowSourceAboveHorizon(source) ? calculateRainbow(source) : null;
    $: secondaryArc = rainbowSourceAboveHorizon(source) && secondary ? calculateRainbow(source, SECONDARY_RAINBOW_RADIUS) : null;
    $: rows = secondary ? [primaryArc, secondaryArc] : [primaryArc];
    $: if (mounted) {
        overlay.render({ location, source, body, secondary, fullCircle, opacity: lineOpacity, language });
    }
    onMount(() => { mounted = true; });
    onDestroy(() => {
        mounted = false;
        overlay.destroy();
    });
</script>

<section class="rainbow-panel" aria-label={messages[language].rainbowPlanning}>
    <div class="rainbow-controls">
        <div class="body-picker" role="group" aria-label={messages[language].rainbowLightSource}>
            <button type="button" class:active={body === 'sun'} aria-pressed={body === 'sun'} on:click={() => body = 'sun'}>
                <CelestialIcon body="sun" size={14} />{messages[language].sun}
            </button>
            <button type="button" class:active={body === 'moon'} aria-pressed={body === 'moon'} on:click={() => body = 'moon'}>
                <CelestialIcon body="moon" size={14} />{messages[language].moon}
            </button>
        </div>
        <label><input type="checkbox" bind:checked={secondary} />{messages[language].double}</label>
        <label><input type="checkbox" bind:checked={fullCircle} />{messages[language].fullCircle}</label>
        <button class="help-button" type="button" aria-label={messages[language].rainbowGuide} aria-expanded={showHelp} aria-controls="rainbow-help" on:click={() => showHelp = !showHelp}>?</button>
    </div>
    {#if showHelp}
        <div id="rainbow-help" class="rainbow-help">
            <p>{messages[language].theRainbowRibbonWidthIsForLegibility}</p>
            <p>{messages[language].thePrimaryBowLiesAboutFromThe}</p>
            <p>{messages[language].theBowIsACompositionReferenceThe}</p>
        </div>
    {/if}
    <div class="source-line">
        <span>{body === 'sun' ? (messages[language].sun2) : (messages[language].moon2)}</span>
        <span>{messages[language].altitude} <strong>{degree(source?.altitude)}</strong></span>
        <span>{messages[language].azimuth} <strong>{degree(source?.azimuth)}</strong></span>
    </div>
    <!-- Svelte 4 treats region as noninteractive; keyboard users need to focus this horizontal scroll region. -->
    <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
    <div class="rainbow-table-scroll" role="region" tabindex="0" aria-label={messages[language].rainbowAnglesAndDailyWindows}>
    <table>
        <colgroup><col class="bow-column" /><col class="window-column" /><col span="4" class="angle-column" /></colgroup>
        <thead><tr><th scope="col">{messages[language].bow}</th><th scope="col" class="window-heading">{messages[language].windowDuration}</th><th scope="col" title={messages[language].topAltitude}>{messages[language].topAlt}</th><th scope="col">{messages[language].left}</th><th scope="col">{messages[language].centre}</th><th scope="col">{messages[language].right}</th></tr></thead>
        {#each rows as arc, index}
            {@const intervals = index === 0 ? windows?.primary : windows?.secondary}
            <tbody>
                <tr>
                    <th scope="row">{index === 0 ? (messages[language].primary) : (messages[language].secondary)}</th>
                    <td class="window-cell">
                        {#if intervals}
                            {#each intervals as interval}
                                <div class="window-time">
                                    <span>{windowClock(interval.start)}–{windowClock(interval.end)}</span>
                                    <span>{durationLabel(interval.start, interval.end)}</span>
                                </div>
                            {:else}
                                <span>{messages[language].noQualifyingWindowToday}</span>
                            {/each}
                        {:else}
                            <span>{contextError ? (messages[language].windowsUnavailable) : (messages[language].waitingForLocationAndTimeZone)}</span>
                        {/if}
                    </td>
                    <td>{degree(arc?.topAltitude)}</td>
                    <td>{degree(arc?.leftAzimuth)}</td>
                    <td>{degree(arc?.center.azimuth)}</td>
                    <td>{degree(arc?.rightAzimuth)}</td>
                </tr>
            </tbody>
        {/each}
    </table>
    </div>
    <p class="caption">{messages[language].anglesAreForTheSelectedTimeWindows}</p>
    {#if !contextReady}
        <p class="status" role="status">{contextError
            ? (messages[language].locationTimeZoneUnavailableSelectTheLocation)
            : (messages[language].resolvingTheLocationTimeZone)}</p>
    {:else if timestamp === null}
        <p class="status" role="status">{messages[language].chooseAValidLocalTimeSkippedDaylight}</p>
    {:else if primaryArc && primaryArc.topAltitude < 0}
        <p class="status" role="status">{fullCircle
            ? (messages[language].thePrimaryBowIsBelowTheHorizontal)
            : (messages[language].thePrimaryBowIsBelowTheHorizontal2)}</p>
    {/if}
    <p class="caption">{messages[language].mapOverlayIsATopDownSky}</p>
    <RainbowConditions {location} {source} {timestamp} {model} {timeZone} {language} enabled={contextReady && body === 'sun'} />
</section>

<style>
    .rainbow-table-scroll { overflow-x: auto; }
    .rainbow-table-scroll:focus-visible { outline: 2px solid var(--panel-accent); outline-offset: -2px; }
    .window-cell { white-space: normal; font-size: 10.5px; line-height: 1.6; }
    .window-time { display: flex; flex-wrap: wrap; justify-content: center; gap: 0 3px; font-variant-numeric: tabular-nums; }
    .window-time span { white-space: nowrap; }
    .window-time span:last-child { color: var(--panel-muted); }
    .rainbow-panel { box-sizing: border-box; height: 100%; overflow-y: auto; overscroll-behavior: contain; padding: 8px 10px; color: var(--panel-text); font-size: 12px; }
    .rainbow-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin-bottom: 8px; }
    .body-picker { display: flex; border: 1px solid var(--panel-border); border-radius: 5px; overflow: hidden; }
    .body-picker button { display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 0 5px; white-space: nowrap; }
    button { min-height: 28px; border: 0; padding: 0 9px; background: transparent; color: var(--panel-muted); font: inherit; cursor: pointer; }
    button.active { color: var(--panel-text); background: rgba(99, 185, 238, 0.18); }
    button:hover { color: var(--panel-text); background: rgba(99, 185, 238, 0.12); }
    button:focus-visible, input:focus-visible { outline: 2px solid var(--panel-accent); outline-offset: -2px; }
    label { display: flex; align-items: center; gap: 4px; min-height: 30px; white-space: nowrap; cursor: pointer; }
    input[type='checkbox'] { width: 14px; height: 14px; margin: 0; accent-color: var(--panel-accent); }
    .help-button { margin-left: auto; padding: 0; width: 28px; flex-shrink: 0; border: 1px solid var(--panel-border); border-radius: 50%; }
    .source-line { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 8px 0 5px; color: var(--panel-muted); }
    strong { color: var(--panel-text); font-weight: 500; }
    /* Data can switch between angles and unavailable dashes; neither may resize a column. */
    table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 11px; font-variant-numeric: tabular-nums; }
    .bow-column { width: 11%; }
    .window-column { width: 41%; }
    .angle-column { width: 12%; }
    th, td { padding: 5px 1px; text-align: center; vertical-align: middle; white-space: nowrap; border-bottom: 1px solid var(--panel-border); }
    th { color: var(--panel-muted); font-weight: 400; white-space: normal; overflow-wrap: anywhere; line-height: 1.3; }
    thead th { font-weight: 700; }
    p { margin: 7px 0 0; line-height: 1.5; }
    .caption { color: var(--panel-muted); font-size: 11px; }
    .status { color: #edcf90; }
    .rainbow-help { margin-bottom: 8px; padding: 0 0 8px; border-bottom: 1px solid var(--panel-border); color: var(--panel-muted); }
    .rainbow-help p:first-child { margin-top: 0; }
    :global(.rainbow-sky-overlay) { pointer-events: none !important; background: none; border: 0; }
    :global(.mobile_ui) .rainbow-controls { gap: 7px; }
</style>

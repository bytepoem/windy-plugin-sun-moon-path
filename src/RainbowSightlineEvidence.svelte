<script lang="ts">
    import { messages } from './locales/RainbowSightlineEvidence';
    import { UI_LANGUAGES } from './uiLanguage';
    import { LOW_VISIBILITY_KM, type SightlineState } from './rainbowSightlines';
    import type { UiLanguage } from './uiLanguage';

    export let state: SightlineState;
    export let language: UiLanguage;
    export let timeZone: string;
    $: terrain = state.terrain;
    $: visibility = state.visibility;
    $: terrainComplete = terrain !== null && terrain.directions.length > 0 && terrain.directions.every(item => item.complete);
    $: obstructed = terrain?.directions.filter(item => item.potentialObstruction).length ?? 0;
    $: visibilityComplete = visibility !== null && visibility.routes.length > 0 && visibility.routes.every(item => item.complete);
    $: poorRoutes = visibility?.routes.filter(item => item.lowVisibility).length ?? 0;
    $: timeFormat = new Intl.DateTimeFormat(UI_LANGUAGES[language].clockLocale, {
        timeZone, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    const number = (value: number | null | undefined, decimals = 1) => value == null ? '—' : value.toFixed(decimals);
</script>

{#if state.status !== 'idle'}
    <section class="sightlines" aria-label={messages[language].terrainAndVisibilityRisks}>
        <div class="heading"><strong>{messages[language].sightlineRisks}</strong><span>{messages[language].separateFromRainLightGrade}</span></div>
        {#if state.status === 'loading'}
            <p role="status">{messages[language].loadingTerrainAndVisibilityAlongTheRoutes}</p>
        {:else}
            <p role="status"><strong>{messages[language].terrain}</strong>{obstructed > 0
                ? (messages[language].obstructionCount(obstructed))
                : terrainComplete ? (messages[language].noSampledTerrainRisesAboveTheBow)
                    : (messages[language].insufficientData)}</p>
            {#if !terrainComplete && obstructed > 0}
                <p>{messages[language].terrainDataAreIncompleteOtherDirectionsRemain}</p>
            {/if}
            {#if terrain}
                <details class="assessment-details">
                    <summary>{messages[language].terrainEvidence}</summary>
                    <p>{messages[language].observerElevation} {number(terrain.observerElevationM, 0)} m</p>
                    <table class="assessment-table">
                        <caption>{messages[language].sampledDirectionsAndHighestTerrain}</caption>
                        <thead><tr><th scope="col">{messages[language].bearing}</th><th scope="col">{messages[language].bow}</th><th scope="col">{messages[language].terrain2}</th><th scope="col">km</th></tr></thead>
                        <tbody>{#each terrain.directions as direction}
                            <tr class:evidence-risk={direction.potentialObstruction} class:evidence-unknown={!direction.complete && !direction.potentialObstruction}>
                                <td>{number(direction.azimuth, 0)}°<span class="evidence-label">{direction.potentialObstruction ? (messages[language].obstructionRisk)
                                    : direction.complete ? (messages[language].noneFound) : (messages[language].unknown)}</span>{#if !direction.complete}<small>{messages[language].partial}</small>{/if}</td>
                                <td>{number(direction.altitude)}°</td><td>{number(direction.horizonAltitude)}°</td><td>{number(direction.ridgeDistanceKm)}</td>
                            </tr>
                        {/each}</tbody>
                    </table>
                </details>
            {/if}
            <p class="note">{messages[language].openMeteoCopernicusDEMGLOBowDirections}</p>

            <p role="status"><strong>{messages[language].visibilityAlongRoutes}</strong>{poorRoutes > 0
                ? (messages[language].poorRouteCount(poorRoutes))
                : visibilityComplete ? (messages[language].noLowVisibilitySignalAtSampledPoints)
                    : (messages[language].insufficientData)}</p>
            {#if !visibilityComplete && poorRoutes > 0}
                <p>{messages[language].visibilityDataAreIncompleteRisksOnOther}</p>
            {/if}
            {#if visibility}
                <p class="assessment-meta">{messages[language].forecastTime}{timeFormat.format(visibility.timestamp)} ({timeZone})</p>
                <details class="assessment-details">
                    <summary>{messages[language].routeVisibilityEvidence}</summary>
                    <table class="assessment-table">
                        <caption>{messages[language].routesAndMinimumVisibility}</caption>
                        <thead><tr><th scope="col">{messages[language].bearing}</th><th scope="col">{messages[language].routeKm}</th><th scope="col">{messages[language].minKm}</th></tr></thead>
                        <tbody>{#each visibility.routes as route}
                            <tr class:evidence-risk={route.lowVisibility} class:evidence-unknown={!route.complete && !route.lowVisibility}>
                                <td>{number(route.bearing, 0)}°<span class="evidence-label">{route.lowVisibility ? (messages[language].lowVisibility)
                                    : route.complete ? (messages[language].noneFound2) : (messages[language].unknown)}</span>{#if !route.complete}<small>{messages[language].partial}</small>{/if}</td>
                                <td>{route.distanceKm}</td><td>{number(route.minimumKm)}</td>
                            </tr>
                        {/each}</tbody>
                    </table>
                </details>
            {/if}
            <p class="note">{messages[language].visibilityNote(LOW_VISIBILITY_KM)}</p>
        {/if}
    </section>
{/if}

<style>
    .sightlines { border-top: 1px solid var(--panel-border); margin-top: 10px; padding-top: 8px; }
    .heading { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 8px; margin-bottom: 6px; }
    strong { color: var(--panel-text); font-weight: 500; }
    .heading span, .note { color: var(--panel-muted); font-size: 11px; }
    p { margin: 6px 0; }
    small { display: block; color: var(--panel-muted); font-size: 10px; }
</style>

<script lang="ts">
    import { LOW_VISIBILITY_KM, type SightlineState } from './rainbowSightlines';

    export let state: SightlineState;
    export let language: 'zh' | 'en';
    export let timeZone: string;
    $: zh = language === 'zh';
    $: terrain = state.terrain;
    $: visibility = state.visibility;
    $: terrainComplete = terrain !== null && terrain.directions.length > 0 && terrain.directions.every(item => item.complete);
    $: obstructed = terrain?.directions.filter(item => item.potentialObstruction).length ?? 0;
    $: visibilityComplete = visibility !== null && visibility.routes.length > 0 && visibility.routes.every(item => item.complete);
    $: poorRoutes = visibility?.routes.filter(item => item.lowVisibility).length ?? 0;
    $: timeFormat = new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-GB', {
        timeZone, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    const number = (value: number | null | undefined, decimals = 1) => value == null ? '—' : value.toFixed(decimals);
</script>

{#if state.status !== 'idle'}
    <section class="sightlines" aria-label={zh ? '地形与能见度风险' : 'Terrain and visibility risks'}>
        <div class="heading"><strong>{zh ? '视线风险' : 'Sightline risks'}</strong><span>{zh ? '独立于雨光等级' : 'Separate from rain/light grade'}</span></div>
        {#if state.status === 'loading'}
            <p role="status">{zh ? '正在读取地形与沿途能见度…' : 'Loading terrain and visibility along the routes…'}</p>
        {:else}
            <p role="status"><strong>{zh ? '地形：' : 'Terrain: '}</strong>{obstructed > 0
                ? (zh ? `${obstructed} 个采样方向存在潜在遮挡` : `Potential obstruction in ${obstructed} sampled directions`)
                : terrainComplete ? (zh ? '采样点未发现高于虹弧的山体' : 'No sampled terrain rises above the bow')
                    : (zh ? '数据不足' : 'Insufficient data')}</p>
            {#if !terrainComplete && obstructed > 0}
                <p>{zh ? '地形数据不完整，其余方向仍未知。' : 'Terrain data are incomplete; other directions remain unknown.'}</p>
            {/if}
            {#if terrain}
                <details class="assessment-details">
                    <summary>{zh ? '地形依据' : 'Terrain evidence'}</summary>
                    <p>{zh ? '计算视点海拔' : 'Observer elevation'} {number(terrain.observerElevationM, 0)} m</p>
                    <table class="assessment-table">
                        <caption>{zh ? '采样方向与最高山体' : 'Sampled directions and highest terrain'}</caption>
                        <thead><tr><th scope="col">{zh ? '方位' : 'Bearing'}</th><th scope="col">{zh ? '虹弧' : 'Bow'}</th><th scope="col">{zh ? '山体仰角' : 'Terrain'}</th><th scope="col">km</th></tr></thead>
                        <tbody>{#each terrain.directions as direction}
                            <tr class:evidence-risk={direction.potentialObstruction} class:evidence-unknown={!direction.complete && !direction.potentialObstruction}>
                                <td>{number(direction.azimuth, 0)}°<span class="evidence-label">{direction.potentialObstruction ? (zh ? '遮挡风险' : 'Obstruction risk')
                                    : direction.complete ? (zh ? '未见遮挡' : 'None found') : (zh ? '未知' : 'Unknown')}</span>{#if !direction.complete}<small>{zh ? '缺测' : 'Partial'}</small>{/if}</td>
                                <td>{number(direction.altitude)}°</td><td>{number(direction.horizonAltitude)}°</td><td>{number(direction.ridgeDistanceKm)}</td>
                            </tr>
                        {/each}</tbody>
                    </table>
                </details>
            {/if}
            <p class="note">{zh ? 'Open-Meteo / Copernicus DEM GLO-90：主虹 7 个方向，100 m–30 km 内每方向 16 个距离点，计入地球曲率，未校正折射。离地高度相对 DEM 表面；不精确刻画建筑、树木，可能漏掉采样间的山脊。雨滴可能在山前，因此只是潜在遮挡；不判断太阳到雨滴的山影。' : 'Open-Meteo / Copernicus DEM GLO-90: 7 bow directions, 16 distances each from 100 m to 30 km, with Earth curvature but no refraction correction. Height is relative to the DEM surface. Buildings, trees and ridges between samples are not resolved reliably. Droplets may be in front of hills; this is potential obstruction, not a test of terrain shadows on rain.'}</p>

            <p role="status"><strong>{zh ? '沿途能见度：' : 'Visibility along routes: '}</strong>{poorRoutes > 0
                ? (zh ? `${poorRoutes} 条候选路径有低能见度信号` : `Low-visibility signal on ${poorRoutes} candidate routes`)
                : visibilityComplete ? (zh ? '采样点未见低能见度信号' : 'No low-visibility signal at sampled points')
                    : (zh ? '数据不足' : 'Insufficient data')}</p>
            {#if !visibilityComplete && poorRoutes > 0}
                <p>{zh ? '能见度数据不完整，不能排除其他路径的风险。' : 'Visibility data are incomplete; risks on other routes remain unknown.'}</p>
            {/if}
            {#if visibility}
                <p class="assessment-meta">{zh ? '预报时次：' : 'Forecast time: '}{timeFormat.format(visibility.timestamp)} ({timeZone})</p>
                <details class="assessment-details">
                    <summary>{zh ? '沿途能见度依据' : 'Route visibility evidence'}</summary>
                    <table class="assessment-table">
                        <caption>{zh ? '路径与最低能见度' : 'Routes and minimum visibility'}</caption>
                        <thead><tr><th scope="col">{zh ? '方位' : 'Bearing'}</th><th scope="col">{zh ? '路径 km' : 'Route km'}</th><th scope="col">{zh ? '最低 km' : 'Min. km'}</th></tr></thead>
                        <tbody>{#each visibility.routes as route}
                            <tr class:evidence-risk={route.lowVisibility} class:evidence-unknown={!route.complete && !route.lowVisibility}>
                                <td>{number(route.bearing, 0)}°<span class="evidence-label">{route.lowVisibility ? (zh ? '低能见度' : 'Low visibility')
                                    : route.complete ? (zh ? '未见风险' : 'None found') : (zh ? '未知' : 'Unknown')}</span>{#if !route.complete}<small>{zh ? '缺测' : 'Partial'}</small>{/if}</td>
                                <td>{route.distanceKm}</td><td>{number(route.minimumKm)}</td>
                            </tr>
                        {/each}</tbody>
                    </table>
                </details>
            {/if}
            <p class="note">{zh ? `采样机位、候选雨区及中间位置；近地面能见度 <${LOW_VISIBILITY_KM} km 为经验风险参考。使用雨量区间末端的能见度时次，不表示整小时状况；无实测雨滴高度，不能代表高空视线，也不与雨区距离直接比较或换算成不可见概率。` : `Samples the observer, candidate rain locations and intermediate points. Near-surface visibility <${LOW_VISIBILITY_KM} km is a screening reference. Its timestamp is the rainfall interval's end, not an hourly average. Droplet heights are unknown; surface visibility does not describe elevated sightlines and is not compared directly with rain distance or converted to an invisibility probability.`}</p>
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

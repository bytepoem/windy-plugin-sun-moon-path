<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { map } from '@windy/map';
    import CelestialIcon from './CelestialIcon.svelte';
    import RainbowConditions from './RainbowConditions.svelte';
    import { cloudBodyPosition } from './cloudGeometry';
    import { calculateRainbow, rainbowSourceAboveHorizon, SECONDARY_RAINBOW_RADIUS } from './rainbowGeometry';
    import { createRainbowOverlay } from './rainbowOverlay';
    import type { WeatherModel } from './weather';
    import type { Coordinates } from './solar';

    export let location: Coordinates;
    export let contextReady: boolean;
    export let contextError: boolean;
    export let language: 'zh' | 'en';
    export let lineOpacity: number;
    export let model: WeatherModel;
    export let timeZone: string;
    // Parent-owned session state survives tab changes; collapsing never unmounts this view.
    export let timestamp: number | null;
    export let body: 'sun' | 'moon' = 'sun';
    export let secondary = false;
    export let fullCircle = false;
    let showHelp = false;
    let mounted = false;
    const overlay = createRainbowOverlay(map);
    const degree = (value: number | null | undefined) => value === null || value === undefined ? '—' : `${value.toFixed(1)}°`;

    $: zh = language === 'zh';
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

<section class="rainbow-panel" aria-label={zh ? '彩虹规划' : 'Rainbow planning'}>
    <div class="rainbow-controls">
        <div class="body-picker" role="group" aria-label={zh ? '彩虹光源' : 'Rainbow light source'}>
            <button type="button" class:active={body === 'sun'} aria-pressed={body === 'sun'} on:click={() => body = 'sun'}>
                <CelestialIcon body="sun" size={14} />{zh ? '日虹' : 'Sun'}
            </button>
            <button type="button" class:active={body === 'moon'} aria-pressed={body === 'moon'} on:click={() => body = 'moon'}>
                <CelestialIcon body="moon" size={14} />{zh ? '月虹' : 'Moon'}
            </button>
        </div>
        <label><input type="checkbox" bind:checked={secondary} />{zh ? '双彩虹' : 'Double'}</label>
        <label><input type="checkbox" bind:checked={fullCircle} />{zh ? '完整圆圈' : 'Full circle'}</label>
        <button class="help-button" type="button" aria-label={zh ? '彩虹说明' : 'Rainbow guide'} aria-expanded={showHelp} aria-controls="rainbow-help" on:click={() => showHelp = !showHelp}>?</button>
    </div>
    {#if showHelp}
        <div id="rainbow-help" class="rainbow-help">
            <p>{zh ? '七彩弧线的宽度仅用于清晰显示，不代表实际角宽。彩色同心圆标记反太阳点／反月亮点：方位与光源相差 180°，高度相反；它可能位于地平线下。圆圈大小为固定图标，不表示佛光大小，也不预测佛光是否出现。' : 'The rainbow ribbon width is for legibility, not actual angular width. The coloured target marks the antisolar/antilunar direction: 180° opposite in azimuth, with negated altitude; it can be below the horizon. Its fixed icon size does not model or predict a glory.'}</p>
            <p>{zh ? '主虹围绕光源反方向约 42°，副虹约 51° 且颜色相反。左右方位是虹弧与水平地平线的交点，没有交点时显示 —。地图从上方俯视天空，0° 圈为水平地平线，高度刻度并非等距。完整圆圈中，地平线上下的方向可能重叠，用实线与虚线区分。' : 'The primary bow lies about 42° from the opposite light-source direction; the secondary is about 51° with reversed colours. Left/right bearings mark horizontal-horizon crossings, or — if absent. The map looks down onto the sky; the 0° ring is the horizon and altitude rings are not evenly spaced. In full-circle mode, above/below-horizon directions may overlap; solid/dashed arcs distinguish them.'}</p>
            <p>{zh ? '虹弧为构图参考。下方可单独评估白天主虹的小时降雨与直射光条件，不是出现概率。前方需有受光水滴；完整圆圈还需下方有受光水滴及无遮挡视线。月虹通常需要较亮月光和长曝光，不纳入条件评估。' : 'The bow is a composition reference. The separate assessment below screens hourly rain and direct light for daytime primary bows; it is not an occurrence probability. Lit droplets must be ahead. Full circles also need lit droplets and clear sightlines below. Moonbows usually need bright moonlight and long exposures and are not assessed.'}</p>
        </div>
    {/if}
    <div class="source-line">
        <span>{body === 'sun' ? (zh ? '太阳' : 'Sun') : (zh ? '月亮' : 'Moon')}</span>
        <span>{zh ? '高度' : 'Altitude'} <strong>{degree(source?.altitude)}</strong></span>
        <span>{zh ? '方位' : 'Azimuth'} <strong>{degree(source?.azimuth)}</strong></span>
    </div>
    <table aria-label={zh ? '彩虹高度与方位' : 'Rainbow altitude and bearings'}>
        <colgroup><col class="bow-column" /><col span="4" class="angle-column" /></colgroup>
        <thead><tr><th scope="col">{zh ? '虹弧' : 'Bow'}</th><th scope="col">{zh ? '顶部高度' : 'Top alt.'}</th><th scope="col">{zh ? '左侧' : 'Left'}</th><th scope="col">{zh ? '中间' : 'Centre'}</th><th scope="col">{zh ? '右侧' : 'Right'}</th></tr></thead>
        <tbody>{#each rows as arc, index}
            <tr><th scope="row">{index === 0 ? (zh ? '主虹' : 'Primary') : (zh ? '副虹' : 'Secondary')}</th><td>{degree(arc?.topAltitude)}</td><td>{degree(arc?.leftAzimuth)}</td><td>{degree(arc?.center.azimuth)}</td><td>{degree(arc?.rightAzimuth)}</td></tr>
        {/each}</tbody>
    </table>
    {#if !contextReady}
        <p class="status" role="status">{contextError
            ? (zh ? '地点时区解析失败，暂无法计算彩虹；请重新选择地点。' : 'Location time zone unavailable; select the location again to retry.')
            : (zh ? '正在解析地点时区…' : 'Resolving the location time zone…')}</p>
    {:else if timestamp === null}
        <p class="status" role="status">{zh ? '请选择有效的当地时间；夏令时跳过的时刻不可用。' : 'Choose a valid local time; skipped daylight-saving times are unavailable.'}</p>
    {:else if primaryArc && primaryArc.topAltitude < 0}
        <p class="status" role="status">{fullCircle
            ? (zh ? '主虹在水平地平线下，虚线仅为俯视方向参考。' : 'The primary bow is below the horizontal horizon; dashed arcs show downward directions only.')
            : (zh ? '主虹在水平地平线下；开启完整圆圈可查看俯视方向。' : 'The primary bow is below the horizontal horizon. Full circle shows downward directions.')}</p>
    {/if}
    <p class="caption">{zh ? '地图为天空俯视投影，不表示距离；虚线为地平线下。' : 'Map overlay is a top-down sky projection, not distance; dashed arcs are below the horizon.'}</p>
    <RainbowConditions {location} {source} {timestamp} {model} {timeZone} {language} enabled={contextReady && body === 'sun'} />
</section>

<style>
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
    table { width: 100%; table-layout: fixed; border-collapse: collapse; font-variant-numeric: tabular-nums; }
    .bow-column { width: 24%; }
    .angle-column { width: 19%; }
    th, td { padding: 5px 3px; text-align: right; white-space: nowrap; border-bottom: 1px solid var(--panel-border); }
    th { color: var(--panel-muted); font-weight: 400; }
    th:first-child { text-align: left; }
    p { margin: 7px 0 0; line-height: 1.5; }
    .caption { color: var(--panel-muted); font-size: 11px; }
    .status { color: #edcf90; }
    .rainbow-help { margin-bottom: 8px; padding: 0 0 8px; border-bottom: 1px solid var(--panel-border); color: var(--panel-muted); }
    .rainbow-help p:first-child { margin-top: 0; }
    :global(.rainbow-sky-overlay) { pointer-events: none !important; background: none; border: 0; }
    :global(.mobile_ui) .rainbow-controls { gap: 7px; }
</style>

<script lang="ts">
    import { onDestroy } from 'svelte';
    import RainbowSightlineEvidence from './RainbowSightlineEvidence.svelte';
    import { createRainbowConditionsLoader, rainbowSampleSignal, type RainbowConditions } from './rainbowConditions';
    import { PRIMARY_RAINBOW_RADIUS, type SkyDirection } from './rainbowGeometry';
    import { createRainbowSightlineLoader, type SightlineState } from './rainbowSightlines';
    import type { Coordinates } from './solar';
    import type { WeatherModel } from './weather';

    export let location: Coordinates;
    export let source: SkyDirection | null;
    export let timestamp: number | null;
    export let model: WeatherModel;
    export let timeZone: string;
    export let language: 'zh' | 'en';
    export let enabled: boolean;

    let state: { status: 'idle' | 'loading' | 'ready' | 'error'; result: RainbowConditions | null } = { status: 'idle', result: null };
    let sightlines: SightlineState = { status: 'idle', terrain: null, visibility: null };
    let cameraHeightM: number | undefined = 2;
    const loader = createRainbowConditionsLoader(value => { state = value; });
    const sightlineLoader = createRainbowSightlineLoader(value => { sightlines = value; });
    $: zh = language === 'zh';
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
    $: labels = zh
        ? { favourable: '条件较有利', mixed: '条件一般', unfavourable: '条件不利', insufficient: '数据不足' }
        : { favourable: 'More favourable', mixed: 'Mixed conditions', unfavourable: 'Unfavourable', insufficient: 'Insufficient data' };
    $: timeFormat = new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-GB', {
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

<section class="conditions" aria-label={zh ? '主虹条件评估' : 'Primary rainbow conditions'}>
    <div class="heading">
        <strong>{zh ? '主虹条件' : 'Primary bow conditions'}</strong>
        <button type="button" disabled={!eligible || !heightValid} on:click={assess}>
            {state.status === 'idle' ? (zh ? '评估当前时刻' : 'Assess selected time') : (zh ? '重新评估' : 'Assess again')}
        </button>
    </div>
    <label class="height-input"><span>{zh ? '视点离地高度' : 'Height above ground'}</span>
        <span class="height-field"><input type="number" min="0" max="1000" step="0.1" bind:value={cameraHeightM} aria-invalid={!heightValid} /><span aria-hidden="true">m</span></span>
    </label>
    {#if !heightValid}<p role="status">{zh ? '请输入 0–1000 m 的有效离地高度。' : 'Enter a valid height from 0 to 1000 m.'}</p>{/if}
    <div role="status" aria-live="polite">
        {#if !eligible}
            <p>{zh ? '仅评估太阳在地平线上、主虹有地平线上弧段的时刻；不评估月虹及地平线下弧段。' : 'Available when the Sun and part of the primary bow are above the horizon. Moonbows and below-horizon arcs are not assessed.'}</p>
        {:else if state.status === 'loading'}
            <p>{zh ? '正在读取前方采样点的降雨与直射光…' : 'Loading rain and direct sunlight at forward sample points…'}</p>
        {:else if state.status === 'error'}
            <p>{zh ? '数据不足：天气请求失败，可重新评估。' : 'Insufficient data: the weather request failed. Try again.'}</p>
        {:else if state.result}
            <div class="verdict"><span>{zh ? '雨光条件' : 'Rain/light'}</span><strong>{labels[state.result.level]}</strong><span class="confidence">{zh ? '低可信度 · 非概率' : 'Low confidence · Not a probability'}</span></div>
            <p class="assessment-meta">{timeFormat.format(state.result.start)} – {timeFormat.format(state.result.end)} <span>({timeZone})</span></p>
            <p>{zh
                ? `9 个采样点中，${state.result.wetCount} 个有液态降水信号，${state.result.litWetCount} 个同时满足小时直射光参考值。`
                : `Of 9 sample points, ${state.result.wetCount} have a liquid-rain signal; ${state.result.litWetCount} also meet the hourly direct-light reference.`}</p>
            {#if state.result.level === 'insufficient'}
                <p>{zh ? '部分字段缺失或所选时段超出预报范围，不能作完整判断。' : 'Some fields are missing or the selected interval is outside forecast coverage.'}</p>
            {/if}
            <details class="assessment-details">
                <summary>{zh ? '采样依据' : 'Sample evidence'}</summary>
                <table class="assessment-table">
                    <caption>{zh ? '雨光采样数据' : 'Rain and sunlight samples'}</caption>
                    <thead><tr><th scope="col">{zh ? '方位' : 'Bearing'}</th><th scope="col">km</th><th scope="col">mm</th><th scope="col">W/m²</th></tr></thead>
                    <tbody>{#each state.result.samples as sample}
                        {@const signal = rainbowSampleSignal(sample)}
                        <tr class:evidence-good={signal === 'favourable'} class:evidence-risk={signal === 'no-rain' || signal === 'weak-light'} class:evidence-unknown={signal === 'missing'}>
                            <td>{sample.bearing.toFixed(0)}°<span class="evidence-label">{signal === 'favourable' ? (zh ? '有利' : 'Favourable')
                                : signal === 'no-rain' ? (zh ? '无雨信号' : 'No rain signal')
                                    : signal === 'weak-light' ? (zh ? '直射光弱' : 'Weak light') : (zh ? '缺测' : 'Missing')}</span></td>
                            <td>{sample.distanceKm}</td><td>{sample.rainMm === null ? '—' : sample.rainMm.toFixed(1)}</td><td>{sample.directWm2 === null ? '—' : sample.directWm2.toFixed(0)}</td>
                        </tr>
                    {/each}</tbody>
                </table>
                <p>{zh ? '液态降水 ≥0.1 mm/h、小时平均直射法向辐射 ≥120 W/m² 为经验筛选参考，未作彩虹观测校准。距离按模型网格间距粗采样，相邻点可能属于同一网格；无降水信号不代表周边无雨。' : 'Liquid rain ≥0.1 mm/h and hourly mean DNI ≥120 W/m² are uncalibrated screening references. Distances scale with model grid spacing; nearby samples may share a grid cell. No rain signal does not rule out nearby rain.'}</p>
            </details>
        {:else}
            <p>{zh ? '按主虹左右与中间方向采样周边天气，给出小时尺度的条件参考。' : 'Sample weather along the left, centre and right bearings of the primary bow for hourly guidance.'}</p>
        {/if}
    </div>
    <RainbowSightlineEvidence state={sightlines} {language} {timeZone} />
    <p class="note">Open-Meteo · {model.toUpperCase()} · {zh ? '独立于天气表的数据源设置。小时雨量和地面直射光不证明同一瞬间雨滴受光；未检查三维云层。地形与近地面能见度仅提供独立的视线风险参考。' : 'Independent of the weather table source. Hourly rain and surface direct light do not prove simultaneous illumination of droplets. 3D clouds are not checked. Terrain and near-surface visibility provide separate sightline risk references.'}</p>
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
    .conditions :global(.assessment-table th) { color: var(--panel-muted); font-weight: 400; }
    .conditions :global(.assessment-table th:first-child), .conditions :global(.assessment-table td:first-child) { text-align: left; }
    /* Pair row tint with a text reason so risk is readable without colour perception. */
    .conditions :global(.assessment-table .evidence-good) { color: var(--weather-tone-good); background: rgba(96, 227, 124, .09); }
    .conditions :global(.assessment-table .evidence-risk) { color: var(--panel-warning); background: rgba(246, 182, 92, .1); }
    .conditions :global(.assessment-table .evidence-unknown) { color: var(--panel-muted); }
    .conditions :global(.assessment-table .evidence-good td:first-child) { box-shadow: inset 2px 0 var(--weather-tone-good); padding-left: 7px; }
    .conditions :global(.assessment-table .evidence-risk td:first-child) { box-shadow: inset 2px 0 var(--panel-warning); padding-left: 7px; }
    .conditions :global(.evidence-label) { display: block; font-size: 10px; line-height: 1.4; font-weight: 400; }
</style>

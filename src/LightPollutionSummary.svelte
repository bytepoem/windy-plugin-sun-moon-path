<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    import type { LightPollutionPoint, ObservationConditionKey } from './lightPollution';

    export let point: LightPollutionPoint | null = null;
    export let status: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
    export let errorMessage = '';
    export let canRetry = true;
    export let language: 'zh' | 'en' = 'zh';

    const dispatch = createEventDispatcher<{ retry: void }>();
    const translations = {
        zh: {
            heading: '光污染',
            sqm: 'SQM',
            bortle: '光污染等级',
            milkyWay: '银河',
            zodiacalLight: '黄道光',
            andromedaGalaxy: '仙女座星系',
            triangulumGalaxy: '三角座星系',
            groundVisibility: '地面亮度',
            loading: '正在加载光污染数据…',
            retry: '重试',
            conditions: {
                'not-visible': '目视不可见',
                'averted-barely-visible': '斜视勉强可见',
                'averted-visible': '斜视可见',
                visible: '目视可见',
                'very-obvious': '非常明显',
                'zenith-faint': '天顶隐约可见',
                'hard-to-discern': '较难辨认',
                'broad-structure': '大体结构可见',
                'complex-structure': '复杂结构可见',
                'clear-structure': '结构清晰',
                'casts-shadow': '可投射阴影',
                faint: '隐约可见',
                'zenith-visible': '天顶可见',
                'clearly-visible': '明显可见',
                'dark-yellow': '明亮暗黄色',
                striking: '惊人可见',
                'bright-enough-to-read': '明亮到可读报',
                'nearby-small-objects': '可辨近处小物',
                'distant-objects': '可辨远处物体',
                'distant-large-objects': '可辨远处大物',
                'faint-distant-large-objects': '隐约见远处大物',
                'faint-nearby-large-objects': '隐约见近处大物',
                'shadows-only': '只可见物体影子',
            } satisfies Record<ObservationConditionKey, string>,
        },
        en: {
            heading: 'Light pollution',
            sqm: 'SQM',
            bortle: 'Est. Bortle',
            milkyWay: 'Milky Way',
            zodiacalLight: 'Zodiacal light',
            andromedaGalaxy: 'Andromeda',
            triangulumGalaxy: 'Triangulum',
            groundVisibility: 'Ground visibility',
            loading: 'Loading light pollution data…',
            retry: 'Retry',
            conditions: {
                'not-visible': 'Not visible',
                'averted-barely-visible': 'Barely visible with averted vision',
                'averted-visible': 'Visible with averted vision',
                visible: 'Visible',
                'very-obvious': 'Very obvious',
                'zenith-faint': 'Faint at zenith',
                'hard-to-discern': 'Hard to discern',
                'broad-structure': 'Broad structure visible',
                'complex-structure': 'Complex structure visible',
                'clear-structure': 'Structure clearly visible',
                'casts-shadow': 'Casts shadows',
                faint: 'Faint',
                'zenith-visible': 'Visible at zenith',
                'clearly-visible': 'Clearly visible',
                'dark-yellow': 'Bright dark-yellow glow',
                striking: 'Strikingly visible',
                'bright-enough-to-read': 'Bright enough to read',
                'nearby-small-objects': 'Nearby small objects visible',
                'distant-objects': 'Distant objects visible',
                'distant-large-objects': 'Distant large objects visible',
                'faint-distant-large-objects': 'Distant large objects faintly visible',
                'faint-nearby-large-objects': 'Nearby large objects faintly visible',
                'shadows-only': 'Only object shadows visible',
            } satisfies Record<ObservationConditionKey, string>,
        },
    };

    $: text = translations[language];
</script>

<section
    class="light-pollution"
    aria-label={text.heading}
    aria-busy={status === 'loading'}
>
    <header class="light-pollution__header">
        <strong>{text.heading}</strong>
        <span class="light-pollution__meta">
            {#if status === 'ready' && point}
                <b>{text.sqm} {point.sqm.toFixed(2)}</b>
                <i aria-hidden="true">·</i>
            {/if}
            <span>David Lorenz · {point?.year || 2025}</span>
        </span>
    </header>

    {#if status === 'ready' && point}
        <dl class="light-pollution__metrics">
            <div>
                <dt>{text.bortle}</dt>
                <dd class="light-pollution__level">{point.estimatedBortle.toFixed(1)}</dd>
            </div>
            <div title={language === 'zh' ? '仅依据天顶光污染估算' : 'Estimated from zenith brightness only'}>
                <dt>{text.milkyWay}</dt>
                <dd>{text.conditions[point.observingConditions.milkyWay]}</dd>
            </div>
            <div>
                <dt>{text.zodiacalLight}</dt>
                <dd>{text.conditions[point.observingConditions.zodiacalLight]}</dd>
            </div>
            <div>
                <dt>{text.groundVisibility}</dt>
                <dd>{text.conditions[point.observingConditions.groundVisibility]}</dd>
            </div>
            <div>
                <dt>{text.andromedaGalaxy}</dt>
                <dd>{text.conditions[point.observingConditions.andromedaGalaxy]}</dd>
            </div>
            <div>
                <dt>{text.triangulumGalaxy}</dt>
                <dd>{text.conditions[point.observingConditions.triangulumGalaxy]}</dd>
            </div>
        </dl>
    {:else}
        <div
            class:light-pollution__state--error={status === 'error'}
            class="light-pollution__state"
            aria-live="polite"
            role={status === 'error' ? 'alert' : undefined}
        >
            <span>{status === 'error' ? errorMessage : text.loading}</span>
            {#if status === 'error' && canRetry}
                <button type="button" on:click={() => dispatch('retry')}>{text.retry}</button>
            {/if}
        </div>
    {/if}
</section>

<style lang="less">
    .light-pollution {
        min-height: 103px;
        margin-top: 5px;
        overflow: hidden;
        border: 1px solid rgba(126, 144, 190, 0.28);
        border-radius: 6px;
        color: #f2f4fa;
        background: rgba(11, 18, 43, 0.72);
    }

    .light-pollution__header {
        display: flex;
        min-height: 21px;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 0 7px;
        border-bottom: 1px solid rgba(126, 144, 190, 0.22);
        color: #a8b1c1;
        font-size: 9px;
        line-height: 1;
    }

    .light-pollution__header strong {
        color: #c9d7f7;
        font-size: 10px;
    }

    .light-pollution__meta {
        display: flex;
        min-width: 0;
        align-items: center;
        justify-content: flex-end;
        gap: 4px;
        white-space: nowrap;
    }

    .light-pollution__meta b {
        color: #dce8ff;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
    }

    .light-pollution__meta i {
        font-style: normal;
    }

    .light-pollution__metrics {
        display: grid;
        min-height: 81px;
        margin: 0;
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .light-pollution__metrics > div {
        display: grid;
        min-width: 0;
        align-content: center;
        justify-items: center;
        min-height: 40px;
        padding: 4px 5px;
        text-align: center;
    }

    .light-pollution__metrics > div:not(:nth-child(3n + 1)) {
        border-left: 1px solid rgba(126, 144, 190, 0.22);
    }

    .light-pollution__metrics > div:nth-child(n + 4) {
        border-top: 1px solid rgba(126, 144, 190, 0.22);
    }

    .light-pollution__metrics dt,
    .light-pollution__metrics dd {
        min-width: 0;
        margin: 0;
    }

    .light-pollution__metrics dt {
        color: #a8b1c1;
        font-size: 9px;
        line-height: 1.1;
    }

    .light-pollution__metrics dd {
        margin-top: 2px;
        color: #f2f4fa;
        max-width: 100%;
        overflow-wrap: anywhere;
        font-size: 11px;
        font-weight: 700;
        line-height: 1.1;
    }

    .light-pollution__metrics .light-pollution__level {
        font-size: 14px;
        font-variant-numeric: tabular-nums;
    }

    .light-pollution__state {
        display: flex;
        min-height: 81px;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 0 8px;
        color: #a8b1c1;
        font-size: 10px;
        text-align: center;
    }

    .light-pollution__state--error {
        color: #ffc1c4;
    }

    .light-pollution__state button {
        min-height: 26px;
        padding: 0 8px;
        border: 1px solid rgba(126, 195, 238, 0.5);
        border-radius: 4px;
        color: #8ed6ff;
        background: transparent;
        font: inherit;
        cursor: pointer;
    }

    .light-pollution__state button:focus-visible {
        outline: 2px solid #63b9ee;
        outline-offset: 1px;
    }

    @media (max-width: 520px) {
        .light-pollution__header {
            padding-right: 6px;
            padding-left: 6px;
        }

        .light-pollution__metrics > div {
            padding: 2px 3px;
        }

        .light-pollution__meta {
            gap: 3px;
            font-size: 8px;
        }

        .light-pollution__metrics dd {
            font-size: 10px;
            line-height: 1.05;
        }
    }
</style>

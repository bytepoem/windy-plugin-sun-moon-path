<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { cloudClockMinute, cloudMinuteClock } from './cloudTimeline';

    export let clock: string;
    export let zh: boolean;
    const dispatch = createEventDispatcher<{ preview: string; commit: void; now: void }>();
    $: minute = cloudClockMinute(clock);
</script>

<div class="cloud-timeline" aria-label={zh ? '当地时间与天体升落' : 'Local time and celestial events'}>
    <div class="time-row">
        <input class="time-entry" type="time" step="60" value={clock}
            aria-label={zh ? '选择当地时间' : 'Choose local time'}
            on:click={event => event.currentTarget.showPicker?.()}
            on:input={event => dispatch('preview', event.currentTarget.value)}
            on:change={() => dispatch('commit')} on:blur={() => dispatch('commit')} />
        <button class="time-now" type="button"
            aria-label={zh ? '回到当前日期和时间' : 'Jump to the current date and time'}
            title={zh ? '回到当前日期和时间' : 'Jump to the current date and time'}
            on:click={() => dispatch('now')}>{zh ? '现在' : 'Now'}</button>
        <div class="time-track">
            <input type="range" min="0" max="1439" step="1" value={minute}
                aria-label={zh ? '当地计算时间' : 'Local calculation time'} aria-valuetext={clock || '--:--'}
                on:input={event => dispatch('preview', cloudMinuteClock(event.currentTarget.valueAsNumber))}
                on:change={() => dispatch('commit')} on:pointercancel={() => dispatch('commit')} on:blur={() => dispatch('commit')} />
            <div class="time-ticks" aria-hidden="true"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
        </div>
    </div>

</div>

<style>
    .cloud-timeline { width:100%; min-width:0; color:#b9c2ce; font-size:11px; }
    .time-row { display:flex; align-items:center; gap:6px; margin-bottom:0; }
    .time-track {
        box-sizing:border-box;
        display:flex;
        flex-direction:column;
        justify-content:center;
        flex:1 1 0;
        min-width:0;
        height:38px;
        padding:0 7px;
        border:1px solid var(--panel-border,#485364);
        border-radius:6px;
        background:#0e161f;
    }
    .time-entry { box-sizing:border-box; width:82px; height:38px; flex-shrink:0; min-width:0; padding:0 5px; border:1px solid var(--panel-border,#485364); border-radius:6px; background:#0e161f; color:var(--panel-text,#f2f4fa); color-scheme:dark; font-family:inherit; font-size:13px; font-weight:500; line-height:1.2; font-variant-numeric:tabular-nums; }
    .time-entry::-webkit-datetime-edit { padding:0; }
    .time-entry::-webkit-calendar-picker-indicator { width:14px; margin:0; padding:0; flex-shrink:0; }
    .time-now {
        height:38px;
        flex-shrink:0;
        padding:0 8px;
        border:1px solid var(--panel-border,#485364);
        border-radius:6px;
        background:#0e161f;
        color:var(--panel-text,#f2f4fa);
        font-family:inherit;
        font-size:12px;
        cursor:pointer;
    }
    .time-now:hover { background:#1b3948; }
    .time-now:focus-visible { outline:2px solid #6ed9ee; outline-offset:2px; }
    input:focus-visible { outline:2px solid #6ed9ee; outline-offset:2px; }
    input[type=range] { display:block; appearance:none; -webkit-appearance:none; width:100%; height:18px; margin:0; padding:0; border:0; background:transparent; cursor:pointer; }
    input::-webkit-slider-runnable-track { height:4px; border-radius:2px; background:#607587; }
    input::-webkit-slider-thumb { appearance:none; -webkit-appearance:none; width:16px; height:16px; margin-top:-6px; border:2px solid #17212a; border-radius:50%; background:#6ed9ee; }
    input::-moz-range-track { height:4px; border-radius:2px; background:#607587; }
    input::-moz-range-thumb { width:14px; height:14px; border:2px solid #17212a; border-radius:50%; background:#6ed9ee; }
    .time-ticks { display:flex; justify-content:space-between; padding:0 3px; font-size:10px; line-height:10px; }
    @media (pointer:coarse) { input[type=range] { height:24px; } }
</style>

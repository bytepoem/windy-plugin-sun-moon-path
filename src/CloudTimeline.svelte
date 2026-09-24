<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { cloudClockMinute, cloudMinuteClock } from './cloudTimeline';

    export let clock: string;
    export let zh: boolean;
    const dispatch = createEventDispatcher<{ preview: string; commit: void }>();
    $: minute = cloudClockMinute(clock);
</script>

<div class="cloud-timeline" aria-label={zh ? '当地时间与天体升落' : 'Local time and celestial events'}>
    <div class="time-row">
        <input class="time-entry" type="time" step="60" value={clock}
            aria-label={zh ? '选择当地时间' : 'Choose local time'}
            on:click={event => event.currentTarget.showPicker?.()}
            on:input={event => dispatch('preview', event.currentTarget.value)}
            on:change={() => dispatch('commit')} on:blur={() => dispatch('commit')} />
        <div class="time-track">
            <input type="range" min="0" max="1439" step="1" value={minute}
                aria-label={zh ? '当地计算时间' : 'Local calculation time'} aria-valuetext={clock || '--:--'}
                on:input={event => dispatch('preview', cloudMinuteClock(event.currentTarget.valueAsNumber))}
                on:change={() => dispatch('commit')} on:pointercancel={() => dispatch('commit')} on:blur={() => dispatch('commit')} />
            <div class="time-ticks" aria-hidden="true"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
        </div>
        <slot name="map" />
    </div>

</div>

<style>
    .cloud-timeline { width:100%; min-width:0; color:#b9c2ce; font-size:11px; }
    .time-row { display:flex; align-items:center; gap:6px; margin-bottom:0; }
    .time-track { flex:1 1 0; min-width:0; }
    .time-entry { box-sizing:border-box; width:82px; height:28px; flex-shrink:0; min-width:0; padding:0 5px; border:1px solid var(--panel-border,#485364); border-radius:5px; background:rgba(8,15,27,.5); color:#f2f4fa; color-scheme:dark; font:600 13px/1.2 monospace; }
    .time-entry::-webkit-datetime-edit { padding:0; }
    .time-entry::-webkit-calendar-picker-indicator { width:14px; margin:0; padding:0; flex-shrink:0; }
    input:focus-visible { outline:2px solid #6ed9ee; outline-offset:2px; }
    input[type=range] { display:block; appearance:none; -webkit-appearance:none; width:100%; height:18px; margin:0; padding:0; border:0; background:transparent; cursor:pointer; }
    input::-webkit-slider-runnable-track { height:4px; border-radius:2px; background:#607587; }
    input::-webkit-slider-thumb { appearance:none; -webkit-appearance:none; width:16px; height:16px; margin-top:-6px; border:2px solid #17212a; border-radius:50%; background:#6ed9ee; }
    input::-moz-range-track { height:4px; border-radius:2px; background:#607587; }
    input::-moz-range-thumb { width:14px; height:14px; border:2px solid #17212a; border-radius:50%; background:#6ed9ee; }
    .time-ticks { display:flex; justify-content:space-between; padding:0 3px; font-size:10px; line-height:10px; }
    @media (pointer:coarse) { input[type=range] { height:24px; } .time-entry { height:30px; } }
</style>

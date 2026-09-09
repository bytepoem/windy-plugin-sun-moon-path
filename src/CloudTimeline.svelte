<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { cloudClockMinute, cloudMinuteClock, cloudTimelineLabel, type CloudTimelineEvent, type CloudTimelineEventType } from './cloudTimeline';
    import { formatLocalClock } from './solar';

    export let events: CloudTimelineEvent[];
    export let clock: string;
    export let selected: CloudTimelineEventType | null;
    export let timeZone: string;
    export let zh: boolean;
    const dispatch = createEventDispatcher<{ preview: string; commit: void; jump: CloudTimelineEventType }>();
    const kinds: CloudTimelineEventType[] = ['sunrise', 'sunset', 'moonrise', 'moonset', 'milkywayrise', 'milkywayset'];
    $: minute = cloudClockMinute(clock);
</script>

<div class="cloud-timeline" aria-label={zh ? '当地时间与天体升落' : 'Local time and celestial events'}>
    <div class="target-events">
        <div class="event-buttons">
            {#each kinds as kind}
                {@const event = events.find(item => item.type === kind)}
                {@const name = cloudTimelineLabel(kind, zh)}
                {@const time = event ? formatLocalClock(new Date(event.timestamp), timeZone) : '--:--'}
                <button type="button" class:active={selected === kind} disabled={!event}
                    class:sun={kind.startsWith('sun')} class:moon={kind.startsWith('moon')} class:milkyway={kind.startsWith('milkyway')}
                    aria-label={`${name} ${time}${event ? '' : (zh ? '，当日无此事件' : ', no event today')}`}
                    aria-pressed={selected === kind} title={event ? `${name} ${time}` : (zh ? '当日无此升落事件' : 'No rise/set event on this date')}
                    on:click={() => dispatch('jump', kind)}>
                    <svg class="event-symbol" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        {#if kind.startsWith('sun')}
                            <circle cx="12" cy="12" r="4.2"></circle>
                            <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"></path>
                        {:else if kind.startsWith('moon')}
                            <path d="M19.6 15.2A8.4 8.4 0 0 1 8.8 4.4A8.6 8.6 0 1 0 19.6 15.2Z"></path>
                        {:else}
                            <path d="M12 9c-5-5-10 1-6 6s14 3 13-3S9 2 5 7m7 8c5 5 10-1 6-6S4 6 5 12s10 10 14 5"></path>
                            <circle cx="12" cy="12" r="1.5"></circle>
                        {/if}
                    </svg>
                    <svg class="event-arrow" class:event-arrow--down={kind.endsWith('set')} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                        <path d="M8 13V3M4.2 6.8 8 3l3.8 3.8"></path>
                    </svg>
                </button>
            {/each}
        </div>
        <slot name="map" />
    </div>
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
        <slot name="forecast" />
    </div>

</div>

<style>
    .cloud-timeline { width:100%; min-width:0; color:#b9c2ce; font-size:11px; }
    .target-events { display:grid; grid-template-columns:minmax(0,1fr) minmax(86px,auto); gap:6px; align-items:center; margin-bottom:6px; }
    .time-row { display:flex; align-items:center; gap:6px; margin-bottom:0; }
    .time-track { flex:1 1 0; min-width:0; }
    .time-entry { box-sizing:border-box; width:82px; height:28px; flex-shrink:0; min-width:0; padding:0 5px; border:1px solid var(--panel-border,#485364); border-radius:5px; background:rgba(8,15,27,.5); color:#f2f4fa; color-scheme:dark; font:600 13px/1.2 monospace; }
    .time-entry::-webkit-datetime-edit { padding:0; }
    .time-entry::-webkit-calendar-picker-indicator { width:14px; margin:0; padding:0; flex-shrink:0; }
    button { color:inherit; font:inherit; background:rgba(8,15,27,.5); border:1px solid var(--panel-border,#485364); border-radius:5px; cursor:pointer; }
    button:hover, button.active { background:#254754; border-color:#6ed9ee; }
    button:disabled { opacity:.45; cursor:default; }
    :is(button,input):focus-visible { outline:2px solid #6ed9ee; outline-offset:2px; }
    input[type=range] { display:block; appearance:none; -webkit-appearance:none; width:100%; height:18px; margin:0; padding:0; border:0; background:transparent; cursor:pointer; }
    input::-webkit-slider-runnable-track { height:4px; border-radius:2px; background:#607587; }
    input::-webkit-slider-thumb { appearance:none; -webkit-appearance:none; width:16px; height:16px; margin-top:-6px; border:2px solid #17212a; border-radius:50%; background:#6ed9ee; }
    input::-moz-range-track { height:4px; border-radius:2px; background:#607587; }
    input::-moz-range-thumb { width:14px; height:14px; border:2px solid #17212a; border-radius:50%; background:#6ed9ee; }
    .time-ticks { display:flex; justify-content:space-between; padding:0 3px; font-size:10px; line-height:10px; }
    .sun .event-symbol { fill:#ffb347; stroke:#ffb347; }
    .moon .event-symbol { fill:#f5efcf; stroke:#f5efcf; }
    .milkyway .event-symbol { fill:none; stroke:#9de0b7; }
    .event-buttons { display:grid; width:100%; max-width:300px; grid-template-columns:repeat(6,minmax(0,1fr)); gap:3px; }
    .event-buttons button { box-sizing:border-box; display:flex; align-items:center; justify-content:center; height:30px; min-height:30px; padding:3px 0; min-width:0; white-space:nowrap; }
    .event-symbol { display:block; width:16px; height:16px; flex-shrink:0; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; }
    .event-arrow { display:block; width:12px; height:12px; flex-shrink:0; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
    .event-arrow--down { transform:rotate(180deg); }
    @container (max-width:380px) { .event-buttons { gap:2px; } .event-symbol { width:14px; height:14px; } .event-arrow { width:10px; height:10px; } .time-row { gap:6px; } }
    @media (pointer:coarse) { input[type=range] { height:24px; } .time-entry { height:30px; } }
</style>

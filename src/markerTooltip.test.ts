import { afterEach, expect, it, vi } from 'vitest';
import { manageMarkerTooltip } from './markerTooltip';

afterEach(() => vi.useRealTimers());

it('dismisses touch/focus tooltips without mouseout and resets the deadline on reopening', () => {
    vi.useFakeTimers();
    const events = new Map<string, () => void>();
    const marker = {
        on: (event: string, handler: () => void) => events.set(event, handler),
        off: vi.fn(), closeTooltip: vi.fn(), unbindTooltip: vi.fn(),
    };
    const release = manageMarkerTooltip(marker as unknown as L.Marker);
    events.get('tooltipopen')!();
    vi.advanceTimersByTime(1500);
    expect(marker.closeTooltip).not.toHaveBeenCalled();
    events.get('tooltipopen')!();
    vi.advanceTimersByTime(1999);
    expect(marker.closeTooltip).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(marker.closeTooltip).toHaveBeenCalledOnce();
    events.get('tooltipopen')!();
    events.get('mouseout')!();
    expect(marker.closeTooltip).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
    events.get('tooltipopen')!();
    events.get('tooltipclose')!();
    expect(vi.getTimerCount()).toBe(0);
    events.get('tooltipopen')!();
    release();
    expect(vi.getTimerCount()).toBe(0);
    expect(marker.off).toHaveBeenCalledTimes(3);
    for (const [event, handler] of events) { expect(marker.off).toHaveBeenCalledWith(event, handler); }
    expect(marker.unbindTooltip).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(3000);
    expect(marker.closeTooltip).toHaveBeenCalledTimes(3);
});

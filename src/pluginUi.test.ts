import { describe, expect, it } from 'vitest';

import pluginSource from './plugin.svelte?raw';

describe('plugin astronomy loading presentation', () => {
    it('keeps loading feedback inside the stable astronomy panel', () => {
        const eventsBranchStart = pluginSource.indexOf("{#if summaryTab === 'events'}");
        const busyStatus = pluginSource.indexOf('class="visually-hidden" role="status"', eventsBranchStart);
        const astronomyPanelStart = pluginSource.indexOf('<section\n                    class="astronomy-panel"', eventsBranchStart);
        const astronomyPanelEnd = pluginSource.indexOf('{:else if summaryTab === \'weather\'', astronomyPanelStart);
        const astronomyPanelSource = pluginSource.slice(astronomyPanelStart, astronomyPanelEnd);

        expect(pluginSource).not.toContain('<div class="status-message">正在计算日月方位…</div>');
        expect(busyStatus).toBeGreaterThan(eventsBranchStart);
        expect(busyStatus).toBeLessThan(astronomyPanelStart);
        expect(astronomyPanelSource).not.toContain('role="status"');
        expect(astronomyPanelSource).toContain('class:astronomy-panel--loading={status === \'loading\'}');
        expect(astronomyPanelSource).toContain('aria-busy={status === \'loading\'}');
        expect(astronomyPanelSource).toContain('class="astronomy-skeleton');
        expect(pluginSource).toContain('Array.from({ length: 7 }');
        expect(pluginSource).toContain('grid-template-columns: repeat(7, minmax(0, 1fr))');
        expect(pluginSource).toContain('800ms linear 180ms infinite');
        expect(pluginSource).toContain('1.2s ease-in-out 180ms infinite');
        expect(pluginSource).toContain('@media (prefers-reduced-motion: reduce)');
        expect(pluginSource).toContain('animation: astronomy-loading-static 0s linear 180ms forwards');
    });

    it('refreshes current sun and moon values immediately after selecting a location', () => {
        const refreshValuesStart = pluginSource.indexOf('const refreshCurrentDirectionValues = () => {');
        const refreshValuesEnd = pluginSource.indexOf('const updateCurrentDirections = () => {', refreshValuesStart);
        const refreshValuesSource = pluginSource.slice(refreshValuesStart, refreshValuesEnd);
        const setLocationStart = pluginSource.indexOf('const setLocation = (');
        const setLocationEnd = pluginSource.indexOf('const setLocationFromMapClick', setLocationStart);
        const setLocationSource = pluginSource.slice(setLocationStart, setLocationEnd);
        const selectedLocationAssignment = setLocationSource.indexOf('selectedLocation = nextLocation;');
        const immediateDirectionRefresh = setLocationSource.indexOf('refreshCurrentDirectionValues();');
        const astronomyRefreshKey = setLocationSource.indexOf('const nextKey = makeAstronomyKey');

        expect(selectedLocationAssignment).toBeGreaterThanOrEqual(0);
        expect(immediateDirectionRefresh).toBeGreaterThan(selectedLocationAssignment);
        expect(immediateDirectionRefresh).toBeLessThan(astronomyRefreshKey);
        expect(refreshValuesSource).toContain('calculateCurrentSolarDirection({');
        expect(refreshValuesSource).toContain('calculateCurrentMoonInfo({');
        expect(refreshValuesSource.match(/location: selectedLocation/g)).toHaveLength(2);
        expect(pluginSource).toContain('requestId !== latestRequestId || key !== astronomyKey');
    });
});

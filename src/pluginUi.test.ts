import { describe, expect, it } from 'vitest';

import pluginSource from './plugin.svelte?raw';
import weatherTableSource from './WeatherTable.svelte?raw';

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

    it('uses the selected observer date instead of a live countdown for other days', () => {
        const timelineLeadStart = pluginSource.indexOf('$: {\n        if (!astronomyTimeline)');
        const timelineLeadEnd = pluginSource.indexOf('\n    }\n\n    export const onopen', timelineLeadStart);
        const timelineLeadSource = pluginSource.slice(timelineLeadStart, timelineLeadEnd);

        expect(pluginSource).toContain(
            '$: selectedDateIsToday = dateInputForInstant(currentInstant, timeZone) === selectedDate;',
        );
        expect(timelineLeadSource).toContain('else if (!selectedDateIsToday)');
        expect(timelineLeadSource).toContain('timelineLeadLabel = text.dateLabel;');
        expect(timelineLeadSource).toContain('timelineLeadTime = formatDateControlLabel(selectedDate);');
        expect(timelineLeadSource).toContain('label: text.timelineEnded');
        expect(timelineLeadSource).not.toContain('addDaysToDateInput');
        expect(timelineLeadSource).not.toContain('calculateAstronomyTimeline');
    });

    it('passes the selected date into both weather layouts and presents forecast coverage', () => {
        expect(pluginSource.match(/\n\s+\{selectedDate\}\n/g)).toHaveLength(2);
        expect(weatherTableSource).toContain("export let selectedDate = '';");
        expect(weatherTableSource).toContain('findWeatherDateSelection(points, timeZone, selectedDate)');
        expect(weatherTableSource).toContain('class:weather-date-group--selected={group.key === selectedDate}');
        expect(weatherTableSource).toContain('class:weather-value-cell--selected={isSelectedDateIndex(index, selectedDateStartIndex, selectedDateEndIndex)}');
        expect(weatherTableSource).toContain('weather-date-notice');
    });

    it('opens the native date picker when the compact date control is clicked', () => {
        expect(pluginSource).toContain('on:click={openDatePicker}');
        expect(pluginSource).toContain('const openDatePicker = (event: MouseEvent) => {');
        expect(pluginSource).toContain('input.showPicker();');
    });

    it('localizes accessibility labels and names astronomy regions for the selected date', () => {
        const literalAriaLabels = Array.from(
            pluginSource.matchAll(/aria-label="([^"]+)"/g),
            match => match[1],
        );

        expect(literalAriaLabels.filter(label => /\p{Script=Han}/u.test(label))).toEqual([]);
        expect(pluginSource).not.toContain(
            'aria-label={`${eventDisplayName(selectedEvent, text)}方向线数据`}',
        );
        expect(pluginSource).toContain('aria-label={text.sunMoonPanelLabel}');
        expect(pluginSource).toContain('aria-label={text.summaryViewsLabel}');
        expect(pluginSource).toContain(
            'aria-label={text.astronomyPanelLabel(accessibleSelectedDateLabel, selectedDateIsToday)}',
        );
        expect(pluginSource).toContain(
            'aria-label={text.astronomyEventsLabel(accessibleSelectedDateLabel, selectedDateIsToday)}',
        );
        expect(pluginSource).toContain('aria-label={text.currentMoonPhaseLabel}');
        expect(pluginSource).toContain('aria-label={text.nightObservationWindowsLabel}');
        expect(pluginSource).toContain('aria-label={text.mapLegendLabel}');
        expect(pluginSource).toContain(
            'aria-label={text.eventDirectionLinesLabel(eventDisplayName(selectedEvent, text))}',
        );
        expect(pluginSource).toContain("summaryViewsLabel: 'Sun and moon information views'");
        expect(pluginSource).toContain("currentMoonPhaseLabel: 'Current moon phase'");
    });
});

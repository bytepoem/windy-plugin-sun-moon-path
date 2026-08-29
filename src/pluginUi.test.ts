import { describe, expect, it } from 'vitest';

import favoriteComparisonSource from './FavoriteComparison.svelte?raw';
import favoriteLocationsSource from './FavoriteLocations.svelte?raw';
import locationSearchSource from './LocationSearch.svelte?raw';
import pluginSource from './plugin.svelte?raw';
import weatherMetricIconSource from './WeatherMetricIcon.svelte?raw';
import weatherTableSource from './WeatherTable.svelte?raw';

describe('plugin astronomy loading presentation', () => {
    it('places moonless and Milky Way windows in the comparison table without a separate timeline', () => {
        const tableBodyStart = favoriteComparisonSource.indexOf('<tbody>');
        const weatherRowStart = favoriteComparisonSource.indexOf(
            '<WeatherMetricIcon metric="totalCloudPercent"',
            tableBodyStart,
        );
        const windowRowsStart = favoriteComparisonSource.indexOf(
            '{#each windowKinds as kind}',
            tableBodyStart,
        );

        expect(windowRowsStart).toBeGreaterThan(tableBodyStart);
        expect(windowRowsStart).toBeLessThan(weatherRowStart);
        expect(favoriteComparisonSource).toContain('{windowTimeLabel(result, kind)}');
        expect(favoriteComparisonSource).toContain("class:last-window={kind === 'milky-way'}");
        expect(favoriteComparisonSource).not.toContain('favorite-comparison__timeline');
        expect(favoriteComparisonSource).not.toContain('timelineScale');
    });

    it('discloses full comparison location names to pointer, keyboard, and touch users', () => {
        expect(favoriteComparisonSource).toContain('class="favorite-comparison__location-button"');
        expect(favoriteComparisonSource).toContain('aria-label={result.prepared.target.title}');
        expect(favoriteComparisonSource).toContain('aria-expanded={expandedLocationId === result.prepared.target.id}');
        expect(favoriteComparisonSource).toContain('role="tooltip"');
        expect(favoriteComparisonSource).toContain('on:click={() => toggleLocationDetails(result.prepared.target.id)}');
        expect(favoriteComparisonSource).toContain("if (expandedLocationId) {");
        expect(favoriteComparisonSource).toContain('touch-action: manipulation;');
        expect(favoriteComparisonSource).not.toContain('document.addEventListener');
    });

    it('keeps mobile favorite and comparison scrolling inside their list regions', () => {
        expect(favoriteLocationsSource).toContain(
            'on:touchmove|nonpassive={handlePanelScrollGesture}',
        );
        expect(favoriteLocationsSource).toContain(
            'on:wheel|nonpassive={handlePanelScrollGesture}',
        );
        expect(favoriteLocationsSource).toMatch(
            /\.favorite-locations__list\s*{[\s\S]*?overscroll-behavior-y: contain;[\s\S]*?touch-action: pan-y;/,
        );
        expect(favoriteComparisonSource).toContain(
            'on:touchmove|nonpassive={handlePanelScrollGesture}',
        );
        expect(favoriteComparisonSource).toContain(
            'on:wheel|nonpassive={handlePanelScrollGesture}',
        );
        expect(pluginSource).toContain('mobile={isMobileOrTablet}');
        expect(favoriteComparisonSource).toContain('export let mobile = false;');
        expect(favoriteComparisonSource).toContain('class:mobile={mobile}');
        expect(favoriteComparisonSource).toMatch(
            /\.favorite-comparison\.mobile\s*{[\s\S]*?overflow: hidden;/,
        );
        expect(favoriteComparisonSource).toContain(
            '.favorite-comparison.mobile .favorite-comparison__footer',
        );
        expect(favoriteComparisonSource).toMatch(
            /\.favorite-comparison\.mobile \.favorite-comparison__table-wrap\s*{[\s\S]*?overflow: auto;[\s\S]*?overscroll-behavior: none;/,
        );
    });

    it('covers the mobile content area and keeps comparison actions in one toolbar', () => {
        expect(pluginSource.match(/mobile=\{isMobileOrTablet\}/g)).toHaveLength(2);
        expect(pluginSource).toContain(
            '.sun-path-panel.mobile_ui.favorites_open .primary-controls',
        );
        expect(pluginSource).toMatch(
            /\.sun-path-panel\.mobile_ui\.favorites_open\s*{[\s\S]*?overflow: hidden;[\s\S]*?scrollbar-width: none;/,
        );
        expect(pluginSource).toContain(
            '.sun-path-panel.mobile_ui.favorites_open .mobile-scroll-content::-webkit-scrollbar',
        );
        expect(favoriteLocationsSource).toContain('export let mobile = false;');
        expect(favoriteLocationsSource).toContain('class:mobile={mobile}');
        expect(favoriteLocationsSource).toMatch(
            /\.favorite-locations\.mobile\s*{[\s\S]*?inset: 0;[\s\S]*?height: 100%;/,
        );
        const toolbarStart = favoriteLocationsSource.indexOf(
            '<div class="favorite-locations__compare-toolbar">',
        );
        const toolbarEnd = favoriteLocationsSource.indexOf('</div>', toolbarStart);
        const toolbarSource = favoriteLocationsSource.slice(toolbarStart, toolbarEnd);
        expect(toolbarSource).toContain('text.compareCancel');
        expect(toolbarSource).toContain('{text.compareStart}');
        expect(toolbarSource).toContain('on:click={startComparison}');
        expect(favoriteLocationsSource).not.toContain('favorite-locations__compare-footer');
    });

    it('hides redundant host window controls while a fullscreen favorite dialog is open', () => {
        expect(pluginSource).toMatch(
            /\.sun-path-panel\.mobile_ui\.mobile_fullscreen\.favorites_open \.mobile-window-control\s*{[\s\S]*?visibility: hidden;[\s\S]*?pointer-events: none;/,
        );
        expect(pluginSource).toMatch(
            /sun-path-mobile-fullscreen\.sun-path-favorites-open > \.closing-x\)\s*{[\s\S]*?visibility: hidden;[\s\S]*?pointer-events: none;/,
        );
    });

    it('adds accessible mobile map-fit and search-zoom controls to the window toolbar', () => {
        expect(pluginSource).toContain('class="mobile-window-control mobile-map-fit-toggle"');
        expect(pluginSource).toContain('class="mobile-window-control mobile-map-detail-toggle"');
        expect(pluginSource).toContain('<path d="M7 12h10"></path>');
        expect(pluginSource).toContain('<path d="M7 12h10M12 7v10"></path>');
        expect(pluginSource).toContain('disabled={!canFitDirectionLines}');
        expect(pluginSource).toContain('paths: selectObservationPaths(solarPaths, selectedEvent)');
        expect(pluginSource).toContain('aria-label={text.fitDirectionLinesLabel(showExtendedDistanceMarker ? 600 : 400)}');
        expect(pluginSource).toContain('aria-label={text.restoreSearchZoomLabel}');
        expect(pluginSource).toContain('paddingBottomRight: visibleViewport.fitPaddingBottomRight');
        expect(pluginSource).toContain('duration: 0.45');
        expect(pluginSource).toContain('--mobile-window-control-width: 36px;');
        expect(pluginSource).toContain('--mobile-window-control-gap: 0px;');
        expect(pluginSource).toMatch(
            /plugin-mobile-bottom-small > \.closing-x\)\s*{[\s\S]*?justify-content: center;/,
        );
        expect(pluginSource).toContain('zoom: SEARCH_LOCATION_ZOOM');
        expect(pluginSource).toContain('paddingTop: visibleViewport.centerPaddingTop');
        expect(pluginSource).toContain('paddingLeft: visibleViewport.centerPaddingLeft');
        expect(pluginSource).toContain('MOBILE_MAP_RECENTER_DELAY_MS');
        expect(pluginSource).toContain('clearTimeout(mapDetailRecenterTimer)');
        expect(pluginSource).toContain("fitDirectionLinesLabel: distanceKm => `完整显示 ${distanceKm} km 方位线`");
        expect(pluginSource).toContain("restoreSearchZoomLabel: 'Restore search-location zoom'");
    });

    it('adds the same map controls to the desktop title bar', () => {
        expect(pluginSource).toContain('class="desktop-map-controls"');
        expect(pluginSource).toContain('class="desktop-map-control desktop-map-fit-control"');
        expect(pluginSource).toContain('class="desktop-map-control desktop-map-detail-control"');
        expect(pluginSource).toContain('on:click|stopPropagation');
        expect(pluginSource).toContain('paddingTopLeft: visibleViewport.fitPaddingTopLeft');
        expect(pluginSource).toMatch(
            /\.desktop-map-control\s*{[\s\S]*?width: 30px;[\s\S]*?height: 30px;/,
        );
    });

    it('keeps settings checkbox focus inside the visible toggle card', () => {
        const toggleStyle = pluginSource.match(
            /\.settings-toggle\s*{([\s\S]*?)\n\s*}/,
        )?.[1];
        const inputStyle = pluginSource.match(
            /\.settings-toggle input\s*{([\s\S]*?)\n\s*}/,
        )?.[1];

        expect(toggleStyle).toContain('position: relative;');
        expect(inputStyle).toContain('inset: 0;');
        expect(inputStyle).toContain('width: 100%;');
        expect(inputStyle).toContain('height: 100%;');
        expect(inputStyle).toContain('cursor: pointer;');
        expect(inputStyle).not.toContain('pointer-events: none;');
    });

    it('supports two to five comparison targets with horizontally scrollable location columns', () => {
        expect(favoriteLocationsSource).toContain(
            '选择 2–${FAVORITE_COMPARISON_MAX_TARGETS} 个收藏地点',
        );
        expect(favoriteLocationsSource).toContain(
            '`已选 ${selectedCount}/${FAVORITE_COMPARISON_MAX_TARGETS}`',
        );
        expect(favoriteLocationsSource).toContain(
            'comparisonIds.length >= FAVORITE_COMPARISON_MAX_TARGETS',
        );
        expect(favoriteComparisonSource).toContain(
            'style={`--comparison-table-width: ${122 + results.length * 80}px`}',
        );
        expect(favoriteComparisonSource).toContain('class:last-location={index === results.length - 1}');
        expect(favoriteComparisonSource).toMatch(
            /table\s*{[\s\S]*?width: max\(100%, var\(--comparison-table-width\)\);/,
        );
        expect(favoriteComparisonSource).toMatch(
            /tbody th\s*{[\s\S]*?position: sticky;[\s\S]*?left: 0;/,
        );
    });

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
        const weatherLayouts = pluginSource.match(/<WeatherTable[\s\S]*?\/>/g) || [];
        expect(weatherLayouts).toHaveLength(2);
        expect(weatherLayouts.every(layout => layout.includes('{selectedDate}'))).toBe(true);
        expect(weatherTableSource).toContain("export let selectedDate = '';");
        expect(weatherTableSource).toContain('findWeatherDateSelection(points, timeZone, selectedDate)');
        expect(weatherTableSource).toContain('class:weather-date-group--selected={group.key === selectedDate}');
        expect(weatherTableSource).toContain('class:weather-value-cell--selected={isSelectedDateIndex(index, selectedDateStartIndex, selectedDateEndIndex)}');
        expect(weatherTableSource).toContain('weather-date-notice');
    });

    it('uses one accessible metric icon vocabulary in observation evidence and weather row labels', () => {
        expect(pluginSource).toContain("import WeatherMetricIcon from './WeatherMetricIcon.svelte';");
        expect(weatherTableSource).toContain("import WeatherMetricIcon from './WeatherMetricIcon.svelte';");
        expect(pluginSource).toContain('<WeatherMetricIcon metric="totalCloudPercent"');
        expect(pluginSource).toContain('<WeatherMetricIcon metric="precipMm"');
        expect(pluginSource).toContain('<WeatherMetricIcon metric="visibilityKm"');
        expect(weatherTableSource).toContain('<WeatherMetricIcon {metric} size={10} />');
        expect(weatherMetricIconSource).toContain('aria-hidden="true"');
        expect(weatherMetricIconSource).toContain('focusable="false"');
    });

    it('loads weather evidence while the compact mobile Events view is visible', () => {
        expect(pluginSource).toContain(
            "!isMobileOrTablet || isMobileFullscreen || summaryTab === 'events' || summaryTab === 'weather'",
        );
        expect(pluginSource.match(/isWeatherTabActive: shouldLoadVisibleWeatherData/g)).toHaveLength(2);
    });

    it('reserves desktop Events headroom and separates live direction metrics', () => {
        const desktopMetricRule = pluginSource.match(
            /\.live-position \.live-position__metric\s*{([\s\S]*?)\n\s*}/,
        )?.[1];
        const narrowMobileStart = pluginSource.indexOf('@media (max-width: 360px)');
        const narrowMobileEnd = pluginSource.indexOf('@media (max-height: 740px)', narrowMobileStart);
        const narrowMobileSource = pluginSource.slice(narrowMobileStart, narrowMobileEnd);
        const mobileStart = pluginSource.indexOf('@media (max-width: 520px)');
        const mobileEnd = pluginSource.indexOf('@media (max-width: 360px)', mobileStart);
        const mobileSource = pluginSource.slice(mobileStart, mobileEnd);
        const mobileMetricRule = mobileSource.match(
            /\.live-position \.live-position__metric\s*{([\s\S]*?)\n\s*}/,
        )?.[1];
        const landscapeStart = pluginSource.indexOf('@media (orientation: landscape)');
        const landscapeEnd = pluginSource.indexOf('@media (prefers-reduced-motion: reduce)', landscapeStart);
        const landscapeSource = pluginSource.slice(landscapeStart, landscapeEnd);

        expect(pluginSource).toContain("class:summary-panel-frame--events={summaryTab === 'events'}");
        expect(pluginSource).toContain(
            'grid-template-columns: minmax(112px, 1fr) max-content minmax(112px, 1fr);',
        );
        expect(pluginSource).toContain(
            '--summary-panel-height: 268px;\n        --events-summary-panel-height: 280px;',
        );
        expect(pluginSource).toContain(
            '--summary-panel-height: 250px;\n        --events-summary-panel-height: 250px;',
        );
        expect(landscapeSource).toContain('--summary-panel-height: 256px;');
        expect(landscapeSource).toContain('--events-summary-panel-height: 256px;');
        expect(pluginSource).toContain('height: var(--events-summary-panel-height);');
        expect(pluginSource).toContain('column-gap: 0.5ch;');
        expect(desktopMetricRule).toContain('grid-template-columns: 7ch 4.4ch 5.1ch;');
        expect(desktopMetricRule).toContain('column-gap: 4px;');
        expect(mobileMetricRule).toContain('grid-template-columns: 6.8ch 4.3ch 5.2ch;');
        expect(mobileMetricRule).toContain('column-gap: 3px;');
        expect(narrowMobileSource).toMatch(/\.live-position__compass\s*{[\s\S]*?display: none;/);
        expect(narrowMobileSource).toMatch(/\.live-position__event-azimuth\s*{[\s\S]*?display: none;/);
    });

    it('keeps the evidence skeleton when no observing interval exists', () => {
        const placeholderStart = pluginSource.indexOf(
            'class="night-window__evidence night-window__evidence--placeholder"',
        );
        const placeholderEnd = pluginSource.indexOf('</div>', placeholderStart);
        const placeholderSource = pluginSource.slice(placeholderStart, placeholderEnd);
        const placeholderStyle = pluginSource.match(
            /\.night-window__evidence--placeholder\s*{([\s\S]*?)\n\s*}/,
        )?.[1];

        expect(placeholderStart).toBeGreaterThanOrEqual(0);
        expect(placeholderEnd).toBeGreaterThan(placeholderStart);
        expect(placeholderSource).toContain('aria-hidden="true"');
        expect(placeholderSource.match(/class="night-window__metric"/g)).toHaveLength(3);
        expect(Array.from(placeholderSource.matchAll(/metric="([^"]+)"/g), match => match[1])).toEqual([
            'totalCloudPercent',
            'precipMm',
            'visibilityKm',
        ]);
        expect(placeholderSource.match(/>\s*--\s*<\/span>/g)).toHaveLength(3);
        expect(placeholderSource).not.toContain('astronomy-skeleton');
        expect(placeholderSource).not.toContain('aria-live');
        expect(placeholderStyle).toContain('opacity: 0.48;');
        expect(placeholderStyle).not.toContain('animation');
    });

    it('opens the native date picker when the compact date control is clicked', () => {
        expect(pluginSource).toContain('on:click={openDatePicker}');
        expect(pluginSource).toContain('const openDatePicker = (event: MouseEvent) => {');
        expect(pluginSource).toContain('input.showPicker();');
    });

    it('uses one hidden search setting while exposing coordinate search in both languages', () => {
        expect(pluginSource).toContain('{#if !hideLocationSearch}');
        expect(pluginSource).toContain("hideLocationSearchLabel: '隐藏地点搜索框'");
        expect(pluginSource).toContain("hideLocationSearchLabel: 'Hide location search'");
        expect(pluginSource).not.toContain('hideDomesticLocationSearch');
        expect(locationSearchSource).toContain('? [...LOCATION_PROVIDERS, ...COORDINATE_SYSTEMS]');
        expect(locationSearchSource).toContain(': [...COORDINATE_SYSTEMS]');
        expect(locationSearchSource).toContain("latitude: 'Lat'");
        expect(locationSearchSource).toContain("longitude: 'Lon'");
        expect(locationSearchSource).toContain('id="location-search-latitude"');
        expect(locationSearchSource).toContain('id="location-search-longitude"');
        expect(locationSearchSource).toContain('inputmode="text"');
        expect(locationSearchSource).not.toContain('inputmode="decimal"');
        expect(locationSearchSource).toContain(
            '{#if !coordinateMode}\n            <label class="location-search__label"',
        );
        expect(locationSearchSource).toContain('{coordinateMode ? text.locate : text.search}');
        expect(locationSearchSource).not.toContain('disabled={!apiKey}');
    });

    it('keeps the search-mode dropdown compact with a centered selection indicator', () => {
        const providerPickerStyle = locationSearchSource.match(
            /\.location-search__provider-picker\s*{([\s\S]*?)\n\s*}/,
        )?.[1];
        const providerButtonStyle = locationSearchSource.match(
            /\.location-search__provider-button\s*{([\s\S]*?)\n\s*}/,
        )?.[1];
        const providerButtonLabelStyle = locationSearchSource.match(
            /\.location-search__provider-button > span:first-child\s*{([\s\S]*?)\n\s*}/,
        )?.[1];
        const providerChevronStyle = locationSearchSource.match(
            /\.location-search__provider-chevron\s*{([\s\S]*?)\n\s*}/,
        )?.[1];
        const providerMenuStyle = locationSearchSource.match(
            /\.location-search__provider-menu\s*{([\s\S]*?)\n\s*}/,
        )?.[1];
        const providerOptionStyle = locationSearchSource.match(
            /\.location-search__provider-menu button\s*{([\s\S]*?)\n\s*}/,
        )?.[1];
        const providerCheckStyle = locationSearchSource.match(
            /\.location-search__provider-check\s*{([\s\S]*?)\n\s*}/,
        )?.[1];
        const mobileSearchStyle = locationSearchSource.slice(
            locationSearchSource.indexOf('@media (max-width: 600px)'),
        );

        expect(providerPickerStyle).toContain('width: 96px;');
        expect(providerPickerStyle).toContain('min-width: 96px;');
        expect(providerButtonStyle).toContain('grid-template-columns: minmax(0, 1fr) 10px;');
        expect(providerButtonStyle).toContain('gap: 8px;');
        expect(providerButtonStyle).toContain('padding: 0 10px;');
        expect(providerButtonLabelStyle).toContain('white-space: nowrap;');
        expect(providerChevronStyle).toContain('justify-self: center;');
        expect(providerMenuStyle).toContain('width: max(100%, 88px);');
        expect(providerOptionStyle).toContain('grid-template-columns: minmax(0, 1fr) 12px;');
        expect(providerOptionStyle).toContain('padding: 0 6px;');
        expect(providerCheckStyle).toContain('justify-self: center;');
        expect(providerCheckStyle).not.toContain('right:');
        expect(mobileSearchStyle).toContain('width: 72px;');
        expect(mobileSearchStyle).toContain('min-width: 72px;');
        expect(mobileSearchStyle).toContain('gap: 4px;');
        expect(mobileSearchStyle).toContain('padding: 0 4px;');
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
        expect(pluginSource).toContain("currentMoonPhaseLabel: 'Moon phase'");
    });

    it('uses live moon illumination only for the observer-local current date', () => {
        const moonDisplayStart = pluginSource.indexOf('$: displayedMoonIllumination =');
        const moonDisplayEnd = pluginSource.indexOf('\n\n    const nextWindowParts', moonDisplayStart);
        const moonDisplaySource = pluginSource.slice(moonDisplayStart, moonDisplayEnd);

        expect(moonDisplayStart).toBeGreaterThanOrEqual(0);
        expect(moonDisplaySource).toContain('selectedDateIsToday && currentMoonInfo');
        expect(moonDisplaySource).toContain('astronomyTimeline?.moonIllumination ?? null');
        expect(moonDisplaySource).toContain('displayedMoonIllumination?.fraction');
        expect(moonDisplaySource).toContain('displayedMoonIllumination?.waxing');
        expect(moonDisplaySource).not.toContain(
            'currentMoonInfo?.illuminationFraction ?? astronomyTimeline?.moonIllumination.fraction',
        );
        expect(pluginSource).toContain('<FavoriteComparison\n        bind:open={favoriteComparisonOpen}');
        expect(pluginSource).toContain('currentInstant={currentInstant}');
        expect(favoriteComparisonSource).toContain('export let currentInstant: Date;');
        expect(favoriteComparisonSource).toContain(
            'dateInputForInstant(currentInstant, result.prepared.timeZone) === selectedDate',
        );
        expect(favoriteComparisonSource).toContain('calculateCurrentMoonInfo({');
        expect(favoriteComparisonSource).toContain('Number((fraction * 100).toFixed(1))');
        expect(favoriteComparisonSource).not.toContain(
            'Math.round(result.prepared.timeline.moonIllumination.fraction * 100)',
        );
    });
});

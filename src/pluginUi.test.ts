import { describe, expect, it } from 'vitest';

import favoriteComparisonSource from './FavoriteComparison.svelte?raw';
import favoriteLocationsSource from './FavoriteLocations.svelte?raw';
import locationSearchSource from './LocationSearch.svelte?raw';
import pluginConfigSource from './pluginConfig.ts?raw';
import pluginSource from './plugin.svelte?raw';
import radarFrameTimeLabelSource from './radarFrameTimeLabel.ts?raw';
import weatherSource from './weather.ts?raw';
import weatherMetricIconSource from './WeatherMetricIcon.svelte?raw';
import weatherTableSource from './WeatherTable.svelte?raw';
import unitPreferencesSource from './unitPreferences.ts?raw';

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

    it('uses comparison location names to select and center the corresponding place', () => {
        expect(favoriteComparisonSource).toContain('class="favorite-comparison__location-button"');
        expect(favoriteComparisonSource).toContain('aria-label={text.locate(result.prepared.target.title)}');
        expect(favoriteComparisonSource).toContain('on:click={() => selectLocation(result.prepared.target)}');
        expect(favoriteComparisonSource).toContain("dispatch('select', target);");
        expect(favoriteComparisonSource).not.toContain('expandedLocationId');
        expect(favoriteComparisonSource).not.toContain('favorite-comparison__location-tooltip');
        expect(pluginSource).toContain('on:select={handleFavoriteComparisonLocationSelect}');
        const selectionHandlerStart = pluginSource.indexOf(
            'const handleFavoriteComparisonLocationSelect =',
        );
        const selectionHandlerEnd = pluginSource.indexOf(
            'const requestPreciseGpsLocation',
            selectionHandlerStart,
        );
        const selectionHandler = pluginSource.slice(selectionHandlerStart, selectionHandlerEnd);
        const closeComparison = selectionHandler.indexOf('favoriteComparisonOpen = false;');
        const waitForPanelLayout = selectionHandler.indexOf('await tick();');
        const recenterVisibleMap = selectionHandler.indexOf('restoreSearchLocationZoom();');

        expect(selectionHandlerStart).toBeGreaterThanOrEqual(0);
        expect(closeComparison).toBeGreaterThanOrEqual(0);
        expect(waitForPanelLayout).toBeGreaterThan(closeComparison);
        expect(recenterVisibleMap).toBeGreaterThan(waitForPanelLayout);
        expect(selectionHandler).not.toContain(
            'centerMap({ lat: target.location.lat, lon: target.location.lon, zoom: SEARCH_LOCATION_ZOOM });',
        );
        expect(favoriteComparisonSource).toMatch(
            /\.favorite-comparison__location-button\s*{[\s\S]*?min-height: 44px;[\s\S]*?cursor: pointer;/,
        );
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
        expect(pluginSource.match(/mobile=\{isMobileOrTablet\}/g)).toHaveLength(3);
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

    it('keeps fullscreen window controls reachable above mobile favorite dialogs', () => {
        expect(pluginSource).not.toContain(
            '.sun-path-panel.mobile_ui.mobile_fullscreen.favorites_open .mobile-window-control',
        );
        expect(pluginSource).not.toContain(
            'sun-path-mobile-fullscreen.sun-path-favorites-open > .closing-x',
        );
        expect(pluginSource.match(/\n\s+fullscreen=\{isMobileFullscreen\}/g)).toHaveLength(2);
        expect(favoriteLocationsSource).toContain('export let fullscreen = false;');
        expect(favoriteLocationsSource).toContain('class:fullscreen={fullscreen}');
        expect(favoriteLocationsSource).toMatch(
            /\.favorite-locations\.mobile\.fullscreen\s*{[\s\S]*?top: calc\(52px \+ env\(safe-area-inset-top, 0px\)\);[\s\S]*?bottom: env\(safe-area-inset-bottom, 0px\);[\s\S]*?height: auto;/,
        );
        expect(favoriteComparisonSource).toContain('export let fullscreen = false;');
        expect(favoriteComparisonSource).toContain('class:fullscreen={fullscreen}');
        expect(favoriteComparisonSource).toMatch(
            /\.favorite-comparison\.mobile\.fullscreen\s*{[\s\S]*?top: calc\(52px \+ env\(safe-area-inset-top, 0px\)\);[\s\S]*?bottom: env\(safe-area-inset-bottom, 0px\);[\s\S]*?height: auto;/,
        );
    });

    it('opens mobile favorites without focusing the search field', () => {
        expect(favoriteLocationsSource).toContain('if (!mobile && searchInput) {');
        expect(favoriteLocationsSource).toContain('searchInput.focus();');
        expect(favoriteLocationsSource).toContain(
            "panelElement?.querySelector<HTMLButtonElement>('.favorite-locations__close')?.focus();",
        );
    });

    it('adds accessible mobile map-fit and search-zoom controls to the window toolbar', () => {
        expect(pluginSource).toContain('class="mobile-window-control mobile-map-fit-toggle"');
        expect(pluginSource).toContain('class="mobile-window-control mobile-map-detail-toggle"');
        expect(pluginSource).toContain('<path d="M7 12h10"></path>');
        expect(pluginSource).toContain('<path d="M7 12h10M12 7v10"></path>');
        expect(pluginSource).toContain('disabled={!canFitDirectionLines}');
        expect(pluginSource).toContain('paths: selectObservationPaths(solarPaths, selectedEvent)');
        expect(pluginSource).toContain(
            'aria-label={text.fitDirectionLinesLabel(formatDistanceLabel(showExtendedDistanceMarker ? 600 : 400, units.distance))}',
        );
        expect(pluginSource).toContain('aria-label={text.restoreSearchZoomLabel}');
        expect(pluginSource).toContain('paddingBottomRight: visibleViewport.fitPaddingBottomRight');
        expect(pluginSource).toContain('duration: 0.45');
        expect(pluginSource).toContain('--mobile-window-control-width: 36px;');
        expect(pluginSource).toContain('--mobile-window-control-gap: 0px;');
        expect(pluginSource).toMatch(
            /plugin-mobile-bottom-small > \.closing-x\)\s*{[\s\S]*?justify-content: center;/,
        );
        expect(pluginSource).toContain('recenterSelectedLocationInVisibleMap(SEARCH_LOCATION_ZOOM);');
        expect(pluginSource).toContain('paddingTop: visibleViewport.centerPaddingTop');
        expect(pluginSource).toContain('paddingLeft: visibleViewport.centerPaddingLeft');
        expect(pluginSource).toContain('MOBILE_MAP_RECENTER_DELAY_MS');
        expect(pluginSource).toContain('clearTimeout(mapDetailRecenterTimer)');
        expect(pluginSource).toContain("fitDirectionLinesLabel: distance => `完整显示 ${distance} 方位线`");
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

    it('adds a persistent RainViewer quick toggle beside the map controls', () => {
        expect(pluginSource).toContain('class="desktop-map-control desktop-radar-toggle"');
        expect(pluginSource).toContain('class="mobile-window-control mobile-radar-toggle"');
        expect(pluginSource).toContain("aria-pressed={radarProvider === 'rainviewer'}");
        expect(pluginSource).toContain('on:click|stopPropagation={toggleRadarOverlay}');
        expect(pluginSource).toContain('on:click={toggleRadarOverlay}');
        expect(pluginSource).toContain('const toggleRadarOverlay = () => {');
        expect(pluginSource).toContain("setRadarProvider(radarProvider === 'rainviewer' ? 'none' : 'rainviewer');");
        expect(pluginSource).toContain("enableRadarOverlayLabel: '开启气象雷达叠加'");
        expect(pluginSource).toContain("disableRadarOverlayLabel: 'Disable radar overlay'");
        expect(pluginSource).toMatch(
            /\.desktop-radar-toggle\[aria-pressed='true'\][\s\S]*?color: var\(--panel-accent\);/,
        );
        expect(pluginSource).toMatch(
            /\.mobile-radar-toggle\[aria-pressed='true'\] \.mobile-window-control__icon[\s\S]*?color: var\(--panel-accent\);/,
        );
    });

    it('adds delayed native hints to compact and icon-only controls', () => {
        expect(pluginSource).toContain('title={text.eventButtonTitles[option.value]}');
        expect(pluginSource).toContain('title={text.languageToggleLabel}');
        expect(pluginSource).toContain(
            'title={text.locationFavoritesLabel(\n                                    locationDisplayName || text.locationResolvingLabel,\n                                )}',
        );
        expect(pluginSource).toContain("all: '显示全部日月事件方位线'");
        expect(pluginSource).toContain("moonset: 'Show only moonset direction lines'");
        expect(favoriteLocationsSource).toContain(
            'class="favorite-locations__close" aria-label={text.close} title={text.close}',
        );
        expect(favoriteComparisonSource).toContain(
            'class="icon-button" aria-label={text.back} title={text.back}',
        );
        expect(favoriteComparisonSource).toContain(
            'class="icon-button" aria-label={text.close} title={text.close}',
        );
    });

    it('keeps the summary-tab focus indicator inside the clipped module', () => {
        expect(pluginSource).toMatch(
            /\.summary-tabs button:focus-visible\s*{[\s\S]*?outline: none;[\s\S]*?box-shadow: inset 0 0 0 2px var\(--panel-accent\);/,
        );
    });

    it('checks for updates on mount, marks the About tab, and presents user-facing notes', () => {
        expect(pluginSource).toContain("isMounted && pluginUpdateStatus === 'idle'");
        expect(pluginSource).not.toContain("summaryTab === 'about' && pluginUpdateStatus === 'idle'");
        expect(pluginSource).toContain('checkPluginUpdate({');
        expect(pluginSource).toContain('betaNotesUrl: betaReleaseNotesUrl');
        expect(pluginSource).toContain('let pluginUpdateReminderSeenVersion = readPluginUpdateReminderSeenVersion({');
        expect(pluginSource).toContain('readPluginUpdateReminderSeenVersion({');
        expect(pluginSource).toContain('writePluginUpdateReminderSeenVersion({');
        expect(pluginSource).toContain("pluginUpdateReminderVersion = result.status === 'available'");
        expect(pluginSource).toContain("nextTab === 'about' && pluginUpdateReminderVersion");
        expect(pluginSource).toContain('rememberPluginUpdateReminder(pluginUpdateReminderVersion);');
        expect(pluginSource).toContain('aria-label={pluginUpdateReminderVersion');
        expect(pluginSource).toContain('class="summary-tab__badge" aria-hidden="true"');
        expect(pluginSource).toContain('{text.aboutTabUpdateBadge}');
        expect(pluginSource).toContain('role="status" aria-live="polite" aria-atomic="true"');
        expect(pluginSource).toContain('text.aboutTabUpdateLabel(pluginUpdateReminderVersion)');
        expect(pluginSource).toContain('void refreshPluginUpdate();');
        expect(pluginSource).toMatch(
            /catch \(error\) \{[\s\S]*?pluginUpdateStatus = 'error';[\s\S]*?\} finally/,
        );
        expect(pluginSource).toContain("pluginUpdateResult.channel === 'beta'");
        expect(pluginSource).toContain("aboutBetaAvailable: '测试版更新预览'");
        expect(pluginSource).toContain("aboutUpdateAvailable: '发现新版本'");
        expect(pluginSource).not.toContain('{#if pluginUpdateResult.releaseUrl}');
        expect(pluginSource).toContain('on:click={copyLatestPluginLink}');
        expect(pluginSource).toContain('navigator.clipboard.writeText(latestPluginUrl);');
        expect(pluginSource).toContain('selectPluginLinkVersion(pluginVersion, pluginUpdateResult)');
        expect(pluginSource).toContain('https://windy-plugins.com/17629746/${name}/${latestPluginVersion}/plugin.min.js');
        expect(pluginSource).toContain("aboutCopyLatestPluginLink: version => `复制 ${version} 插件链接`");
        expect(pluginSource).toContain("aboutPluginLinkCopied: version => `已复制 ${version} 插件链接`");
        expect(pluginSource).toContain("aboutPluginLinkCopyError: '复制失败，请重试'");
        expect(pluginSource).toContain('role="status" aria-live="polite" aria-atomic="true"');
        expect(pluginSource.indexOf('class="about-update__actions"')).toBeLessThan(
            pluginSource.indexOf('class="about-update__notes"'),
        );
        expect(pluginSource).toContain("class:about-update--compact={pluginUpdateStatus !== 'available' && pluginUpdateStatus !== 'current'}");
        expect(pluginSource).toContain('role="status" aria-live="polite"');
        expect(pluginSource).toContain('{#each localizedUpdateNotes as releaseNote}');
        expect(pluginSource).toContain('{releaseNote.version}');
        expect(pluginSource).toContain('{releaseNote.notes.title}');
        expect(pluginSource).toContain("pluginUpdateStatus === 'current'");
        expect(pluginSource).toContain('? text.aboutUpdateCurrent');
        expect(pluginSource).toContain('{text.aboutUpdateTypeLabels[item.type]}');
        expect(pluginSource).toContain('on:click={retryPluginUpdate}');
        expect(pluginSource).toContain("pluginUpdateResult.notesStatus === 'error'");
        expect(pluginSource).toContain('on:click={retryPluginUpdateNotes}');
        expect(pluginSource).toContain('text.aboutUpdateNotesRetry');
        expect(pluginSource).toContain('let pluginUpdateNotesRetrying = false;');
        expect(pluginSource).toContain('{text.aboutAuthorLabel}');
        expect(pluginSource).toContain('{text.aboutVersionLabel}');
        expect(pluginSource).toContain('{text.aboutCurrentVersionDateLabel}');
        expect(pluginConfigSource).toContain("export const currentVersionReleasedAt = '2026-08-31';");
        expect(pluginSource).toContain("import config, { currentVersionReleasedAt } from './pluginConfig';");
        expect(pluginSource).toContain('class="about-meta__date"');
        expect(pluginSource).toContain('<time datetime={currentVersionReleasedAt}>{currentVersionReleasedAt}</time>');
        expect(pluginSource).toContain("aboutCurrentVersionDateLabel: '更新日期'");
        expect(pluginSource).toContain("aboutCurrentVersionDateLabel: 'Updated'");
        expect(pluginSource).not.toContain('{text.aboutCurrentVersionLabel}');
        expect(pluginSource).not.toContain('{text.aboutLatestVersionLabel}');
        expect(pluginSource).not.toContain('{text.aboutUpdateDateLabel}');
        expect(pluginSource).not.toContain('class="about-update__release-date"');
        expect(pluginSource).not.toContain('<time datetime={pluginUpdateResult.releasedAt}>');
        expect(pluginSource).toContain("aboutVersionLabel: '版本'");
        expect(pluginSource).toContain("aboutUpdateNotesUnavailable: '版本更新说明暂时无法加载。'");
        expect(pluginSource).not.toContain('aboutUpdateReleaseLink');
        expect(pluginSource).toMatch(
            /\.about-update--compact\s*{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto;[\s\S]*?align-items: center;/,
        );
        expect(pluginSource).toMatch(
            /\.about-update\s*{[\s\S]*?box-sizing: border-box;/,
        );
        expect(pluginSource).toMatch(
            /\.about-update--compact\s*{[\s\S]*?padding: 0;/,
        );
        expect(pluginSource).toMatch(
            /\.sun-path-panel\.mobile_ui \.about-update button\s*{[\s\S]*?min-height: 32px;/,
        );
        expect(pluginConfigSource).toContain("version: '0.9.1'");
        expect(pluginSource).toMatch(
            /\.summary-tab__badge\s*{[\s\S]*?white-space: nowrap;[\s\S]*?background: var\(--panel-accent\);/,
        );
        expect(pluginSource).toMatch(
            /\.about-update__header\s*{[\s\S]*?display: flex;[\s\S]*?flex-wrap: wrap;/,
        );
        expect(pluginSource).toMatch(
            /\.about-hero__header\s*{[^}]*align-items: end;[^}]*}/,
        );
        expect(pluginSource).toMatch(
            /\.about-hero__copy strong\s*{[^}]*font-size: 12px;[^}]*}/,
        );
        expect(pluginSource).toMatch(
            /\.about-meta\s*{[^}]*grid-template-columns: repeat\(3, auto\);[^}]*grid-template-rows: auto auto;[^}]*grid-auto-flow: column;[^}]*align-items: baseline;[^}]*}/,
        );
        expect(pluginSource).toMatch(
            /\.about-meta div\s*{[^}]*display: contents;[^}]*}/,
        );
        expect(pluginSource).not.toMatch(/\.about-meta__date dd\s*{/);
    });

    it('uses the Events-tab height as a fixed non-scrolling compact mobile shell', () => {
        const compactScrollLockStart = pluginSource.indexOf(
            '.sun-path-panel.mobile_ui.mobile_compact:not(.mobile_fullscreen) .mobile-scroll-content',
        );
        const landscapeMediaStart = pluginSource.indexOf('@media (orientation: landscape)');

        expect(pluginSource).toContain("&& mobilePanelMode === 'compact'");
        expect(pluginSource).toContain("&& summaryTab === 'events'");
        expect(pluginSource).toContain("&& nestedScroller.matches('.astronomy-panel')");
        expect(pluginSource).toContain('Do not transfer its boundary');
        expect(pluginSource).toContain(
            'class:mobile_compact={isMobileOrTablet && !isMobileCollapsed && !isMobileFullscreen}',
        );
        expect(pluginSource).toContain(
            "'sun-path-mobile-compact',\n            isMobileOrTablet && !isMobileCollapsed && !isMobileFullscreen,",
        );
        expect(compactScrollLockStart).toBeGreaterThanOrEqual(0);
        expect(compactScrollLockStart).toBeLessThan(landscapeMediaStart);
        expect(pluginSource).toMatch(
            /\.sun-path-panel\.mobile_ui\.mobile_compact:not\(\.mobile_fullscreen\) \.mobile-scroll-content\s*{[\s\S]*?overflow: clip;[\s\S]*?overscroll-behavior-y: none;/,
        );
        expect(pluginSource).toContain(
            "mobilePluginRoot?.classList.remove('sun-path-mobile-compact');",
        );
        expect(pluginSource).toMatch(
            /\.sun-path-panel\.mobile_ui\.mobile_compact \.astronomy-panel\s*{[\s\S]*?overflow-y: clip;[\s\S]*?overscroll-behavior-y: none;[\s\S]*?touch-action: none;/,
        );
        expect(pluginSource).toMatch(
            /\.sun-path-panel\.mobile_ui \.summary-tabs\s*{[\s\S]*?grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);/,
        );
        expect(pluginSource).not.toContain('@media (orientation: portrait)');
        expect(pluginSource).not.toContain('sun-path-mobile-events');
        expect(pluginSource).not.toContain('mobile_events');
    });

    it('pins the selected location without blocking explicit location controls', () => {
        expect(pluginSource).toContain('class="astronomy-location__pin"');
        expect(pluginSource).toContain('class:pinned={locationPinned}');
        expect(pluginSource).toContain('aria-pressed={locationPinned}');
        expect(pluginSource).toContain("pinCurrentLocationLabel: '钉住当前地点'");
        expect(pluginSource).toContain("unpinCurrentLocationLabel: 'Unpin current location'");
        expect(pluginSource).toContain('const toggleLocationPinned = () => {');

        const mapClickStart = pluginSource.indexOf('const setLocationFromMapClick =');
        const mapClickEnd = pluginSource.indexOf('const selectLocationSearchResult =', mapClickStart);
        const mapClickSource = pluginSource.slice(mapClickStart, mapClickEnd);
        expect(mapClickSource).toContain('if (locationPinned) {');
        expect(mapClickSource).toContain('return;');

        const searchSelectionStart = pluginSource.indexOf('const selectLocationSearchResult =');
        const searchSelectionEnd = pluginSource.indexOf('const handleLocationSearchSelect =', searchSelectionStart);
        const searchSelectionSource = pluginSource.slice(searchSelectionStart, searchSelectionEnd);
        expect(searchSelectionSource).not.toContain('locationPinned');
        expect(pluginSource).toMatch(
            /\.astronomy-location__pin\.pinned\s*{[\s\S]*?color: var\(--panel-accent\);/,
        );
        expect(pluginSource).toContain(
            '.astronomy-location__pin.pinned .astronomy-location__pin-head',
        );
        expect(pluginSource).toMatch(
            /\.astronomy-location__favorite svg\s*{[\s\S]*?transform: translateX\(3px\);/,
        );
        expect(pluginSource).toMatch(
            /\.astronomy-location__pin svg\s*{[\s\S]*?transform: translateX\(-3px\);/,
        );
    });

    it('applies the selected Windy layer immediately and on later plugin opens', () => {
        expect(pluginSource).toContain('class="settings-select"');
        expect(pluginSource).toContain('<label for="initial-overlay">{text.initialOverlayLabel}</label>');
        expect(pluginSource).toContain('aria-describedby="initial-overlay-description"');
        expect(pluginSource).toContain('<option value={KEEP_CURRENT_OVERLAY}>');
        expect(pluginSource).toContain('{#each initialOverlayOptions as option}');
        expect(pluginSource).toContain('.filter(overlay => !overlay.partOf)');
        expect(pluginSource).toContain('label: overlay.getMenuName()');
        expect(pluginSource).toContain('orderInitialOverlayOptions(Array.from(new Map(');
        expect(pluginSource).toContain('initialOverlayPreference = loadInitialOverlayPreference();');
        expect(pluginSource).toContain('applyInitialOverlayPreference(initialOverlayPreference);');
        const changeHandlerStart = pluginSource.indexOf('const changeInitialOverlayPreference =');
        const changeHandlerEnd = pluginSource.indexOf('const applyInitialOverlayPreference =', changeHandlerStart);
        const changeHandlerSource = pluginSource.slice(changeHandlerStart, changeHandlerEnd);
        expect(changeHandlerSource).toContain('saveInitialOverlayPreference(nextPreference);');
        expect(changeHandlerSource).toContain('void applyInitialOverlayPreference(nextPreference);');
        expect(pluginSource).toContain("store.set('overlay', preference, {");
        expect(pluginSource).toContain("await store.set('overlay', preference, {");
        expect(pluginSource).toContain('doNotSaveToCloud: true');
        expect(pluginSource).toContain('doNotStore: true');
        expect(pluginSource).toContain('recenterSelectedLocationInVisibleMap(map.getZoom());');
        expect(pluginSource).toContain("initialOverlayLabel: '打开插件时的图层'");
        expect(pluginSource).toContain('选择后立即切换到对应 Windy 图层');
        expect(pluginSource).toContain("keepCurrentOverlayLabel: 'Keep Windy’s current layer'");
        expect(pluginSource).toMatch(
            /\.settings-select select\s*{[\s\S]*?height: 30px;[\s\S]*?cursor: pointer;/,
        );
    });

    it('adds the keyless RainViewer radar overlay with local display preferences', () => {
        expect(pluginSource).toContain("import {\n        createRadarOverlayController,");
        expect(pluginSource).toContain('<label for="radar-provider">{text.radarProviderLabel}</label>');
        expect(pluginSource).toContain('{#each RADAR_PROVIDERS as providerOption}');
        expect(pluginSource).toContain("rainviewer: 'RainViewer（无需 Key）'");
        expect(pluginSource).toContain("{#if radarProvider === 'rainviewer'}");
        expect(pluginSource).toContain('{text.rainViewerDescription}');
        expect(pluginSource).toContain("windy-plugin-sun-moon-path:radar-provider");
        expect(pluginSource).toContain('role="status"');
        expect(pluginSource).toContain('aria-live="polite"');
        expect(pluginSource).not.toContain('rainviewer-api-key');
        expect(pluginSource).not.toContain("{#if radarProvider !== 'none'}");
        expect(pluginSource).toContain('id="radar-overlay-opacity"');
        expect(pluginSource).toContain('{radarOpacityPercent}%');
        expect(pluginSource).toContain('on:input={changeRadarOpacity}');
        expect(pluginSource).toContain("windy-plugin-sun-moon-path:radar-opacity");
        expect(pluginSource).toContain('radarOverlayController.setOpacity(radarOpacityPercent);');
        expect(pluginSource).toContain("radarOpacityLabel: '雷达图层透明度'");
        expect(pluginSource).toContain("radarOpacityLabel: 'Radar overlay opacity'");

        const radarOpacityStart = pluginSource.indexOf('class="settings-range settings-range--radar-opacity"');
        const radarProviderStart = pluginSource.indexOf('class="settings-select settings-radar-source"');
        expect(radarProviderStart).toBeGreaterThanOrEqual(0);
        expect(radarOpacityStart).toBeGreaterThan(radarProviderStart);
        expect(pluginSource).toContain('窗口雷达按钮与此设置同步，任一处都可直接开关');
        expect(pluginSource).toContain('The window radar button and this setting stay synchronized');
    });

    it('starts the selected radar overlay on mount and destroys it with the unified cleanup path', () => {
        expect(pluginSource).toContain('radarOverlayController = createRadarOverlayController(map, nextStatus => {');
        expect(pluginSource).toContain('radarProvider = loadRadarProvider();');
        expect(pluginSource).toContain('radarOpacityPercent = loadRadarOpacityPreference();');
        expect(pluginSource).toContain('clearRemovedRadarCredentials();');
        expect(pluginSource).toContain("radarOverlayController.setTimestamp(store.get('timestamp'));");
        expect(pluginSource).toContain("radarTimestampSubscriptionId = store.on('timestamp', syncRadarTimestamp);");
        expect(pluginSource).toContain('void applyRadarProvider();');
        expect(pluginSource).toContain('radarOverlayController.destroy();');

        const cleanupStart = pluginSource.indexOf('deactivateForReplacement: () => {');
        const cleanupEnd = pluginSource.indexOf('\n        },\n    };', cleanupStart);
        const cleanupSource = pluginSource.slice(cleanupStart, cleanupEnd);
        expect(cleanupSource).toContain('mapOverlayController.destroy();');
        expect(cleanupSource).toContain('radarOverlayController.destroy();');
        expect(cleanupSource).toContain('store.off(radarTimestampSubscriptionId);');
        expect(pluginSource).not.toContain('<RadarTimeline');
    });

    it('follows Windy units while preserving canonical weather and location data', () => {
        expect(weatherSource).toContain('windMs: wind === null ? null : roundTo(Math.max(0, wind), 1)');
        expect(weatherSource).not.toContain('Math.max(0, wind) * 3.6');
        expect(unitPreferencesSource).toContain('metrics.wind.convertNumber(windMs, forcedPrecision, unit)');
        expect(unitPreferencesSource).toContain('metrics.temp.convertNumber(temperatureC + 273.15');
        expect(unitPreferencesSource).toContain('metrics.rain.convertNumber(precipitationMm');
        expect(unitPreferencesSource).toContain('metrics.distance.convertNumber(distanceKm * 1_000');
        expect(unitPreferencesSource).toContain('metrics.elevation.convertNumber(elevationM');
        expect(unitPreferencesSource).toContain("unit === 'bft' ? 'bft/m/s' : unit");
        expect(unitPreferencesSource).not.toContain('setMetric(');
        expect(weatherTableSource).toContain('export let units: UnitPreferences;');
        expect(weatherTableSource).toContain('metricValueText(metric, value, units)');
        expect(weatherTableSource).toContain('formatWindSpeed(value, selectedUnits.wind)');
        expect(weatherTableSource).toContain('formatTemperatureC(value, selectedUnits.temperature)');
        expect(weatherTableSource).toContain('formatPrecipitationMm(value, selectedUnits.precipitation)');
        expect(weatherTableSource).toContain('formatVisibilityKm(value, selectedUnits.distance)');
        expect(favoriteComparisonSource).toContain('metric.evidenceField,\n                                            units,');
        expect(favoriteComparisonSource).toContain('formatWindSpeedRange(range, selectedUnits.wind)');
        expect(favoriteComparisonSource).toContain('formatTemperatureRangeC(range, selectedUnits.temperature)');
        expect(favoriteComparisonSource).toContain('formatPrecipitationRangeMm(range, selectedUnits.precipitation)');
        expect(favoriteComparisonSource).toContain('formatVisibilityRangeKm(range, selectedUnits.distance)');
        expect(favoriteLocationsSource).toContain('export let units: UnitPreferences;');
        expect(favoriteLocationsSource).toContain('formatDistanceKm(item.distanceKm, selectedUnits.distance)');
        expect(favoriteLocationsSource).toContain('formatElevationM(value, selectedUnits.elevation)');
        expect(locationSearchSource).toContain('export let units: UnitPreferences;');
        expect(locationSearchSource).toContain('formatDistanceKm(distanceKm, selectedUnits.distance)');
        expect(locationSearchSource).toContain('formatElevationM(elevationM as number, selectedUnits.elevation)');
        expect(pluginSource).toContain('formatDistance: distanceKm => formatDistanceLabel(distanceKm, units.distance)');
        expect(pluginSource).toContain(
            'openUpward={isMobileCollapsed}\n        {units}\n        on:back={handleFavoriteComparisonBack}',
        );
        expect(pluginSource).not.toContain(
            'openUpward={isMobileCollapsed}\n        {units}\n        on:select={handleFavoriteLocationSelect}',
        );
        expect(pluginSource).toContain('units = currentUnitPreferences();');
        expect(pluginSource).toContain(
            'const nextUnits = resolveUnitPreferencesChange(units, ident, unit, currentUnitPreferences);',
        );
        expect(pluginSource).toContain("bcast.on('metricChanged', handleMetricChange);");
        expect(pluginSource).toContain("bcast.off('metricChanged', handleMetricChange);");
        expect(pluginSource).not.toContain('metrics.wind.setMetric');
    });

    it('mounts the actual provider frame time above Windy’s native timecode and removes it on close', () => {
        expect(pluginSource).toContain("import {\n        createRadarFrameTimeLabel,");
        expect(pluginSource).toContain('radarFrameTimeMs = radarOverlayController?.getActiveFrameTime() ?? null;');
        expect(pluginSource).toContain('radarFrameTimeLabelController = createRadarFrameTimeLabel();');
        expect(pluginSource).toContain('radarFrameTimeLabelController?.destroy();');
        expect(pluginSource).toContain(':global(.sun-path-radar-frame-time)');
        expect(pluginSource).toMatch(/\.sun-path-radar-frame-time\)\s*{[\s\S]*?position: fixed;[\s\S]*?z-index: 10000;[\s\S]*?pointer-events: none;/);
        expect(radarFrameTimeLabelSource).toContain("window.addEventListener('resize', schedulePosition);");
        expect(radarFrameTimeLabelSource).toContain('observer.disconnect();');
        expect(radarFrameTimeLabelSource).toContain('resizeObserver.disconnect();');
        expect(radarFrameTimeLabelSource).toContain("window.removeEventListener('resize', schedulePosition);");
        expect(radarFrameTimeLabelSource).toContain('element.remove();');
    });

    it('routes map, layer, and mobile panel state changes through the visible map center', () => {
        expect(pluginSource.match(/centerMap\(/g)).toHaveLength(1);
        expect(pluginSource).toContain('const centerSelectedLocationInVisibleMap = (zoom: number) => {');
        expect(pluginSource).toContain('const recenterSelectedLocationInVisibleMap = (zoom: number) => {');
        expect(pluginSource).toContain('paddingTop: visibleViewport.centerPaddingTop');
        expect(pluginSource).toContain('paddingLeft: visibleViewport.centerPaddingLeft');

        const mobileModeStart = pluginSource.indexOf('const setMobilePanelMode = async');
        const mobileModeEnd = pluginSource.indexOf('const toggleMobileCollapsed =', mobileModeStart);
        const mobileModeSource = pluginSource.slice(mobileModeStart, mobileModeEnd);
        expect(mobileModeSource).toContain('await tick();');
        expect(mobileModeSource).toContain('recenterSelectedLocationInVisibleMap(map.getZoom());');

        const searchSelectionStart = pluginSource.indexOf('const selectLocationSearchResult =');
        const searchSelectionEnd = pluginSource.indexOf('const handleLocationSearchSelect =', searchSelectionStart);
        expect(pluginSource.slice(searchSelectionStart, searchSelectionEnd)).toContain(
            'recenterSelectedLocationInVisibleMap(SEARCH_LOCATION_ZOOM);',
        );

        const gpsStart = pluginSource.indexOf('const centerOnCurrentGps =');
        const gpsEnd = pluginSource.indexOf('const syncLocationFromMapCenter =', gpsStart);
        expect(pluginSource.slice(gpsStart, gpsEnd)).toContain('recenterSelectedLocationInVisibleMap(6);');

        const openStart = pluginSource.indexOf('export const onopen =');
        const openEnd = pluginSource.indexOf('const overlayOwner =', openStart);
        expect(pluginSource.slice(openStart, openEnd)).toContain('recenterSelectedLocationInVisibleMap(6);');
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

    it('uses one vertical gap between every top-level settings item', () => {
        const settingsStyle = pluginSource.match(
            /\.module-settings\s*{([\s\S]*?)\n\s*}/,
        )?.[1];

        expect(settingsStyle).toContain('gap: 6px;');
        expect(pluginSource).not.toContain('settings-toggle--location-search');

        const apiKeyStyle = pluginSource.match(
            /\.settings-api-key\s*{([\s\S]*?)\n\s*}/,
        )?.[1];
        expect(apiKeyStyle).toContain('gap: 4px;');
        expect(apiKeyStyle).toContain('padding: 7px 10px;');
        expect(pluginSource).toMatch(
            /\.settings-api-key__control input\s*{[\s\S]*?height: 30px;/,
        );
        expect(pluginSource).toMatch(
            /\.settings-api-key__control button\s*{[\s\S]*?min-height: 30px;/,
        );
        expect(pluginSource).toMatch(
            /\.sun-path-panel\.mobile_ui \.settings-select select,\s*\.sun-path-panel\.mobile_ui \.settings-api-key__control input\s*{[\s\S]*?height: 44px;/,
        );
        expect(pluginSource).toMatch(
            /\.sun-path-panel\.mobile_ui \.settings-api-key__control button\s*{[\s\S]*?min-height: 44px;/,
        );
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
        expect(locationSearchSource).toContain('export let mobile = false;');
        expect(pluginSource).toContain('mobile={isMobileOrTablet}');
        expect(pluginSource).toContain('provider={locationSearchProvider}');
        expect(pluginSource).toContain('<LocationSearch');
        expect(locationSearchSource).toContain('focusOption = false');
        expect(locationSearchSource).toContain('if (focusOption) {');
        expect(locationSearchSource).toContain('const keyboardActivated = event.detail === 0;');
        expect(locationSearchSource).toContain(
            'openSelectorMenu(selectorOptions.indexOf(selectorValue), !mobile || keyboardActivated);',
        );
        expect(locationSearchSource).toContain('on:click={handleSelectorButtonClick}');
        expect(locationSearchSource).toMatch(
            /openSelectorMenu\([\s\S]*?\(selectedIndex - 1 \+ selectorOptions\.length\) % selectorOptions\.length,[\s\S]*?true,[\s\S]*?\);/,
        );
        expect(mobileSearchStyle).toContain('width: 72px;');
        expect(mobileSearchStyle).toContain('min-width: 72px;');
        expect(mobileSearchStyle).toContain('gap: 4px;');
        expect(mobileSearchStyle).toContain('padding: 0 4px;');
    });

    it('documents the current user-facing features in usage order in both languages', () => {
        const guideStart = pluginSource.indexOf("{:else if summaryTab === 'guide'}");
        const settingsStart = pluginSource.indexOf("{:else if summaryTab === 'settings'}", guideStart);
        const guideSource = pluginSource.slice(guideStart, settingsStart);
        const coordinatesStart = guideSource.indexOf('{text.featureGuide.coordinates.title}');
        const favoritesStart = guideSource.indexOf('{text.featureGuide.favorites.title}');
        const comparisonStart = guideSource.indexOf('{text.featureGuide.comparison.title}');
        const evidenceStart = guideSource.indexOf('{text.featureGuide.observationEvidence.title}');
        const mapControlsStart = guideSource.indexOf('{text.featureGuide.mapControls.title}');
        const radarOverlayStart = guideSource.indexOf('{text.featureGuide.radarOverlay.title}');
        const mobileModeStart = guideSource.indexOf('{text.featureGuide.mobileMode.title}');

        expect(guideSource).toContain('id="feature-guide-heading"');
        expect(guideSource).toContain('id="button-hints-heading"');
        expect(guideSource).toContain('{text.buttonHintsDescription}');
        expect(coordinatesStart).toBeGreaterThanOrEqual(0);
        expect(mapControlsStart).toBeGreaterThan(coordinatesStart);
        expect(radarOverlayStart).toBeGreaterThan(mapControlsStart);
        expect(evidenceStart).toBeGreaterThan(radarOverlayStart);
        expect(favoritesStart).toBeGreaterThan(evidenceStart);
        expect(comparisonStart).toBeGreaterThan(favoritesStart);
        expect(mobileModeStart).toBeGreaterThan(comparisonStart);
        expect(pluginSource).toContain("featureGuideHeading: '功能说明'");
        expect(pluginSource).toContain("featureGuideHeading: 'Feature guide'");
        expect(pluginSource).not.toContain('0.8.0 新增功能');
        expect(pluginSource).not.toContain('What’s new in 0.8.0');
        expect(pluginSource).toContain("title: '收藏地点对比'");
        expect(pluginSource).toContain("title: 'Favorite location comparison'");
        expect(pluginSource).toContain("title: '地图视图按钮'");
        expect(pluginSource).toContain("title: 'Map view controls'");
        expect(pluginSource).toContain("buttonHintsHeading: '按钮提示'");
        expect(pluginSource).toContain("buttonHintsHeading: 'Button hints'");
        expect(pluginSource).toContain("title: '气象雷达叠加'");
        expect(pluginSource).toContain("title: 'Weather radar overlay'");
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

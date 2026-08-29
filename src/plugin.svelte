<section
    id="sun-moon-path-panel"
    class="sun-path-panel"
    class:plugin__content={!isMobileOrTablet}
    class:mobile_ui={isMobileOrTablet}
    class:mobile_collapsed={isMobileCollapsed}
    class:mobile_fullscreen={isMobileFullscreen}
    class:favorites_open={favoritesOpen || favoriteComparisonOpen}
    bind:this={panelElement}
    on:wheel|capture|nonpassive={handleNestedWheel}
>
    {#if !isMobileOrTablet}
        <div
            class="plugin__title plugin__title--chevron-back panel-title"
            on:click={() => bcast.emit('rqstOpen', 'menu')}
        >
            <span class="panel-title__text">{title}</span>
            <span class="desktop-map-controls">
                <button
                    type="button"
                    class="desktop-map-control desktop-map-fit-control"
                    aria-label={text.fitDirectionLinesLabel(showExtendedDistanceMarker ? 600 : 400)}
                    title={text.fitDirectionLinesLabel(showExtendedDistanceMarker ? 600 : 400)}
                    disabled={!canFitDirectionLines}
                    on:click|stopPropagation={fitVisibleDirectionLines}
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M7 12h10"></path>
                    </svg>
                </button>
                <button
                    type="button"
                    class="desktop-map-control desktop-map-detail-control"
                    aria-label={text.restoreSearchZoomLabel}
                    title={text.restoreSearchZoomLabel}
                    on:click|stopPropagation={restoreSearchLocationZoom}
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M7 12h10M12 7v10"></path>
                    </svg>
                </button>
            </span>
        </div>
    {/if}

    {#if isMobileOrTablet}
        {#if !isMobileFullscreen}
            <button
                type="button"
                class="mobile-window-control mobile-map-fit-toggle"
                aria-label={text.fitDirectionLinesLabel(showExtendedDistanceMarker ? 600 : 400)}
                title={text.fitDirectionLinesLabel(showExtendedDistanceMarker ? 600 : 400)}
                disabled={!canFitDirectionLines}
                on:click={fitVisibleDirectionLines}
            >
                <span class="mobile-window-control__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                        <path d="M7 12h10"></path>
                    </svg>
                </span>
            </button>

            <button
                type="button"
                class="mobile-window-control mobile-map-detail-toggle"
                aria-label={text.restoreSearchZoomLabel}
                title={text.restoreSearchZoomLabel}
                on:click={restoreSearchLocationZoom}
            >
                <span class="mobile-window-control__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                        <path d="M7 12h10M12 7v10"></path>
                    </svg>
                </span>
            </button>
        {/if}

        <button
            type="button"
            class="mobile-window-control mobile-collapse-toggle"
            aria-controls="sun-moon-path-panel"
            aria-expanded={!isMobileCollapsed}
            aria-label={isMobileCollapsed ? text.expandCompactPanelLabel : text.collapsePanelLabel}
            title={isMobileCollapsed ? text.expandCompactPanelLabel : text.collapsePanelLabel}
            on:click={toggleMobileCollapsed}
        >
            <span class="mobile-window-control__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                    {#if isMobileCollapsed}
                        <path d="m5 15 7-7 7 7"></path>
                    {:else}
                        <path d="m5 9 7 7 7-7"></path>
                    {/if}
                </svg>
            </span>
        </button>

        <button
            type="button"
            class="mobile-window-control mobile-window-toggle"
            aria-controls="sun-moon-path-panel"
            aria-expanded={isMobileFullscreen}
            aria-label={isMobileFullscreen ? text.restorePanelLabel : text.expandPanelLabel}
            title={isMobileFullscreen ? text.restorePanelLabel : text.expandPanelLabel}
            on:click={toggleMobileFullscreen}
        >
            <span class="mobile-window-control__icon" aria-hidden="true">
                {#if isMobileFullscreen}
                    <svg viewBox="0 0 24 24" focusable="false">
                        <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"></path>
                    </svg>
                {:else}
                    <svg viewBox="0 0 24 24" focusable="false">
                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
                    </svg>
                {/if}
            </span>
        </button>
    {/if}

    <div class="mobile-scroll-content">
    <div class="panel-intro">
        <p>{text.panelIntro}</p>
    </div>

    <div class="primary-controls">
    {#if !hideLocationSearch}
        <div
            class="location-tools"
            on:focusin={handleLocationToolsFocusIn}
        >
            <LocationSearch
                apiKeys={locationApiKeys}
                language={uiLanguage}
                location={selectedLocation}
                mobile={isMobileOrTablet}
                provider={locationSearchProvider}
                on:providerchange={handleLocationProviderChange}
                on:select={handleLocationSearchSelect}
            />
        </div>
    {/if}

    <div
        class="control-grid control-grid--favorites"
    >
        <label class="control-field">
            <span class="control-label">{text.dateLabel}</span>
            <span class="date-control">
                <span class="date-control__text">{formatDateControlLabel(selectedDate)}</span>
                <input
                    type="date"
                    bind:value={selectedDate}
                    aria-label={text.dateLabel}
                    on:click={openDatePicker}
                />
            </span>
        </label>

        <fieldset class="event-selector">
            <legend class="control-label">{text.eventSelectorLabel}</legend>
            <div class="segmented-control segmented-control--events" role="group" aria-label={text.eventSelectorLabel}>
                {#each eventOptions as option}
                    <button
                        type="button"
                        class:active={selectedEvent === option.value}
                        aria-pressed={selectedEvent === option.value}
                        aria-label={text.events[option.value]}
                        on:click={() => selectEvent(option.value)}
                    >
                        {#if option.value === 'all'}
                            <span class="event-button__text">{text.events.all}</span>
                        {:else}
                            <span
                                class:event-button__icon--moon={option.value === 'moonrise' || option.value === 'moonset'}
                                class:event-button__icon--sun={option.value === 'sunrise' || option.value === 'sunset'}
                                class="event-button__icon"
                                aria-hidden="true"
                            >
                                {#if option.value === 'sunrise' || option.value === 'sunset'}
                                    <svg viewBox="0 0 24 24" focusable="false">
                                        <circle cx="12" cy="12" r="4.2"></circle>
                                        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"></path>
                                    </svg>
                                {:else}
                                    <svg viewBox="0 0 24 24" focusable="false">
                                        <path d="M19.6 15.2A8.4 8.4 0 0 1 8.8 4.4A8.6 8.6 0 1 0 19.6 15.2Z"></path>
                                    </svg>
                                {/if}
                            </span>
                            <span
                                class:event-button__arrow--down={option.value === 'sunset' || option.value === 'moonset'}
                                class="event-button__arrow"
                                aria-hidden="true"
                            >
                                <svg viewBox="0 0 16 16" focusable="false">
                                    <path d="M8 13V3M4.2 6.8 8 3l3.8 3.8"></path>
                                </svg>
                            </span>
                        {/if}
                    </button>
                {/each}
            </div>
        </fieldset>

        <button
            type="button"
            class="favorite-locations-trigger favorite-locations-trigger--inline"
            aria-label={text.favoriteLocationsCountLabel(favoriteCount)}
            aria-haspopup="dialog"
            aria-controls={favoritesOpen ? 'favorite-locations-panel' : undefined}
            aria-expanded={favoritesOpen}
            title={text.favoriteLocationsLabel}
            on:click={toggleFavoriteLocations}
        >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M7 4h10v16l-5-3-5 3Z"></path>
            </svg>
            {#if favoriteCount > 0}
                <span class="favorite-locations-trigger__count">{favoriteCount}</span>
            {/if}
        </button>

        <button
            type="button"
            class="language-toggle"
            aria-label={text.languageToggleLabel}
            on:click={toggleLanguage}
        >
            <span class="language-toggle__option" class:active={uiLanguage === 'zh'}>中</span>
            <span class="language-toggle__option" class:active={uiLanguage === 'en'}>EN</span>
        </button>
    </div>

    <FavoriteLocations
        bind:this={favoriteLocationsComponent}
        bind:open={favoritesOpen}
        bind:count={favoriteCount}
        bind:currentSaved={currentLocationSaved}
        bind:currentActionDisabled={currentFavoriteActionDisabled}
        language={uiLanguage}
        location={selectedLocation}
        locationName={locationDisplayName}
        locationNameResolved={locationNameResolved}
        distanceOrigin={favoriteDistanceOrigin}
        currentElevationM={elevationLocationKey === locationKey ? elevationM : null}
        currentLightPollution={lightPollutionLoadedKey === locationKey ? lightPollutionPoint : null}
        mobile={isMobileOrTablet}
        fullscreen={isMobileFullscreen}
        returnFocus={favoriteReturnFocus}
        openUpward={isMobileCollapsed}
        on:select={handleFavoriteLocationSelect}
        on:compare={handleFavoriteComparisonStart}
    />
    <FavoriteComparison
        bind:open={favoriteComparisonOpen}
        bind:selectedDate
        currentInstant={currentInstant}
        targets={favoriteComparisonTargets}
        initialModel={weatherModel}
        language={uiLanguage}
        mobile={isMobileOrTablet}
        fullscreen={isMobileFullscreen}
        returnFocus={favoriteReturnFocus}
        openUpward={isMobileCollapsed}
        on:back={handleFavoriteComparisonBack}
        on:close={handleFavoriteComparisonClose}
    />
    </div>

    <div
        class="status-region"
        class:mobile-collapsed-hidden={isMobileCollapsed}
        class:status-region--event-details={selectedEvent !== 'all' && activeSolarPath?.status !== undefined}
        aria-live="polite"
    >
        {#if status === 'error'}
            <div class="status-message status-message--error" role="alert">
                <span>{errorMessage}</span>
                <button type="button" class="text-button" on:click={() => void refreshPaths(astronomyKey)}>
                    {text.retry}
                </button>
            </div>
        {:else if selectedEvent !== 'all' && activeSolarPath?.status === 'unavailable'}
            <div class="status-message status-message--muted">
                {unavailableMessage(activeSolarPath.event, activeSolarPath.reason)}
            </div>
        {:else if selectedEvent !== 'all' && activeSolarPath?.status === 'ok'}
            <div class="event-summary">
                <div>
                    <span class="control-label">{eventDisplayName(selectedEvent, text)}{text.eventTimeSuffix}</span>
                    <strong>{formatLocalDateTime(activeSolarPath.eventTime, timeZone)}</strong>
                </div>
                <div class="event-summary__meta">
                    <span>{timeZone}</span>
                    {#if elevationM > 0}
                        <span>海拔 {Math.round(elevationM)} m</span>
                    {/if}
                </div>
            </div>

            <div
                class="sample-list"
                aria-label={text.eventDirectionLinesLabel(eventDisplayName(selectedEvent, text))}
            >
                {#each activeSolarPath.samples as sample}
                    <div class="sample-row">
                        <span
                            class="line-swatch"
                            style={`--line-color: ${lineColorForEvent(selectedEvent, sample.kind)}`}
                            aria-hidden="true"
                        ></span>
                        <span class="sample-row__name">{sample.label}</span>
                        <span class="sample-row__time">{formatLocalClock(sample.time, timeZone)}</span>
                        <span class="sample-row__azimuth">
                            {Math.round(sample.azimuth)}° {compassDirectionLabel(sample.azimuth, uiLanguage)}
                        </span>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <section
        class="map-bottom-module"
        class:map-bottom-module--mobile-collapsed={isMobileCollapsed}
        aria-label={text.sunMoonPanelLabel}
    >
        <nav class="summary-tabs" role="tablist" aria-label={text.summaryViewsLabel}>
            <button id="summary-tab-events" type="button" role="tab" aria-controls="summary-panel" class:active={summaryTab === 'events'} aria-selected={summaryTab === 'events'} tabindex={summaryTab === 'events' ? 0 : -1} on:click={() => (summaryTab = 'events')} on:keydown={event => handleSummaryTabKeydown(event, 'events')}>{text.eventTab}</button>
            {#if isMobileOrTablet && !isMobileFullscreen}
                <button id="summary-tab-weather" type="button" role="tab" aria-controls="summary-panel" class:active={summaryTab === 'weather'} aria-selected={summaryTab === 'weather'} tabindex={summaryTab === 'weather' ? 0 : -1} on:click={() => (summaryTab = 'weather')} on:keydown={event => handleSummaryTabKeydown(event, 'weather')}>{text.weatherTab}</button>
            {/if}
            <button id="summary-tab-guide" type="button" role="tab" aria-controls="summary-panel" class:active={summaryTab === 'guide'} aria-selected={summaryTab === 'guide'} tabindex={summaryTab === 'guide' ? 0 : -1} on:click={() => (summaryTab = 'guide')} on:keydown={event => handleSummaryTabKeydown(event, 'guide')}>{text.guideTab}</button>
            <button id="summary-tab-settings" type="button" role="tab" aria-controls="summary-panel" class:active={summaryTab === 'settings'} aria-selected={summaryTab === 'settings'} tabindex={summaryTab === 'settings' ? 0 : -1} on:click={() => (summaryTab = 'settings')} on:keydown={event => handleSummaryTabKeydown(event, 'settings')}>{text.settingsTab}</button>
            <button id="summary-tab-about" type="button" role="tab" aria-controls="summary-panel" class:active={summaryTab === 'about'} aria-selected={summaryTab === 'about'} tabindex={summaryTab === 'about' ? 0 : -1} on:click={() => (summaryTab = 'about')} on:keydown={event => handleSummaryTabKeydown(event, 'about')}>{text.aboutTab}</button>
        </nav>

        <div
            id="summary-panel"
            class="summary-panel-frame"
            class:summary-panel-frame--events={summaryTab === 'events'}
            role={isMobileCollapsed ? 'region' : 'tabpanel'}
            aria-label={isMobileCollapsed ? text.eventTab : undefined}
            aria-labelledby={isMobileCollapsed ? undefined : `summary-tab-${summaryTab}`}
        >
            {#if summaryTab === 'events'}
                <span class="visually-hidden" role="status" aria-live="polite">
                    {status === 'loading' ? text.calculating : ''}
                </span>
                <section
                    class="astronomy-panel"
                    class:astronomy-panel--loading={status === 'loading'}
                    aria-label={text.astronomyPanelLabel(accessibleSelectedDateLabel, selectedDateIsToday)}
                    aria-busy={status === 'loading'}
                >
                    <div class="astronomy-panel__heading">
                        <div class="astronomy-location">
                            <button
                                type="button"
                                class="astronomy-location__button"
                                class:scrolling={locationNameOverflows}
                                title={locationDisplayName || text.locationResolvingLabel}
                                aria-label={text.locationFavoritesLabel(
                                    locationDisplayName || text.locationResolvingLabel,
                                )}
                                aria-haspopup="dialog"
                                aria-controls={favoritesOpen ? 'favorite-locations-panel' : undefined}
                                aria-expanded={favoritesOpen}
                                use:observeLocationNameOverflow={eventLocationDisplayName || text.locationResolvingLabel}
                                on:click={openFavoriteLocations}
                            >
                                <span class="astronomy-location__copy">
                                    <span class="astronomy-location__name-line">
                                        <span class="astronomy-location__name-viewport">
                                            <span class="astronomy-location__name-track">
                                                <span class="astronomy-location__name-value">
                                                    {eventLocationDisplayName || text.locationResolvingLabel}
                                                </span>
                                                {#if locationNameOverflows}
                                                    <span class="astronomy-location__name-value" aria-hidden="true">
                                                        {eventLocationDisplayName || text.locationResolvingLabel}
                                                    </span>
                                                {/if}
                                            </span>
                                        </span>
                                        <svg class="astronomy-location__chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                                            <path d="m6 3 5 5-5 5"></path>
                                        </svg>
                                    </span>
                                    <span
                                        class="astronomy-location__metrics"
                                        aria-label={`${text.elevationLabel} ${locationElevationText}`}
                                    >
                                        <span class="astronomy-location__elevation-icon" aria-hidden="true">▲</span>
                                        {#if status === 'loading' && elevationLocationKey !== locationKey}
                                            <span class="astronomy-skeleton astronomy-skeleton--elevation" aria-hidden="true"></span>
                                        {:else}
                                            <span>{locationElevationText}</span>
                                        {/if}
                                        <span
                                            class="astronomy-refresh-indicator"
                                            class:active={status === 'loading'}
                                            aria-hidden="true"
                                        ></span>
                                    </span>
                                </span>
                            </button>
                            <button
                                type="button"
                                class="astronomy-location__favorite"
                                class:saved={currentLocationSaved}
                                aria-label={currentLocationSaved
                                    ? text.removeCurrentLocationFavoriteLabel
                                    : text.saveCurrentLocationFavoriteLabel}
                                aria-pressed={currentLocationSaved}
                                title={currentLocationSaved
                                    ? text.removeCurrentLocationFavoriteLabel
                                    : text.saveCurrentLocationFavoriteLabel}
                                disabled={currentFavoriteActionDisabled}
                                on:click={toggleCurrentLocationFavorite}
                            >
                                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                    <path d="m12 3.8 2.5 5.1 5.6.8-4.1 4 1 5.6-5-2.6-5 2.6 1-5.6-4.1-4 5.6-.8Z"></path>
                                </svg>
                            </button>
                        </div>
                        <div class="live-positions" aria-label={text.currentDirectionsLabel}>
                            <div class="live-position live-position--sun" aria-label={text.sun}>
                                <span class="live-position__icon live-position__icon--sun" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" focusable="false">
                                        <circle cx="12" cy="12" r="4.2"></circle>
                                        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"></path>
                                    </svg>
                                </span>
                                {#if currentSolarDirection}
                                    <strong>
                                        <span class="live-position__azimuth">{Math.round(currentSolarDirection.azimuth)}°</span>
                                        <span class="live-position__compass">{compassDirectionLabel(currentSolarDirection.azimuth, uiLanguage)}</span>
                                    </strong>
                                    <em class="live-position__metric">
                                        <span class="live-position__altitude">{text.altitude} {currentSolarDirection.altitude.toFixed(1)}°</span>
                                        <span class="live-position__event-azimuth">{sunriseAzimuthLabel ? `↑${sunriseAzimuthLabel}` : ''}</span>
                                        <span class="live-position__event-azimuth">{sunsetAzimuthLabel ? `↓${sunsetAzimuthLabel}` : ''}</span>
                                    </em>
                                {:else}
                                    <strong>--</strong>
                                {/if}
                            </div>
                            <div class="live-position live-position--moon" aria-label={text.moon}>
                                <span class="live-position__icon live-position__icon--moon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" focusable="false">
                                        <path d="M19.6 15.2A8.4 8.4 0 0 1 8.8 4.4A8.6 8.6 0 1 0 19.6 15.2Z"></path>
                                    </svg>
                                </span>
                                {#if currentMoonInfo}
                                    <strong>
                                        <span class="live-position__azimuth">{Math.round(currentMoonInfo.azimuth)}°</span>
                                        <span class="live-position__compass">{compassDirectionLabel(currentMoonInfo.azimuth, uiLanguage)}</span>
                                    </strong>
                                    <em class="live-position__metric">
                                        <span class="live-position__altitude">{text.altitude} {currentMoonInfo.altitude.toFixed(1)}°</span>
                                        <span class="live-position__event-azimuth">{moonriseAzimuthLabel ? `↑${moonriseAzimuthLabel}` : ''}</span>
                                        <span class="live-position__event-azimuth">{moonsetAzimuthLabel ? `↓${moonsetAzimuthLabel}` : ''}</span>
                                    </em>
                                {:else}
                                    <strong>--</strong>
                                {/if}
                            </div>
                        </div>
                        <div class="orbit-badge orbit-badge--moon">
                            <svg class="orbit-moon" viewBox="0 0 48 48" aria-label={text.currentMoonPhaseLabel} role="img">
                                <circle cx="24" cy="24" r="18" fill="#f5efcf"></circle>
                                <circle
                                    class="orbit-moon__shadow"
                                    cx={moonShadowCenterValue}
                                    cy="24"
                                    r="18"
                                ></circle>
                            </svg>
                            {#if moonIlluminationPercentText}
                                <span class="orbit-badge__percent">{moonIlluminationPercentText}</span>
                            {/if}
                        </div>
                    </div>

                    <div
                        class="timeline-events"
                        aria-label={text.astronomyEventsLabel(accessibleSelectedDateLabel, selectedDateIsToday)}
                    >
                        {#if status === 'loading'}
                            {#each timelineSkeletonSlots as _}
                                <div class="timeline-event timeline-event--skeleton" aria-hidden="true">
                                    <span class="astronomy-skeleton astronomy-skeleton--label"></span>
                                    <span class="astronomy-skeleton astronomy-skeleton--time"></span>
                                </div>
                            {/each}
                        {:else}
                            <div class="timeline-event timeline-event--countdown">
                                <span class="timeline-event__label">{timelineLeadLabel}</span>
                                <strong>{timelineLeadTime || '--'}</strong>
                            </div>
                            {#each astronomyTimeline?.items || [] as item}
                                <div
                                    class:item-moon={item.body === 'moon'}
                                    class:item-blue-hour={item.kind === 'dawn' || item.kind === 'dusk'}
                                    class:timeline-event--missing={!item.time}
                                    class="timeline-event"
                                >
                                    <span class="timeline-event__label">{timelineEventLabel(item, text)}</span>
                                    <strong>{item.time ? formatLocalClock(item.time, timeZone) : '--:--'}</strong>
                                </div>
                            {/each}
                        {/if}
                    </div>

                    {#if !isMobileCollapsed}
                        <LightPollutionSummary
                            point={lightPollutionPoint}
                            status={lightPollutionStatus}
                            errorMessage={lightPollutionErrorMessage}
                            canRetry={lightPollutionErrorKind === 'network'}
                            language={uiLanguage}
                            on:retry={retryLightPollution}
                        />

                        <div class="night-window-list" aria-label={text.nightObservationWindowsLabel}>
                            {#each observationWindows as slot}
                                <article class:night-window--milky-way={slot.kind === 'milky-way'} class="night-window">
                                    <div class="night-window__body">
                                        <strong>{text.intervals[slot.kind]}</strong>
                                        {#if status === 'loading'}
                                            <span class="astronomy-skeleton astronomy-skeleton--window" aria-hidden="true"></span>
                                        {:else if slot.interval}
                                            <span>{formatInterval(slot.interval)} · {formatIntervalDuration(slot.interval, uiLanguage)}</span>
                                            {@const evidenceState = observationEvidenceState(slot)}
                                            {#if evidenceState === 'loading'}
                                                <span class="astronomy-skeleton astronomy-skeleton--evidence" aria-hidden="true"></span>
                                                <span class="visually-hidden">{text.observationEvidenceLoading}</span>
                                            {:else if evidenceState === 'ready'}
                                                <div class="night-window__evidence" role="group" aria-label={text.observationEvidenceLabel}>
                                                    <span
                                                        class="night-window__metric"
                                                        title={text.observationMetricLabels.totalCloudPercent}
                                                    >
                                                        <span class="visually-hidden">{text.observationMetricLabels.totalCloudPercent}</span>
                                                        <WeatherMetricIcon metric="totalCloudPercent" size={11} />
                                                        {formatObservationMeasurement(slot.evidence.totalCloudPercent, 0, '%')}
                                                    </span>
                                                    <span
                                                        class="night-window__metric"
                                                        title={text.observationMetricLabels.precipMm}
                                                    >
                                                        <span class="visually-hidden">{text.observationMetricLabels.precipMm}</span>
                                                        <WeatherMetricIcon metric="precipMm" size={11} />
                                                        {formatObservationPrecipitation(slot.evidence.precipitationMm)}
                                                    </span>
                                                    <span
                                                        class="night-window__metric"
                                                        title={text.observationMetricLabels.visibilityKm}
                                                    >
                                                        <span class="visually-hidden">{text.observationMetricLabels.visibilityKm}</span>
                                                        <WeatherMetricIcon metric="visibilityKm" size={11} />
                                                        {formatObservationMeasurement(slot.evidence.visibilityKm, 1, 'km')}
                                                    </span>
                                                </div>
                                            {:else}
                                                <span class="night-window__evidence-state">
                                                    {observationEvidenceStateLabel(evidenceState)}
                                                </span>
                                            {/if}
                                        {:else}
                                            <span>
                                                {status === 'error'
                                                    ? text.intervalUnavailable
                                                    : status === 'ready' || status === 'empty'
                                                        ? text.noInterval
                                                        : text.calculating}
                                            </span>
                                            <div
                                                class="night-window__evidence night-window__evidence--placeholder"
                                                aria-hidden="true"
                                            >
                                                <span class="night-window__metric">
                                                    <WeatherMetricIcon metric="totalCloudPercent" size={11} />
                                                    --
                                                </span>
                                                <span class="night-window__metric">
                                                    <WeatherMetricIcon metric="precipMm" size={11} />
                                                    --
                                                </span>
                                                <span class="night-window__metric">
                                                    <WeatherMetricIcon metric="visibilityKm" size={11} />
                                                    --
                                                </span>
                                            </div>
                                        {/if}
                                    </div>
                                </article>
                            {/each}
                        </div>
                    {/if}
                </section>
            {:else if summaryTab === 'weather' && isMobileOrTablet && !isMobileFullscreen}
                <WeatherTable
                    points={weatherPoints}
                    model={weatherModel}
                    status={weatherStatus}
                    errorMessage={weatherErrorMessage}
                    {atmosphereStatus}
                    {atmosphereErrorMessage}
                    language={uiLanguage}
                    {timeZone}
                    currentTimestamp={currentInstant.getTime()}
                    {selectedDate}
                    dataKey={weatherRequestKey}
                    location={selectedLocation}
                    on:modelchange={handleWeatherModelChange}
                    on:retry={retryWeather}
                    on:atmosphereretry={retryAtmosphere}
                />
            {:else if summaryTab === 'guide'}
                <section class="module-about module-guide" aria-label={text.guideHeading}>
                    <p>{text.aboutDescription}</p>

                    <section class="feature-guide" aria-labelledby="feature-guide-heading">
                        <h3 id="feature-guide-heading">{text.featureGuideHeading}</h3>
                        <dl>
                            <div>
                                <dt>{text.featureGuide.coordinates.title}</dt>
                                <dd>{text.featureGuide.coordinates.description}</dd>
                            </div>
                            <div>
                                <dt>{text.featureGuide.mapControls.title}</dt>
                                <dd>{text.featureGuide.mapControls.description}</dd>
                            </div>
                            <div>
                                <dt>{text.featureGuide.observationEvidence.title}</dt>
                                <dd>{text.featureGuide.observationEvidence.description}</dd>
                            </div>
                            <div>
                                <dt>{text.featureGuide.favorites.title}</dt>
                                <dd>{text.featureGuide.favorites.description}</dd>
                            </div>
                            <div>
                                <dt>{text.featureGuide.comparison.title}</dt>
                                <dd>{text.featureGuide.comparison.description}</dd>
                            </div>
                            <div>
                                <dt>{text.featureGuide.mobileMode.title}</dt>
                                <dd>{text.featureGuide.mobileMode.description}</dd>
                            </div>
                        </dl>
                    </section>

                    <div class="sun-path-legend sun-path-legend--module" aria-label={text.mapLegendLabel}>
                        <div class="sun-path-legend__items">
                            <span class="legend-item">
                                <span class="legend-dot legend-dot--origin" aria-hidden="true"></span>
                                {text.legend.origin}
                            </span>
                            <span class="legend-item">
                                <span class="legend-dot legend-dot--inner" aria-hidden="true"></span>
                                200 km
                            </span>
                            <span class="legend-item">
                                <span class="legend-dot legend-dot--outer" aria-hidden="true"></span>
                                400 km
                            </span>
                            {#if showExtendedDistanceMarker}
                                <span class="legend-item">
                                    <span class="legend-dot legend-dot--extended" aria-hidden="true"></span>
                                    600 km
                                </span>
                            {/if}
                        </div>
                        <div class="sun-path-legend__items sun-path-legend__items--lines">
                            <span class="legend-item">
                                <span class="legend-line legend-line--before" aria-hidden="true"></span>
                                {text.legend.sunBefore}
                            </span>
                            <span class="legend-item">
                                <span class="legend-line legend-line--event" aria-hidden="true"></span>
                                {text.legend.sunEvent}
                            </span>
                            <span class="legend-item">
                                <span class="legend-line legend-line--after" aria-hidden="true"></span>
                                {text.legend.sunAfter}
                            </span>
                            <span class="legend-item">
                                <span class="legend-line legend-line--moon-before" aria-hidden="true"></span>
                                {text.legend.moonBefore}
                            </span>
                            <span class="legend-item">
                                <span class="legend-line legend-line--moon-event" aria-hidden="true"></span>
                                {text.legend.moonEvent}
                            </span>
                            <span class="legend-item">
                                <span class="legend-line legend-line--moon-after" aria-hidden="true"></span>
                                {text.legend.moonAfter}
                            </span>
                            <span class="legend-item">
                                <span class="legend-line legend-line--current" aria-hidden="true"></span>
                                {text.legend.currentSun}
                            </span>
                            <span class="legend-item">
                                <span class="legend-line legend-line--moon" aria-hidden="true"></span>
                                {text.legend.currentMoon}
                            </span>
                        </div>
                    </div>

                    <section class="settings-guide" aria-labelledby="settings-guide-heading">
                        <h3 id="settings-guide-heading">{text.settingsGuideHeading}</h3>
                        <dl>
                            {#if uiLanguage === 'zh'}
                                <div>
                                    <dt>{text.locationApiKeyLabel}</dt>
                                    <dd>{text.locationApiKeyDescription}</dd>
                                </div>
                            {/if}
                            <div>
                                <dt>{text.lineOpacityLabel}</dt>
                                <dd>{text.lineOpacityDescription}</dd>
                            </div>
                            <div>
                                <dt>{text.show600Label}</dt>
                                <dd>{text.show600Description}</dd>
                            </div>
                        </dl>
                    </section>

                    <div class="weather-legend" aria-label={text.weatherLegend.heading}>
                        <h3>{text.weatherLegend.heading}</h3>

                        <section class="weather-legend__section">
                            <h4>{text.weatherLegend.cloud}</h4>
                            <div class="weather-legend__scale weather-legend__scale--cloud">
                                {#each [25, 50, 75, 100] as value}
                                    <span class="weather-legend__cloud-sample">
                                        <span class="weather-legend__cloud-box" style={`--legend-cloud: ${value}%`} aria-hidden="true"></span>
                                        <small>{value}%</small>
                                    </span>
                                {/each}
                            </div>
                            <p>{text.weatherLegend.cloudDescription}</p>
                        </section>

                        <section class="weather-legend__section">
                            <h4>{text.weatherLegend.temperature}</h4>
                            <div class="weather-legend__scale weather-legend__scale--temperature">
                                <span class="weather-legend__swatch tone-freezing">&lt;0</span>
                                <span class="weather-legend__swatch tone-cool">5</span>
                                <span class="weather-legend__swatch tone-cold">12</span>
                                <span class="weather-legend__swatch tone-mild">18</span>
                                <span class="weather-legend__swatch tone-good">24</span>
                                <span class="weather-legend__swatch tone-warning">30</span>
                                <span class="weather-legend__swatch tone-orange">36</span>
                                <span class="weather-legend__swatch tone-danger">≥38</span>
                            </div>
                            <p>{text.weatherLegend.temperatureDescription}</p>
                        </section>

                        <section class="weather-legend__section">
                            <h4>{text.weatherLegend.dewPoint}</h4>
                            <div class="weather-legend__scale">
                                <span class="weather-legend__swatch tone-good">≤33</span>
                                <span class="weather-legend__swatch tone-warning">34–35</span>
                                <span class="weather-legend__swatch tone-danger">≥36</span>
                            </div>
                            <p>{text.weatherLegend.dewPointDescription}</p>
                        </section>

                        <section class="weather-legend__section">
                            <h4>{text.weatherLegend.humidity}</h4>
                            <div class="weather-legend__scale">
                                <span class="weather-legend__swatch tone-good">&lt;60%</span>
                                <span class="weather-legend__swatch tone-warning">60–74%</span>
                                <span class="weather-legend__swatch tone-orange">75–84%</span>
                                <span class="weather-legend__swatch tone-danger">≥85%</span>
                            </div>
                            <p>{text.weatherLegend.humidityDescription}</p>
                        </section>

                        <section class="weather-legend__section">
                            <h4>{text.weatherLegend.precipitation}</h4>
                            <div class="weather-legend__scale">
                                <span class="weather-legend__swatch tone-warning">&gt;0–&lt;1</span>
                                <span class="weather-legend__swatch tone-orange">1–2.5</span>
                                <span class="weather-legend__swatch tone-danger">&gt;2.5</span>
                            </div>
                            <p>{text.weatherLegend.precipitationDescription}</p>
                        </section>

                        <section class="weather-legend__section">
                            <h4>{text.weatherLegend.windSpeed}</h4>
                            <div class="weather-legend__scale">
                                <span class="weather-legend__swatch tone-good">≤16</span>
                                <span class="weather-legend__swatch tone-warning">17–32</span>
                                <span class="weather-legend__swatch tone-danger">&gt;32</span>
                            </div>
                            <p>{text.weatherLegend.windSpeedDescription}</p>
                        </section>

                        <section class="weather-legend__section">
                            <h4>{text.weatherLegend.windDirection}</h4>
                            <div class="weather-legend__direction-row">
                                <svg class="weather-legend__wind-arrow" viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M12 2 18 20 12 16 6 20Z"></path>
                                </svg>
                                <p>{text.weatherLegend.windDirectionDescription}</p>
                            </div>
                        </section>

                        <section class="weather-legend__section">
                            <h4>{text.weatherLegend.visibility}</h4>
                            <div class="weather-legend__scale">
                                <span class="weather-legend__swatch tone-danger">0.8</span>
                                <span class="weather-legend__swatch tone-orange">1.5</span>
                                <span class="weather-legend__swatch tone-warning">3.5</span>
                                <span class="weather-legend__swatch tone-mild">7</span>
                                <span class="weather-legend__swatch tone-good">12</span>
                            </div>
                            <p>{text.weatherLegend.visibilityDescription}</p>
                            <p class="weather-legend__sources">
                                <a href={OPEN_METEO_URL} target="_blank" rel="noreferrer">Open-Meteo</a>
                            </p>
                        </section>

                        <section class="weather-legend__section">
                            <h4>{text.weatherLegend.aerosolAod}</h4>
                            <div class="weather-legend__scale">
                                <span class="weather-legend__swatch tone-good">0.05</span>
                                <span class="weather-legend__swatch tone-warning">0.15</span>
                                <span class="weather-legend__swatch tone-orange">0.30</span>
                                <span class="weather-legend__swatch tone-danger">0.50</span>
                            </div>
                            <p>{text.weatherLegend.aerosolAodDescription}</p>
                            <p class="weather-legend__sources">
                                <a href={OPEN_METEO_URL} target="_blank" rel="noreferrer">Open-Meteo</a>
                                <span aria-hidden="true"> · </span>
                                <a href={CAMS_URL} target="_blank" rel="noreferrer">CAMS</a>
                            </p>
                        </section>

                        <section class="weather-legend__section">
                            <h4>{text.weatherLegend.celestialEvents}</h4>
                            <div class="weather-legend__celestial-row">
                                <span class="weather-legend__celestial-sample">
                                    <CelestialIcon body="moon" size={15} label={text.moon} />
                                    <span>↑ 05:30</span>
                                </span>
                                <span class="weather-legend__celestial-sample">
                                    <CelestialIcon body="sun" size={15} label={text.sun} />
                                    <span>↓ 18:45</span>
                                </span>
                            </div>
                            <p>{text.weatherLegend.celestialEventsDescription}</p>
                        </section>
                    </div>
                </section>
            {:else if summaryTab === 'settings'}
                <section class="module-about module-settings" aria-label={text.settingsHeading}>
                    <label class="settings-toggle settings-toggle--location-search">
                        <span class="settings-toggle__copy">
                            <strong>{text.hideLocationSearchLabel}</strong>
                            <span>{text.hideLocationSearchDescription}</span>
                        </span>
                        <input
                            type="checkbox"
                            checked={hideLocationSearch}
                            aria-label={text.hideLocationSearchLabel}
                            on:change={toggleLocationSearch}
                        />
                        <span class="settings-toggle__control" aria-hidden="true"></span>
                    </label>
                    {#if uiLanguage === 'zh'}
                        <div class="settings-api-keys" aria-label={text.locationApiKeyLabel}>
                            {#each LOCATION_PROVIDERS as providerOption}
                                <form
                                    class="settings-api-key"
                                    on:submit={event => saveLocationApiKey(event, providerOption)}
                                >
                                    <div class="settings-api-key__header">
                                        <label for={`${providerOption}-api-key`}>
                                            {text.locationProviderLabels[providerOption]}
                                        </label>
                                        <span class="settings-api-key__header-actions">
                                            <a
                                                href={LOCATION_PROVIDER_APPLICATION_URLS[providerOption]}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                {text.locationProviderApplyLabels[providerOption]}
                                            </a>
                                            {#if savedApiKeyProvider === providerOption}
                                                <span role="status">{text.locationApiKeySaved}</span>
                                            {/if}
                                        </span>
                                    </div>
                                    <div class="settings-api-key__control">
                                        <input
                                            id={`${providerOption}-api-key`}
                                            type="password"
                                            value={locationApiKeyDrafts[providerOption]}
                                            placeholder={text.locationApiKeyPlaceholder}
                                            autocomplete="off"
                                            aria-describedby={`${providerOption}-api-key-description`}
                                            on:input={event => updateLocationApiKeyDraft(event, providerOption)}
                                        />
                                        <button
                                            type="submit"
                                            disabled={!locationApiKeyDrafts[providerOption].trim()}
                                        >
                                            {text.locationApiKeySave}
                                        </button>
                                        {#if locationApiKeys[providerOption]}
                                            <button
                                                type="button"
                                                class="settings-api-key__clear"
                                                on:click={() => clearLocationApiKey(providerOption)}
                                            >
                                                {text.locationApiKeyClear}
                                            </button>
                                        {/if}
                                    </div>
                                    <span
                                        id={`${providerOption}-api-key-description`}
                                        class="settings-api-key__description"
                                    >
                                        {text.locationProviderDescriptions[providerOption]}
                                    </span>
                                </form>
                            {/each}
                        </div>
                    {/if}
                    <div class="settings-range">
                        <div class="settings-range__header">
                            <label for="direction-line-opacity">{text.lineOpacityLabel}</label>
                            <output for="direction-line-opacity">{directionLineOpacityPercent}%</output>
                        </div>
                        <input
                            id="direction-line-opacity"
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={directionLineOpacityPercent}
                            aria-describedby="direction-line-opacity-description"
                            on:input={changeDirectionLineOpacity}
                        />
                        <span id="direction-line-opacity-description" class="settings-range__description">
                            {text.lineOpacityDescription}
                        </span>
                    </div>
                    <label class="settings-toggle">
                        <span class="settings-toggle__copy">
                            <strong>{text.show600Label}</strong>
                            <span>{text.show600Description}</span>
                        </span>
                        <input
                            type="checkbox"
                            checked={showExtendedDistanceMarker}
                            aria-label={text.show600Label}
                            on:change={toggleExtendedDistanceMarker}
                        />
                        <span class="settings-toggle__control" aria-hidden="true"></span>
                    </label>
                </section>
            {:else}
                <section class="module-about" aria-label={text.aboutHeading}>
                    <div class="about-hero">
                        <div class="about-hero__header">
                            <div class="about-hero__copy">
                                <span>{text.aboutHeading}</span>
                                <strong>{title}</strong>
                            </div>
                            <dl class="about-meta">
                                <div>
                                    <dt>{text.aboutAuthorLabel}</dt>
                                    <dd>{pluginAuthor}</dd>
                                </div>
                                <div>
                                    <dt>{text.aboutVersionLabel}</dt>
                                    <dd>{pluginVersion}</dd>
                                </div>
                            </dl>
                        </div>
                        <div class="about-actions" aria-label={text.aboutLinksLabel}>
                            <a href={repositoryUrl} target="_blank" rel="noreferrer">{text.aboutGithubLabel}</a>
                            <a href={issuesUrl} target="_blank" rel="noreferrer">{text.aboutIssuesLabel}</a>
                            <a class="about-actions__star" href={repositoryUrl} target="_blank" rel="noreferrer">{text.aboutStarLabel}</a>
                        </div>
                        <p>{text.aboutStarHint}</p>
                    </div>
                </section>
            {/if}
        </div>
    </section>

    {#if !isMobileOrTablet || isMobileFullscreen}
        <section class="desktop-weather-module" aria-label={uiLanguage === 'zh' ? '天气模式预报' : 'Weather model forecast'}>
            <WeatherTable
                points={weatherPoints}
                model={weatherModel}
                status={weatherStatus}
                errorMessage={weatherErrorMessage}
                {atmosphereStatus}
                {atmosphereErrorMessage}
                language={uiLanguage}
                {timeZone}
                currentTimestamp={currentInstant.getTime()}
                {selectedDate}
                dataKey={weatherRequestKey}
                location={selectedLocation}
                on:modelchange={handleWeatherModelChange}
                on:retry={retryWeather}
                on:atmosphereretry={retryAtmosphere}
            />
        </section>
    {/if}

    <p class="panel-note">
        方向线表示天文方位，不代表山体、建筑或云层遮挡条件下的实际可见性。关闭面板后，方向线会保留在地图上；重新打开插件时会接管并更新同一组图层。
    </p>
    </div>
</section>

<script lang="ts">
    import bcast from '@windy/broadcast';
    import { getElevation, getPointForecastData, getTimezoneInfo } from '@windy/fetch';
    import { getGPSlocation, getMyLatestPos } from '@windy/geolocation';
    import { centerMap, map } from '@windy/map';
    import * as reverseName from '@windy/reverseName';
    import { isMobileOrTablet } from '@windy/rootScope';
    import { setUrl } from '@windy/location';
    import { singleclick } from '@windy/singleclick';
    import { onDestroy, onMount, tick } from 'svelte';

    import config from './pluginConfig';
    import CelestialIcon from './CelestialIcon.svelte';
    import FavoriteComparison from './FavoriteComparison.svelte';
    import FavoriteLocations from './FavoriteLocations.svelte';
    import WeatherMetricIcon from './WeatherMetricIcon.svelte';
    import {
        compactLocationLabel,
        DETAILED_REVERSE_NAME_ZOOM,
        detailedLocationLabel,
        gpsCoordinatesFromLocation,
        isHomeButtonTarget,
        isMapCenteredOnLocation,
        scheduleReopenAfterHome,
        shouldRefreshSameLocationImmediately,
    } from './location';
    import {
        buildOpenMeteoRequestKey,
        fetchOpenMeteoAtmosphere,
        mergeOpenMeteoAtmosphere,
        type OpenMeteoAtmospherePoint,
    } from './openMeteo';
    import {
        resolveObservationEvidenceState,
        type ObservationEvidenceState,
    } from './observationEvidence';
    import { claimOverlayOwner } from './overlayOwner';
    import { createMapOverlayController } from './mapOverlayController';
    import { buildDirectionLineFitBounds, calculateVisibleMapViewport } from './mapView';
    import {
        buildObservationWindows,
        createObservationPlanner,
        ObservationPlannerError,
        selectObservationPaths,
        type ObservationEvent,
        type ObservationMetricRange,
        type ObservationWindow,
    } from './observationPlanner';
    import LightPollutionSummary from './LightPollutionSummary.svelte';
    import LocationSearch from './LocationSearch.svelte';
    import WeatherTable from './WeatherTable.svelte';
    import {
        fetchLightPollutionPoint,
        isLightPollutionResponseCurrent,
        LightPollutionOutOfBoundsError,
        type LightPollutionPoint,
    } from './lightPollution';
    import {
        calculateCurrentMoonInfo,
        calculateCurrentSolarDirection,
        compassDirection,
        dateInputForInstant,
        dateInputToUtcNoon,
        formatLocalClock,
        formatLocalDateTime,
        LINE_COLORS,
        MOON_LINE_COLORS,
        coordinatesFromLocation,
        type AstronomyInterval,
        type AstronomyTimeline,
        type Coordinates,
        type CurrentMoonInfo,
        type SolarDirection,
        type SolarEvent,
        type SolarPath,
        type SolarSampleKind,
    } from './solar';
    import {
        transformWeatherPayload,
        buildWeatherLocationKey,
        buildWeatherRequestKey,
        findWeatherDateSelection,
        isWeatherResponseCurrent,
        shouldLoadWeather,
        type WeatherForecastPayload,
        type WeatherLoadStatus,
        type WeatherModel,
        type WeatherPoint,
    } from './weather';
    import {
        applyLocationApiKey,
        LOCATION_PROVIDERS,
        type LocationProvider,
        type LocationProviderApiKeys,
        type LocationSearchResult,
        type LocationSearchSelection,
    } from './locationProvider';
    import type { FavoriteComparisonTarget } from './favoriteComparison';

    import type { LatLon } from '@windy/interfaces.d';

    const { author: pluginAuthor, name, repository: repositoryUrl, title, version: pluginVersion } = config;
    const issuesUrl = `${repositoryUrl}/issues`;
    const OPEN_METEO_URL = 'https://open-meteo.com/';
    const CAMS_URL = 'https://atmosphere.copernicus.eu/';
    const systemTimeZone = (() => {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        } catch {
            return 'UTC';
        }
    })();
    type DirectionEvent = ObservationEvent;
    type SummaryTab = 'events' | 'weather' | 'guide' | 'settings' | 'about';
    type UiLanguage = 'zh' | 'en';
    type MobileNonFullscreenPanelMode = 'collapsed' | 'compact';
    type MobilePanelMode = MobileNonFullscreenPanelMode | 'fullscreen';
    const mobileSummaryTabOrder: SummaryTab[] = ['events', 'weather', 'guide', 'settings', 'about'];
    const desktopSummaryTabOrder: SummaryTab[] = ['events', 'guide', 'settings', 'about'];
    const timelineSkeletonSlots = Array.from({ length: 7 }, (_, index) => index);
    const eventOptions: { value: DirectionEvent }[] = [
        { value: 'all' },
        { value: 'sunrise' },
        { value: 'sunset' },
        { value: 'moonrise' },
        { value: 'moonset' },
    ];
    const translations: Record<UiLanguage, {
        dateLabel: string;
        eventSelectorLabel: string;
        languageToggleLabel: string;
        collapsePanelLabel: string;
        expandCompactPanelLabel: string;
        expandPanelLabel: string;
        restorePanelLabel: string;
        fitDirectionLinesLabel: (distanceKm: number) => string;
        restoreSearchZoomLabel: string;
        panelIntro: string;
        sunMoonPanelLabel: string;
        summaryViewsLabel: string;
        astronomyPanelLabel: (date: string, isToday: boolean) => string;
        currentMoonPhaseLabel: string;
        astronomyEventsLabel: (date: string, isToday: boolean) => string;
        nightObservationWindowsLabel: string;
        observationEvidenceLabel: string;
        observationEvidenceLoading: string;
        observationEvidenceOutsideRange: string;
        observationEvidenceMissing: string;
        observationEvidencePartial: string;
        observationEvidenceUnavailable: string;
        observationMetricLabels: Record<'totalCloudPercent' | 'precipMm' | 'visibilityKm', string>;
        mapLegendLabel: string;
        eventDirectionLinesLabel: (event: string) => string;
        favoriteLocationsLabel: string;
        locationFavoritesLabel: (location: string) => string;
        favoriteLocationsCountLabel: (count: number) => string;
        saveCurrentLocationFavoriteLabel: string;
        removeCurrentLocationFavoriteLabel: string;
        eventTab: string;
        weatherTab: string;
        guideTab: string;
        settingsTab: string;
        aboutTab: string;
        retry: string;
        eventTimeSuffix: string;
        now: string;
        currentDirectionsLabel: string;
        sun: string;
        moon: string;
        altitude: string;
        locationResolvingLabel: string;
        elevationLabel: string;
        calculating: string;
        noInterval: string;
        intervalUnavailable: string;
        timelineEnded: string;
        timelinePrefix: string;
        timelineStartSuffix: string;
        moonPhaseLoading: string;
        lightPollutionLoadError: string;
        lightPollutionOutOfBounds: string;
        aboutDescription: string;
        guideHeading: string;
        featureGuideHeading: string;
        featureGuide: Record<
            | 'favorites'
            | 'comparison'
            | 'coordinates'
            | 'observationEvidence'
            | 'mobileMode'
            | 'mapControls',
            { title: string; description: string }
        >;
        settingsGuideHeading: string;
        settingsHeading: string;
        lineOpacityLabel: string;
        lineOpacityDescription: string;
        show600Label: string;
        show600Description: string;
        hideLocationSearchLabel: string;
        hideLocationSearchDescription: string;
        locationApiKeyLabel: string;
        locationApiKeyPlaceholder: string;
        locationApiKeyDescription: string;
        locationApiKeySave: string;
        locationApiKeyClear: string;
        locationApiKeySaved: string;
        locationProviderLabels: Record<LocationProvider, string>;
        locationProviderDescriptions: Record<LocationProvider, string>;
        locationProviderApplyLabels: Record<LocationProvider, string>;
        aboutHeading: string;
        aboutAuthorLabel: string;
        aboutVersionLabel: string;
        aboutLinksLabel: string;
        aboutGithubLabel: string;
        aboutIssuesLabel: string;
        aboutStarLabel: string;
        aboutStarHint: string;
        weatherLoadError: string;
        atmosphereLoadError: string;
        timeZoneLoadError: string;
        timeZoneInvalidError: string;
        astronomyLoadError: string;
        weatherLegend: Record<
            | 'heading'
            | 'cloud'
            | 'cloudDescription'
            | 'temperature'
            | 'temperatureDescription'
            | 'dewPoint'
            | 'dewPointDescription'
            | 'humidity'
            | 'humidityDescription'
            | 'precipitation'
            | 'precipitationDescription'
            | 'windSpeed'
            | 'windSpeedDescription'
            | 'windDirection'
            | 'windDirectionDescription'
            | 'visibility'
            | 'visibilityDescription'
            | 'aerosolAod'
            | 'aerosolAodDescription'
            | 'celestialEvents'
            | 'celestialEventsDescription',
            string
        >;
        events: Record<DirectionEvent, string>;
        timeline: Record<string, string>;
        intervals: Record<AstronomyInterval['kind'], string>;
        legend: Record<string, string>;
        phases: string[];
    }> = {
        zh: {
            dateLabel: '观测日期',
            eventSelectorLabel: '选择日月事件',
            languageToggleLabel: '切换到英文',
            collapsePanelLabel: '收起为方位线模式',
            expandCompactPanelLabel: '展开面板',
            expandPanelLabel: '全屏显示',
            restorePanelLabel: '恢复小窗口',
            fitDirectionLinesLabel: distanceKm => `完整显示 ${distanceKm} km 方位线`,
            restoreSearchZoomLabel: '回到搜索定位缩放',
            panelIntro: '日月关键时刻、事件前后 30 分钟方位线和夜间观测时段。',
            sunMoonPanelLabel: '日月信息面板',
            summaryViewsLabel: '日月信息视图',
            astronomyPanelLabel: (date, isToday) => isToday ? '今日天文时段' : `${date}天文时段`,
            currentMoonPhaseLabel: '月相',
            astronomyEventsLabel: (date, isToday) => isToday ? '今日天文事件' : `${date}天文事件`,
            nightObservationWindowsLabel: '夜间观测时段',
            observationEvidenceLabel: '观测时段天气证据',
            observationEvidenceLoading: '正在匹配时段天气…',
            observationEvidenceOutsideRange: '当前五天预报未覆盖该日期',
            observationEvidenceMissing: '该时段暂无预报数据',
            observationEvidencePartial: '当前预报仅覆盖部分时段',
            observationEvidenceUnavailable: '观测天气暂不可用',
            observationMetricLabels: {
                totalCloudPercent: '云量',
                precipMm: '降水',
                visibilityKm: '能见度',
            },
            mapLegendLabel: '地图图例',
            eventDirectionLinesLabel: event => `${event}方向线数据`,
            favoriteLocationsLabel: '收藏地点',
            locationFavoritesLabel: location => `${location}，打开收藏地点`,
            favoriteLocationsCountLabel: count => `打开收藏地点，共 ${count} 个`,
            saveCurrentLocationFavoriteLabel: '收藏当前地点',
            removeCurrentLocationFavoriteLabel: '取消收藏当前地点',
            eventTab: '事件',
            weatherTab: '天气',
            guideTab: '说明',
            settingsTab: '设置',
            aboutTab: '关于',
            retry: '重试',
            eventTimeSuffix: '时间',
            now: '现在',
            currentDirectionsLabel: '当前太阳和月亮方位',
            sun: '太阳',
            moon: '月亮',
            altitude: '∠',
            locationResolvingLabel: '地点解析中…',
            elevationLabel: '海拔',
            calculating: '正在计算…',
            noInterval: '当天无可用时段',
            intervalUnavailable: '暂不可用',
            timelineEnded: '今日天文时段已结束',
            timelinePrefix: '距离',
            timelineStartSuffix: '开始还有',
            moonPhaseLoading: '月相计算中',
            lightPollutionLoadError: '无法取得光污染数据，请稍后重试。',
            lightPollutionOutOfBounds: '该地点超出光污染数据范围（南纬 65° 至北纬 75°）。',
            aboutDescription: '太阳事件线使用实线，月升/月落事件线使用虚线。每个事件包含前 30 分钟、事件时刻和后 30 分钟三个方位。',
            guideHeading: '地图说明',
            featureGuideHeading: '功能说明',
            featureGuide: {
                favorites: {
                    title: '收藏地点',
                    description: '使用书签按钮收藏或取消收藏当前地点；列表显示距离、海拔和光污染，并支持按距离、收藏时间、海拔或光污染排序。',
                },
                comparison: {
                    title: '收藏地点对比',
                    description: '从收藏中选择 2–5 个地点，在同一观测日期下对比无月、银河时段、天气、光污染和月相。',
                },
                coordinates: {
                    title: '坐标精确定位',
                    description: '在搜索下拉中选择 WGS84 或 GCJ-02，分别输入纬度和经度；GCJ-02 会自动转换为 Windy 使用的 WGS84。',
                },
                observationEvidence: {
                    title: '观测时段证据',
                    description: '无月和银河时段同步显示综合云量、降水和能见度，用当前选择的预报模型补充观测条件依据。',
                },
                mobileMode: {
                    title: '移动端方位线模式',
                    description: '收起面板后保留搜索、日期、事件、实时方位和当天事件时间，并记住方位线模式或小窗口的选择。',
                },
                mapControls: {
                    title: '地图视图按钮',
                    description: '“−”用于缩放到完整方位线范围，“+”用于恢复搜索地点的详细缩放级别。',
                },
            },
            settingsGuideHeading: '设置说明',
            settingsHeading: '插件设置',
            lineOpacityLabel: '方位线透明度',
            lineOpacityDescription: '调整地图上全部太阳和月亮方位线的显示强度。设置会保存在当前浏览器。',
            show600Label: '显示 600 km 点',
            show600Description: '开启后事件方向线会延伸到 600 km，并在该距离增加一个参考点。设置会保存在当前浏览器。',
            hideLocationSearchLabel: '隐藏地点搜索框',
            hideLocationSearchDescription: '开启后不再显示面板顶部的名称和经纬度搜索；已保存的地图 API Key 不会清除。设置会保存在当前浏览器。',
            locationApiKeyLabel: '国内地址搜索 API Key',
            locationApiKeyPlaceholder: '请输入 API Key',
            locationApiKeyDescription: '可配置高德、百度和腾讯，并在搜索框中切换。各 Key 仅保存在当前浏览器。',
            locationApiKeySave: '保存',
            locationApiKeyClear: '清除',
            locationApiKeySaved: '已保存',
            locationProviderLabels: {
                amap: '高德 Web 服务 API Key',
                baidu: '百度 JavaScript API Key',
                tencent: '腾讯 WebService API Key',
            },
            locationProviderDescriptions: {
                amap: '用于高德输入提示，GCJ-02 结果会转换为 Windy 使用的坐标。',
                baidu: '用于百度 JSAPI 4.0 地点检索，BD-09 结果会转换为 Windy 使用的坐标。',
                tencent: '用于腾讯关键词输入提示，GCJ-02 结果会转换为 Windy 使用的坐标。',
            },
            locationProviderApplyLabels: {
                amap: '申请高德 Key',
                baidu: '申请百度 Key',
                tencent: '申请腾讯 Key',
            },
            aboutHeading: '关于插件',
            aboutAuthorLabel: '作者',
            aboutVersionLabel: '版本',
            aboutLinksLabel: '项目链接',
            aboutGithubLabel: 'GitHub 仓库',
            aboutIssuesLabel: 'Issues',
            aboutStarLabel: 'Star',
            aboutStarHint: '喜欢这个插件的话，欢迎在 GitHub 给一个 Star。',
            weatherLoadError: '无法取得天气模式数据，请稍后重试。',
            atmosphereLoadError: '无法取得 Open-Meteo 的 AOD 和能见度数据。',
            timeZoneLoadError: '无法取得观察点时区，请稍后重试。',
            timeZoneInvalidError: 'Windy 返回的观察点时区无效，请稍后重试。',
            astronomyLoadError: '日月方位计算失败，请稍后重试。',
            weatherLegend: {
                heading: '天气图例',
                cloud: '云量',
                cloudDescription: '白色填充越高，云量越多；综合云量表示整体遮挡，高、中、低云表示云层高度。',
                temperature: '气温',
                temperatureDescription: '颜色从低温到高温变化，数字单位为 °C。',
                dewPoint: '露点',
                dewPointDescription: '绿色不易结露，黄色需要留意，红色容易结露；数字单位为 °C。',
                humidity: '湿度',
                humidityDescription: '湿度越高，越需要留意结露。',
                precipitation: '降水量',
                precipitationDescription: '黄色小于 1 mm，橙色为 1–2.5 mm，红色超过 2.5 mm。',
                windSpeed: '风速',
                windSpeedDescription: '绿色不超过 16 km/h，黄色为 17–32 km/h，红色超过 32 km/h。',
                windDirection: '风向',
                windDirectionDescription: '箭头指向风的来向。',
                visibility: '能见度',
                visibilityDescription: '示例数字的单位为千米。数值越大，远处空气通常越通透。',
                aerosolAod: '气溶胶 AOD',
                aerosolAodDescription: 'AOD 为 550 nm 全大气柱气溶胶光学厚度；从左到右依次为很低、较低、偏高、较高。数值越低，气溶胶对光的衰减通常越弱，但不能直接换算为能见度。两项由 Open-Meteo 提供，其中 AOD 使用 CAMS 数据，不随 EC、GFS 或 ICON 切换。',
                celestialEvents: '日月升落时间',
                celestialEventsDescription: '太阳和月亮图标用于区分天体；↑ 表示升起，↓ 表示落下，时间为观察点当地时间。',
            },
            events: {
                all: '全部',
                sunrise: '日出',
                sunset: '日落',
                moonrise: '月升',
                moonset: '月落',
            },
            timeline: {
                dawn: '蓝调',
                sunrise: '日出',
                sunset: '日落',
                moonrise: '月升',
                moonset: '月落',
            },
            intervals: {
                'moonless-night': '无月黑夜',
                'milky-way': '银河时段',
            },
            legend: {
                origin: '用户位置',
                sunBefore: '太阳前 30 分钟',
                sunEvent: '太阳事件时刻',
                sunAfter: '太阳后 30 分钟',
                moonBefore: '月亮前 30 分钟',
                moonEvent: '月亮事件时刻',
                moonAfter: '月亮后 30 分钟',
                currentSun: '当前太阳方位',
                currentMoon: '当前月亮方位',
            },
            phases: ['新月', '娥眉月', '上弦月', '盈凸月', '满月', '亏凸月', '下弦月', '残月'],
        },
        en: {
            dateLabel: 'Date',
            eventSelectorLabel: 'Choose event',
            languageToggleLabel: 'Switch to Chinese',
            collapsePanelLabel: 'Collapse to direction-line mode',
            expandCompactPanelLabel: 'Expand panel',
            expandPanelLabel: 'Show fullscreen',
            restorePanelLabel: 'Restore compact window',
            fitDirectionLinesLabel: distanceKm => `Fit ${distanceKm} km direction lines`,
            restoreSearchZoomLabel: 'Restore search-location zoom',
            panelIntro: 'Key sun and moon times, direction lines 30 minutes before and after each event, and night observing windows.',
            sunMoonPanelLabel: 'Sun and moon information panel',
            summaryViewsLabel: 'Sun and moon information views',
            astronomyPanelLabel: (date, isToday) => isToday ? 'Today’s astronomy windows' : `Astronomy windows for ${date}`,
            currentMoonPhaseLabel: 'Moon phase',
            astronomyEventsLabel: (date, isToday) => isToday ? 'Today’s astronomy events' : `Astronomy events for ${date}`,
            nightObservationWindowsLabel: 'Night observing windows',
            observationEvidenceLabel: 'Weather evidence for the observing window',
            observationEvidenceLoading: 'Matching forecast to this window…',
            observationEvidenceOutsideRange: 'This date is outside the current five-day forecast',
            observationEvidenceMissing: 'No forecast data is available for this window',
            observationEvidencePartial: 'The current forecast covers only part of this window',
            observationEvidenceUnavailable: 'Observing weather is unavailable',
            observationMetricLabels: {
                totalCloudPercent: 'Clouds',
                precipMm: 'Precip.',
                visibilityKm: 'Visibility',
            },
            mapLegendLabel: 'Map legend',
            eventDirectionLinesLabel: event => `${event} direction-line data`,
            favoriteLocationsLabel: 'Favorite locations',
            locationFavoritesLabel: location => `${location}. Open favorite locations`,
            favoriteLocationsCountLabel: count => `Open ${count} favorite locations`,
            saveCurrentLocationFavoriteLabel: 'Save current location',
            removeCurrentLocationFavoriteLabel: 'Remove current location from favorites',
            eventTab: 'Events',
            weatherTab: 'Weather',
            guideTab: 'Guide',
            settingsTab: 'Settings',
            aboutTab: 'About',
            retry: 'Retry',
            eventTimeSuffix: ' time',
            now: 'Now',
            currentDirectionsLabel: 'Current sun and moon directions',
            sun: 'Sun',
            moon: 'Moon',
            altitude: '∠',
            locationResolvingLabel: 'Resolving place…',
            elevationLabel: 'Elevation',
            calculating: 'Calculating…',
            noInterval: 'No window today',
            intervalUnavailable: 'Unavailable',
            timelineEnded: 'Today’s astronomy windows have ended',
            timelinePrefix: '',
            timelineStartSuffix: 'starts in',
            moonPhaseLoading: 'Calculating phase',
            lightPollutionLoadError: 'Unable to load light pollution data. Please try again.',
            lightPollutionOutOfBounds: 'This location is outside atlas coverage (65°S to 75°N).',
            aboutDescription: 'Solar event lines are solid; moonrise and moonset lines are dashed. Each event includes directions 30 minutes before, at the event, and 30 minutes after.',
            guideHeading: 'Map guide',
            featureGuideHeading: 'Feature guide',
            featureGuide: {
                favorites: {
                    title: 'Favorite locations',
                    description: 'Use the bookmark button to save or remove the current location. The list shows distance, elevation, and light pollution, with sorting by distance, recency, elevation, or light pollution.',
                },
                comparison: {
                    title: 'Favorite location comparison',
                    description: 'Select 2–5 favorites to compare moonless and Milky Way windows, weather, light pollution, and moon phase for the same observing date.',
                },
                coordinates: {
                    title: 'Exact coordinate location',
                    description: 'Choose WGS84 or GCJ-02 from the search menu and enter latitude and longitude separately. GCJ-02 is converted to the WGS84 coordinates used by Windy.',
                },
                observationEvidence: {
                    title: 'Observing-window evidence',
                    description: 'Moonless and Milky Way windows now show total cloud cover, precipitation, and visibility from the selected forecast model.',
                },
                mobileMode: {
                    title: 'Mobile direction-line mode',
                    description: 'Collapse the panel while keeping search, date, event, live directions, and daily event times. The direction-line or compact choice is remembered.',
                },
                mapControls: {
                    title: 'Map view controls',
                    description: 'Use “−” to fit the full direction-line range and “+” to restore the detailed search-location zoom.',
                },
            },
            settingsGuideHeading: 'Settings guide',
            settingsHeading: 'Plugin settings',
            lineOpacityLabel: 'Direction line opacity',
            lineOpacityDescription: 'Adjust all sun and moon direction lines on the map. This setting is saved in this browser.',
            show600Label: 'Show 600 km point',
            show600Description: 'When enabled, event direction lines extend to 600 km and add a reference point there. This setting is saved in this browser.',
            hideLocationSearchLabel: 'Hide location search',
            hideLocationSearchDescription: 'Hide place-name and coordinate search without removing saved map API keys. This setting is saved in this browser.',
            locationApiKeyLabel: 'Domestic location search API keys',
            locationApiKeyPlaceholder: 'Enter API Key',
            locationApiKeyDescription: 'Configure Amap, Baidu, and Tencent, then switch providers in search. Keys stay in this browser.',
            locationApiKeySave: 'Save',
            locationApiKeyClear: 'Clear',
            locationApiKeySaved: 'Saved',
            locationProviderLabels: {
                amap: 'Amap Web Service API Key',
                baidu: 'Baidu JavaScript API Key',
                tencent: 'Tencent WebService API Key',
            },
            locationProviderDescriptions: {
                amap: 'Uses Amap input tips and converts GCJ-02 results to Windy coordinates.',
                baidu: 'Uses Baidu JSAPI 4.0 local search and converts BD-09 results to Windy coordinates.',
                tencent: 'Uses Tencent keyword suggestions and converts GCJ-02 results to Windy coordinates.',
            },
            locationProviderApplyLabels: {
                amap: 'Apply for Amap Key',
                baidu: 'Apply for Baidu Key',
                tencent: 'Apply for Tencent Key',
            },
            aboutHeading: 'About plugin',
            aboutAuthorLabel: 'Author',
            aboutVersionLabel: 'Version',
            aboutLinksLabel: 'Project links',
            aboutGithubLabel: 'GitHub repo',
            aboutIssuesLabel: 'Issues',
            aboutStarLabel: 'Star',
            aboutStarHint: 'If this plugin helps, please consider starring it on GitHub.',
            weatherLoadError: 'Unable to load weather model data. Please try again.',
            atmosphereLoadError: 'Unable to load AOD and visibility data from Open-Meteo.',
            timeZoneLoadError: 'Unable to load the observer time zone. Please try again.',
            timeZoneInvalidError: 'Windy returned an invalid observer time zone. Please try again.',
            astronomyLoadError: 'Unable to calculate sun and moon directions. Please try again.',
            weatherLegend: {
                heading: 'Weather legend',
                cloud: 'Cloud cover',
                cloudDescription: 'More white fill means more cloud. Total cover shows overall obstruction; high, medium, and low show cloud-layer height.',
                temperature: 'Temperature',
                temperatureDescription: 'Colors progress from colder to hotter. Values are in °C.',
                dewPoint: 'Dew point',
                dewPointDescription: 'Green means lower condensation risk, yellow needs attention, and red means condensation is likely. Values are in °C.',
                humidity: 'Humidity',
                humidityDescription: 'Higher humidity means a greater need to watch for condensation.',
                precipitation: 'Precipitation',
                precipitationDescription: 'Yellow is below 1 mm, orange is 1–2.5 mm, and red is above 2.5 mm.',
                windSpeed: 'Wind speed',
                windSpeedDescription: 'Green is up to 16 km/h, yellow is 17–32 km/h, and red is above 32 km/h.',
                windDirection: 'Wind direction',
                windDirectionDescription: 'The arrow points toward the direction the wind comes from.',
                visibility: 'Visibility',
                visibilityDescription: 'Sample values are in kilometres. Higher values usually mean clearer air over longer distances.',
                aerosolAod: 'Aerosol AOD',
                aerosolAodDescription: 'AOD is total-column aerosol optical depth at 550 nm. From left to right, the samples mean very low, low, elevated, and high. Lower values usually mean less light attenuation by aerosols, but AOD cannot be converted directly into visibility. Open-Meteo provides both fields, with AOD sourced from CAMS independently of the EC, GFS, or ICON selection.',
                celestialEvents: 'Sun and moon rise/set times',
                celestialEventsDescription: 'Sun and moon icons identify the celestial body; ↑ means rise and ↓ means set. Times use the observer location\'s local time.',
            },
            events: {
                all: 'All',
                sunrise: 'Sunrise',
                sunset: 'Sunset',
                moonrise: 'Moonrise',
                moonset: 'Moonset',
            },
            timeline: {
                dawn: 'Blue',
                sunrise: 'Sunrise',
                sunset: 'Sunset',
                moonrise: 'Moonrise',
                moonset: 'Moonset',
            },
            intervals: {
                'moonless-night': 'Moonless night',
                'milky-way': 'Milky Way',
            },
            legend: {
                origin: 'Observer',
                sunBefore: 'Sun -30 min',
                sunEvent: 'Sun event',
                sunAfter: 'Sun +30 min',
                moonBefore: 'Moon -30 min',
                moonEvent: 'Moon event',
                moonAfter: 'Moon +30 min',
                currentSun: 'Current sun',
                currentMoon: 'Current moon',
            },
            phases: ['New', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full', 'Waning gibbous', 'Last quarter', 'Waning crescent'],
        },
    };
    const SHOW_600_STORAGE_KEY = 'windy-plugin-sun-moon-path:show-600km';
    const UI_LANGUAGE_STORAGE_KEY = 'windy-plugin-sun-moon-path:ui-language';
    const MOBILE_PANEL_MODE_STORAGE_KEY = 'windy-plugin-sun-moon-path:mobile-panel-mode';
    const HIDE_LOCATION_SEARCH_STORAGE_KEY = 'windy-plugin-sun-moon-path:hide-location-search';
    const DIRECTION_LINE_OPACITY_STORAGE_KEY = 'windy-plugin-sun-moon-path:direction-line-opacity';
    const LOCATION_PROVIDER_STORAGE_KEY = 'windy-plugin-sun-moon-path:location-provider';
    const LOCATION_PROVIDER_API_KEY_STORAGE_KEYS: Record<LocationProvider, string> = {
        amap: 'windy-plugin-sun-moon-path:amap-api-key',
        baidu: 'windy-plugin-sun-moon-path:baidu-api-key',
        tencent: 'windy-plugin-sun-moon-path:tencent-api-key',
    };
    const LOCATION_PROVIDER_APPLICATION_URLS: Record<LocationProvider, string> = {
        amap: 'https://lbs.amap.com/api/webservice/create-project-and-key',
        baidu: 'https://lbsyun.baidu.com/docs/jsapi?title=jsapi4/quickstart/prepare',
        tencent: 'https://lbs.qq.com/webApi/javascriptGL/glGuide/glBasic',
    };
    const DEFAULT_DIRECTION_LINE_OPACITY_PERCENT = 100;
    const SEARCH_LOCATION_ZOOM = 12;
    const MAP_VIEW_EDGE_PADDING_PX = 18;
    const MOBILE_MAP_RECENTER_DELAY_MS = 550;
    let lastKnownGpsLocation: Coordinates | null = null;
    const cachedGpsLocation = (): Coordinates | null => {
        const gpsLocation = gpsCoordinatesFromLocation(getMyLatestPos());
        if (gpsLocation) {
            lastKnownGpsLocation = gpsLocation;
        }
        return gpsLocation || lastKnownGpsLocation;
    };
    const defaultLocation = (): Coordinates => {
        const mapCenter = coordinatesFromLocation(map.getCenter());
        if (!mapCenter) {
            throw new Error('Windy map center is unavailable');
        }
        return cachedGpsLocation() || mapCenter;
    };
    const observationPlanner = createObservationPlanner({
        getTimeZone: async (location, datetime) => (await getTimezoneInfo(location, datetime)).data.TZname,
        getElevation: async location => (await getElevation(location.lat, location.lon)).data,
    });
    const mapOverlayController = createMapOverlayController(map);

    let selectedLocation: Coordinates = {
        ...defaultLocation(),
    };
    let favoriteDistanceOrigin: Coordinates | null = cachedGpsLocation();
    let selectedDate = dateInputForInstant(new Date(), systemTimeZone);
    let selectedEvent: DirectionEvent = 'sunset';
    let uiLanguage: UiLanguage = 'zh';
    let text = translations.zh;
    let timeZone = systemTimeZone;
    let elevationM = 0;
    let solarPaths: SolarPath[] = [];
    let activeSolarPath: SolarPath | null = null;
    let astronomyTimeline: AstronomyTimeline | null = null;
    let currentSolarDirection: SolarDirection | null = null;
    let currentMoonInfo: CurrentMoonInfo | null = null;
    let displayedMoonIllumination: { fraction: number; waxing: boolean } | null = null;
    let currentInstant = new Date();
    let timelineLeadLabel = '正在计算…';
    let timelineLeadTime = '';
    let locationDisplayName = '';
    let eventLocationDisplayName = '';
    let locationNameResolved = false;
    let locationNameOverflows = false;
    let favoritesOpen = false;
    let favoriteComparisonOpen = false;
    let favoriteComparisonTargets: FavoriteComparisonTarget[] = [];
    let favoriteCount = 0;
    let currentLocationSaved = false;
    let currentFavoriteActionDisabled = true;
    let favoriteLocationsComponent: FavoriteLocations | null = null;
    let favoriteReturnFocus: HTMLElement | null = null;
    let locationElevationText = '--';
    let sunriseAzimuthLabel = '';
    let sunsetAzimuthLabel = '';
    let moonriseAzimuthLabel = '';
    let moonsetAzimuthLabel = '';
    let moonShadowCenterValue = 24;
    let summaryTab: SummaryTab = 'events';
    let weatherModel: WeatherModel = 'ecmwf';
    let baseWeatherPoints: WeatherPoint[] = [];
    let weatherPoints: WeatherPoint[] = [];
    let weatherStatus: WeatherLoadStatus = 'idle';
    let weatherErrorMessage = '';
    let weatherRequestKey = '';
    let weatherLoadedKey = '';
    let weatherLoadingKey = '';
    let locationKey = '';
    let resolvedContextLocationKey = '';
    let elevationLocationKey = '';
    let latestWeatherRequestId = 0;
    let weatherAbortController: AbortController | null = null;
    let atmospherePoints: OpenMeteoAtmospherePoint[] = [];
    let atmosphereStatus: WeatherLoadStatus = 'idle';
    let atmosphereErrorMessage = '';
    let atmosphereRequestKey = '';
    let atmosphereLoadedKey = '';
    let atmosphereLoadingKey = '';
    let latestAtmosphereRequestId = 0;
    let atmosphereAbortController: AbortController | null = null;
    let lightPollutionPoint: LightPollutionPoint | null = null;
    let lightPollutionStatus: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
    let lightPollutionErrorMessage = '';
    let lightPollutionErrorKind: 'none' | 'network' | 'out-of-bounds' = 'none';
    let lightPollutionRequestKey = '';
    let lightPollutionLoadedKey = '';
    let lightPollutionLoadingKey = '';
    let latestLightPollutionRequestId = 0;
    let lightPollutionAbortController: AbortController | null = null;
    let showExtendedDistanceMarker = false;
    let hideLocationSearch = false;
    let directionLineOpacityPercent = DEFAULT_DIRECTION_LINE_OPACITY_PERCENT;
    let locationSearchProvider: LocationProvider = 'amap';
    let locationApiKeys: LocationProviderApiKeys = { amap: '', baidu: '', tencent: '' };
    let locationApiKeyDrafts: LocationProviderApiKeys = { amap: '', baidu: '', tencent: '' };
    let savedApiKeyProvider: LocationProvider | null = null;
    let observationWindows: ObservationWindow[] = [];
    let status: 'idle' | 'loading' | 'ready' | 'empty' | 'error' = 'idle';
    let errorMessage = '';
    let isMounted = false;
    let latestRequestId = 0;
    let panelElement: HTMLElement | null = null;
    let mobilePluginRoot: HTMLElement | null = null;
    let mobileBottomWrapper: HTMLElement | null = null;
    let mobilePanelMode: MobilePanelMode = 'compact';
    let lastMobileNonFullscreenMode: MobileNonFullscreenPanelMode = 'compact';
    let astronomyKey = '';
    let currentDirectionTimer: ReturnType<typeof setInterval> | null = null;
    let locationSyncTimer: ReturnType<typeof setTimeout> | null = null;
    let mapDetailRecenterTimer: ReturnType<typeof setTimeout> | null = null;
    let releaseOverlayOwnership: (() => void) | null = null;
    let currentLocationRequestId = 0;
    let favoriteDistanceRequestId = 0;
    let locationNameRequestId = 0;
    let mapWasDragged = false;
    let reopenAfterHome = false;
    let addressSelectedLocation: Pick<LocationSearchResult, 'wgs84'> | null = null;
    let canFitDirectionLines = false;

    $: text = translations[uiLanguage];

    $: selectedDateIsToday = dateInputForInstant(currentInstant, timeZone) === selectedDate;

    $: accessibleSelectedDateLabel = formatAccessibleDateLabel(selectedDate, uiLanguage);

    $: isMobileCollapsed = isMobileOrTablet && mobilePanelMode === 'collapsed';

    $: isMobileFullscreen = isMobileOrTablet && mobilePanelMode === 'fullscreen';

    // Observation evidence belongs to the Events view, so both compact data
    // views must trigger the same weather and atmosphere requests on mobile.
    $: shouldLoadVisibleWeatherData = !isMobileCollapsed
        && (!isMobileOrTablet || isMobileFullscreen || summaryTab === 'events' || summaryTab === 'weather');

    $: if (mobilePluginRoot) {
        mobilePluginRoot.classList.toggle(
            'sun-path-favorites-open',
            isMobileOrTablet && (favoritesOpen || favoriteComparisonOpen),
        );
    }

    $: eventLocationDisplayName = compactLocationLabel(locationDisplayName);

    $: astronomyKey = makeAstronomyKey(selectedLocation, selectedDate);

    $: locationKey = buildWeatherLocationKey(selectedLocation);

    $: locationElevationText = elevationLocationKey === locationKey
        ? `${Math.round(elevationM)} m`
        : '--';

    $: weatherRequestKey = buildWeatherRequestKey(weatherModel, locationKey, currentInstant.getTime());

    $: atmosphereRequestKey = buildOpenMeteoRequestKey(locationKey, currentInstant.getTime());

    $: weatherPoints = mergeOpenMeteoAtmosphere(baseWeatherPoints, atmospherePoints);

    $: selectedWeatherDate = findWeatherDateSelection(weatherPoints, timeZone, selectedDate);

    $: lightPollutionRequestKey = locationKey;

    $: lightPollutionErrorMessage = lightPollutionErrorKind === 'out-of-bounds'
        ? text.lightPollutionOutOfBounds
        : lightPollutionErrorKind === 'network'
            ? text.lightPollutionLoadError
            : '';

    $: if (isMounted && astronomyKey) {
        void refreshPaths(astronomyKey);
    }

    $: if (shouldLoadWeather({
        isMounted,
        isWeatherTabActive: shouldLoadVisibleWeatherData,
        locationKey,
        resolvedContextLocationKey,
        requestKey: weatherRequestKey,
        loadedKey: weatherLoadedKey,
        loadingKey: weatherLoadingKey,
    })) {
        void refreshWeather(weatherRequestKey);
    }

    $: if (shouldLoadWeather({
        isMounted,
        isWeatherTabActive: shouldLoadVisibleWeatherData,
        locationKey,
        resolvedContextLocationKey,
        requestKey: atmosphereRequestKey,
        loadedKey: atmosphereLoadedKey,
        loadingKey: atmosphereLoadingKey,
    })) {
        void refreshAtmosphere(atmosphereRequestKey);
    }

    $: if (
        isMounted
        && !isMobileCollapsed
        && lightPollutionRequestKey
        && lightPollutionRequestKey !== lightPollutionLoadedKey
        && lightPollutionRequestKey !== lightPollutionLoadingKey
    ) {
        void refreshLightPollution(lightPollutionRequestKey);
    }

    $: activeSolarPath = selectedEvent === 'all'
        ? null
        : solarPaths.find(path => path.event === selectedEvent) || null;

    $: {
        const selectedDayReference = dateInputForInstant(currentInstant, timeZone) === selectedDate
            ? currentInstant.getTime()
            : dateInputToUtcNoon(selectedDate, timeZone).getTime();
        observationWindows = buildObservationWindows({
            timeline: astronomyTimeline,
            weatherPoints,
            lightPollution: lightPollutionPoint,
            referenceTime: selectedDayReference,
        });
    }

    $: if (isMounted) {
        setUrl(name, { lat: selectedLocation.lat, lon: selectedLocation.lon });
    }

    const eventDisplayName = (event: DirectionEvent, labels = text): string => {
        return labels.events[event] || event;
    };

    const loadLanguagePreference = (): UiLanguage => {
        try {
            return localStorage.getItem(UI_LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : 'zh';
        } catch {
            return 'zh';
        }
    };

    const saveLanguagePreference = (value: UiLanguage) => {
        try {
            localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, value);
        } catch {
            // Storage can be unavailable in hardened browser modes; the language still works for this session.
        }
    };

    const loadMobilePanelModePreference = (): MobileNonFullscreenPanelMode => {
        try {
            return localStorage.getItem(MOBILE_PANEL_MODE_STORAGE_KEY) === 'collapsed'
                ? 'collapsed'
                : 'compact';
        } catch {
            return 'compact';
        }
    };

    const saveMobilePanelModePreference = (value: MobileNonFullscreenPanelMode) => {
        try {
            localStorage.setItem(MOBILE_PANEL_MODE_STORAGE_KEY, value);
        } catch {
            // Storage can be unavailable in hardened browser modes; the panel mode still works for this session.
        }
    };

    const loadHideLocationSearchPreference = (): boolean => {
        try {
            return localStorage.getItem(HIDE_LOCATION_SEARCH_STORAGE_KEY) === 'true';
        } catch {
            return false;
        }
    };

    const saveHideLocationSearchPreference = (value: boolean) => {
        try {
            localStorage.setItem(HIDE_LOCATION_SEARCH_STORAGE_KEY, String(value));
        } catch {
            // Storage can be unavailable in hardened browser modes; the setting still works for this session.
        }
    };

    const toggleLocationSearch = (event: Event) => {
        hideLocationSearch = (event.currentTarget as HTMLInputElement).checked;
        saveHideLocationSearchPreference(hideLocationSearch);
    };

    const suspendMobileDetailRequests = () => {
        if (weatherLoadingKey) {
            latestWeatherRequestId += 1;
            weatherAbortController?.abort();
            weatherAbortController = null;
            weatherLoadingKey = '';
            weatherStatus = 'idle';
        }
        if (atmosphereLoadingKey) {
            latestAtmosphereRequestId += 1;
            atmosphereAbortController?.abort();
            atmosphereAbortController = null;
            atmosphereLoadingKey = '';
            atmosphereStatus = 'idle';
        }
        if (lightPollutionLoadingKey) {
            latestLightPollutionRequestId += 1;
            lightPollutionAbortController?.abort();
            lightPollutionAbortController = null;
            lightPollutionLoadingKey = '';
            lightPollutionStatus = 'idle';
        }
    };

    const toggleLanguage = () => {
        favoritesOpen = false;
        favoriteReturnFocus = null;
        uiLanguage = uiLanguage === 'zh' ? 'en' : 'zh';
        saveLanguagePreference(uiLanguage);
    };

    const setMobilePanelMode = (value: MobilePanelMode) => {
        if (!isMobileOrTablet) {
            return;
        }
        if (value === 'collapsed') {
            summaryTab = 'events';
        }
        if (value === 'fullscreen' && summaryTab === 'weather') {
            summaryTab = 'events';
        }
        mobilePluginRoot = mobilePluginRoot
            || panelElement?.closest<HTMLElement>('#plugin-windy-plugin-sun-moon-path')
            || null;
        mobileBottomWrapper = mobileBottomWrapper
            || mobilePluginRoot?.closest<HTMLElement>('#bottom-wrapper')
            || null;
        if (value === 'fullscreen') {
            if (mobilePanelMode !== 'fullscreen') {
                lastMobileNonFullscreenMode = mobilePanelMode;
            }
        } else {
            lastMobileNonFullscreenMode = value;
            saveMobilePanelModePreference(value);
        }
        favoritesOpen = false;
        favoriteReturnFocus = null;
        if (value === 'collapsed') {
            suspendMobileDetailRequests();
        }
        mobilePanelMode = value;
        const fullscreen = value === 'fullscreen';
        const collapsed = value === 'collapsed';
        mobilePluginRoot?.classList.toggle('sun-path-mobile-collapsed', collapsed);
        mobilePluginRoot?.classList.toggle('sun-path-mobile-fullscreen', fullscreen);
        mobileBottomWrapper?.classList.toggle('sun-path-mobile-fullscreen-wrapper', fullscreen);
    };

    const toggleMobileCollapsed = () => {
        setMobilePanelMode(isMobileCollapsed ? 'compact' : 'collapsed');
    };

    const toggleMobileFullscreen = () => {
        setMobilePanelMode(isMobileFullscreen ? lastMobileNonFullscreenMode : 'fullscreen');
    };

    const handleNestedWheel = (event: WheelEvent) => {
        if (!panelElement || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
            return;
        }
        const outerScroller = isMobileOrTablet
            ? panelElement.querySelector<HTMLElement>('.mobile-scroll-content')
            : panelElement;
        if (!outerScroller) {
            return;
        }
        const target = event.target instanceof Element ? event.target : null;
        const nestedScroller = target?.closest('.astronomy-panel, .module-about, .weather-table-scroll');
        if (!(nestedScroller instanceof HTMLElement) || !outerScroller.contains(nestedScroller)) {
            return;
        }

        const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE
            ? event.deltaY * 16
            : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
                ? event.deltaY * outerScroller.clientHeight
                : event.deltaY;
        const maximumScrollTop = Math.max(0, nestedScroller.scrollHeight - nestedScroller.clientHeight);
        const availableDistance = delta < 0
            ? nestedScroller.scrollTop
            : maximumScrollTop - nestedScroller.scrollTop;
        if (Math.abs(delta) <= availableDistance) {
            return;
        }

        event.preventDefault();
        nestedScroller.scrollTop = delta < 0 ? 0 : maximumScrollTop;
        const remainingDelta = delta < 0
            ? delta + availableDistance
            : delta - availableDistance;
        outerScroller.scrollTop += remainingDelta;
    };

    const handleSummaryTabKeydown = async (event: KeyboardEvent, currentTab: SummaryTab) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            return;
        }
        event.preventDefault();
        const summaryTabOrder = isMobileOrTablet && !isMobileFullscreen
            ? mobileSummaryTabOrder
            : desktopSummaryTabOrder;
        const currentIndex = summaryTabOrder.indexOf(currentTab);
        const nextTab = event.key === 'Home'
            ? summaryTabOrder[0]
            : event.key === 'End'
                ? summaryTabOrder.at(-1)!
                : summaryTabOrder[(currentIndex + (event.key === 'ArrowLeft' ? -1 : 1) + summaryTabOrder.length) % summaryTabOrder.length];
        summaryTab = nextTab;
        await tick();
        document.getElementById(`summary-tab-${nextTab}`)?.focus();
    };

    const selectedMapPaths = (paths = solarPaths): SolarPath[] =>
        selectObservationPaths(paths, selectedEvent);

    $: canFitDirectionLines = buildDirectionLineFitBounds({
        location: selectedLocation,
        // Keep the reactive inputs explicit: Svelte cannot infer state read
        // from inside selectedMapPaths(), so an async path refresh would
        // otherwise leave the toolbar button in its initial disabled state.
        paths: selectObservationPaths(solarPaths, selectedEvent),
        showExtendedDistanceMarker,
    }) !== null;

    /** Returns fit and center offsets for the map pixels not covered by Windy's UI. */
    const currentVisibleMapViewport = () => {
        const pluginRoot = panelElement?.closest<HTMLElement>('#plugin-windy-plugin-sun-moon-path') || null;
        const obstruction = pluginRoot && !isMobileFullscreen
            ? {
                side: isMobileOrTablet ? 'bottom' as const : 'right' as const,
                rect: pluginRoot.getBoundingClientRect(),
            }
            : null;

        return calculateVisibleMapViewport({
            // On wide desktop layouts Windy shifts the full-width Leaflet
            // container behind both the viewport edge and the plugin pane.
            // Use the real container rectangle so those hidden pixels are
            // included symmetrically instead of compensating the pane twice.
            containerRect: map.getContainer().getBoundingClientRect(),
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            obstruction,
            edgePadding: MAP_VIEW_EDGE_PADDING_PX,
        });
    };

    /** Fits the currently rendered 400/600 km event lines into the unobscured map area. */
    const fitVisibleDirectionLines = () => {
        const bounds = buildDirectionLineFitBounds({
            location: selectedLocation,
            paths: selectedMapPaths(),
            showExtendedDistanceMarker,
        });
        if (!bounds) {
            return;
        }

        map.stop?.();
        const visibleViewport = currentVisibleMapViewport();
        map.fitBounds(bounds, {
            animate: true,
            duration: 0.45,
            maxZoom: SEARCH_LOCATION_ZOOM,
            paddingTopLeft: visibleViewport.fitPaddingTopLeft,
            paddingBottomRight: visibleViewport.fitPaddingBottomRight,
        });
    };

    /** Centers the selected location inside the currently unobscured map region. */
    const centerSelectedLocationInVisibleMap = () => {
        const visibleViewport = currentVisibleMapViewport();
        centerMap({
            lat: selectedLocation.lat,
            lon: selectedLocation.lon,
            zoom: SEARCH_LOCATION_ZOOM,
            paddingTop: visibleViewport.centerPaddingTop,
            paddingLeft: visibleViewport.centerPaddingLeft,
        });
    };

    /** Restores the selected location to the exact zoom used after a search result is chosen. */
    const restoreSearchLocationZoom = () => {
        map.stop?.();
        if (mapDetailRecenterTimer) {
            clearTimeout(mapDetailRecenterTimer);
            mapDetailRecenterTimer = null;
        }

        centerSelectedLocationInVisibleMap();
        if (isMobileOrTablet && !isMobileFullscreen) {
            // A map interaction can make Windy's bottom timeline reserve more
            // height. Re-read the settled panel position once so one tap still
            // lands at the center of the final visible map area.
            mapDetailRecenterTimer = setTimeout(() => {
                mapDetailRecenterTimer = null;
                centerSelectedLocationInVisibleMap();
            }, MOBILE_MAP_RECENTER_DELAY_MS);
        }
    };

    const selectEvent = (event: DirectionEvent) => {
        selectedEvent = event;
        if (solarPaths.length === 0) {
            return;
        }
        const paths = selectedMapPaths();
        status = paths.some(path => path.status === 'ok') ? 'ready' : 'empty';
        renderMapFeatures(paths);
    };

    const loadExtendedDistancePreference = (): boolean => {
        try {
            return localStorage.getItem(SHOW_600_STORAGE_KEY) === 'true';
        } catch {
            return false;
        }
    };

    const saveExtendedDistancePreference = (value: boolean) => {
        try {
            localStorage.setItem(SHOW_600_STORAGE_KEY, String(value));
        } catch {
            // Storage can be unavailable in hardened browser modes; the setting still works for this session.
        }
    };

    const setShowExtendedDistanceMarker = (value: boolean) => {
        showExtendedDistanceMarker = value;
        saveExtendedDistancePreference(value);
        if (isMounted && solarPaths.length > 0) {
            renderMapFeatures(selectedMapPaths());
        }
    };

    const toggleExtendedDistanceMarker = (event: Event) => {
        setShowExtendedDistanceMarker((event.currentTarget as HTMLInputElement).checked);
    };

    const normalizeDirectionLineOpacityPercent = (value: number): number =>
        Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : DEFAULT_DIRECTION_LINE_OPACITY_PERCENT;

    const loadDirectionLineOpacityPreference = (): number => {
        try {
            const storedValue = localStorage.getItem(DIRECTION_LINE_OPACITY_STORAGE_KEY);
            return storedValue === null
                ? DEFAULT_DIRECTION_LINE_OPACITY_PERCENT
                : normalizeDirectionLineOpacityPercent(Number(storedValue));
        } catch {
            return DEFAULT_DIRECTION_LINE_OPACITY_PERCENT;
        }
    };

    const saveDirectionLineOpacityPreference = (value: number) => {
        try {
            localStorage.setItem(DIRECTION_LINE_OPACITY_STORAGE_KEY, String(value));
        } catch {
            // Storage can be unavailable in hardened browser modes; the setting still works for this session.
        }
    };

    const changeDirectionLineOpacity = (event: Event) => {
        const nextValue = normalizeDirectionLineOpacityPercent(
            Number((event.currentTarget as HTMLInputElement).value),
        );
        directionLineOpacityPercent = nextValue;
        saveDirectionLineOpacityPreference(nextValue);
        mapOverlayController.setOpacity(nextValue);
    };

    const loadLocationSearchProvider = (): LocationProvider => {
        try {
            const value = localStorage.getItem(LOCATION_PROVIDER_STORAGE_KEY);
            return LOCATION_PROVIDERS.includes(value as LocationProvider) ? value as LocationProvider : 'amap';
        } catch {
            return 'amap';
        }
    };

    const loadLocationApiKeys = (): LocationProviderApiKeys => {
        try {
            return Object.fromEntries(LOCATION_PROVIDERS.map(providerOption => [
                providerOption,
                localStorage.getItem(LOCATION_PROVIDER_API_KEY_STORAGE_KEYS[providerOption])?.trim() || '',
            ])) as LocationProviderApiKeys;
        } catch {
            return { amap: '', baidu: '', tencent: '' };
        }
    };

    const setLocationSearchProvider = (providerOption: LocationProvider) => {
        locationSearchProvider = providerOption;
        try {
            localStorage.setItem(LOCATION_PROVIDER_STORAGE_KEY, providerOption);
        } catch {
            // The provider still changes for this plugin session when storage is unavailable.
        }
    };

    const handleLocationProviderChange = (event: CustomEvent<LocationProvider>) => {
        setLocationSearchProvider(event.detail);
    };

    const updateLocationApiKeyDraft = (event: Event, providerOption: LocationProvider) => {
        locationApiKeyDrafts = {
            ...locationApiKeyDrafts,
            [providerOption]: (event.currentTarget as HTMLInputElement).value,
        };
        if (savedApiKeyProvider === providerOption) {
            savedApiKeyProvider = null;
        }
    };

    const saveLocationApiKey = (event: SubmitEvent, providerOption: LocationProvider) => {
        event.preventDefault();
        const nextKey = locationApiKeyDrafts[providerOption].trim();
        if (!nextKey) {
            return;
        }
        try {
            localStorage.setItem(LOCATION_PROVIDER_API_KEY_STORAGE_KEYS[providerOption], nextKey);
            savedApiKeyProvider = providerOption;
        } catch {
            savedApiKeyProvider = null;
        }
        const nextState = applyLocationApiKey(locationApiKeys, providerOption, nextKey);
        locationApiKeys = nextState.apiKeys;
        locationApiKeyDrafts = { ...locationApiKeyDrafts, [providerOption]: nextKey };
        setLocationSearchProvider(nextState.provider);
    };

    const clearLocationApiKey = (providerOption: LocationProvider) => {
        locationApiKeys = { ...locationApiKeys, [providerOption]: '' };
        locationApiKeyDrafts = { ...locationApiKeyDrafts, [providerOption]: '' };
        if (savedApiKeyProvider === providerOption) {
            savedApiKeyProvider = null;
        }
        try {
            localStorage.removeItem(LOCATION_PROVIDER_API_KEY_STORAGE_KEYS[providerOption]);
        } catch {
            // The in-memory key is cleared even when browser storage is unavailable.
        }
    };

    const refreshFavoriteDistanceOrigin = async () => {
        const cachedLocation = cachedGpsLocation();
        if (cachedLocation) {
            favoriteDistanceOrigin = cachedLocation;
            return;
        }
        const requestId = ++favoriteDistanceRequestId;
        try {
            const gpsLocation = await requestPreciseGpsLocation();
            if (!gpsLocation || requestId !== favoriteDistanceRequestId) {
                return;
            }
            lastKnownGpsLocation = gpsLocation;
            favoriteDistanceOrigin = gpsLocation;
        } catch {
            // Distances stay unavailable when precise device location cannot be obtained.
        }
    };

    const openFavoriteLocations = (event: MouseEvent) => {
        favoriteReturnFocus = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
        favoriteComparisonOpen = false;
        favoritesOpen = true;
        void refreshFavoriteDistanceOrigin();
    };

    const toggleFavoriteLocations = (event: MouseEvent) => {
        favoriteReturnFocus = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
        const nextOpen = !favoritesOpen;
        favoriteComparisonOpen = false;
        favoritesOpen = nextOpen;
        if (nextOpen) {
            void refreshFavoriteDistanceOrigin();
        }
    };

    const toggleCurrentLocationFavorite = () => {
        void favoriteLocationsComponent?.toggleCurrentFavorite();
    };

    const handleLocationToolsFocusIn = (event: FocusEvent) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('.location-search')) {
            favoritesOpen = false;
            favoriteComparisonOpen = false;
        }
    };

    const handleFavoriteOutsidePointerDown = (event: PointerEvent) => {
        if ((!favoritesOpen && !favoriteComparisonOpen) || !(event.target instanceof Node)) {
            return;
        }
        if (event.target instanceof Element && event.target.closest(
            '#favorite-locations-panel, #favorite-comparison-panel, .favorite-locations-trigger, .astronomy-location__button, .astronomy-location__favorite',
        )) {
            return;
        }
        favoritesOpen = false;
        favoriteComparisonOpen = false;
    };

    const makeAstronomyKey = (location: Coordinates, dateInput: string): string =>
        `${dateInput}|${location.lat}|${location.lon}`;

    const lineColorForEvent = (event: DirectionEvent, kind: SolarSampleKind): string =>
        event === 'moonrise' || event === 'moonset' ? MOON_LINE_COLORS[kind] : LINE_COLORS[kind];

    const compassDirectionLabel = (azimuth: number, language = uiLanguage): string => {
        if (language === 'zh') {
            return compassDirection(azimuth);
        }
        const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        return labels[Math.round(((azimuth % 360) + 360) % 360 / 45) % labels.length];
    };

    const renderMapFeatures = (paths: SolarPath[]) => {
        mapOverlayController.render({
            location: selectedLocation,
            paths,
            currentSun: currentSolarDirection,
            currentMoon: currentMoonInfo,
            showExtendedDistanceMarker,
            opacityPercent: directionLineOpacityPercent,
            originLabel: text.legend.origin,
            eventNames: text.events,
        });
    };

    const refreshCurrentDirectionValues = () => {
        currentInstant = new Date();
        try {
            currentSolarDirection = calculateCurrentSolarDirection({
                date: currentInstant,
                location: selectedLocation,
            });
            currentMoonInfo = calculateCurrentMoonInfo({
                date: currentInstant,
                location: selectedLocation,
            });
        } catch {
            currentSolarDirection = null;
            currentMoonInfo = null;
        }
    };

    const updateCurrentDirections = () => {
        refreshCurrentDirectionValues();
        mapOverlayController.updateCurrent({
            location: selectedLocation,
            currentSun: currentSolarDirection,
            currentMoon: currentMoonInfo,
            opacityPercent: directionLineOpacityPercent,
        });
    };

    const refreshPaths = async (key: string) => {
        const requestId = ++latestRequestId;
        const location = { ...selectedLocation };
        const dateInput = selectedDate;
        const contextLocationKey = buildWeatherLocationKey(location);
        const knownElevation = elevationLocationKey === contextLocationKey && Number.isFinite(elevationM)
            ? elevationM
            : null;

        status = 'loading';
        errorMessage = '';
        solarPaths = [];
        astronomyTimeline = null;
        mapOverlayController.destroy();

        try {
            const plan = await observationPlanner.plan({ location, dateInput, knownElevationM: knownElevation });
            if (requestId !== latestRequestId || key !== astronomyKey) {
                return;
            }

            timeZone = plan.timeZone;
            resolvedContextLocationKey = contextLocationKey;
            elevationLocationKey = contextLocationKey;
            elevationM = plan.elevationM;
            solarPaths = plan.paths;
            astronomyTimeline = plan.timeline;
            const selectedPaths = selectObservationPaths(plan.paths, selectedEvent);
            status = selectedPaths.some(path => path.status === 'ok') ? 'ready' : 'empty';
            renderMapFeatures(selectedPaths);
        } catch (error) {
            if (requestId !== latestRequestId || key !== astronomyKey) {
                return;
            }

            status = 'error';
            solarPaths = [];
            astronomyTimeline = null;
            errorMessage = error instanceof ObservationPlannerError
                ? error.code === 'TIME_ZONE_UNAVAILABLE'
                    ? text.timeZoneLoadError
                    : text.timeZoneInvalidError
                : text.astronomyLoadError;
        }
    };

    const refreshWeather = async (key: string) => {
        weatherAbortController?.abort();
        const abortController = new AbortController();
        weatherAbortController = abortController;
        const requestId = ++latestWeatherRequestId;
        const requestModel = weatherModel;
        const requestLocation = { ...selectedLocation };
        const requestedAt = Date.now();

        weatherLoadingKey = key;
        weatherStatus = 'loading';
        weatherErrorMessage = '';
        baseWeatherPoints = [];

        try {
            const result = await getPointForecastData(
                requestModel,
                {
                    lat: requestLocation.lat,
                    lon: requestLocation.lon,
                    days: 5,
                    step: 1,
                    source: 'detail',
                },
                {
                    header: true,
                    meteogram: true,
                    sounding: true,
                },
                { abortSignal: abortController.signal },
            );

            if (!isWeatherResponseCurrent({
                aborted: abortController.signal.aborted,
                requestId,
                latestRequestId: latestWeatherRequestId,
                requestKey: key,
                currentRequestKey: weatherRequestKey,
            })) {
                return;
            }

            const nextPoints = transformWeatherPayload(
                result.data as WeatherForecastPayload,
                requestedAt,
            );
            baseWeatherPoints = nextPoints;
            weatherStatus = nextPoints.length > 0 ? 'ready' : 'empty';
            weatherLoadedKey = key;
        } catch (error) {
            if (!isWeatherResponseCurrent({
                aborted: abortController.signal.aborted,
                requestId,
                latestRequestId: latestWeatherRequestId,
                requestKey: key,
                currentRequestKey: weatherRequestKey,
            })) {
                return;
            }
            weatherStatus = 'error';
            weatherErrorMessage = error instanceof Error && error.message
                ? `${text.weatherLoadError} ${error.message}`
                : text.weatherLoadError;
            weatherLoadedKey = key;
        } finally {
            if (requestId === latestWeatherRequestId) {
                weatherLoadingKey = '';
            }
        }
    };

    const refreshAtmosphere = async (key: string) => {
        atmosphereAbortController?.abort();
        const abortController = new AbortController();
        atmosphereAbortController = abortController;
        const requestId = ++latestAtmosphereRequestId;
        const requestLocation = { ...selectedLocation };

        atmosphereLoadingKey = key;
        atmosphereStatus = 'loading';
        atmosphereErrorMessage = '';
        atmospherePoints = [];

        try {
            const nextPoints = await fetchOpenMeteoAtmosphere({
                location: requestLocation,
                signal: abortController.signal,
            });
            if (!isWeatherResponseCurrent({
                aborted: abortController.signal.aborted,
                requestId,
                latestRequestId: latestAtmosphereRequestId,
                requestKey: key,
                currentRequestKey: atmosphereRequestKey,
            })) {
                return;
            }

            atmospherePoints = nextPoints;
            atmosphereStatus = nextPoints.length > 0 ? 'ready' : 'error';
            atmosphereErrorMessage = nextPoints.length > 0 ? '' : text.atmosphereLoadError;
            atmosphereLoadedKey = key;
        } catch {
            if (!isWeatherResponseCurrent({
                aborted: abortController.signal.aborted,
                requestId,
                latestRequestId: latestAtmosphereRequestId,
                requestKey: key,
                currentRequestKey: atmosphereRequestKey,
            })) {
                return;
            }

            atmospherePoints = [];
            atmosphereStatus = 'error';
            atmosphereErrorMessage = text.atmosphereLoadError;
            atmosphereLoadedKey = key;
        } finally {
            if (requestId === latestAtmosphereRequestId) {
                atmosphereLoadingKey = '';
            }
        }
    };

    const refreshLightPollution = async (key: string) => {
        lightPollutionAbortController?.abort();
        const abortController = new AbortController();
        lightPollutionAbortController = abortController;
        const requestId = ++latestLightPollutionRequestId;
        const requestLocation = { ...selectedLocation };

        lightPollutionLoadingKey = key;
        lightPollutionStatus = 'loading';
        lightPollutionErrorKind = 'none';
        lightPollutionPoint = null;

        try {
            const nextPoint = await fetchLightPollutionPoint(requestLocation, abortController.signal);
            if (!isLightPollutionResponseCurrent({
                aborted: abortController.signal.aborted,
                requestId,
                latestRequestId: latestLightPollutionRequestId,
                requestKey: key,
                currentRequestKey: lightPollutionRequestKey,
            })) {
                return;
            }

            lightPollutionPoint = nextPoint;
            lightPollutionStatus = 'ready';
            lightPollutionLoadedKey = key;
        } catch (error) {
            if (!isLightPollutionResponseCurrent({
                aborted: abortController.signal.aborted,
                requestId,
                latestRequestId: latestLightPollutionRequestId,
                requestKey: key,
                currentRequestKey: lightPollutionRequestKey,
            })) {
                return;
            }

            lightPollutionPoint = null;
            lightPollutionStatus = 'error';
            lightPollutionErrorKind = error instanceof LightPollutionOutOfBoundsError
                ? 'out-of-bounds'
                : 'network';
            lightPollutionLoadedKey = key;
        } finally {
            if (requestId === latestLightPollutionRequestId) {
                lightPollutionLoadingKey = '';
            }
        }
    };

    const retryLightPollution = () => {
        lightPollutionLoadedKey = '';
        lightPollutionLoadingKey = '';
        void refreshLightPollution(lightPollutionRequestKey);
    };

    const handleWeatherModelChange = (event: CustomEvent<WeatherModel>) => {
        weatherModel = event.detail;
        weatherLoadedKey = '';
    };

    const retryWeather = () => {
        weatherLoadedKey = '';
        weatherLoadingKey = '';
        void refreshWeather(weatherRequestKey);
    };

    const retryAtmosphere = () => {
        atmosphereLoadedKey = '';
        atmosphereLoadingKey = '';
        void refreshAtmosphere(atmosphereRequestKey);
    };

    const unavailableMessage = (
        event: SolarEvent,
        reason: 'always-up' | 'always-down' | 'not-available',
    ): string => {
        const nameForEvent = eventDisplayName(event, text);
        if (uiLanguage === 'en') {
            const body = event === 'moonrise' || event === 'moonset' ? 'moon' : 'sun';
            if (reason === 'always-up') {
                return `The ${body} stays above the horizon today; no ${nameForEvent} time is available.`;
            }
            if (reason === 'always-down') {
                return `The ${body} stays below the horizon today; no ${nameForEvent} time is available.`;
            }
            return `No ${nameForEvent} time is available today.`;
        }
        if (reason === 'always-up') {
            return `当天${nameForEvent === '月升' || nameForEvent === '月落' ? '月亮' : '太阳'}始终在地平线以上，没有可用的${nameForEvent}时刻。`;
        }
        if (reason === 'always-down') {
            return `当天${nameForEvent === '月升' || nameForEvent === '月落' ? '月亮' : '太阳'}始终在地平线以下，没有可用的${nameForEvent}时刻。`;
        }
        return `当天没有可用的${nameForEvent}时刻。`;
    };

    const coordinateLocationLabel = (location: Coordinates): string =>
        `${location.lat.toFixed(3)}, ${location.lon.toFixed(3)}`;

    const resolveLocationDisplayName = async (location: Coordinates, requestId: number) => {
        let nextName = '';
        try {
            nextName = detailedLocationLabel(await reverseName.get(location, DETAILED_REVERSE_NAME_ZOOM));
        } catch {
            // Coordinates remain an accurate fallback when reverse lookup is unavailable.
        }
        if (requestId !== locationNameRequestId || !isMapCenteredOnLocation(selectedLocation, location, 0.01)) {
            return;
        }
        locationDisplayName = nextName || coordinateLocationLabel(location);
        locationNameResolved = true;
    };

    const setLocation = (
        latLon: LatLon,
        reopenWhenClosed = true,
        displayName = '',
        knownElevationM?: number | null,
        knownLightPollution?: LightPollutionPoint | null,
    ) => {
        const nextLocation = coordinatesFromLocation(latLon);
        if (!nextLocation) {
            return;
        }

        selectedLocation = nextLocation;
        // Current azimuth and altitude are local calculations, so update them before async context loading.
        refreshCurrentDirectionValues();
        const nextLocationKey = buildWeatherLocationKey(nextLocation);
        const nameRequestId = ++locationNameRequestId;
        locationDisplayName = displayName.trim();
        locationNameResolved = Boolean(locationDisplayName);
        if (!locationDisplayName) {
            void resolveLocationDisplayName(nextLocation, nameRequestId);
        }
        if (Number.isFinite(knownElevationM)) {
            elevationM = Math.max(0, knownElevationM as number);
            elevationLocationKey = nextLocationKey;
        } else {
            elevationLocationKey = '';
        }
        resolvedContextLocationKey = '';
        weatherLoadedKey = '';
        weatherAbortController?.abort();
        baseWeatherPoints = [];
        weatherStatus = 'idle';
        latestAtmosphereRequestId += 1;
        atmosphereAbortController?.abort();
        atmosphereLoadedKey = '';
        atmosphereLoadingKey = '';
        atmospherePoints = [];
        atmosphereStatus = 'idle';
        atmosphereErrorMessage = '';
        latestLightPollutionRequestId += 1;
        lightPollutionAbortController?.abort();
        lightPollutionLoadingKey = '';
        lightPollutionErrorKind = 'none';
        if (knownLightPollution) {
            lightPollutionLoadedKey = nextLocationKey;
            lightPollutionPoint = knownLightPollution;
            lightPollutionStatus = 'ready';
        } else {
            lightPollutionLoadedKey = '';
            lightPollutionPoint = null;
            lightPollutionStatus = 'idle';
        }
        const nextKey = makeAstronomyKey(nextLocation, selectedDate);
        const needsImmediateRefresh = shouldRefreshSameLocationImmediately(isMounted, astronomyKey, nextKey);
        astronomyKey = nextKey;

        if (isMounted) {
            if (needsImmediateRefresh) {
                void refreshPaths(nextKey);
            }
            return;
        }

        setUrl(name, nextLocation);
        void refreshPaths(nextKey);
        if (reopenWhenClosed) {
            bcast.emit('rqstOpen', name, nextLocation);
        }
    };

    const setLocationFromMapClick = (latLon: LatLon) => {
        currentLocationRequestId += 1;
        addressSelectedLocation = null;
        favoritesOpen = false;
        setLocation(latLon);
    };

    const selectLocationSearchResult = (selection: LocationSearchSelection) => {
        currentLocationRequestId += 1;
        if (locationSyncTimer) {
            clearTimeout(locationSyncTimer);
            locationSyncTimer = null;
        }
        addressSelectedLocation = {
            wgs84: { ...selection.wgs84 },
        };
        favoritesOpen = false;
        setLocation(
            selection.wgs84,
            false,
            selection.name,
            selection.elevationM,
            selection.lightPollution,
        );
        centerMap({ lat: selection.wgs84.lat, lon: selection.wgs84.lon, zoom: SEARCH_LOCATION_ZOOM });
    };

    const handleLocationSearchSelect = (event: CustomEvent<LocationSearchSelection>) => {
        selectLocationSearchResult(event.detail);
    };

    const handleFavoriteLocationSelect = (event: CustomEvent<LocationSearchSelection>) => {
        selectLocationSearchResult(event.detail);
    };

    const handleFavoriteComparisonStart = (event: CustomEvent<FavoriteComparisonTarget[]>) => {
        favoriteComparisonTargets = event.detail;
        favoritesOpen = false;
        favoriteComparisonOpen = true;
    };

    const handleFavoriteComparisonBack = () => {
        favoriteComparisonOpen = false;
        favoritesOpen = true;
        void refreshFavoriteDistanceOrigin();
    };

    const handleFavoriteComparisonClose = () => {
        favoriteComparisonOpen = false;
    };

    const requestPreciseGpsLocation = async (): Promise<Coordinates | null> =>
        gpsCoordinatesFromLocation(await getGPSlocation({
            enableHighAccuracy: true,
            maximumAge: 60_000,
            timeout: 10_000,
            doNotShowFailureMessage: true,
            getMeFallbackGps: false,
        }));

    const centerOnCurrentGps = async (requestId: number) => {
        try {
            const gpsLocation = await requestPreciseGpsLocation();
            if (!gpsLocation || requestId !== currentLocationRequestId) {
                return;
            }

            lastKnownGpsLocation = gpsLocation;
            favoriteDistanceOrigin = gpsLocation;
            addressSelectedLocation = null;
            setLocation(gpsLocation, false);
            centerMap({ lat: gpsLocation.lat, lon: gpsLocation.lon, zoom: 6 });
        } catch {
            // Keep the current map center when precise GPS permission is unavailable.
        }
    };

    const syncLocationFromMapCenter = () => {
        const gpsLocation = cachedGpsLocation();
        if (gpsLocation) {
            favoriteDistanceOrigin = gpsLocation;
        }
        const mapCenter = coordinatesFromLocation(map.getCenter());
        if (!gpsLocation || !mapCenter || !isMapCenteredOnLocation(mapCenter, gpsLocation)) {
            return;
        }
        if (isMapCenteredOnLocation(selectedLocation, gpsLocation, 0.01)) {
            return;
        }

        currentLocationRequestId += 1;
        setLocation(gpsLocation, false);
    };

    const handleMapDragStart = () => {
        mapWasDragged = true;
        currentLocationRequestId += 1;
    };

    const handleMapMoveEnd = () => {
        if (mapWasDragged) {
            mapWasDragged = false;
            return;
        }

        if (addressSelectedLocation) {
            const mapCenter = coordinatesFromLocation(map.getCenter());
            if (mapCenter && isMapCenteredOnLocation(mapCenter, addressSelectedLocation.wgs84, 0.05)) {
                return;
            }
            addressSelectedLocation = null;
        }

        syncLocationFromMapCenter();
        if (locationSyncTimer) {
            clearTimeout(locationSyncTimer);
        }
        locationSyncTimer = setTimeout(syncLocationFromMapCenter, 750);
    };

    const requestReopenAfterHome = () => {
        if (reopenAfterHome) {
            return;
        }
        reopenAfterHome = true;
        currentLocationRequestId += 1;
        addressSelectedLocation = null;
    };

    const handleBackToHome = () => requestReopenAfterHome();

    const handleHomeButtonClick = (event: MouseEvent) => {
        if (isHomeButtonTarget(event.target)) {
            requestReopenAfterHome();
        }
    };

    const timelineEventLabel = (item: { kind: string; label: string }, labels = text): string => {
        if (item.kind === 'dawn' || item.kind === 'dusk') {
            return labels.timeline.dawn;
        }
        return labels.timeline[item.kind] || item.label;
    };

    const observeLocationNameOverflow = (node: HTMLElement, _label: string) => {
        const value = node.querySelector<HTMLElement>('.astronomy-location__name-value');
        const update = () => {
            locationNameOverflows = Boolean(value && value.scrollWidth > node.clientWidth + 1);
        };
        const scheduleUpdate = () => {
            void tick().then(update);
        };
        const observer = new ResizeObserver(update);
        observer.observe(node);
        if (value) {
            observer.observe(value);
        }
        scheduleUpdate();
        return {
            update: scheduleUpdate,
            destroy: () => observer.disconnect(),
        };
    };

    const eventAzimuthLabel = (paths: SolarPath[], event: SolarEvent): string => {
        const path = paths.find(
            (item): item is Extract<SolarPath, { status: 'ok' }> => item.event === event && item.status === 'ok',
        );
        const eventSample = path?.samples.find(sample => sample.kind === 'event');
        return eventSample ? `${Math.round(eventSample.azimuth)}°` : '';
    };

    $: sunriseAzimuthLabel = eventAzimuthLabel(solarPaths, 'sunrise');
    $: sunsetAzimuthLabel = eventAzimuthLabel(solarPaths, 'sunset');
    $: moonriseAzimuthLabel = eventAzimuthLabel(solarPaths, 'moonrise');
    $: moonsetAzimuthLabel = eventAzimuthLabel(solarPaths, 'moonset');

    const formatInterval = (interval: AstronomyInterval): string =>
        `${formatLocalClock(interval.start, timeZone)} ~ ${formatLocalClock(interval.end, timeZone)}`;

    const formatIntervalDuration = (interval: AstronomyInterval, language = uiLanguage): string =>
        formatRemaining(interval.end.getTime() - interval.start.getTime(), language);

    const observationEvidenceState = (slot: ObservationWindow): ObservationEvidenceState =>
        resolveObservationEvidenceState({
            weatherStatus,
            atmosphereStatus,
            dateCoverage: selectedWeatherDate.coverage,
            evidence: slot.evidence,
        });

    const observationEvidenceStateLabel = (state: ObservationEvidenceState): string => {
        if (state === 'outside-range') {
            return text.observationEvidenceOutsideRange;
        }
        if (state === 'missing') {
            return text.observationEvidenceMissing;
        }
        if (state === 'partial') {
            return text.observationEvidencePartial;
        }
        return text.observationEvidenceUnavailable;
    };

    const formatObservationRange = (range: ObservationMetricRange | null, maximumFractionDigits: number): string => {
        if (!range) {
            return '--';
        }
        const formatter = new Intl.NumberFormat(uiLanguage === 'zh' ? 'zh-CN' : 'en-US', {
            maximumFractionDigits,
        });
        const minimum = formatter.format(range.minimum);
        const maximum = formatter.format(range.maximum);
        return minimum === maximum ? minimum : `${minimum}–${maximum}`;
    };

    const formatObservationMeasurement = (
        range: ObservationMetricRange | null,
        maximumFractionDigits: number,
        unit: '%' | 'km',
    ): string => range
        ? `${formatObservationRange(range, maximumFractionDigits)}${unit === '%' ? '' : ' '}${unit}`
        : '--';

    const formatObservationPrecipitation = (range: ObservationMetricRange | null): string => {
        if (!range) {
            return '--';
        }
        if (range.maximum === 0) {
            return '0 mm';
        }
        return `${formatObservationRange(range, 1)} mm`;
    };

    const formatDateControlLabel = (dateInput: string): string => {
        const [year, month, day] = dateInput.split('-').map(value => Number.parseInt(value, 10));
        return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
            ? `${month}/${day}`
            : dateInput;
    };

    const formatAccessibleDateLabel = (dateInput: string, language: UiLanguage): string => {
        const [year, month, day] = dateInput.split('-').map(value => Number.parseInt(value, 10));
        if (![year, month, day].every(Number.isFinite)) {
            return dateInput;
        }
        return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC',
        }).format(Date.UTC(year, month - 1, day, 12));
    };

    const openDatePicker = (event: MouseEvent) => {
        const input = event.currentTarget;
        if (!(input instanceof HTMLInputElement)) {
            return;
        }
        // The compact control renders its own date text over a transparent native input.
        // Open the browser picker explicitly because appearance:none removes Chrome's calendar affordance.
        input.showPicker();
    };

    const formatRemaining = (milliseconds: number, language = uiLanguage): string => {
        const totalMinutes = Math.max(1, Math.round(milliseconds / 60_000));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (language === 'en') {
            return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        }
        return hours > 0 ? `${hours}小时${minutes}分钟` : `${minutes}分钟`;
    };

    const formatCompactRemaining = (milliseconds: number, language = uiLanguage): string => {
        const totalMinutes = Math.max(1, Math.round(milliseconds / 60_000));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (language === 'en') {
            return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        }
        return hours > 0 ? `${hours}h${minutes}m` : `${minutes}m`;
    };

    // 今日使用实时月相；选择其他日期时，使用该日当地中午的天文时间线月相。
    $: displayedMoonIllumination = selectedDateIsToday && currentMoonInfo
        ? {
            fraction: currentMoonInfo.illuminationFraction,
            waxing: currentMoonInfo.waxing,
        }
        : astronomyTimeline?.moonIllumination ?? null;

    $: moonIlluminationPercentText = (() => {
        const fraction = displayedMoonIllumination?.fraction;
        return typeof fraction === 'number' && Number.isFinite(fraction)
            ? `${(fraction * 100).toFixed(1)}%`
            : '';
    })();

    $: moonShadowCenterValue = (() => {
        const fraction = displayedMoonIllumination?.fraction ?? 0;
        const waxing = displayedMoonIllumination?.waxing ?? true;
        return 24 + (waxing ? -1 : 1) * fraction * 36;
    })();

    const nextWindowParts = (item: { kind: string; label: string; time?: Date | null }, language = uiLanguage): { label: string; time: string } => {
        if (!item.time) {
            return { label: language === 'en' ? 'Ended' : '已结束', time: '' };
        }
        if (language === 'en') {
            return {
                label: 'Next',
                time: formatCompactRemaining(item.time.getTime() - currentInstant.getTime(), language),
            };
        }
        return {
            label: '倒计时',
            time: formatCompactRemaining(item.time.getTime() - currentInstant.getTime(), language),
        };
    };

    $: {
        if (!astronomyTimeline) {
            timelineLeadLabel = text.calculating;
            timelineLeadTime = '';
        } else if (!selectedDateIsToday) {
            timelineLeadLabel = text.dateLabel;
            timelineLeadTime = formatDateControlLabel(selectedDate);
        } else {
            const next = astronomyTimeline.items.find(item => item.time && item.time.getTime() > currentInstant.getTime());
            const parts = next?.time
                ? nextWindowParts(next, uiLanguage)
                : { label: text.timelineEnded, time: '' };
            timelineLeadLabel = parts.label;
            timelineLeadTime = parts.time;
        }
    }

    export const onopen = (params?: LatLon) => {
        const requestId = ++currentLocationRequestId;
        addressSelectedLocation = null;
        favoriteDistanceOrigin = cachedGpsLocation();
        const nextLocation = params ? coordinatesFromLocation(params) || defaultLocation() : defaultLocation();
        setLocation(nextLocation, false);
        centerMap({ lat: selectedLocation.lat, lon: selectedLocation.lon, zoom: 6 });
        if (!params) {
            void centerOnCurrentGps(requestId);
        }
    };

    const overlayOwner = {
        deactivateForReplacement: () => {
            isMounted = false;
            mobilePanelMode = 'compact';
            lastMobileNonFullscreenMode = 'compact';
            favoritesOpen = false;
            favoriteComparisonOpen = false;
            mobilePluginRoot?.classList.remove('sun-path-favorites-open');
            mobilePluginRoot?.classList.remove('sun-path-mobile-collapsed');
            mobilePluginRoot?.classList.remove('sun-path-mobile-fullscreen');
            mobileBottomWrapper?.classList.remove('sun-path-mobile-fullscreen-wrapper');
            mobilePluginRoot = null;
            mobileBottomWrapper = null;
            favoriteReturnFocus = null;
            latestRequestId += 1;
            latestWeatherRequestId += 1;
            latestAtmosphereRequestId += 1;
            latestLightPollutionRequestId += 1;
            currentLocationRequestId += 1;
            favoriteDistanceRequestId += 1;
            locationNameRequestId += 1;
            weatherAbortController?.abort();
            weatherAbortController = null;
            atmosphereAbortController?.abort();
            atmosphereAbortController = null;
            lightPollutionAbortController?.abort();
            lightPollutionAbortController = null;
            if (currentDirectionTimer) {
                clearInterval(currentDirectionTimer);
                currentDirectionTimer = null;
            }
            if (locationSyncTimer) {
                clearTimeout(locationSyncTimer);
                locationSyncTimer = null;
            }
            if (mapDetailRecenterTimer) {
                clearTimeout(mapDetailRecenterTimer);
                mapDetailRecenterTimer = null;
            }
            mapOverlayController.destroy();
            singleclick.off(name, setLocationFromMapClick);
            bcast.off('back2home', handleBackToHome);
            map.off('dragstart', handleMapDragStart);
            map.off('moveend', handleMapMoveEnd);
            document.removeEventListener('click', handleHomeButtonClick, true);
            document.removeEventListener('pointerdown', handleFavoriteOutsidePointerDown);
        },
    };

    onMount(() => {
        releaseOverlayOwnership = claimOverlayOwner(overlayOwner);
        mobilePluginRoot = isMobileOrTablet
            ? panelElement?.closest<HTMLElement>('#plugin-windy-plugin-sun-moon-path') || null
            : null;
        mobileBottomWrapper = mobilePluginRoot?.closest<HTMLElement>('#bottom-wrapper') || null;
        uiLanguage = loadLanguagePreference();
        mobilePanelMode = isMobileOrTablet ? loadMobilePanelModePreference() : 'compact';
        lastMobileNonFullscreenMode = mobilePanelMode;
        mobilePluginRoot?.classList.toggle('sun-path-mobile-collapsed', mobilePanelMode === 'collapsed');
        hideLocationSearch = loadHideLocationSearchPreference();
        showExtendedDistanceMarker = loadExtendedDistancePreference();
        directionLineOpacityPercent = loadDirectionLineOpacityPreference();
        locationSearchProvider = loadLocationSearchProvider();
        locationApiKeys = loadLocationApiKeys();
        locationApiKeyDrafts = { ...locationApiKeys };
        isMounted = true;
        singleclick.on(name, setLocationFromMapClick);
        bcast.on('back2home', handleBackToHome);
        map.on('dragstart', handleMapDragStart);
        map.on('moveend', handleMapMoveEnd);
        document.addEventListener('click', handleHomeButtonClick, true);
        document.addEventListener('pointerdown', handleFavoriteOutsidePointerDown);
        updateCurrentDirections();
        currentDirectionTimer = setInterval(updateCurrentDirections, 5_000);
    });

    onDestroy(() => {
        const shouldReopenAfterHome = reopenAfterHome;
        overlayOwner.deactivateForReplacement();
        releaseOverlayOwnership?.();
        releaseOverlayOwnership = null;
        if (shouldReopenAfterHome) {
            scheduleReopenAfterHome(() => bcast.emit('rqstOpen', name));
        }
    });
</script>

<style lang="less">
    :global(.sun-path-marker) {
        background: transparent;
        border: 0;
    }

    :global(.sun-path-marker span) {
        display: block;
        box-sizing: border-box;
        border-radius: 50%;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.32);
    }

    :global(.sun-path-marker--origin span) {
        width: 16px;
        height: 16px;
        background: rgba(117, 83, 242, 0.62);
        border: 1px solid rgba(255, 255, 255, 0.72);
    }

    :global(.sun-path-marker--inner span) {
        width: 10px;
        height: 10px;
        background: rgba(23, 170, 3, 0.58);
        border: 1px solid rgba(255, 255, 255, 0.58);
    }

    :global(.sun-path-marker--outer span),
    :global(.sun-path-marker--extended span) {
        width: 10px;
        height: 10px;
        border: 1px solid rgba(255, 255, 255, 0.58);
    }

    :global(.sun-path-marker--outer span) {
        background: rgba(49, 139, 255, 0.58);
    }

    :global(.sun-path-marker--extended span) {
        background: rgba(250, 204, 21, 0.55);
    }

    .sun-path-panel {
        --panel-bg: rgba(19, 25, 32, 0.98);
        --panel-surface: rgba(255, 255, 255, 0.06);
        --panel-surface-hover: rgba(255, 255, 255, 0.1);
        --panel-border: rgba(255, 255, 255, 0.16);
        --panel-text: #f3f6f8;
        --panel-muted: #b8c3cc;
        --panel-accent: #63b9ee;
        --panel-warning: #f6b65c;
        --timeline-bg: #111a31;
        --timeline-sun: #ff9c38;
        --timeline-moon: #5ca9ff;
        --weather-tone-good: #60e37c;
        --weather-tone-warning: #ffe082;
        --weather-tone-orange: #ff8248;
        --weather-tone-danger: #ff5a5f;
        --weather-tone-cold: #405cf2;
        --weather-tone-cool: #9092ba;
        --weather-tone-mild: #aff5c0;
        --weather-tone-freezing: #f7f7f7;
        --summary-panel-height: 268px;
        --events-summary-panel-height: 280px;
        --desktop-weather-panel-height: 592px;

        box-sizing: border-box;
        width: 100%;
        max-width: none;
        max-height: 100%;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 10px 12px calc(12px + env(safe-area-inset-bottom, 0px));
        color: var(--panel-text);
        background: var(--panel-bg);
        font-size: 14px;
        line-height: 1.5;
    }

    .mobile-scroll-content {
        position: relative;
        width: 100%;
    }

    :global(.plugin-mobile-bottom-small#plugin-windy-plugin-sun-moon-path) {
        --mobile-window-control-size: 44px;
        --mobile-window-control-width: 36px;
        --mobile-window-control-gap: 0px;
        --mobile-window-control-edge: 32px;
        --mobile-window-icon-size: 25px;

        height: fit-content !important;
        max-height: min(430px, 52vh) !important;
        max-height: min(430px, 52dvh) !important;
        min-height: 0;
        padding: 0;
        margin: 0;
        overflow: visible !important;
    }

    :global(.plugin-mobile-bottom-small#plugin-windy-plugin-sun-moon-path.sun-path-mobile-collapsed) {
        max-height: min(
            280px,
            calc(100dvh - 16px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))
        ) !important;
    }

    :global(#plugin-windy-plugin-sun-moon-path.plugin-mobile-bottom-small > .closing-x) {
        top: -44px !important;
        right: var(--mobile-window-control-edge) !important;
        bottom: auto !important;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        box-sizing: border-box;
        width: var(--mobile-window-control-width);
        height: var(--mobile-window-control-size);
        margin: 0;
        padding: 0;
        border-radius: 0;
        background: transparent;
        color: transparent;
        font-size: 0;
        line-height: 1;
        z-index: 1002 !important;
        pointer-events: auto;
    }

    :global(#plugin-windy-plugin-sun-moon-path.plugin-mobile-bottom-small > .closing-x::before) {
        display: grid;
        width: var(--mobile-window-icon-size);
        height: var(--mobile-window-icon-size);
        margin-bottom: -10px;
        place-items: center;
        border-radius: 50%;
        color: #fff;
        background: #9d0300;
        font-size: 25px;
        line-height: 25px;
    }

    .sun-path-panel.mobile_ui {
        --summary-panel-height: 250px;
        --events-summary-panel-height: 250px;

        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 0;
        height: fit-content !important;
        max-height: min(430px, 52vh);
        max-height: min(430px, 52dvh);
        min-height: 0;
        margin: 0;
        padding: 0;
        overflow: visible;
    }

    .mobile-window-control {
        position: absolute;
        top: -44px;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        box-sizing: border-box;
        width: var(--mobile-window-control-width);
        height: var(--mobile-window-control-size);
        padding: 0;
        border: 0;
        color: var(--panel-text);
        background: transparent;
        cursor: pointer;
        touch-action: manipulation;
        z-index: 1001;
    }

    .sun-path-panel.mobile_ui.mobile_collapsed.favorites_open .mobile-window-control {
        z-index: 19;
    }

    :global(#plugin-windy-plugin-sun-moon-path.sun-path-mobile-collapsed.sun-path-favorites-open > .closing-x) {
        z-index: 19 !important;
    }

    .mobile-collapse-toggle {
        right: calc(
            var(--mobile-window-control-edge) + var(--mobile-window-control-width) +
                var(--mobile-window-control-gap) + var(--mobile-window-control-width) +
                var(--mobile-window-control-gap)
        );
    }

    .mobile-window-toggle {
        right: calc(
            var(--mobile-window-control-edge) + var(--mobile-window-control-width) +
                var(--mobile-window-control-gap)
        );
    }

    .mobile-map-detail-toggle {
        right: calc(
            var(--mobile-window-control-edge) + var(--mobile-window-control-width) +
                var(--mobile-window-control-gap) + var(--mobile-window-control-width) +
                var(--mobile-window-control-gap) + var(--mobile-window-control-width) +
                var(--mobile-window-control-gap)
        );
    }

    .mobile-map-fit-toggle {
        right: calc(
            var(--mobile-window-control-edge) + var(--mobile-window-control-width) +
                var(--mobile-window-control-gap) + var(--mobile-window-control-width) +
                var(--mobile-window-control-gap) + var(--mobile-window-control-width) +
                var(--mobile-window-control-gap) + var(--mobile-window-control-width) +
                var(--mobile-window-control-gap)
        );
    }

    .mobile-window-control__icon {
        box-sizing: border-box;
        display: grid;
        width: var(--mobile-window-icon-size);
        height: var(--mobile-window-icon-size);
        margin-bottom: -10px;
        place-items: center;
        border: 1px solid var(--panel-border);
        border-radius: 50%;
        background: var(--panel-bg);
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.32);
    }

    .mobile-window-control svg {
        width: 14px;
        height: 14px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .mobile-window-control:hover .mobile-window-control__icon,
    .mobile-window-control:active .mobile-window-control__icon {
        background: var(--panel-surface-hover);
    }

    .mobile-window-control:disabled {
        color: var(--panel-muted);
        cursor: default;
        opacity: 0.42;
    }

    .mobile-window-control:disabled .mobile-window-control__icon {
        background: var(--panel-bg);
    }

    .mobile-window-control:focus-visible {
        outline: none;
    }

    .mobile-window-control:focus-visible .mobile-window-control__icon {
        outline: 2px solid var(--panel-accent);
        outline-offset: 2px;
    }

    .sun-path-panel.mobile_ui .mobile-scroll-content {
        box-sizing: border-box;
        width: 100%;
        height: fit-content;
        min-height: 0;
        max-height: min(430px, 52vh);
        max-height: min(430px, 52dvh);
        flex: 0 1 auto;
        overflow-x: hidden;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior-y: contain;
        touch-action: pan-y;
        padding: 8px 8px 0;
    }

    .sun-path-panel.mobile_ui.mobile_collapsed .mobile-scroll-content {
        max-height: min(
            280px,
            calc(100dvh - 16px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))
        );
        overflow: visible;
    }

    .sun-path-panel.mobile_ui.mobile_collapsed {
        max-height: min(
            280px,
            calc(100dvh - 16px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))
        );
    }

    .mobile-collapsed-hidden {
        display: none !important;
    }

    :global(#plugin-windy-plugin-sun-moon-path.plugin-mobile-bottom-small.sun-path-mobile-fullscreen) {
        position: fixed !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100vh !important;
        height: 100dvh !important;
        max-height: none !important;
        z-index: 1000 !important;
    }

    :global(#bottom-wrapper.sun-path-mobile-fullscreen-wrapper) {
        z-index: 1000 !important;
    }

    :global(#plugin-windy-plugin-sun-moon-path.plugin-mobile-bottom-small.sun-path-mobile-fullscreen > .closing-x) {
        top: env(safe-area-inset-top, 0px) !important;
        right: var(--mobile-window-control-edge) !important;
        align-items: center;
    }

    :global(#plugin-windy-plugin-sun-moon-path.plugin-mobile-bottom-small.sun-path-mobile-fullscreen > .closing-x::before) {
        margin-bottom: 0;
    }

    .sun-path-panel.mobile_ui.mobile_fullscreen {
        width: 100%;
        height: 100% !important;
        max-height: none;
    }

    .sun-path-panel.mobile_ui.mobile_fullscreen .mobile-window-control {
        top: env(safe-area-inset-top, 0px);
        align-items: center;
    }

    .sun-path-panel.mobile_ui.mobile_fullscreen .mobile-window-control__icon {
        margin-bottom: 0;
    }

    .sun-path-panel.mobile_ui.mobile_fullscreen .mobile-scroll-content {
        height: 100%;
        max-height: none;
        flex: 1 1 auto;
        padding-top: calc(52px + env(safe-area-inset-top, 0px));
        padding-bottom: env(safe-area-inset-bottom, 0px);
    }

    .sun-path-panel.mobile_ui.favorites_open {
        overflow: hidden;
        scrollbar-width: none;
    }

    .sun-path-panel.mobile_ui.favorites_open .mobile-scroll-content {
        overflow: hidden;
        overscroll-behavior: none;
        scrollbar-width: none;
    }

    .sun-path-panel.mobile_ui.favorites_open .primary-controls {
        position: static;
    }

    .sun-path-panel.mobile_ui.favorites_open::-webkit-scrollbar,
    .sun-path-panel.mobile_ui.favorites_open .mobile-scroll-content::-webkit-scrollbar {
        width: 0;
        height: 0;
        display: none;
    }

    .sun-path-panel.mobile_ui.mobile_fullscreen .summary-tabs {
        grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .panel-intro,
    .location-summary,
    .panel-note {
        display: none;
    }

    .control-field > .control-label,
    .event-selector > .control-label {
        display: none;
    }

    .status-region--event-details {
        display: none;
    }

    .sun-path-panel.mobile_ui .map-bottom-module {
        margin-top: 0;
    }

    .map-bottom-module--mobile-collapsed .summary-tabs {
        display: none;
    }

    .map-bottom-module--mobile-collapsed .summary-panel-frame {
        height: auto;
    }

    .map-bottom-module--mobile-collapsed .astronomy-panel {
        height: auto;
        min-height: 0;
        overflow: hidden;
    }

    .sun-path-panel.mobile_ui .summary-tabs button {
        min-height: 36px;
        padding: 0 3px;
        font-size: 13px;
    }

    .sun-path-panel.mobile_ui .module-about {
        padding: 6px 10px 10px;
    }

    .panel-title {
        display: flex;
        align-items: center;
        gap: 9px;
        box-sizing: border-box;
        width: 100%;
        min-height: 44px;
        padding: 8px 0;
        border: 0;
        color: var(--panel-text) !important;
        background: var(--panel-bg) !important;
        font: inherit;
        font-size: 16px;
        font-weight: 700;
        text-align: left;
        cursor: pointer;
    }

    .panel-title__text {
        white-space: nowrap;
    }

    .desktop-map-controls {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-left: 5px;
    }

    .desktop-map-control {
        display: grid;
        width: 30px;
        height: 30px;
        padding: 0;
        place-items: center;
        border: 1px solid var(--panel-border);
        border-radius: 50%;
        background: var(--panel-surface);
        color: var(--panel-text);
        cursor: pointer;
    }

    .desktop-map-control svg {
        width: 14px;
        height: 14px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
    }

    .desktop-map-control:hover:not(:disabled),
    .desktop-map-control:active:not(:disabled) {
        background: var(--panel-surface-hover);
    }

    .desktop-map-control:disabled {
        color: var(--panel-muted);
        cursor: default;
        opacity: 0.42;
    }

    .panel-title__arrow {
        color: var(--panel-accent);
        font-size: 22px;
        line-height: 1;
    }

    .panel-title:focus-visible,
    input[type='date']:focus-visible,
    button:focus-visible {
        outline: 2px solid var(--panel-accent);
        outline-offset: 2px;
    }

    .panel-intro {
        margin: 8px 0 12px;
        padding: 10px;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        background: var(--panel-surface);
    }

    .panel-intro p,
    .panel-note {
        margin: 4px 0 0;
        color: var(--panel-muted);
    }

    .primary-controls {
        position: relative;
        z-index: 20;
    }

    .location-tools {
        position: relative;
        z-index: 21;
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 6px;
        align-items: start;
    }

    .favorite-locations-trigger {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 1px;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        padding: 0;
        border: 1px solid var(--panel-border);
        border-radius: 7px;
        background: rgba(8, 15, 27, 0.68);
        color: var(--panel-muted);
        cursor: pointer;
        touch-action: manipulation;
    }

    .favorite-locations-trigger:hover,
    .favorite-locations-trigger[aria-expanded='true'] {
        border-color: var(--panel-accent);
        background: rgba(99, 185, 238, 0.16);
        color: var(--panel-accent);
    }

    .favorite-locations-trigger svg {
        width: 17px;
        height: 17px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .favorite-locations-trigger__count {
        color: currentColor;
        font-size: 9px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        line-height: 1;
    }

    .favorite-locations-trigger--inline {
        flex-direction: row;
        gap: 4px;
        width: 100%;
        height: 38px;
        border-radius: 6px;
    }

    .favorite-locations-trigger--inline .favorite-locations-trigger__count {
        font-size: 10px;
    }

    .eyebrow {
        color: var(--panel-accent);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
    }

    .control-grid {
        position: relative;
        z-index: 19;
        display: grid;
        grid-template-columns: minmax(76px, 0.52fr) minmax(0, 2fr) 52px;
        align-items: stretch;
        gap: 6px;
        margin: 0 0 6px;
    }

    .control-grid--favorites {
        z-index: 20;
        grid-template-columns: 62px minmax(0, 1fr) 54px 52px;
    }

    .control-grid--favorites .date-control {
        justify-content: center;
        padding-right: 8px;
        padding-left: 8px;
        font-size: 13px;
    }

    .control-field,
    .event-selector {
        min-width: 0;
        margin: 0;
        padding: 0;
        border: 0;
    }

    .control-label {
        display: block;
        margin-bottom: 5px;
        color: var(--panel-muted);
        font-size: 12px;
    }

    .date-control {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        height: 38px;
        min-height: 38px;
        padding: 0 11px;
        overflow: hidden;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        color: var(--panel-text);
        background: #0e161f;
        font-size: 14px;
        cursor: pointer;
    }

    .date-control__text {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    input[type='date'] {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        max-width: 100%;
        min-height: 38px;
        padding: 0 8px;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        color: var(--panel-text);
        background: #0e161f;
        font: inherit;
        font-size: 14px;
        color-scheme: dark;
    }

    .date-control input[type='date'] {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        min-height: 0;
        padding: 0;
        border: 0;
        opacity: 0;
        appearance: none;
        -webkit-appearance: none;
        cursor: pointer;
    }

    .segmented-control {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        min-height: 38px;
        overflow: hidden;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        background: #0e161f;
    }

    .segmented-control button,
    .text-button,
    .language-toggle {
        min-height: 36px;
        padding: 0 4px;
        border: 0;
        color: var(--panel-muted);
        background: transparent;
        font: inherit;
        font-size: 14px;
        cursor: pointer;
        transition: color 160ms ease, background 160ms ease;
    }

    .segmented-control button + button {
        border-left: 1px solid var(--panel-border);
    }

    .segmented-control button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 2px;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .event-button__text {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .event-button__icon,
    .event-button__arrow {
        display: inline-grid;
        flex: 0 0 auto;
        place-items: center;
        color: currentColor;
        line-height: 1;
    }

    .event-button__icon svg {
        display: block;
        width: 16px;
        height: 16px;
    }

    .event-button__icon--sun svg {
        fill: #ffb347;
        stroke: #ffb347;
        stroke-width: 1.6;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .event-button__icon--moon svg {
        fill: #f5efcf;
        stroke: #f5efcf;
        stroke-width: 1.6;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .event-button__arrow svg {
        display: block;
        width: 12px;
        height: 12px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .event-button__arrow--down {
        transform: rotate(180deg);
    }

    .segmented-control button:hover,
    .segmented-control button.active {
        color: var(--panel-text);
        background: rgba(73, 169, 232, 0.22);
    }

    .language-toggle {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-items: center;
        gap: 2px;
        width: 100%;
        padding: 2px;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        background: #0e161f;
        font-size: 12px;
        font-weight: 700;
    }

    .language-toggle:hover {
        background: rgba(73, 169, 232, 0.12);
    }

    .language-toggle__option {
        display: grid;
        place-items: center;
        min-width: 0;
        min-height: 30px;
        border-radius: 5px;
        color: var(--panel-muted);
        line-height: 1;
        white-space: nowrap;
        transition: color 160ms ease, background 160ms ease;
    }

    .language-toggle__option.active {
        color: #07131c;
        background: #67c5ff;
    }

    .location-summary,
    .event-summary {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
        padding: 10px 0;
        border-top: 1px solid var(--panel-border);
        border-bottom: 1px solid var(--panel-border);
    }

    .location-summary strong,
    .event-summary strong {
        display: block;
        color: var(--panel-text);
        font-size: 15px;
        font-variant-numeric: tabular-nums;
        overflow-wrap: anywhere;
    }

    .location-hint,
    .event-summary__meta {
        min-width: 0;
        max-width: 100%;
        flex: 0 0 auto;
        color: var(--panel-muted);
        font-size: 12px;
        text-align: right;
    }

    .event-summary__meta {
        display: grid;
        gap: 2px;
    }

    .status-region {
        min-height: 0;
    }

    .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }

    .status-message {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 0;
        color: var(--panel-warning);
    }

    .status-message--error {
        color: #ff9a9a;
    }

    .status-message--muted {
        color: var(--panel-muted);
    }

    .text-button {
        flex: 0 0 auto;
        padding: 4px 0;
        color: var(--panel-accent);
        text-decoration: underline;
        text-underline-offset: 3px;
    }

    .sample-list {
        display: grid;
        gap: 1px;
        margin-top: 8px;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        overflow: hidden;
    }

    .sample-row {
        display: grid;
        grid-template-columns: 8px minmax(0, 1fr) auto;
        gap: 5px 10px;
        align-items: center;
        padding: 8px 10px;
        background: var(--panel-surface);
    }

    .sample-row__name {
        min-width: 0;
        color: var(--panel-text);
    }

    .sample-row__time,
    .sample-row__azimuth {
        color: var(--panel-muted);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

    .sample-row__azimuth {
        grid-column-start: 2;
        grid-column-end: -1;
        font-size: 12px;
    }

    .line-swatch {
        width: 8px;
        height: 28px;
        border-radius: 4px;
        background: var(--line-color);
    }

    .timeline-card {
        margin-top: 18px;
        padding: 14px 12px 12px;
        border: 1px solid rgba(122, 158, 207, 0.28);
        border-radius: 8px;
        background: var(--timeline-bg);
    }

    .timeline-card__heading {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        min-height: 44px;
    }

    .timeline-card__heading strong {
        display: block;
        margin-top: 3px;
        color: #edf3ff;
        font-size: 15px;
    }

    .timeline-card__now {
        flex: 0 0 auto;
        color: #aeb9cb;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
    }

    .timeline-track {
        position: relative;
        height: 30px;
        margin: 14px 0 12px;
        overflow: hidden;
        border-radius: 15px;
        background: #0b122b;
    }

    .timeline-track__night,
    .timeline-track__daylight {
        position: absolute;
        top: 0;
        bottom: 0;
    }

    .timeline-track__night {
        right: 0;
        left: 0;
        background: #0b122b;
    }

    .timeline-track__daylight {
        background: rgba(67, 141, 211, 0.58);
    }

    .timeline-track__marker,
    .timeline-track__current {
        position: absolute;
        z-index: 2;
        top: 4px;
        bottom: 4px;
        width: 3px;
        transform: translateX(-50%);
        border-radius: 2px;
        background: var(--timeline-sun);
        box-shadow: 0 0 0 2px rgba(17, 26, 49, 0.7);
    }

    .timeline-track__marker.item-moon {
        background: var(--timeline-moon);
    }

    .timeline-track__current {
        z-index: 3;
        top: -4px;
        bottom: -4px;
        width: 2px;
        background: #f7f9fc;
        box-shadow: none;
    }

    .timeline-events {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 8px;
    }

    .timeline-event {
        min-width: 0;
        color: #aeb9cb;
        font-size: 11px;
        text-align: center;
    }

    .timeline-event__dot {
        display: block;
        width: 7px;
        height: 7px;
        margin: 0 auto 4px;
        border-radius: 50%;
        background: var(--timeline-sun);
    }

    .timeline-event.item-moon .timeline-event__dot {
        background: var(--timeline-moon);
    }

    .timeline-event__label {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .timeline-event strong {
        display: block;
        margin-top: 2px;
        color: #eef3fb;
        font-size: 13px;
        font-variant-numeric: tabular-nums;
    }

    .celestial-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-top: 14px;
    }

    .celestial-card {
        min-width: 0;
        padding: 12px;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        background: var(--panel-surface);
    }

    .celestial-card__heading {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .celestial-card__heading strong {
        display: block;
        margin-top: 2px;
        color: var(--panel-text);
        font-size: 13px;
    }

    .celestial-symbol {
        display: grid;
        flex: 0 0 auto;
        place-items: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        font-size: 18px;
    }

    .celestial-symbol--sun {
        color: #211504;
        background: #f6b65c;
    }

    .celestial-symbol--moon {
        color: #dcecff;
        background: #355f99;
    }

    .celestial-card__value {
        margin-top: 12px;
        color: #ffffff;
        font-size: 17px;
        font-variant-numeric: tabular-nums;
        font-weight: 700;
    }

    .celestial-card__meta {
        margin-top: 4px;
        color: var(--panel-muted);
        font-size: 11px;
        line-height: 1.55;
    }

    .legend {
        margin-top: 18px;
        padding-top: 14px;
        border-top: 1px solid var(--panel-border);
    }

    .legend__title {
        margin-bottom: 8px;
        color: var(--panel-text);
        font-weight: 600;
    }

    .legend__items {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 14px;
    }

    .legend__items--lines {
        margin-top: 8px;
    }

    .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--panel-muted);
        white-space: nowrap;
    }

    .legend-dot {
        width: 9px;
        height: 9px;
        border: 1px solid rgba(255, 255, 255, 0.58);
        border-radius: 50%;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.24);
    }

    .legend-dot--origin {
        width: 11px;
        height: 11px;
        background: rgba(117, 83, 242, 0.62);
    }

    .legend-dot--inner {
        background: rgba(23, 170, 3, 0.58);
    }

    .legend-dot--outer {
        background: rgba(49, 139, 255, 0.58);
    }

    .legend-dot--extended {
        background: rgba(250, 204, 21, 0.55);
    }

    .legend-line {
        display: inline-block;
        width: 24px;
        height: 3px;
        border-radius: 2px;
    }

    .legend-line--before {
        background: #f6b65c;
    }

    .legend-line--event {
        background: #f97316;
    }

    .legend-line--after {
        background: #991b1b;
    }

    .legend-line--moon-before {
        background: #b9a5ff;
        background-image: linear-gradient(90deg, #b9a5ff 0 55%, transparent 55% 100%);
        background-size: 8px 3px;
    }

    .legend-line--moon-event {
        background: #5c91ff;
        background-image: linear-gradient(90deg, #5c91ff 0 55%, transparent 55% 100%);
        background-size: 8px 3px;
    }

    .legend-line--moon-after {
        background: #294da8;
        background-image: linear-gradient(90deg, #294da8 0 55%, transparent 55% 100%);
        background-size: 8px 3px;
    }

    .legend-line--current {
        background: #ffffff;
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
    }

    .legend-line--moon {
        background: #8ec5ff;
        background-image: linear-gradient(90deg, #8ec5ff 0 55%, transparent 55% 100%);
        background-size: 8px 3px;
    }

    .map-bottom-module {
        flex: 0 0 auto;
        margin-top: 0;
        overflow: hidden;
        border: 1px solid var(--panel-border);
        border-radius: 8px;
        background: rgba(5, 10, 20, 0.38);
    }

    .summary-tabs {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        border-bottom: 1px solid var(--panel-border);
        background: rgba(255, 255, 255, 0.04);
    }

    .summary-tabs button {
        min-height: 36px;
        padding: 0 5px;
        border: 0;
        border-bottom: 2px solid transparent;
        color: var(--panel-muted);
        background: transparent;
        font: inherit;
        font-size: 15px;
        cursor: pointer;
    }

    .summary-tabs button + button {
        border-left: 1px solid rgba(255, 255, 255, 0.08);
    }

    .summary-tabs button:hover,
    .summary-tabs button.active {
        color: var(--panel-text);
        background: rgba(99, 185, 238, 0.14);
    }

    .summary-tabs button.active {
        border-bottom-color: var(--panel-accent);
    }

    .summary-panel-frame {
        height: var(--summary-panel-height);
        overflow: hidden;
        background: #1d263d;
    }

    .summary-panel-frame--events {
        height: var(--events-summary-panel-height);
    }

    .desktop-weather-module {
        flex: 0 0 auto;
        height: var(--desktop-weather-panel-height);
        min-height: 260px;
        margin-top: 6px;
        overflow: hidden;
        border: 1px solid var(--panel-border);
        border-radius: 8px;
        background: #1d263d;
    }

    .astronomy-panel {
        --astronomy-bg: #1d263d;
        --astronomy-muted: #a8b1c1;
        --astronomy-text: #f2f4fa;
        --astronomy-sun: #ff9138;
        --astronomy-moon: #4e91ed;
        --astronomy-blue-hour: #c4b5fd;

        box-sizing: border-box;
        height: 100%;
        min-height: 100%;
        overflow-y: auto;
        padding: 4px 10px 0;
        color: var(--astronomy-text);
        background: var(--astronomy-bg);
    }

    .sun-path-panel:not(.mobile_ui) .astronomy-panel,
    .sun-path-panel:not(.mobile_ui) .module-about {
        overscroll-behavior-y: auto;
    }

    .astronomy-panel__heading {
        display: grid;
        grid-template-columns: minmax(112px, 1fr) max-content minmax(112px, 1fr);
        align-items: center;
        gap: 6px;
        min-height: 40px;
    }

    .astronomy-location {
        display: flex;
        column-gap: 2px;
        align-items: center;
        min-width: 0;
        text-align: left;
    }

    .astronomy-location__button {
        display: grid;
        flex: 0 1 auto;
        align-items: center;
        width: max-content;
        max-width: calc(100% - 30px);
        min-height: 40px;
        padding: 2px 0;
        overflow: hidden;
        border: 0;
        border-radius: 4px;
        color: var(--astronomy-text);
        background: transparent;
        font: inherit;
        font-size: 13px;
        line-height: 1.2;
        text-align: left;
        white-space: nowrap;
        cursor: pointer;
    }

    .astronomy-location__button:hover,
    .astronomy-location__button[aria-expanded='true'] {
        color: var(--panel-accent);
    }

    .astronomy-location__favorite {
        display: grid;
        flex: 0 0 28px;
        align-self: center;
        place-items: center;
        width: 28px;
        height: 28px;
        padding: 0;
        border: 0;
        border-radius: 5px;
        background: transparent;
        color: var(--astronomy-muted);
        cursor: pointer;
        touch-action: manipulation;
    }

    .astronomy-location__favorite:hover,
    .astronomy-location__favorite:focus-visible {
        background: rgba(99, 185, 238, 0.14);
        color: var(--panel-accent);
    }

    .astronomy-location__favorite:focus-visible {
        outline: 2px solid var(--panel-accent);
        outline-offset: -2px;
    }

    .astronomy-location__favorite.saved {
        color: #ffd166;
    }

    .astronomy-location__favorite:disabled {
        cursor: wait;
        opacity: 0.5;
    }

    .astronomy-location__favorite svg {
        width: 15px;
        height: 15px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .astronomy-location__favorite.saved svg {
        fill: currentColor;
    }

    .astronomy-location__copy {
        display: grid;
        flex: 0 1 auto;
        gap: 1px;
        align-content: center;
        width: max-content;
        max-width: 100%;
        min-width: 0;
    }

    .astronomy-location__name-line {
        display: flex;
        gap: 3px;
        align-items: center;
        width: max-content;
        max-width: 100%;
        min-width: 0;
        color: var(--panel-accent);
    }

    .astronomy-location__name-viewport {
        flex: 0 1 auto;
        width: max-content;
        max-width: 100%;
        min-width: 0;
        overflow: hidden;
    }

    .astronomy-location__name-track {
        display: flex;
        gap: 24px;
        width: max-content;
        max-width: 100%;
        min-width: 0;
    }

    .astronomy-location__name-value {
        flex: 0 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .astronomy-location__button.scrolling .astronomy-location__name-track {
        width: max-content;
        animation: location-name-scroll 10s linear 1.2s infinite;
        will-change: transform;
    }

    .astronomy-location__button.scrolling .astronomy-location__name-value {
        flex: none;
        overflow: visible;
        text-overflow: clip;
    }

    .astronomy-location__chevron {
        width: 11px;
        height: 11px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.7;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    @keyframes location-name-scroll {
        from {
            transform: translateX(0);
        }
        to {
            transform: translateX(calc(-50% - 12px));
        }
    }

    .astronomy-location__metrics {
        display: flex;
        gap: 4px;
        align-items: center;
        min-width: 0;
        overflow: hidden;
        color: var(--astronomy-muted);
        font-size: 10px;
        font-variant-numeric: tabular-nums;
        line-height: 1.2;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .astronomy-refresh-indicator {
        flex: 0 0 auto;
        box-sizing: border-box;
        width: 9px;
        height: 9px;
        border: 1.5px solid rgba(168, 177, 193, 0.28);
        border-top-color: var(--panel-accent);
        border-radius: 50%;
        opacity: 0;
    }

    .astronomy-refresh-indicator.active {
        animation: astronomy-refresh-spin 800ms linear 180ms infinite;
    }

    @keyframes astronomy-refresh-spin {
        from {
            opacity: 0.78;
            transform: rotate(0deg);
        }
        to {
            opacity: 0.78;
            transform: rotate(360deg);
        }
    }

    .astronomy-location__elevation-icon {
        color: rgba(255, 255, 255, 0.68);
        font-size: 10px;
        line-height: 1;
        text-align: center;
    }

    .live-positions {
        --live-icon-size: 12px;
        --live-row-height: 14px;

        display: grid;
        grid-template-columns: var(--live-icon-size) max-content max-content;
        justify-self: center;
        align-self: center;
        align-items: center;
        column-gap: 2px;
        row-gap: 3px;
        min-width: 0;
        align-content: center;
        justify-content: center;
        justify-items: start;
    }

    .live-position {
        display: contents;
        min-width: 0;
        color: var(--astronomy-muted);
        font-size: 10px;
        line-height: var(--live-row-height);
        white-space: nowrap;
    }

    .live-position__icon {
        display: inline-grid;
        justify-self: center;
        align-self: center;
        flex: 0 0 auto;
        place-items: center;
        width: var(--live-icon-size);
        height: var(--live-icon-size);
        color: var(--astronomy-muted);
        transform: translateY(-1px);
    }

    .live-position__icon svg {
        display: block;
        width: var(--live-icon-size);
        height: var(--live-icon-size);
    }

    .live-position__icon--sun svg {
        fill: #ffb347;
        stroke: #ffb347;
        stroke-width: 1.7;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .live-position__icon--moon svg {
        fill: #f5efcf;
        stroke: #f5efcf;
        stroke-width: 1.7;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .live-position span {
        color: var(--astronomy-muted);
        white-space: nowrap;
    }

    .live-position strong,
    .live-position em {
        display: flex;
        align-items: center;
        min-width: 0;
        min-height: var(--live-row-height);
        overflow: visible;
        text-overflow: clip;
        white-space: nowrap;
        font-style: normal;
        font-variant-numeric: tabular-nums;
        line-height: var(--live-row-height);
    }

    .live-position strong {
        display: grid;
        grid-template-columns: 3.8ch minmax(2em, auto);
        column-gap: 0.5ch;
        color: var(--astronomy-text);
        font-weight: 700;
    }

    .live-position strong > span {
        color: inherit;
    }

    .live-position__azimuth {
        justify-self: start;
        text-align: left;
    }

    .live-position__compass {
        text-align: left;
    }

    .live-position .live-position__metric {
        display: grid;
        grid-template-columns: 7ch 4.4ch 5.1ch;
        align-items: center;
        column-gap: 4px;
    }

    .live-position__metric > span {
        display: inline-flex;
        align-items: center;
        justify-content: flex-start;
        min-height: var(--live-row-height);
        line-height: var(--live-row-height);
    }

    .live-position__event-azimuth {
        color: var(--astronomy-muted);
        font-size: 1em;
        text-align: left;
    }

    .orbit-badge {
        display: flex;
        justify-self: stretch;
        align-items: center;
        justify-content: flex-end;
        gap: 4px;
        width: 100%;
        min-width: 0;
        color: var(--astronomy-muted);
        font-size: 10px;
        font-variant-numeric: tabular-nums;
        text-align: center;
    }

    .orbit-moon {
        flex: 0 0 auto;
        display: block;
        width: 36px;
        height: 36px;
        border-radius: 50%;
    }

    .orbit-moon {
        overflow: hidden;
        background: #182033;
    }

    .orbit-badge--moon {
        align-self: center;
    }

    .orbit-badge__percent {
        min-width: 0;
        overflow: visible;
        color: var(--astronomy-muted);
        white-space: nowrap;
    }

    .orbit-moon__shadow {
        fill: #111727;
    }

    .timeline-events {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 0;
        margin-top: 4px;
        padding: 6px 0 5px;
        border-top: 1px solid rgba(255, 255, 255, 0.12);
        border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    }

    .timeline-event {
        min-width: 0;
        padding: 0 2px;
        color: var(--astronomy-muted);
        font-size: 11px;
        line-height: 1.2;
        text-align: center;
    }

    .timeline-event--skeleton {
        display: grid;
        grid-template-rows: 12px 14px;
        gap: 3px;
        align-content: start;
        justify-items: center;
    }

    .astronomy-skeleton {
        display: block;
        border-radius: 999px;
        background: rgba(168, 177, 193, 0.32);
        opacity: 0;
    }

    .astronomy-panel--loading .astronomy-skeleton {
        animation: astronomy-skeleton-pulse 1.2s ease-in-out 180ms infinite;
    }

    .astronomy-skeleton--elevation {
        width: 30px;
        height: 8px;
    }

    .astronomy-skeleton--label {
        align-self: center;
        width: 62%;
        height: 7px;
    }

    .astronomy-skeleton--time {
        align-self: end;
        width: 78%;
        height: 9px;
    }

    .astronomy-skeleton--window {
        width: min(78%, 150px);
        height: 11px;
        margin-top: 2px;
    }

    .astronomy-skeleton--evidence {
        width: min(100%, 150px);
        height: 20px;
        margin-top: 3px;
    }

    @keyframes astronomy-skeleton-pulse {
        0%, 100% {
            opacity: 0.34;
        }
        50% {
            opacity: 0.68;
        }
    }

    .timeline-event__label {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .timeline-event strong {
        display: block;
        margin-top: 3px;
        color: var(--astronomy-text);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
    }

    .timeline-event:not(.item-moon) .timeline-event__label,
    .timeline-event:not(.item-moon) strong {
        color: var(--astronomy-sun);
    }

    .timeline-event.item-blue-hour .timeline-event__label,
    .timeline-event.item-blue-hour strong {
        color: var(--astronomy-blue-hour);
    }

    .timeline-event.item-moon .timeline-event__label {
        color: #91bfff;
    }

    .timeline-event.item-moon strong {
        color: #91bfff;
    }

    .timeline-event.timeline-event--countdown .timeline-event__label,
    .timeline-event.timeline-event--countdown strong {
        color: var(--astronomy-text);
    }

    .timeline-event--missing {
        opacity: 0.55;
    }

    .night-window-list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
        margin-top: 6px;
    }

    .night-window {
        min-width: 0;
        padding: 6px 8px;
        border: 1px solid rgba(115, 143, 214, 0.32);
        border-radius: 6px;
        background: rgba(11, 18, 43, 0.72);
    }

    .night-window--milky-way {
        border-color: rgba(143, 118, 219, 0.42);
        background: rgba(29, 22, 63, 0.72);
    }

    .night-window__body {
        display: grid;
        gap: 2px;
        min-width: 0;
    }

    .night-window__body strong {
        overflow: visible;
        color: var(--astronomy-text);
        font-size: 12px;
        text-overflow: clip;
        white-space: normal;
        line-height: 1.2;
    }

    .night-window__body span {
        overflow: visible;
        color: var(--astronomy-muted);
        font-size: 10px;
        font-variant-numeric: tabular-nums;
        text-overflow: clip;
        white-space: normal;
        line-height: 1.25;
    }

    .night-window__evidence {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-top: 1px;
        padding-top: 3px;
        border-top: 1px solid rgba(153, 181, 235, 0.16);
    }

    .night-window__body span.night-window__metric {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        color: #c4d5ee;
        font-size: 9.5px;
        white-space: nowrap;
    }

    .night-window__body span.night-window__evidence-state {
        margin-top: 2px;
        padding-top: 4px;
        border-top: 1px solid rgba(153, 181, 235, 0.16);
        color: #93a3bc;
        font-size: 9.5px;
    }

    .night-window__evidence--placeholder {
        opacity: 0.48;
    }

    .module-about {
        box-sizing: border-box;
        height: 100%;
        overflow-y: auto;
        display: grid;
        align-content: start;
        gap: 10px;
        padding: 12px;
        color: var(--panel-muted);
        background: rgba(0, 0, 0, 0.14);
        font-size: 12px;
    }

    .module-about__title {
        margin-bottom: 6px;
        color: var(--panel-text);
        font-weight: 600;
    }

    .module-about p {
        margin: 6px 0 0;
    }

    .module-about p:first-child {
        margin-top: 0;
    }

    .module-guide {
        gap: 8px;
        padding: 10px 12px 14px;
    }

    .module-guide > p {
        margin: 0;
        color: var(--panel-muted);
        font-size: 12px;
        line-height: 1.45;
    }

    .feature-guide,
    .settings-guide {
        display: grid;
        gap: 0;
        border-top: 1px solid var(--panel-border);
    }

    .feature-guide h3,
    .feature-guide dl,
    .feature-guide dt,
    .feature-guide dd,
    .settings-guide h3,
    .settings-guide dl,
    .settings-guide dt,
    .settings-guide dd {
        margin: 0;
    }

    .feature-guide h3,
    .settings-guide h3 {
        padding: 10px 0 4px;
        color: var(--panel-text);
        font-size: 13px;
        line-height: 1.2;
    }

    .feature-guide dl > div,
    .settings-guide dl > div {
        display: grid;
        gap: 4px;
        padding: 9px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .feature-guide dl > div:last-child,
    .settings-guide dl > div:last-child {
        border-bottom: 0;
    }

    .feature-guide dt,
    .settings-guide dt {
        color: var(--panel-text);
        font-size: 11px;
        font-weight: 700;
        line-height: 1.25;
    }

    .feature-guide dd,
    .settings-guide dd {
        color: var(--panel-muted);
        font-size: 10px;
        line-height: 1.45;
    }

    .weather-legend {
        display: grid;
        gap: 0;
        border-top: 1px solid var(--panel-border);
        color: var(--panel-muted);
    }

    .weather-legend h3,
    .weather-legend h4,
    .weather-legend p {
        margin: 0;
    }

    .weather-legend h3 {
        padding: 10px 0 4px;
        color: var(--panel-text);
        font-size: 13px;
        line-height: 1.2;
    }

    .weather-legend__section {
        display: grid;
        gap: 6px;
        padding: 10px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .weather-legend__section:last-child {
        border-bottom: 0;
    }

    .weather-legend__section h4 {
        color: var(--panel-text);
        font-size: 11px;
        line-height: 1.2;
    }

    .weather-legend__section p {
        color: var(--panel-muted);
        font-size: 10px;
        line-height: 1.4;
    }

    .weather-legend__sources {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    .weather-legend__sources a {
        color: #8ed0ff;
        text-decoration: underline;
        text-underline-offset: 2px;
    }

    .weather-legend__celestial-row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px 28px;
    }

    .weather-legend__celestial-sample {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        color: var(--panel-text);
        font-size: 11px;
        font-variant-numeric: tabular-nums;
        line-height: 1;
        white-space: nowrap;
    }

    .weather-legend__scale {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .weather-legend__swatch {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        min-width: 48px;
        height: 30px;
        padding: 0 6px;
        color: #101624;
        font-size: 10px;
        font-variant-numeric: tabular-nums;
        line-height: 1;
    }

    .weather-legend__scale--temperature {
        display: grid;
        grid-template-columns: repeat(8, minmax(0, 1fr));
        gap: 3px;
    }

    .weather-legend__scale--temperature .weather-legend__swatch {
        min-width: 0;
        padding: 0 2px;
    }

    .weather-legend__scale--cloud {
        align-items: end;
        gap: 12px;
    }

    .weather-legend__cloud-sample {
        display: grid;
        justify-items: center;
        gap: 4px;
    }

    .weather-legend__cloud-sample small {
        color: var(--panel-muted);
        font-size: 9px;
        font-variant-numeric: tabular-nums;
    }

    .weather-legend__cloud-box {
        position: relative;
        display: block;
        width: 34px;
        height: 34px;
        overflow: hidden;
        background: #454545;
    }

    .weather-legend__cloud-box::after {
        position: absolute;
        right: 0;
        bottom: 0;
        left: 0;
        height: var(--legend-cloud);
        background: #f7f7f7;
        content: '';
    }

    .weather-legend .tone-good {
        background: var(--weather-tone-good);
    }

    .weather-legend .tone-warning {
        background: var(--weather-tone-warning);
    }

    .weather-legend .tone-orange {
        background: var(--weather-tone-orange);
    }

    .weather-legend .tone-danger {
        background: var(--weather-tone-danger);
    }

    .weather-legend .tone-cold {
        color: #07164e;
        background: var(--weather-tone-cold);
    }

    .weather-legend .tone-cool {
        background: var(--weather-tone-cool);
    }

    .weather-legend .tone-mild {
        background: var(--weather-tone-mild);
    }

    .weather-legend .tone-freezing {
        background: var(--weather-tone-freezing);
    }

    .weather-legend__direction-row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        align-items: center;
        column-gap: 12px;
    }

    .weather-legend__wind-arrow {
        width: 28px;
        height: 28px;
    }

    .weather-legend__wind-arrow path {
        fill: #eef4fb;
        stroke: rgba(0, 0, 0, 0.28);
        stroke-width: 0.8;
    }

    .module-settings {
        gap: 8px;
    }

    .settings-api-keys {
        display: grid;
        gap: 8px;
    }

    .settings-api-key {
        display: grid;
        gap: 6px;
        padding: 10px 12px;
        border: 1px solid var(--panel-border);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.06);
    }

    .settings-api-key__header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px;
        align-items: center;
        color: var(--panel-text);
        font-size: 13px;
        font-weight: 700;
        line-height: 1.25;
    }

    .settings-api-key__header-actions {
        display: inline-flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 2px 8px;
        align-items: baseline;
        text-align: right;
    }

    .settings-api-key__header-actions a {
        color: var(--panel-accent);
        font-size: 11px;
        font-weight: 700;
        text-underline-offset: 2px;
    }

    .settings-api-key__header-actions a:hover {
        color: var(--panel-text);
    }

    .settings-api-key__header-actions a:focus-visible {
        border-radius: 3px;
        outline: 2px solid var(--panel-accent);
        outline-offset: 2px;
    }

    .settings-api-key__header-actions [role='status'] {
        color: #8bd6a3;
        font-size: 11px;
    }

    .settings-api-key__control {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        gap: 6px;
    }

    .settings-api-key__control input {
        min-width: 0;
        height: 44px;
        padding: 0 10px;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        outline: 0;
        background: rgba(8, 15, 27, 0.68);
        color: var(--panel-text);
        font: inherit;
        font-size: 13px;
    }

    .settings-api-key__control input:focus {
        border-color: var(--panel-accent);
        box-shadow: 0 0 0 2px rgba(99, 185, 238, 0.18);
    }

    .settings-api-key__control button {
        min-width: 54px;
        min-height: 44px;
        padding: 0 10px;
        border: 1px solid rgba(99, 185, 238, 0.45);
        border-radius: 6px;
        background: rgba(99, 185, 238, 0.18);
        color: var(--panel-accent);
        font: inherit;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
    }

    .settings-api-key__control button:hover:not(:disabled) {
        background: rgba(99, 185, 238, 0.28);
    }

    .settings-api-key__control button:focus-visible,
    .settings-api-key__control input:focus-visible {
        outline: 2px solid var(--panel-accent);
        outline-offset: 2px;
    }

    .settings-api-key__control button:disabled {
        cursor: not-allowed;
        opacity: 0.45;
    }

    .settings-api-key__control .settings-api-key__clear {
        border-color: var(--panel-border);
        background: transparent;
        color: var(--panel-muted);
    }

    .settings-api-key__description {
        color: var(--panel-muted);
        font-size: 11px;
        line-height: 1.35;
    }

    .settings-range {
        display: grid;
        gap: 4px;
        padding: 8px 12px 9px;
        border: 1px solid var(--panel-border);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.06);
    }

    .settings-range__header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px;
        color: var(--panel-text);
        font-size: 13px;
        font-weight: 700;
        line-height: 1.25;
    }

    .settings-range__header output {
        min-width: 4ch;
        color: var(--panel-accent);
        font-variant-numeric: tabular-nums;
        text-align: right;
    }

    .settings-range input[type='range'] {
        appearance: none;
        width: 100%;
        height: 32px;
        margin: 0;
        padding: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        accent-color: var(--panel-accent);
        cursor: pointer;
        touch-action: manipulation;
    }

    .settings-range input[type='range']::-webkit-slider-runnable-track {
        height: 6px;
        border-radius: 3px;
        background: rgba(255, 255, 255, 0.2);
        box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.28);
    }

    .settings-range input[type='range']::-webkit-slider-thumb {
        appearance: none;
        width: 18px;
        height: 18px;
        margin-top: -6px;
        border: 2px solid rgba(255, 255, 255, 0.92);
        border-radius: 50%;
        background: var(--panel-accent);
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
    }

    .settings-range input[type='range']::-moz-range-track {
        height: 6px;
        border: 0;
        border-radius: 3px;
        background: rgba(255, 255, 255, 0.2);
        box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.28);
    }

    .settings-range input[type='range']::-moz-range-progress {
        height: 6px;
        border-radius: 3px;
        background: var(--panel-accent);
    }

    .settings-range input[type='range']::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.92);
        border-radius: 50%;
        background: var(--panel-accent);
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
    }

    .settings-range input[type='range']:focus-visible {
        outline: 2px solid var(--panel-accent);
        outline-offset: 2px;
    }

    .settings-range__description {
        color: var(--panel-muted);
        font-size: 11px;
        line-height: 1.35;
    }

    .settings-toggle {
        position: relative;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 12px;
        align-items: center;
        height: max-content;
        min-height: 48px;
        padding: 10px 12px;
        border: 1px solid var(--panel-border);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.06);
        cursor: pointer;
    }

    .settings-toggle--location-search {
        margin-bottom: 10px;
    }

    .settings-toggle__copy {
        display: grid;
        gap: 3px;
        min-width: 0;
    }

    .settings-toggle__copy strong {
        color: var(--panel-text);
        font-size: 13px;
        line-height: 1.25;
    }

    .settings-toggle__copy span {
        color: var(--panel-muted);
        font-size: 11px;
        line-height: 1.35;
    }

    .settings-toggle input {
        position: absolute;
        inset: 0;
        z-index: 1;
        width: 100%;
        height: 100%;
        margin: 0;
        opacity: 0;
        cursor: pointer;
    }

    .settings-toggle__control {
        position: relative;
        width: 42px;
        height: 24px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.12);
        transition: background-color 180ms ease, border-color 180ms ease;
    }

    .settings-toggle__control::after {
        position: absolute;
        top: 3px;
        left: 3px;
        width: 16px;
        height: 16px;
        content: '';
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.92);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
        transition: transform 180ms ease;
    }

    .settings-toggle input:checked + .settings-toggle__control {
        border-color: rgba(99, 185, 238, 0.8);
        background: rgba(99, 185, 238, 0.58);
    }

    .settings-toggle input:checked + .settings-toggle__control::after {
        transform: translateX(18px);
    }

    .settings-toggle input:focus-visible + .settings-toggle__control {
        outline: 2px solid var(--panel-accent);
        outline-offset: 2px;
    }

    .about-hero {
        display: grid;
        gap: 8px;
        padding: 10px 12px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 8px;
        background: linear-gradient(135deg, rgba(42, 55, 86, 0.92), rgba(18, 28, 48, 0.94));
        color: var(--panel-text);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
    }

    .about-hero p {
        margin: 0;
        color: var(--panel-muted);
        font-size: 11px;
        line-height: 1.35;
    }

    .about-hero__header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        align-items: start;
    }

    .about-hero__copy {
        display: grid;
        gap: 2px;
        min-width: 0;
    }

    .about-hero__copy span {
        color: var(--panel-muted);
        font-size: 11px;
        line-height: 1.2;
    }

    .about-hero__copy strong {
        color: var(--panel-text);
        font-size: 15px;
        line-height: 1.2;
    }

    .about-meta {
        display: grid;
        grid-template-columns: repeat(2, auto);
        gap: 8px;
        margin: 0;
    }

    .about-meta div {
        display: grid;
        gap: 1px;
        text-align: right;
    }

    .about-meta dt,
    .about-meta dd {
        margin: 0;
    }

    .about-meta dt {
        color: var(--panel-muted);
        font-size: 10px;
        line-height: 1.2;
    }

    .about-meta dd {
        color: var(--panel-text);
        font-size: 12px;
        font-weight: 700;
        line-height: 1.2;
        white-space: nowrap;
    }

    .about-actions {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 6px;
    }

    .about-actions a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 0;
        min-height: 32px;
        padding: 0 8px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 6px;
        color: var(--panel-text) !important;
        background: rgba(255, 255, 255, 0.07);
        font-size: 12px;
        font-weight: 700;
        line-height: 1.15;
        text-align: center;
        text-decoration: none;
        cursor: pointer;
        transition: background-color 180ms ease, border-color 180ms ease, color 180ms ease;
    }

    .about-actions a:hover {
        border-color: rgba(255, 255, 255, 0.3);
        background: rgba(255, 255, 255, 0.13);
    }

    .about-actions a:focus-visible {
        outline: 2px solid var(--panel-accent);
        outline-offset: 2px;
    }

    .about-actions__star {
        border-color: rgba(250, 204, 21, 0.64) !important;
        color: #171717 !important;
        background: #facc15 !important;
    }

    .about-actions__star:hover {
        background: #fde047 !important;
    }

    .sun-path-legend {
        margin-top: 12px;
        padding: 10px;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        background: var(--panel-bg) !important;
        color: var(--panel-text) !important;
    }

    .sun-path-legend--module {
        margin: 0;
        border: 0;
        border-radius: 0;
        background: transparent !important;
    }

    .sun-path-legend__title {
        margin-bottom: 8px;
        color: var(--panel-text) !important;
        font-weight: 600;
    }

    .sun-path-legend__items {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 14px;
    }

    .sun-path-legend__items--lines {
        margin-top: 8px;
    }

    .sun-path-legend .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--panel-muted) !important;
        white-space: nowrap;
    }

    .panel-note {
        margin-top: 12px;
        font-size: 12px;
    }

    @media (max-width: 520px) {
        .sun-path-panel {
            display: flex;
            flex-direction: column;
            max-width: none;
            padding-right: 14px;
            padding-left: 14px;
        }

        .map-bottom-module {
            margin-top: 0;
        }

        .summary-tabs {
            grid-template-columns: repeat(5, minmax(0, 1fr));
        }

        .sun-path-panel.mobile_ui .control-grid {
            grid-template-columns: 76px minmax(0, 1fr) 52px;
        }

        .sun-path-panel.mobile_ui .control-grid--favorites {
            grid-template-columns: 62px minmax(0, 1fr) 52px 52px;
        }

        .segmented-control--events {
            grid-template-columns: repeat(5, minmax(0, 1fr));
        }

        .sample-row {
            grid-template-columns: 8px minmax(0, 1fr) auto;
        }

        .event-summary {
            align-items: flex-start;
        }

        .event-summary__meta,
        .location-hint {
            flex: 1 1 100%;
            text-align: left;
        }

        .event-summary__meta {
            display: flex;
            flex-wrap: wrap;
            gap: 2px 10px;
        }

        .timeline-card__heading {
            display: block;
        }

        .timeline-card__now {
            display: block;
            margin-top: 4px;
        }

        .timeline-events {
            grid-template-columns: repeat(7, minmax(0, 1fr));
            margin-top: 4px;
        }

        .timeline-event {
            padding: 0 1px;
            font-size: 10px;
        }

        .timeline-event strong {
            font-size: 11px;
        }

        .celestial-grid {
            grid-template-columns: 1fr;
        }

        .astronomy-panel {
            padding-right: 10px;
            padding-left: 10px;
        }

        .astronomy-panel__heading {
            grid-template-columns: minmax(0, 1fr) max-content minmax(0, 1fr);
            gap: 4px;
        }

        .astronomy-location {
            padding-right: 0;
            padding-left: 0;
        }

        .astronomy-location__button {
            min-height: 40px;
            font-size: 11px;
            line-height: 1.2;
        }

        .astronomy-location__favorite {
            height: 28px;
        }

        .astronomy-location__metrics {
            font-size: 9px;
        }

        .live-positions {
            --live-icon-size: 12px;
            --live-row-height: 13px;

            justify-self: center;
            column-gap: 2px;
            row-gap: 3px;
        }

        .live-position {
            font-size: 9px;
        }

        .live-position .live-position__metric {
            grid-template-columns: 6.8ch 4.3ch 5.2ch;
            column-gap: 3px;
        }

        .orbit-moon {
            width: 32px;
            height: 32px;
        }

        .orbit-badge {
            gap: 3px;
            font-size: 9px;
        }

        .night-window-list {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 5px;
            margin-top: 4px;
        }

        .night-window {
            padding: 2px 6px;
        }

        .night-window__body {
            gap: 0;
        }

        .night-window__evidence {
            margin-top: 0;
            padding-top: 1px;
        }
    }

    @media (max-width: 360px) {
        .sun-path-panel.mobile_ui .control-grid {
            grid-template-columns: 68px minmax(0, 1fr) 48px;
            gap: 5px;
        }

        .control-grid--favorites,
        .sun-path-panel.mobile_ui .control-grid--favorites {
            grid-template-columns: 50px minmax(0, 1fr) 42px 44px;
            gap: 4px;
        }

        .control-grid--favorites .segmented-control button {
            gap: 0;
            padding-right: 0;
            padding-left: 0;
            font-size: 11px;
        }

        .control-grid--favorites .event-button__icon svg {
            width: 12px;
            height: 12px;
        }

        .control-grid--favorites .event-button__arrow svg {
            width: 9px;
            height: 9px;
        }

        .segmented-control button {
            font-size: 11px;
        }

        .astronomy-panel__heading {
            grid-template-columns: minmax(0, 1fr) max-content minmax(0, 1fr);
            gap: 3px;
        }

        .live-position .live-position__metric {
            display: flex;
        }

        .live-positions {
            column-gap: 1px;
        }

        .live-position {
            font-size: 8px;
        }

        .live-position strong {
            display: block;
            min-width: 0;
        }

        .live-position__compass {
            display: none;
        }

        .live-position__event-azimuth {
            display: none;
        }
    }

    @media (max-height: 740px) {
        .astronomy-panel {
            padding-top: 4px;
            padding-bottom: 0;
        }

        .astronomy-panel__heading {
            min-height: 38px;
        }
    }

    @media (orientation: landscape) {
        .sun-path-panel.mobile_ui {
            --summary-panel-height: 256px;
            --events-summary-panel-height: 256px;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .segmented-control button,
        .text-button {
            transition: none;
        }

        .astronomy-refresh-indicator.active,
        .astronomy-panel--loading .astronomy-skeleton {
            animation: astronomy-loading-static 0s linear 180ms forwards;
        }

        .astronomy-location__button.scrolling .astronomy-location__name-track {
            width: 100%;
            min-width: 0;
            animation: none;
        }

        .astronomy-location__button.scrolling .astronomy-location__name-value:first-child {
            flex: 1 1 auto;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .astronomy-location__button.scrolling .astronomy-location__name-value[aria-hidden='true'] {
            display: none;
        }
    }

    @keyframes astronomy-loading-static {
        to {
            opacity: 0.58;
        }
    }
</style>

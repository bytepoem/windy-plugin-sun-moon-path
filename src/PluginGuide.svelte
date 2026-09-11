<script lang="ts">
    import CelestialIcon from './CelestialIcon.svelte';
    import { translations, type UiLanguage } from './pluginTranslations';
    import {
        formatDistanceKm, formatPrecipitationMm, formatTemperatureC, formatVisibilityKm,
        formatWindThreshold, windThresholdUnit, type UnitPreferences, type DistanceUnit,
    } from './unitPreferences';

    export let uiLanguage: UiLanguage;
    export let units: UnitPreferences;
    export let showExtendedDistanceMarker: boolean;

    const OPEN_METEO_URL = 'https://open-meteo.com/';
    const CAMS_URL = 'https://atmosphere.copernicus.eu/';
    const formatDistanceLabel = (distanceKm: number, unit: DistanceUnit): string =>
        `${formatDistanceKm(distanceKm, unit)} ${unit}`;
    $: text = translations[uiLanguage];
    $: windWarningThresholdLabel = formatWindThreshold(4.5, units.wind);
    $: windDangerThresholdLabel = formatWindThreshold(9, units.wind);
    $: windLegendUnit = windThresholdUnit(units.wind);
    $: temperatureLegendValues = [0, 5, 12, 18, 24, 30, 36, 38]
        .map(value => formatTemperatureC(value, units.temperature));
    $: dewPointLegendValues = [33, 34, 35, 36]
        .map(value => formatTemperatureC(value, units.temperature));
    $: precipitationLegendValues = [1, 2.5]
        .map(value => formatPrecipitationMm(value, units.precipitation));
    $: visibilityLegendValues = [0.8, 1.5, 3.5, 7, 12]
        .map(value => formatVisibilityKm(value, units.distance));

</script>

<section class="module-about module-guide" aria-label={text.guideHeading}>
    <p>{text.aboutDescription}</p>
    <p>{text.supportGuideHint}</p>

    <section class="feature-guide" aria-labelledby="feature-guide-heading">
        <h3 id="feature-guide-heading">{text.featureGuideHeading}</h3>
        <section class="button-hints" aria-labelledby="button-hints-heading">
            <h4 id="button-hints-heading">{text.buttonHintsHeading}</h4>
            <p>{text.buttonHintsDescription}</p>
        </section>
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
                <dt>{text.featureGuide.cloudPlanning.title}</dt>
                <dd>{text.featureGuide.cloudPlanning.description}</dd>
            </div>
            <div>
                <dt>{text.featureGuide.weatherSources.title}</dt>
                <dd>{text.featureGuide.weatherSources.description}</dd>
            </div>
            <div>
                <dt>{text.featureGuide.units.title}</dt>
                <dd>{text.featureGuide.units.description}</dd>
            </div>
            <div>
                <dt>{text.featureGuide.radarOverlay.title}</dt>
                <dd>{text.featureGuide.radarOverlay.description}</dd>
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
                {formatDistanceLabel(200, units.distance)}
            </span>
            <span class="legend-item">
                <span class="legend-dot legend-dot--outer" aria-hidden="true"></span>
                {formatDistanceLabel(400, units.distance)}
            </span>
            {#if showExtendedDistanceMarker}
                <span class="legend-item">
                    <span class="legend-dot legend-dot--extended" aria-hidden="true"></span>
                    {formatDistanceLabel(600, units.distance)}
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
                <dt>{text.show600Label(formatDistanceLabel(600, units.distance))}</dt>
                <dd>{text.show600Description(formatDistanceLabel(600, units.distance))}</dd>
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
                <span class="weather-legend__swatch tone-freezing">&lt;{temperatureLegendValues[0]}</span>
                <span class="weather-legend__swatch tone-cool">{temperatureLegendValues[1]}</span>
                <span class="weather-legend__swatch tone-cold">{temperatureLegendValues[2]}</span>
                <span class="weather-legend__swatch tone-mild">{temperatureLegendValues[3]}</span>
                <span class="weather-legend__swatch tone-good">{temperatureLegendValues[4]}</span>
                <span class="weather-legend__swatch tone-warning">{temperatureLegendValues[5]}</span>
                <span class="weather-legend__swatch tone-orange">{temperatureLegendValues[6]}</span>
                <span class="weather-legend__swatch tone-danger">≥{temperatureLegendValues[7]}</span>
            </div>
            <p>{text.weatherLegend.temperatureDescription(units.temperature)}</p>
        </section>

        <section class="weather-legend__section">
            <h4>{text.weatherLegend.dewPoint}</h4>
            <div class="weather-legend__scale">
                <span class="weather-legend__swatch tone-good">≤{dewPointLegendValues[0]}</span>
                <span class="weather-legend__swatch tone-warning">{dewPointLegendValues[1]}–{dewPointLegendValues[2]}</span>
                <span class="weather-legend__swatch tone-danger">≥{dewPointLegendValues[3]}</span>
            </div>
            <p>{text.weatherLegend.dewPointDescription(units.temperature)}</p>
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
                <span class="weather-legend__swatch tone-warning">&gt;0–&lt;{precipitationLegendValues[0]}</span>
                <span class="weather-legend__swatch tone-orange">{precipitationLegendValues[0]}–{precipitationLegendValues[1]}</span>
                <span class="weather-legend__swatch tone-danger">&gt;{precipitationLegendValues[1]}</span>
            </div>
            <p>{text.weatherLegend.precipitationDescription(
                precipitationLegendValues[0],
                precipitationLegendValues[1],
                units.precipitation,
            )}</p>
        </section>

        <section class="weather-legend__section">
            <h4>{text.weatherLegend.windSpeed}</h4>
            <div class="weather-legend__scale">
                <span class="weather-legend__swatch tone-good">≤{windWarningThresholdLabel}</span>
                <span class="weather-legend__swatch tone-warning">&gt;{windWarningThresholdLabel}–{windDangerThresholdLabel}</span>
                <span class="weather-legend__swatch tone-danger">&gt;{windDangerThresholdLabel}</span>
            </div>
            <p>{text.weatherLegend.windSpeedDescription(
                windWarningThresholdLabel,
                windDangerThresholdLabel,
                windLegendUnit,
                units.wind === 'bft',
            )}</p>
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
                <span class="weather-legend__swatch tone-danger">{visibilityLegendValues[0]}</span>
                <span class="weather-legend__swatch tone-orange">{visibilityLegendValues[1]}</span>
                <span class="weather-legend__swatch tone-warning">{visibilityLegendValues[2]}</span>
                <span class="weather-legend__swatch tone-mild">{visibilityLegendValues[3]}</span>
                <span class="weather-legend__swatch tone-good">{visibilityLegendValues[4]}</span>
            </div>
            <p>{text.weatherLegend.visibilityDescription(units.distance)}</p>
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

<style lang="less">

    :global(.sun-path-panel.mobile_ui) .module-about {
        padding: 6px 10px 10px;
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

    :global(.sun-path-panel:not(.mobile_ui)) .module-about {
        overscroll-behavior-y: auto;
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

    .button-hints {
        display: grid;
        gap: 2px;
        margin: 4px 0 2px;
        padding: 7px 8px;
        border: 1px solid rgba(99, 185, 238, 0.28);
        border-radius: 6px;
        background: rgba(99, 185, 238, 0.08);
    }

    .button-hints h4,
    .button-hints p {
        margin: 0;
    }

    .button-hints h4 {
        color: var(--panel-text);
        font-size: 11px;
        font-weight: 700;
        line-height: 1.25;
    }

    .button-hints p {
        color: var(--panel-muted);
        font-size: 10px;
        line-height: 1.45;
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
</style>

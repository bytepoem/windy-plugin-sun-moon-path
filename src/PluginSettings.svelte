<script lang="ts">
    import PluginGuide from './PluginGuide.svelte';
    import { translations, type UiLanguage } from './pluginTranslations';
    import { KEEP_CURRENT_OVERLAY, initialOverlayLabel, type InitialOverlayPreference, type WindyOverlay } from './initialOverlay';
    import { RADAR_PROVIDERS, RAINVIEWER_WEBSITE_URL, type RadarProvider, type RadarOverlayStatus } from './radarOverlay';
    import { LOCATION_PROVIDERS, type LocationProvider, type LocationProviderApiKeys } from './locationProvider';
    import { formatDistanceKm, type UnitPreferences } from './unitPreferences';

    // Controlled settings: the shell owns persistence and map side effects.
    export let uiLanguage: UiLanguage;
    export let units: UnitPreferences;
    // Bound to the shell so unmounting this Tab does not reset the selected page.
    export let settingsPage: 'preferences' | 'guide';
    export let initialOverlayPreference: InitialOverlayPreference;
    export let initialOverlayOptions: { value: WindyOverlay }[];
    export let radarProvider: RadarProvider;
    export let radarOverlayStatus: RadarOverlayStatus;
    export let radarOpacityPercent: number;
    export let hideLocationSearch: boolean;
    export let directionLineOpacityPercent: number;
    export let showExtendedDistanceMarker: boolean;
    export let savedApiKeyProvider: LocationProvider | null;
    export let locationApiKeyDrafts: LocationProviderApiKeys;
    export let locationApiKeys: LocationProviderApiKeys;
    export let toggleLanguage: () => void;
    export let changeInitialOverlayPreference: (event: Event) => void;
    export let changeRadarProvider: (event: Event) => void;
    export let changeRadarOpacity: (event: Event) => void;
    export let toggleLocationSearch: (event: Event) => void;
    export let changeDirectionLineOpacity: (event: Event) => void;
    export let toggleExtendedDistanceMarker: (event: Event) => void;
    export let saveLocationApiKey: (event: SubmitEvent, provider: LocationProvider) => void;
    export let updateLocationApiKeyDraft: (event: Event, provider: LocationProvider) => void;
    export let clearLocationApiKey: (provider: LocationProvider) => void;

    const LOCATION_PROVIDER_APPLICATION_URLS: Record<LocationProvider, string> = {
        amap: 'https://lbs.amap.com/api/webservice/create-project-and-key',
        baidu: 'https://lbsyun.baidu.com/docs/jsapi?title=jsapi4/quickstart/prepare',
        tencent: 'https://lbs.qq.com/webApi/javascriptGL/glGuide/glBasic',
    };
    $: text = translations[uiLanguage];
    $: radarStatusText = text.radarStatusLabels[radarOverlayStatus];
    $: extendedDistanceLabel = `${formatDistanceKm(600, units.distance)} ${units.distance}`;
</script>

<div class="settings-header">
    <div class="settings-pages" role="group" aria-label={text.settingsTab}>
        <button type="button" class:active={settingsPage === 'preferences'} aria-pressed={settingsPage === 'preferences'} on:click={() => (settingsPage = 'preferences')}>{uiLanguage === 'zh' ? '偏好设置' : 'Preferences'}</button>
        <button type="button" class:active={settingsPage === 'guide'} aria-pressed={settingsPage === 'guide'} on:click={() => (settingsPage = 'guide')}>{uiLanguage === 'zh' ? '使用说明' : 'User guide'}</button>
    </div>
    <button
        type="button"
        class="language-toggle"
        aria-label={text.languageToggleLabel}
        title={text.languageToggleLabel}
        on:click={toggleLanguage}
    >
        <span class="language-toggle__option" class:active={uiLanguage === 'zh'}>中文</span>
        <span class="language-toggle__option" class:active={uiLanguage === 'en'}>EN</span>
    </button>
</div>
{#if settingsPage === 'guide'}
    <PluginGuide {uiLanguage} {units} {showExtendedDistanceMarker} />
{:else}
<section class="module-about module-settings" aria-label={text.settingsHeading}>
    <div class="settings-select">
        <label for="initial-overlay">{text.initialOverlayLabel}</label>
        <select
            id="initial-overlay"
            value={initialOverlayPreference}
            aria-describedby="initial-overlay-description"
            on:change={changeInitialOverlayPreference}
        >
            <option value={KEEP_CURRENT_OVERLAY}>{text.keepCurrentOverlayLabel}</option>
            {#each initialOverlayOptions as option}
                <option value={option.value}>{initialOverlayLabel(option.value, uiLanguage)}</option>
            {/each}
        </select>
        <span id="initial-overlay-description" class="settings-select__description">
            {text.initialOverlayDescription}
        </span>
    </div>
    <div class="settings-select settings-radar-source">
        <label for="radar-provider">{text.radarProviderLabel}</label>
        <select
            id="radar-provider"
            value={radarProvider}
            aria-describedby="radar-provider-description radar-provider-status"
            on:change={changeRadarProvider}
        >
            {#each RADAR_PROVIDERS as providerOption}
                <option value={providerOption}>{text.radarProviderLabels[providerOption]}</option>
            {/each}
        </select>
        <span id="radar-provider-description" class="settings-select__description">
            {text.radarProviderDescription}
        </span>
        {#if radarProvider === 'rainviewer'}
            <span class="settings-select__description settings-radar-source__provider-note">
                {text.rainViewerDescription}
                <a href={RAINVIEWER_WEBSITE_URL} target="_blank" rel="noreferrer">RainViewer</a>
            </span>
        {/if}
        <span
            id="radar-provider-status"
            class="settings-radar-status"
            class:settings-radar-status--ready={radarOverlayStatus === 'ready'}
            class:settings-radar-status--warning={radarOverlayStatus === 'out-of-range'}
            class:settings-radar-status--error={radarOverlayStatus === 'error'}
            role="status"
            aria-live="polite"
        >
            <span aria-hidden="true"></span>
            {radarStatusText}
        </span>
    </div>
    <div class="settings-range settings-range--radar-opacity">
        <div class="settings-range__header">
            <label for="radar-overlay-opacity">{text.radarOpacityLabel}</label>
            <output for="radar-overlay-opacity">{radarOpacityPercent}%</output>
        </div>
        <input
            id="radar-overlay-opacity"
            type="range"
            min="0"
            max="100"
            step="1"
            value={radarOpacityPercent}
            aria-describedby="radar-overlay-opacity-description"
            on:input={changeRadarOpacity}
        />
        <span id="radar-overlay-opacity-description" class="settings-range__description">
            {text.radarOpacityDescription}
        </span>
    </div>
    <label class="settings-toggle">
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
            <strong>{text.show600Label(extendedDistanceLabel)}</strong>
            <span>{text.show600Description(extendedDistanceLabel)}</span>
        </span>
        <input
            type="checkbox"
            checked={showExtendedDistanceMarker}
            aria-label={text.show600Label(extendedDistanceLabel)}
            on:change={toggleExtendedDistanceMarker}
        />
        <span class="settings-toggle__control" aria-hidden="true"></span>
    </label>
</section>
{/if}

<style>

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

    .settings-header {
        flex-shrink: 0;
        display: flex;
        gap: 8px;
        padding: 8px 12px;
        border-bottom: 1px solid var(--panel-border);
    }

    .settings-pages {
        display: flex;
        flex: 1;
        min-width: 0;
        gap: 8px;
    }

    .settings-header .language-toggle {
        flex: 0 0 80px;
        width: 80px;
    }

    .settings-pages button {
        flex: 1;
        min-height: 36px;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        background: transparent;
        color: var(--panel-muted);
        font: inherit;
        cursor: pointer;
    }

    .settings-pages button.active {
        color: var(--panel-text);
        background: rgba(99, 185, 238, 0.14);
        border-color: var(--panel-accent);
    }

    .settings-pages button:focus-visible,
    .language-toggle:focus-visible {
        outline: 2px solid var(--panel-accent);
        outline-offset: -2px;
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

    .module-settings {
        gap: 6px;
    }

    .settings-select {
        display: grid;
        gap: 6px;
        padding: 10px 12px;
        border: 1px solid var(--panel-border);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.06);
    }

    .settings-select label {
        color: var(--panel-text);
        font-size: 13px;
        font-weight: 700;
        line-height: 1.25;
    }

    .settings-select select {
        width: 100%;
        min-width: 0;
        height: 30px;
        padding: 0 10px;
        border: 1px solid var(--panel-border);
        border-radius: 6px;
        outline: 0;
        background: rgba(8, 15, 27, 0.68);
        color: var(--panel-text);
        font: inherit;
        font-size: 13px;
        cursor: pointer;
    }

    .settings-select select:focus-visible {
        border-color: var(--panel-accent);
        outline: 2px solid var(--panel-accent);
        outline-offset: 2px;
    }

    .settings-select__description {
        color: var(--panel-muted);
        font-size: 11px;
        line-height: 1.35;
    }

    .settings-radar-source__provider-note {
        display: flex;
        flex-wrap: wrap;
        gap: 2px 6px;
        align-items: baseline;
    }

    .settings-radar-source__provider-note a {
        color: var(--panel-accent);
        font-weight: 700;
        text-underline-offset: 2px;
    }

    .settings-radar-source__provider-note a:hover {
        color: var(--panel-text);
    }

    .settings-radar-source__provider-note a:focus-visible {
        border-radius: 3px;
        outline: 2px solid var(--panel-accent);
        outline-offset: 2px;
    }

    .settings-radar-status {
        display: inline-flex;
        gap: 6px;
        align-items: center;
        min-height: 18px;
        color: var(--panel-muted);
        font-size: 11px;
        line-height: 1.35;
    }

    .settings-radar-status > span[aria-hidden='true'] {
        flex: 0 0 auto;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: currentColor;
        opacity: 0.72;
    }

    .settings-radar-status--ready {
        color: #8bd6a3;
    }

    .settings-radar-status--warning {
        color: var(--panel-warning);
    }

    .settings-radar-status--error {
        color: #ffc078;
    }

    .settings-api-keys {
        display: grid;
        gap: 6px;
    }

    .settings-api-key {
        display: grid;
        gap: 4px;
        padding: 7px 10px;
        border: 1px solid var(--panel-border);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.06);
    }

    .settings-api-key__header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 6px;
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
        gap: 4px;
    }

    .settings-api-key__control input {
        min-width: 0;
        height: 30px;
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
        min-height: 30px;
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
</style>

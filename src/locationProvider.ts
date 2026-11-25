import { KNOWN_LOCATION_SEARCH_FAILURES, messages } from './locales/locationProvider';
import { DEFAULT_UI_LANGUAGE, type UiLanguage } from './uiLanguage';
import type { Coordinates } from './solar';
import type { LightPollutionPoint } from './lightPollution';

export const LOCATION_PROVIDERS = ['amap', 'baidu', 'tencent'] as const;

export type LocationProvider = typeof LOCATION_PROVIDERS[number];

export type LocationProviderApiKeys = Record<LocationProvider, string>;



export const locationSearchFailureMessage = (
    error: unknown,
    providerName: string,
    fallbackMessage: string,
    language: UiLanguage = DEFAULT_UI_LANGUAGE,
): string => {
    const detail = error instanceof Error ? error.message.trim() : '';
    if (!detail) {
        return fallbackMessage;
    }

    const knownMessage = KNOWN_LOCATION_SEARCH_FAILURES[language][
        detail as keyof typeof KNOWN_LOCATION_SEARCH_FAILURES[typeof language]
    ];
    if (knownMessage) {
        return messages[language].providerError(providerName, knownMessage);
    }
    if (/^[A-Z][A-Z0-9_]*$/.test(detail)) {
        return fallbackMessage;
    }
    return messages[language].providerError(providerName, detail);
};

export const applyLocationApiKey = (
    apiKeys: LocationProviderApiKeys,
    provider: LocationProvider,
    apiKey: string,
): { provider: LocationProvider; apiKeys: LocationProviderApiKeys } => ({
    provider,
    apiKeys: { ...apiKeys, [provider]: apiKey },
});

export type LocationSearchResult = {
    id: string;
    name: string;
    district: string;
    address: string;
    province: string;
    city: string;
    area: string;
    distanceKm: number | null;
    wgs84: Coordinates;
};

export type LocationSearchSelection = LocationSearchResult & {
    elevationM: number | null | undefined;
    lightPollution?: LightPollutionPoint | null;
};

export type LocationSearchOptions = {
    apiKey: string;
    keyword: string;
    origin?: Coordinates;
    signal?: AbortSignal;
};

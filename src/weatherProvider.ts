import type { Coordinates } from './solar';
import {
    transformWeatherPayload,
    type WeatherForecastPayload,
    type WeatherModel,
    type WeatherPoint,
    type WeatherSource,
} from './weather';

export type WeatherRequest = {
    location: Coordinates;
    model: WeatherModel;
    requestedAt: number;
    signal: AbortSignal;
};

export type WeatherResult = {
    points: WeatherPoint[];
    /** Only Windy supplies cloud geometry; Open-Meteo must never masquerade as this payload. */
    cloudForecast: WeatherForecastPayload | null;
};

export type WeatherProvider = {
    weather: (request: WeatherRequest & { source: WeatherSource }) => Promise<WeatherResult>;
    clouds: (request: WeatherRequest) => Promise<WeatherForecastPayload>;
};

/** Shares source selection and normalization between the main panel and favorite comparison. */
export const createWeatherProvider = (port: {
    windy: (request: WeatherRequest) => Promise<WeatherForecastPayload>;
    openMeteo: (request: WeatherRequest) => Promise<WeatherPoint[]>;
}): WeatherProvider => ({
    weather: async request => {
        if (request.source === 'open-meteo') {
            return { points: await port.openMeteo(request), cloudForecast: null };
        }
        const cloudForecast = await port.windy(request);
        return {
            points: transformWeatherPayload(cloudForecast, request.requestedAt),
            cloudForecast,
        };
    },
    clouds: request => port.windy(request),
});

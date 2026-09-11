import { getPointForecastData } from '@windy/fetch';
import { fetchOpenMeteoWeather } from './openMeteo';
import { createWeatherProvider } from './weatherProvider';
import type { WeatherForecastPayload } from './weather';

/** The only host adapter for forecast requests. Consumers retain their own request lifetimes. */
export const windyWeatherProvider = createWeatherProvider({
    windy: async ({ location, model, signal }) => {
        const response = await getPointForecastData(
            model,
            { ...location, days: 5, step: 1, source: 'detail' },
            { header: true, meteogram: true, sounding: true },
            { abortSignal: signal },
        );
        return response.data as WeatherForecastPayload;
    },
    openMeteo: request => fetchOpenMeteoWeather(request),
});

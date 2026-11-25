import { beforeAll, describe, expect, it, vi } from 'vitest';
import { compileRenderer, type RenderComponent } from './test/renderSvelte';
import { createMultiDayCalculator } from './multiDayPlanner';
import { multiDayWeatherMetrics } from './multiDayWeatherPresentation';
import type { WeatherPoint } from './weather';

// The direct metric selection import needs the host module. Rendered unit conversions use compileRenderer's adapter.
vi.mock('@windy/metrics', () => ({ default: {} }));

let renderWeather: RenderComponent;
beforeAll(async () => { renderWeather = await compileRenderer('MultiDayWeather.svelte'); }, 20_000);
const interval = { start: new Date('2027-06-12T21:00Z'), end: new Date('2027-06-13T00:00Z') };
const sample = (hour: number): WeatherPoint => ({
    timestamp: Date.UTC(2027, 5, 12, hour), totalCloudPercent: 20, windMs: 3,
    iconCode: null, isDay: false, highCloudPercent: null, mediumCloudPercent: null, lowCloudPercent: null,
    temperatureC: null, dewPointC: null, humidityPercent: null, precipMm: 4, windDirectionDeg: null,
    aod550: null, visibilityKm: null, precipitationPeriodMs: 3_600_000,
});
const props = { interval, points: [sample(20), sample(21), sample(23), sample(24)], status: 'ready',
    aodStatus: 'ready', visibilityStatus: 'ready',
    language: 'zh', timeZone: 'UTC', units: { wind: 'm/s', temperature: '°C', precipitation: 'mm', distance: 'km', elevation: 'm' } };
// This real Milky Way window lasts under five minutes between hourly instants,
// but intersects the source's full 05:00–06:00 local rain accumulation.
const shortWindow = createMultiDayCalculator({ lat:23.06, lon:113.36 }, 'Asia/Shanghai', 0)('2027-01-10').windows['milky-way'][0];
const hourlyRain = [21, 22].map(hour => ({ ...sample(hour),
    timestamp:Date.UTC(2027, 0, 10, hour), precipMm:hour === 22 ? 4 : 0,
    totalCloudPercent:99, temperatureC:99,
}));

describe('compiled multi-day window evidence', () => {
    it('keeps the OM snow period that ends at the window boundary without leaking ground depth', () => {
        const points = [
            { ...sample(21), iconCode: 10, snowCondition: 'snow', snowIntensity: 'heavy', snowfallCm: 0, snowDepthCm: 7 },
            { ...sample(24), snowfallCm: 1.2, snowDepthCm: 99 },
        ] satisfies WeatherPoint[];
        const metrics = multiDayWeatherMetrics([interval], points, 'open-meteo', 'auto');
        const html = renderWeather({ ...props, points, source: 'open-meteo', metrics, expanded: true });
        expect(html).toContain('1.2 cm');
        expect(html).toContain('7 cm');
        expect(html).not.toContain('99 cm');
        expect(html).toContain('2027-06-12 23:00 – 2027-06-13 00:00');
        expect(html).toContain('data-snow-intensity="heavy"');
    });

    it('retains overlapping accumulated rain when a real window has no instantaneous samples', () => {
        const html = renderWeather({ ...props, interval:shortWindow, points:hourlyRain, timeZone:'Asia/Shanghai', expanded:true });
        expect(html).toContain('4 mm');
        expect(html).toContain('2027-01-11 05:00 – 2027-01-11 06:00');
        expect(html).toContain('缺测');
        expect(html).not.toContain('预报范围内');
        expect(html).not.toContain('99%');
        expect(html).not.toContain('99 °C');
        const withoutSummary = renderWeather({ ...props, interval:shortWindow, points:hourlyRain,
            timeZone:'Asia/Shanghai', expanded:true, showSummary:false, showCoverage:true });
        expect(withoutSummary).toContain('4 mm');
        expect(withoutSummary).toContain('2027-01-11 05:00 – 2027-01-11 06:00');
        const dry = renderWeather({ ...props, interval:shortWindow,
            points:hourlyRain.map(point => ({ ...point, precipMm:0 })) });
        expect(dry).toContain('0 mm');
    });
    it.each(['loading', 'error', 'empty'])('does not expose retained rain samples while weather is %s', status => {
        const html = renderWeather({ ...props, interval:shortWindow, points:hourlyRain, status, expanded:true });
        expect(html).not.toContain('4 mm');
        expect(html).not.toContain('原始预报点');
    });
    it('shows only selected-window ranges and labels partial coverage with endpoints', () => {
        const full = renderWeather(props);
        expect(full).toContain('20%');
        expect(full).toContain('预报范围内');
        const partial = renderWeather({ ...props, points: [sample(20), sample(21), sample(22)] });
        expect(partial).toContain('部分覆盖');
        expect(partial).toContain('2027-06-12 22:00');
    });
    it('retains accumulation periods rather than adding or prorating rain', () => {
        const html = renderWeather({ ...props, expanded: true });
        expect(html).toContain('2027-06-12 23:00 – 2027-06-13 00:00');
        expect(html).toContain('4 mm');
        expect(html).not.toContain('12 mm');
        expect(html).toContain('不拆分、不求和');
    });
    it('retains exact partial-coverage times when matrix details omit duplicate metrics', () => {
        const html = renderWeather({ ...props, showSummary:false, showCoverage:true,
            points:[sample(20), sample(21), sample(22)] });
        expect(html).toContain('部分覆盖');
        expect(html).toContain('2027-06-12 22:00');
        expect(html).not.toContain('20%');
    });
    it.each([
        ['error', [], '加载失败'], ['loading', [], '正在加载'], ['empty', [], '缺测'],
        ['ready', [sample(1), sample(2)], '日期超出预报范围'],
    ])('separates %s from an actual weather range', (status, points, expected) => {
        const html = renderWeather({ ...props, status, points });
        expect(html).toContain(expected);
        expect(html).not.toContain('20%');
    });
    it('shows all requested metrics from in-window samples and original rainfall periods', () => {
        const observation = { temperatureC:18, dewPointC:13, humidityPercent:65, visibilityKm:12, aod550:0.2, iconCode:1 };
        const html = renderWeather({ ...props, expanded:true, points:[
            { ...sample(20), temperatureC:99, aod550:9, precipMm:99, iconCode:14 },
            { ...sample(21), ...observation, precipMm:99 },
            { ...sample(23), ...observation, temperatureC:20, dewPointC:15, humidityPercent:80, visibilityKm:15, aod550:0.4, iconCode:7 },
            { ...sample(24), temperatureC:99, aod550:9, precipMm:6, iconCode:14 },
        ] });
        for (const expected of ['18–20 °C', '13–15 °C', '65–80%', '12–15 km', '0.20–0.40', '4–6 mm', 'weather-icon']) {
            expect(html).toContain(expected);
        }
        // Endpoint-only accumulation rows cannot leak other observations or be
        // added together into an invented window rainfall total.
        for (const excluded of ['99 °C', '9.00', '99 mm', '10 mm', 'weather-icon__thunder']) {
            expect(html).not.toContain(excluded);
        }
        expect(html).toContain('2027-06-12 23:00 – 2027-06-13 00:00');
    });
    it('keeps zero measurements distinct from missing and marks partial samples', () => {
        const html = renderWeather({ ...props, points:[
            { ...sample(21), precipMm:0, humidityPercent:0, aod550:0, visibilityKm:0 },
            { ...sample(23), precipMm:0, humidityPercent:null, aod550:null, visibilityKm:null },
            { ...sample(24), precipMm:0 },
        ] });
        expect(html).toContain('0 mm');
        expect(html).toContain('0% (缺测)');
        expect(html).toContain('0.00 (缺测)');
        expect(html).toContain('0 km (缺测)');
        expect(html).not.toContain('null');
    });
    it('separates independent loading and failure states', () => {
        const points = [sample(21), sample(23), sample(24)].map(point => ({
            ...point, temperatureC:18, aod550:0.2, visibilityKm:12,
        }));
        const html = renderWeather({ ...props, points, aodStatus:'loading', visibilityStatus:'error', expanded:true });
        expect(html).toContain('18 °C');
        expect(html).toContain('加载中');
        expect(html).toContain('加载失败');
        expect(html).not.toContain('0.20');
        expect(html).not.toContain('12 km');
        const complete = renderWeather({ ...props, points });
        expect(complete).toContain('0.20');
        expect(complete).toContain('12 km');
    });
    it('renders new and reused evidence copy after installing a verified non-English catalog', () => {
        const html = renderWeather({ ...props, language: 'ja', expanded: true });
        expect(html).not.toContain('预报范围内');
        expect(html).not.toContain('Within forecast range');
        expect(html).toContain('4 mm');
    });
});

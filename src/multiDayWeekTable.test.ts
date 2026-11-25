import { beforeAll, describe, expect, it, vi } from 'vitest';
import { compileRenderer, type RenderComponent } from './test/renderSvelte';
import { createMultiDayCalculator } from './multiDayPlanner';
import { multiDayWeatherMetrics } from './multiDayWeatherPresentation';
import type { WeatherPoint } from './weather';

vi.mock('@windy/metrics', () => ({ default: {} }));

let renderTable: RenderComponent;
const calculate = createMultiDayCalculator({ lat:23.06, lon:113.36 }, 'UTC', 0);
const rows = Array.from({ length:7 }, (_, index) => calculate(`2027-06-${12 + index}`));
const points: WeatherPoint[] = rows.map((row, index) => ({
    timestamp:row.windows.sunset[0].start.getTime() + 30 * 60_000, precipitationPeriodMs:3_600_000,
    iconCode:1, isDay:true, totalCloudPercent:10 + index, windMs:3, precipMm:index,
    temperatureC:20 + index, dewPointC:13, humidityPercent:65, visibilityKm:12, aod550:0.2,
    highCloudPercent:null, mediumCloudPercent:null, lowCloudPercent:null, windDirectionDeg:null,
}));
const props = { rows, points, target:'sunset', status:'ready', aodStatus:'ready', visibilityStatus:'ready',
    language:'zh', timeZone:'UTC', units:{ wind:'m/s', temperature:'°C', precipitation:'mm', distance:'km', elevation:'m' } };
beforeAll(async () => { renderTable = await compileRenderer('MultiDayWeekTable.svelte'); }, 20_000);

/** Explicit table-header associations identify the same date/metric cell after
 * transposition, independently of DOM row order or visual CSS selectors.
 */
const cells = (html: string) => Object.fromEntries([...html.matchAll(/<td\b[^>]*headers="week-date-([\d-]+) week-field-(\w+)"[^>]*>([\s\S]*?)<\/td>/g)]
    .map(([, date, metric, value]) => [`${date}/${metric}`, value.trim()] as const)
    .sort(([left], [right]) => left.localeCompare(right)));

describe('compiled seven-day date axes', () => {
    it.each(['fr', 'de', 'ru'])('keeps month before day in %s date headers', language => {
        const html = renderTable({ ...props, language, orientation: 'horizontal' });
        const header = html.match(/<th\b[^>]*id="week-date-2027-06-12"[^>]*>([\s\S]*?)<\/th>/)![1];
        expect(header).toContain('6/12');
        expect(header).not.toContain('12/06');
        expect(header).not.toContain('12.6');
    });

    it.each(['horizontal', 'vertical'])('shows overlapping accumulated rain independently of missing instants in %s', orientation => {
        const row = createMultiDayCalculator({ lat:23.06, lon:113.36 }, 'Asia/Shanghai', 0)('2027-01-10');
        const hourlyRain = [21, 22].map(hour => ({ ...points[0],
            timestamp:Date.UTC(2027, 0, 10, hour), precipMm:hour === 22 ? 4 : 0,
        }));
        const values = cells(renderTable({ ...props, rows:[row], points:hourlyRain,
            target:'milky-way', timeZone:'Asia/Shanghai', orientation }));
        expect(values['2027-01-10/precipMm']).toBe('4 mm');
        expect(values['2027-01-10/totalCloudPercent']).toBe('—');
        expect(values['2027-01-10/temperatureC']).toBe('—');
        expect(values['2027-01-10/coverage']).toBe('缺测');
    });
    it.each(['horizontal', 'vertical'])('labels out-of-window event samples and keeps rain separate in %s', orientation => {
        const [row] = rows;
        const event = row.windows.sunset[0];
        const before = { ...points[0], timestamp: event.start.getTime() - 37 * 60_000, temperatureC: 9 };
        const after = { ...points[0], timestamp: event.end.getTime() + 23 * 60_000, temperatureC: 3, precipMm: 7 };
        const html = renderTable({ ...props, rows: [row], points: [before, after], orientation });
        const values = cells(html);
        expect(html).toContain('class="reference-time');
        expect(values[`${row.date}/coverage`]).toMatch(/参考.*日落.*\+83/);
        expect(values[`${row.date}/temperatureC`]).toBe('3 °C');
        expect(values[`${row.date}/precipMm`]).toBe('7 mm');
    });
    it('puts all seven dates in column headers horizontally', () => {
        const html = renderTable({ ...props, orientation:'horizontal' });
        const head = html.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/)![1];
        const body = html.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/)![1];
        expect([...head.matchAll(/data-date="/g)]).toHaveLength(7);
        expect(body).not.toContain('data-date=');
        for (const row of rows) { expect(head).toContain(`data-date="${row.date}"`); }
    });
    it('puts all seven dates in row headers vertically', () => {
        const html = renderTable({ ...props, orientation:'vertical' });
        const head = html.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/)![1];
        const body = html.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/)![1];
        expect(head).not.toContain('data-date=');
        expect([...body.matchAll(/data-date="/g)]).toHaveLength(7);
        for (const row of rows) { expect(body).toContain(`data-date="${row.date}"`); }
    });
    it('keeps every date/metric value unchanged when the axes transpose', () => {
        const horizontal = cells(renderTable({ ...props, orientation:'horizontal' }));
        const vertical = cells(renderTable({ ...props, orientation:'vertical' }));
        expect(Object.keys(horizontal)).toHaveLength(70);
        expect(vertical).toEqual(horizontal);
        expect(horizontal['2027-06-12/temperatureC']).toContain('20 °C');
        expect(horizontal['2027-06-18/temperatureC']).toContain('26 °C');
    });
    it.each(['horizontal', 'vertical'])('shows snow accumulations and depth in the same window in %s', orientation => {
        const [row] = rows;
        const window = row.windows.sunset[0];
        const [point] = points;
        const snowy = [
            { ...point, timestamp: window.start.getTime() - 30 * 60_000, precipitationPeriodMs: undefined,
                snowWaterPeriodHours: 3 as const, snowWaterMm: 0.12, snowfallCm: 0.35, snowDepthCm: 99 },
            { ...point, timestamp: window.start.getTime() + 30 * 60_000, precipitationPeriodMs: undefined,
                snowWaterPeriodHours: 1 as const, snowWaterMm: 0, snowfallCm: 0, snowDepthCm: 8 },
        ];
        const metrics = multiDayWeatherMetrics([window], snowy, 'windy', 'auto');
        const visible = cells(renderTable({ ...props, rows: [row], points: snowy, orientation, metrics, snowStatus: 'ready' }));
        expect(visible[`${row.date}/snowWaterMm`]).toBeUndefined();
        expect(visible[`${row.date}/snowfallCm`]).toBe('0–0.35 cm');
        expect(visible[`${row.date}/snowDepthCm`]).toBe('8 cm');
        const failed = cells(renderTable({ ...props, rows: [row], points: snowy, orientation, metrics, snowStatus: 'error' }));
        expect(failed[`${row.date}/snowfallCm`]).toBe('0–0.35 cm');
        expect(failed[`${row.date}/snowDepthCm`]).toContain('加载失败');
        expect(multiDayWeatherMetrics([window], snowy, 'windy', 'hidden')).not.toContain('snowfallCm');
        expect(multiDayWeatherMetrics([window], [], 'open-meteo', 'always')).toContain('snowfallCm');
    });
    it.each(['horizontal', 'vertical'])('keeps independent metric states in %s date layout', orientation => {
        const values = cells(renderTable({ ...props, orientation, aodStatus:'error', visibilityStatus:'loading' }));
        expect(values['2027-06-12/aod550']).toContain('加载失败');
        expect(values['2027-06-12/visibilityKm']).toContain('加载中');
        expect(values['2027-06-12/totalCloudPercent']).toContain('10%');
    });
    it('keeps separate windows and unavailable dates distinct instead of aggregating them', () => {
        const modified = rows.map((row, index) => ({ ...row, windows:{ ...row.windows, sunset:index === 0
            ? [...row.windows.sunset, { start:new Date(row.windows.sunset[0].end.getTime() + 3_600_000), end:new Date(row.windows.sunset[0].end.getTime() + 7_200_000) }]
            : index === 1 ? [] : row.windows.sunset } }));
        const values = cells(renderTable({ ...props, rows:modified, orientation:'horizontal' }));
        expect(values['2027-06-12/coverage']).toContain('全部窗口 · 2');
        expect(values['2027-06-13/coverage']).toContain('无可用时段');
        expect(values['2027-06-12/totalCloudPercent']).toBe('—');
        expect(values['2027-06-13/totalCloudPercent']).toBe('—');
    });
});

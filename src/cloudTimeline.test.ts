import { describe, expect, it } from 'vitest';
import { cloudGalacticCenterPosition, cloudTimeInstant } from './cloudGeometry';
import { cloudClockMinute, cloudEventBody, cloudMinuteClock, galacticCenterEvents } from './cloudTimeline';
import { dateInputForInstant } from './solar';

describe('cloud timeline', () => {
    const location = { lat: 24.918759, lon: 112.658726 };
    it('finds both galactic centre crossings within the selected local day', () => {
        const events = galacticCenterEvents('2026-09-08', 'Asia/Shanghai', location);
        expect(events.map(event => event.type).sort()).toEqual(['milkywayrise', 'milkywayset']);
        for (const event of events) {
            expect(dateInputForInstant(new Date(event.timestamp), 'Asia/Shanghai')).toBe('2026-09-08');
            const before = cloudGalacticCenterPosition(event.timestamp - 1000, location).altitude;
            const after = cloudGalacticCenterPosition(event.timestamp + 1000, location).altitude;
            expect(event.type === 'milkywayrise' ? before < 0 && after > 0 : before > 0 && after < 0).toBe(true);
            expect(cloudGalacticCenterPosition(event.timestamp, location).sightlineAvailable).toBe(true);
        }
    });
    it('does not invent events when the galactic centre never rises or never sets', () => {
        expect(galacticCenterEvents('2026-09-08', 'UTC', { lat: 80, lon: 0 })).toEqual([]);
        expect(galacticCenterEvents('2026-09-08', 'UTC', { lat: -80, lon: 0 })).toEqual([]);
    });
    it.each(['2026-03-08', '2026-11-01'])('keeps DST-day events within %s', date => {
        const events = galacticCenterEvents(date, 'America/New_York', { lat: 40.7, lon: -74 });
        expect(events.length).toBeGreaterThan(0);
        for (const event of events) {
            expect(dateInputForInstant(new Date(event.timestamp), 'America/New_York')).toBe(date);
        }
    });
    it('maps minute slider endpoints and the screenshot time without crossing dates', () => {
        for (const [minute, clock] of [[0, '00:00'], [1207, '20:07'], [1439, '23:59']] as const) {
            expect(cloudMinuteClock(minute)).toBe(clock);
            expect(cloudClockMinute(clock)).toBe(minute);
        }
        expect(cloudTimeInstant('2026-03-08', cloudMinuteClock(150), 'America/New_York')).toBeNull();
    });
});


it.each([
    ['sunrise', 'sun'], ['sunset', 'sun'], ['moonrise', 'moon'], ['moonset', 'moon'],
    ['milkywayrise', 'milkyway'], ['milkywayset', 'milkyway'],
] as const)('selects the same obstruction body for %s', (event, body) => {
    expect(cloudEventBody(event)).toBe(body);
});

import { cloudGalacticCenterPosition } from './cloudGeometry';
import { cloudTimelineLabel, type CloudTimelineEvent } from './cloudTimeline';
import {
    destinationPoint, LINE_LENGTHS_KM, LINE_COLORS, MOON_LINE_COLORS,
    type Coordinates, type SolarEvent, type SolarPath, type SolarPathSuccess,
    type SolarPathUnavailable, type SolarSampleKind,
} from './solar';

export type GalacticEvent = 'milkywayrise' | 'milkywayset';
export type DirectionEvent = SolarEvent | GalacticEvent | 'all';
export type GalacticPath = (Omit<SolarPathSuccess, 'event'> | Omit<SolarPathUnavailable, 'event'>)
    & { event: GalacticEvent; eventLabel: string };
export type DirectionPath = SolarPath | GalacticPath;

export const GALACTIC_LINE_COLORS = {
    before: '#b8ecd0',
    event: '#57c58b',
    after: '#27815e',
} as const;

export const isGalacticEvent = (event: DirectionEvent): event is GalacticEvent =>
    event === 'milkywayrise' || event === 'milkywayset';

/** Build all three bearings even below the horizon: these are direction references, not visibility claims. */
export const galacticDirectionPaths = (
    events: CloudTimelineEvent[], location: Coordinates, language: 'zh' | 'en',
): GalacticPath[] => (['milkywayrise', 'milkywayset'] as const).map(event => {
    const eventLabel = cloudTimelineLabel(event, language === 'zh');
    const crossing = events.find(item => item.type === event);
    if (!crossing) {
        return { status: 'unavailable', event, eventLabel, reason: 'not-available' };
    }
    const name = eventLabel;
    const samples = ([
        { kind: 'before', offsetMinutes: -30, label: language === 'zh' ? `${name}前 30 分钟` : `30 min before ${name}` },
        { kind: 'event', offsetMinutes: 0, label: name },
        { kind: 'after', offsetMinutes: 30, label: language === 'zh' ? `${name}后 30 分钟` : `30 min after ${name}` },
    ] satisfies { kind: SolarSampleKind; offsetMinutes: number; label: string }[]).map(sample => {
        const time = new Date(crossing.timestamp + sample.offsetMinutes * 60_000);
        const { azimuth } = cloudGalacticCenterPosition(time.getTime(), location);
        return {
            ...sample, time, azimuth,
            point200: destinationPoint(location, azimuth, LINE_LENGTHS_KM.inner),
            point400: destinationPoint(location, azimuth, LINE_LENGTHS_KM.outer),
            point600: destinationPoint(location, azimuth, LINE_LENGTHS_KM.extended),
        };
    });
    return { status: 'ok', event, eventLabel, eventTime: new Date(crossing.timestamp), samples };
});

/** Keep the existing All overview limited to Sun/Moon rays; galactic shortcuts select their own triplet. */
export const selectDirectionPaths = (
    solarPaths: SolarPath[], galacticPaths: GalacticPath[], event: DirectionEvent,
): DirectionPath[] => event === 'all' ? solarPaths
    : (isGalacticEvent(event) ? galacticPaths : solarPaths).filter(path => path.event === event);

export const directionLineColor = (event: DirectionEvent, kind: SolarSampleKind): string =>
    isGalacticEvent(event) ? GALACTIC_LINE_COLORS[kind]
        : event === 'moonrise' || event === 'moonset' ? MOON_LINE_COLORS[kind] : LINE_COLORS[kind];

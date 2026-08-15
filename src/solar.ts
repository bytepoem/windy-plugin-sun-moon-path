import * as SunCalc from 'suncalc';

export const EARTH_RADIUS_KM = 6371.0088;
export const SAMPLE_OFFSETS_MINUTES = [-30, 0, 30] as const;
export const LINE_LENGTHS_KM = {
    inner: 200,
    outer: 400,
} as const;
export const CURRENT_DIRECTION_LENGTH_KM = 600;

export const LINE_COLORS = {
    before: '#f6b65c',
    event: '#f97316',
    after: '#991b1b',
} as const;
export const CURRENT_DIRECTION_COLOR = '#ffffff';
export const CURRENT_MOON_DIRECTION_COLOR = '#8ec5ff';

export type SolarEvent = 'sunrise' | 'sunset' | 'moonrise' | 'moonset';
export type SolarSampleKind = 'before' | 'event' | 'after';
export type CelestialBody = 'sun' | 'moon';

export interface Coordinates {
    lat: number;
    lon: number;
}

export interface SolarSample {
    kind: SolarSampleKind;
    label: string;
    offsetMinutes: number;
    time: Date;
    azimuth: number;
    point200: Coordinates;
    point400: Coordinates;
}

export interface SolarDirection {
    body: 'sun';
    azimuth: number;
    altitude: number;
    endpoint: Coordinates;
}

export interface CurrentCelestialDirection {
    body: CelestialBody;
    azimuth: number;
    altitude: number;
    endpoint: Coordinates;
}

export interface CurrentMoonInfo extends CurrentCelestialDirection {
    body: 'moon';
    distanceKm: number;
    illuminationFraction: number;
    phase: number;
    waxing: boolean;
}

export interface SolarPathSuccess {
    status: 'ok';
    event: SolarEvent;
    eventTime: Date;
    samples: SolarSample[];
}

export interface SolarPathUnavailable {
    status: 'unavailable';
    event: SolarEvent;
    reason: 'always-up' | 'always-down' | 'not-available';
}

export type SolarPath = SolarPathSuccess | SolarPathUnavailable;

export type AstronomyTimelineKind = 'dawn' | 'sunrise' | 'moonrise' | 'sunset' | 'dusk' | 'moonset';

export interface AstronomyTimelineItem {
    kind: AstronomyTimelineKind;
    label: string;
    body: CelestialBody;
    time: Date | null;
}

export interface AstronomyTimeline {
    dayStart: Date;
    dayEnd: Date;
    items: AstronomyTimelineItem[];
}

const SAMPLE_KINDS: SolarSampleKind[] = ['before', 'event', 'after'];
const DAY_MS = 24 * 60 * 60 * 1000;

const isFiniteNumber = (value: number): boolean => Number.isFinite(value);

const parseDateInput = (dateInput: string): [number, number, number] => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput);
    if (!match) {
        throw new RangeError(`Invalid calendar date: ${dateInput}`);
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day, 12));

    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        throw new RangeError(`Invalid calendar date: ${dateInput}`);
    }

    return [year, month, day];
};

const formatDateInput = (date: Date): string =>
    `${date.getUTCFullYear().toString().padStart(4, '0')}-${(date.getUTCMonth() + 1)
        .toString()
        .padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')}`;

const getDateTimePart = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find(({ type: partType }) => partType === type);
    return part ? Number(part.value) : Number.NaN;
};

const getTimeZoneOffsetMinutes = (instant: Date, timeZone: string): number => {
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour12: false,
            hourCycle: 'h23',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }).formatToParts(instant);

        const year = getDateTimePart(parts, 'year');
        const month = getDateTimePart(parts, 'month');
        const day = getDateTimePart(parts, 'day');
        const hour = getDateTimePart(parts, 'hour');
        const minute = getDateTimePart(parts, 'minute');
        const second = getDateTimePart(parts, 'second');
        const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);

        return (localAsUtc - instant.getTime()) / 60_000;
    } catch {
        return 0;
    }
};

const dateInputToUtcHour = (dateInput: string, timeZone: string, hour: number): Date => {
    const [year, month, day] = parseDateInput(dateInput);
    const naiveUtc = new Date(Date.UTC(year, month - 1, day, hour));

    if (!timeZone || timeZone === 'UTC') {
        return naiveUtc;
    }

    const offsetMinutes = getTimeZoneOffsetMinutes(naiveUtc, timeZone);
    return new Date(naiveUtc.getTime() - offsetMinutes * 60_000);
};

/** Convert a date input value into a stable local-noon instant for a time zone. */
export const dateInputToUtcNoon = (dateInput: string, timeZone = 'UTC'): Date =>
    dateInputToUtcHour(dateInput, timeZone, 12);

/** Convert a date input value into the observer's local midnight instant. */
export const dateInputToUtcMidnight = (dateInput: string, timeZone = 'UTC'): Date =>
    dateInputToUtcHour(dateInput, timeZone, 0);

export const addDaysToDateInput = (dateInput: string, days: number): string => {
    const [year, month, day] = parseDateInput(dateInput);
    return formatDateInput(new Date(Date.UTC(year, month - 1, day + days)));
};

/** Format a Date using the observer's local time zone. */
export const formatLocalDateTime = (date: Date, timeZone: string): string =>
    new Intl.DateTimeFormat(undefined, {
        timeZone,
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);

/** Format a Date as a compact local clock value. */
export const formatLocalClock = (date: Date, timeZone: string): string =>
    new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).format(date);

/** Format a Date as yyyy-mm-dd for a date input in the supplied time zone. */
export const dateInputForInstant = (date: Date, timeZone: string): string => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const year = getDateTimePart(parts, 'year');
    const month = getDateTimePart(parts, 'month');
    const day = getDateTimePart(parts, 'day');

    return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
        .toString()
        .padStart(2, '0')}`;
};

export const normalizeAzimuth = (azimuth: number): number => {
    const normalized = azimuth % 360;
    return normalized < 0 ? normalized + 360 : normalized;
};

export const compassDirection = (azimuth: number): string => {
    const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    return directions[Math.round(normalizeAzimuth(azimuth) / 45) % directions.length];
};

export const moonPhaseName = (phase: number): string => {
    const names = ['新月', '娥眉月', '上弦月', '盈凸月', '满月', '亏凸月', '下弦月', '残月'];
    return names[Math.round(((phase % 1) + 1) % 1 * 8) % names.length];
};

const normalizeLongitude = (longitude: number): number => {
    const normalized = ((longitude + 540) % 360) - 180;
    return normalized === -180 ? 180 : normalized;
};

export const destinationPoint = (
    origin: Coordinates,
    bearingDegrees: number,
    distance: number,
): Coordinates => {
    if (
        !isFiniteNumber(origin.lat) ||
        !isFiniteNumber(origin.lon) ||
        Math.abs(origin.lat) > 90 ||
        Math.abs(origin.lon) > 180
    ) {
        throw new RangeError('Origin coordinates are invalid');
    }
    if (!isFiniteNumber(bearingDegrees) || !isFiniteNumber(distance) || distance < 0) {
        throw new RangeError('Bearing or distance is invalid');
    }

    const angularDistance = distance / EARTH_RADIUS_KM;
    const bearing = (normalizeAzimuth(bearingDegrees) * Math.PI) / 180;
    const latitude = (origin.lat * Math.PI) / 180;
    const longitude = (origin.lon * Math.PI) / 180;

    const destinationLatitude = Math.asin(
        Math.sin(latitude) * Math.cos(angularDistance) +
            Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const destinationLongitude =
        longitude +
        Math.atan2(
            Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
            Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(destinationLatitude),
        );

    return {
        lat: (destinationLatitude * 180) / Math.PI,
        lon: normalizeLongitude((destinationLongitude * 180) / Math.PI),
    };
};

export const distanceKm = (first: Coordinates, second: Coordinates): number => {
    const latitudeDelta = ((second.lat - first.lat) * Math.PI) / 180;
    const longitudeDelta = ((second.lon - first.lon) * Math.PI) / 180;
    const firstLatitude = (first.lat * Math.PI) / 180;
    const secondLatitude = (second.lat * Math.PI) / 180;
    const haversine =
        Math.sin(latitudeDelta / 2) ** 2 +
        Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;

    return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

/** Split short geographic lines at the international date line for map rendering. */
export const splitPolylineAtDateLine = (points: Coordinates[]): Coordinates[][] => {
    if (points.length < 2) {
        return points.length === 0 ? [] : [points];
    }

    const segments: Coordinates[][] = [[points[0]]];

    for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1];
        const next = points[index];
        let nextLongitude = next.lon;

        while (nextLongitude - previous.lon > 180) {
            nextLongitude -= 360;
        }
        while (nextLongitude - previous.lon < -180) {
            nextLongitude += 360;
        }

        const currentSegment = segments[segments.length - 1];
        const crossedDateLine = nextLongitude !== next.lon;
        if (crossedDateLine && (nextLongitude >= 180 || nextLongitude <= -180)) {
            const boundaryLongitude = nextLongitude >= 180 ? 180 : -180;
            if (nextLongitude === previous.lon) {
                currentSegment.push({ lat: next.lat, lon: previous.lon });
                continue;
            }

            const ratio = (boundaryLongitude - previous.lon) / (nextLongitude - previous.lon);
            const boundaryLatitude = previous.lat + ratio * (next.lat - previous.lat);
            const oppositeLongitude = boundaryLongitude === 180 ? -180 : 180;

            currentSegment.push({ lat: boundaryLatitude, lon: boundaryLongitude });
            if (nextLongitude !== boundaryLongitude) {
                segments.push([
                    { lat: boundaryLatitude, lon: oppositeLongitude },
                    { lat: next.lat, lon: next.lon },
                ]);
            }
        } else {
            currentSegment.push(next);
        }
    }

    return segments;
};

const eventName = (event: SolarEvent): string => {
    switch (event) {
        case 'sunrise':
            return '日出';
        case 'sunset':
            return '日落';
        case 'moonrise':
            return '月升';
        case 'moonset':
            return '月落';
    }
};

const sampleLabel = (event: SolarEvent, kind: SolarSampleKind): string => {
    const name = eventName(event);
    if (kind === 'before') {
        return `${name}前 30 分钟`;
    }
    if (kind === 'after') {
        return `${name}后 30 分钟`;
    }
    return name;
};

interface LocalMoonTimes {
    rise?: Date;
    set?: Date;
    alwaysUp?: boolean;
    alwaysDown?: boolean;
}

const isValidDate = (value: Date | null | undefined): value is Date =>
    value instanceof Date && !Number.isNaN(value.getTime());

const getMoonTimesForLocalDate = (
    dateInput: string,
    timeZone: string,
    location: Coordinates,
): LocalMoonTimes => {
    const dayStart = dateInputToUtcMidnight(dateInput, timeZone);
    const dayEnd = dateInputToUtcMidnight(addDaysToDateInput(dateInput, 1), timeZone);
    const candidates: Date[] = [];

    // SunCalc scans UTC calendar days. Scan the UTC days touching the local civil day,
    // then retain only events inside the observer's actual local-day interval.
    for (const dayOffset of [-1, 0, 1]) {
        const scanDate = new Date(dayStart.getTime() + dayOffset * DAY_MS);
        const times = SunCalc.getMoonTimes(scanDate, location.lat, location.lon);
        if (isValidDate(times.rise)) {
            candidates.push(times.rise);
        }
        if (isValidDate(times.set)) {
            candidates.push(times.set);
        }
    }

    const localCandidates = candidates
        .filter(candidate => candidate.getTime() >= dayStart.getTime() && candidate.getTime() < dayEnd.getTime())
        .sort((first, second) => first.getTime() - second.getTime());
    const rise = localCandidates.find(candidate => {
        const times = SunCalc.getMoonTimes(candidate, location.lat, location.lon);
        return isValidDate(times.rise) && Math.abs(times.rise.getTime() - candidate.getTime()) < 60_000;
    });
    const set = localCandidates.find(candidate => {
        const times = SunCalc.getMoonTimes(candidate, location.lat, location.lon);
        return isValidDate(times.set) && Math.abs(times.set.getTime() - candidate.getTime()) < 60_000;
    });

    if (rise || set) {
        return { rise, set };
    }

    const midpoint = new Date(dayStart.getTime() + (dayEnd.getTime() - dayStart.getTime()) / 2);
    const altitude = SunCalc.getMoonPosition(midpoint, location.lat, location.lon).altitude;
    return altitude > 0 ? { alwaysUp: true } : { alwaysDown: true };
};

const eventUnavailable = (
    event: SolarEvent,
    times: { alwaysUp?: boolean; alwaysDown?: boolean },
): SolarPathUnavailable => ({
    status: 'unavailable',
    event,
    reason: times.alwaysUp ? 'always-up' : times.alwaysDown ? 'always-down' : 'not-available',
});

export const calculateCurrentCelestialDirection = ({
    date,
    location,
    body,
}: {
    date: Date;
    location: Coordinates;
    body: CelestialBody;
}): CurrentCelestialDirection => {
    const position = body === 'moon'
        ? SunCalc.getMoonPosition(date, location.lat, location.lon)
        : SunCalc.getPosition(date, location.lat, location.lon);
    if (!Number.isFinite(position.azimuth) || !Number.isFinite(position.altitude)) {
        throw new RangeError(`${body === 'moon' ? 'Lunar' : 'Solar'} position is invalid`);
    }

    const azimuth = normalizeAzimuth(position.azimuth);
    return {
        body,
        azimuth,
        altitude: position.altitude,
        endpoint: destinationPoint(location, azimuth, CURRENT_DIRECTION_LENGTH_KM),
    };
};

export const calculateCurrentSolarDirection = ({
    date,
    location,
}: {
    date: Date;
    location: Coordinates;
}): SolarDirection => calculateCurrentCelestialDirection({ date, location, body: 'sun' }) as SolarDirection;

export const calculateCurrentMoonInfo = ({
    date,
    location,
}: {
    date: Date;
    location: Coordinates;
}): CurrentMoonInfo => {
    const position = SunCalc.getMoonPosition(date, location.lat, location.lon);
    const illumination = SunCalc.getMoonIllumination(date);
    if (
        !Number.isFinite(position.azimuth) ||
        !Number.isFinite(position.altitude) ||
        !Number.isFinite(position.distance) ||
        !Number.isFinite(illumination.fraction) ||
        !Number.isFinite(illumination.phase)
    ) {
        throw new RangeError('Lunar position is invalid');
    }

    const direction = calculateCurrentCelestialDirection({ date, location, body: 'moon' });
    return {
        ...direction,
        body: 'moon',
        distanceKm: position.distance,
        illuminationFraction: illumination.fraction,
        phase: illumination.phase,
        waxing: illumination.waxing,
    };
};

export const calculateSolarPath = ({
    date,
    dateInput,
    timeZone = 'UTC',
    location,
    event,
    elevationM = 0,
}: {
    date: Date;
    dateInput?: string;
    timeZone?: string;
    location: Coordinates;
    event: SolarEvent;
    elevationM?: number;
}): SolarPath => {
    let eventTime: Date | null | undefined;
    let availability: { alwaysUp?: boolean; alwaysDown?: boolean } = {};

    if (event === 'moonrise' || event === 'moonset') {
        const localDateInput = dateInput || dateInputForInstant(date, timeZone);
        const moonTimes = getMoonTimesForLocalDate(localDateInput, timeZone, location);
        eventTime = event === 'moonrise' ? moonTimes.rise : moonTimes.set;
        availability = moonTimes;
    } else {
        const times = SunCalc.getTimes(date, location.lat, location.lon, elevationM);
        eventTime = event === 'sunrise' ? times.sunrise : times.sunset;
        availability = times;
    }

    if (!isValidDate(eventTime)) {
        return eventUnavailable(event, availability);
    }

    const samples = SAMPLE_OFFSETS_MINUTES.map((offsetMinutes, index) => {
        const kind = SAMPLE_KINDS[index];
        const time = new Date(eventTime.getTime() + offsetMinutes * 60_000);
        const position = event === 'moonrise' || event === 'moonset'
            ? SunCalc.getMoonPosition(time, location.lat, location.lon)
            : SunCalc.getPosition(time, location.lat, location.lon);
        const azimuth = normalizeAzimuth(position.azimuth);

        return {
            kind,
            label: sampleLabel(event, kind),
            offsetMinutes,
            time,
            azimuth,
            point200: destinationPoint(location, azimuth, LINE_LENGTHS_KM.inner),
            point400: destinationPoint(location, azimuth, LINE_LENGTHS_KM.outer),
        };
    });

    return {
        status: 'ok',
        event,
        eventTime,
        samples,
    };
};

const timelineItem = (
    kind: AstronomyTimelineKind,
    label: string,
    body: CelestialBody,
    time: Date | null | undefined,
): AstronomyTimelineItem => ({
    kind,
    label,
    body,
    time: isValidDate(time) ? time : null,
});

export const calculateAstronomyTimeline = ({
    dateInput,
    timeZone,
    location,
    elevationM = 0,
}: {
    dateInput: string;
    timeZone: string;
    location: Coordinates;
    elevationM?: number;
}): AstronomyTimeline => {
    const dayStart = dateInputToUtcMidnight(dateInput, timeZone);
    const dayEnd = dateInputToUtcMidnight(addDaysToDateInput(dateInput, 1), timeZone);
    const sunTimes = SunCalc.getTimes(dateInputToUtcNoon(dateInput, timeZone), location.lat, location.lon, elevationM);
    const moonTimes = getMoonTimesForLocalDate(dateInput, timeZone, location);

    return {
        dayStart,
        dayEnd,
        items: [
            timelineItem('dawn', '蓝调开始', 'sun', sunTimes.dawn),
            timelineItem('sunrise', '日出', 'sun', sunTimes.sunrise),
            timelineItem('moonrise', '月升', 'moon', moonTimes.rise),
            timelineItem('sunset', '日落', 'sun', sunTimes.sunset),
            timelineItem('dusk', '蓝调结束', 'sun', sunTimes.dusk),
            timelineItem('moonset', '月落', 'moon', moonTimes.set),
        ],
    };
};

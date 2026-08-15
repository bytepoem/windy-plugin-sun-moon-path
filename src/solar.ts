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

export type SolarEvent = 'sunrise' | 'sunset';
export type SolarSampleKind = 'before' | 'event' | 'after';

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
    azimuth: number;
    endpoint: Coordinates;
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

const SAMPLE_KINDS: SolarSampleKind[] = ['before', 'event', 'after'];

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

const getDateTimePart = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find(({ type: partType }) => partType === type);
    return part ? Number(part.value) : Number.NaN;
};

const getTimeZoneOffsetMinutes = (instant: Date, timeZone: string): number => {
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour12: false,
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
        const normalizedHour = hour === 24 ? 0 : hour;
        const localAsUtc = Date.UTC(year, month - 1, day, normalizedHour, minute, second);

        return (localAsUtc - instant.getTime()) / 60_000;
    } catch {
        return 0;
    }
};

/** Convert a date input value into a stable local-noon instant for a time zone. */
export const dateInputToUtcNoon = (dateInput: string, timeZone = 'UTC'): Date => {
    const [year, month, day] = parseDateInput(dateInput);
    const naiveUtcNoon = new Date(Date.UTC(year, month - 1, day, 12));

    if (!timeZone || timeZone === 'UTC') {
        return naiveUtcNoon;
    }

    const offsetMinutes = getTimeZoneOffsetMinutes(naiveUtcNoon, timeZone);
    return new Date(naiveUtcNoon.getTime() - offsetMinutes * 60_000);
};

/** Format a Date using the observer's local time zone. */
export const formatLocalDateTime = (date: Date, timeZone: string): string =>
    new Intl.DateTimeFormat(undefined, {
        timeZone,
        dateStyle: 'medium',
        timeStyle: 'short',
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

const sampleLabel = (event: SolarEvent, kind: SolarSampleKind): string => {
    const eventName = event === 'sunrise' ? '日出' : '日落';
    if (kind === 'before') {
        return `${eventName}前 30 分钟`;
    }
    if (kind === 'after') {
        return `${eventName}后 30 分钟`;
    }
    return eventName;
};

export const calculateCurrentSolarDirection = ({
    date,
    location,
}: {
    date: Date;
    location: Coordinates;
}): SolarDirection => {
    const position = SunCalc.getPosition(date, location.lat, location.lon);
    if (!Number.isFinite(position.azimuth)) {
        throw new RangeError('Solar azimuth is invalid');
    }

    const azimuth = normalizeAzimuth(position.azimuth);
    return {
        azimuth,
        endpoint: destinationPoint(location, azimuth, CURRENT_DIRECTION_LENGTH_KM),
    };
};

export const calculateSolarPath = ({
    date,
    location,
    event,
    elevationM = 0,
}: {
    date: Date;
    location: Coordinates;
    event: SolarEvent;
    elevationM?: number;
}): SolarPath => {
    const times = SunCalc.getTimes(date, location.lat, location.lon, elevationM);
    const eventTime = times[event];

    if (!(eventTime instanceof Date) || Number.isNaN(eventTime.getTime())) {
        return {
            status: 'unavailable',
            event,
            reason: times.alwaysUp ? 'always-up' : times.alwaysDown ? 'always-down' : 'not-available',
        };
    }

    const samples = SAMPLE_OFFSETS_MINUTES.map((offsetMinutes, index) => {
        const kind = SAMPLE_KINDS[index];
        const time = new Date(eventTime.getTime() + offsetMinutes * 60_000);
        const azimuth = normalizeAzimuth(SunCalc.getPosition(time, location.lat, location.lon).azimuth);

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

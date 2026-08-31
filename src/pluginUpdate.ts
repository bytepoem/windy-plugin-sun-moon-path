export type UpdateNoteKind = 'new' | 'improved' | 'fixed';

export interface UserFacingUpdateNote {
    type: UpdateNoteKind;
    text: string;
}

export interface LocalizedUpdateNotes {
    title: string;
    summary: string;
    items: UserFacingUpdateNote[];
}

export interface UserFacingReleaseNotes {
    version: string;
    releasedAt: string;
    zh: LocalizedUpdateNotes;
    en: LocalizedUpdateNotes;
}

export type PluginUpdateNotesStatus = 'loaded' | 'missing' | 'error';

export type PluginUpdateResult =
    | {
        status: 'current';
        channel: 'formal' | 'beta';
        latestVersion: string;
        releasedAt: string | null;
        releaseUrl: string | null;
    }
    | {
        status: 'available';
        channel: 'formal' | 'beta';
        latestVersion: string;
        releasedAt: string | null;
        releaseUrl: string | null;
        notes: UserFacingReleaseNotes | null;
        notesStatus: PluginUpdateNotesStatus;
    };

interface GithubPackageManifest {
    name: string;
    version: string;
}

interface ParsedSemanticVersion {
    raw: string;
    core: [number, number, number];
    prerelease: string[];
}

export interface SessionCache {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
}

interface PluginUpdateReminderOptions {
    currentVersion: string;
    repositoryUrl: string;
    sessionCache?: SessionCache | null;
}

interface WritePluginUpdateReminderOptions extends PluginUpdateReminderOptions {
    latestVersion: string;
}

interface CheckPluginUpdateOptions {
    currentVersion: string;
    repositoryUrl: string;
    signal?: AbortSignal;
    fetchImpl?: typeof fetch;
    sessionCache?: SessionCache | null;
    betaNotesUrl?: string | null;
}

const SEMANTIC_VERSION_PATTERN = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const RELEASE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UPDATE_NOTE_KINDS = new Set<UpdateNoteKind>(['new', 'improved', 'fixed']);

const parseSafeNumericIdentifier = (identifier: string, version: string): number => {
    const value = Number(identifier);
    if (!Number.isSafeInteger(value)) {
        throw new Error(`Invalid semantic version: ${version}`);
    }
    return value;
};

const parseSemanticVersion = (version: string): ParsedSemanticVersion => {
    const match = SEMANTIC_VERSION_PATTERN.exec(version.trim());
    if (!match) {
        throw new Error(`Invalid semantic version: ${version}`);
    }
    const prerelease = match[4]?.split('.') || [];
    for (const identifier of prerelease) {
        if (/^\d+$/.test(identifier)) {
            if ((identifier.length > 1 && identifier.startsWith('0')) || !Number.isSafeInteger(Number(identifier))) {
                throw new Error(`Invalid semantic version: ${version}`);
            }
        }
    }
    return {
        raw: `${match[1]}.${match[2]}.${match[3]}${match[4] ? `-${match[4]}` : ''}`,
        core: [
            parseSafeNumericIdentifier(match[1], version),
            parseSafeNumericIdentifier(match[2], version),
            parseSafeNumericIdentifier(match[3], version),
        ],
        prerelease,
    };
};

const comparePrereleaseIdentifiers = (left: string, right: string): number => {
    const leftNumber = /^\d+$/.test(left) ? Number(left) : null;
    const rightNumber = /^\d+$/.test(right) ? Number(right) : null;
    if (leftNumber !== null && rightNumber !== null) {
        return Math.sign(leftNumber - rightNumber);
    }
    if (leftNumber !== null) {
        return -1;
    }
    if (rightNumber !== null) {
        return 1;
    }
    return left < right ? -1 : left > right ? 1 : 0;
};

/** Compare two SemVer strings without treating version numbers as plain text. */
export const compareSemanticVersions = (leftVersion: string, rightVersion: string): number => {
    const left = parseSemanticVersion(leftVersion);
    const right = parseSemanticVersion(rightVersion);
    for (let index = 0; index < left.core.length; index += 1) {
        const difference = left.core[index] - right.core[index];
        if (difference !== 0) {
            return Math.sign(difference);
        }
    }
    if (left.prerelease.length === 0 || right.prerelease.length === 0) {
        return left.prerelease.length === right.prerelease.length
            ? 0
            : left.prerelease.length === 0 ? 1 : -1;
    }
    const identifierCount = Math.max(left.prerelease.length, right.prerelease.length);
    for (let index = 0; index < identifierCount; index += 1) {
        const leftIdentifier = left.prerelease[index];
        const rightIdentifier = right.prerelease[index];
        if (leftIdentifier === undefined || rightIdentifier === undefined) {
            return leftIdentifier === rightIdentifier ? 0 : leftIdentifier === undefined ? -1 : 1;
        }
        const difference = comparePrereleaseIdentifiers(leftIdentifier, rightIdentifier);
        if (difference !== 0) {
            return difference;
        }
    }
    return 0;
};

const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;

/** Accept only real ISO calendar dates so remote metadata cannot display normalized invalid dates. */
const isReleaseDate = (value: unknown): value is string => {
    if (typeof value !== 'string' || !RELEASE_DATE_PATTERN.test(value)) {
        return false;
    }
    try {
        return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
    } catch {
        return false;
    }
};

const isLocalizedUpdateNotes = (value: unknown): value is LocalizedUpdateNotes => {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const candidate = value as Partial<LocalizedUpdateNotes>;
    return isNonEmptyString(candidate.title)
        && isNonEmptyString(candidate.summary)
        && Array.isArray(candidate.items)
        && candidate.items.length > 0
        && candidate.items.every(item => Boolean(
            item
            && typeof item === 'object'
            && UPDATE_NOTE_KINDS.has((item as UserFacingUpdateNote).type)
            && isNonEmptyString((item as UserFacingUpdateNote).text),
        ));
};

const parseUserFacingReleaseNotes = (
    value: unknown,
    expectedVersion: string,
): UserFacingReleaseNotes | null => {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const candidate = value as Partial<UserFacingReleaseNotes>;
    try {
        if (
            !isNonEmptyString(candidate.version)
            || compareSemanticVersions(candidate.version, expectedVersion) !== 0
            || !isReleaseDate(candidate.releasedAt)
            || !isLocalizedUpdateNotes(candidate.zh)
            || !isLocalizedUpdateNotes(candidate.en)
        ) {
            return null;
        }
    } catch {
        return null;
    }
    return candidate as UserFacingReleaseNotes;
};

const parseBetaReleaseNotes = (value: unknown): { version: string; notes: UserFacingReleaseNotes } | null => {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const candidate = value as Partial<UserFacingReleaseNotes>;
    if (!isNonEmptyString(candidate.version)) {
        return null;
    }
    try {
        const version = parseSemanticVersion(candidate.version).raw;
        const notes = parseUserFacingReleaseNotes(candidate, version);
        return notes ? { version, notes } : null;
    } catch {
        return null;
    }
};

const parseGithubRepository = (repositoryUrl: string): { owner: string; repository: string } => {
    const url = new URL(repositoryUrl);
    const [owner, repositorySegment] = url.pathname.split('/').filter(Boolean);
    const repository = repositorySegment?.replace(/\.git$/, '');
    if (url.hostname !== 'github.com' || !owner || !repository) {
        throw new Error(`Unsupported GitHub repository URL: ${repositoryUrl}`);
    }
    return { owner, repository };
};

const buildGithubReleaseUrl = (
    owner: string,
    repository: string,
    version: string,
): string => `https://github.com/${owner}/${repository}/releases/tag/${version}`;

const isGithubPackageManifest = (
    value: unknown,
    repository: string,
): value is GithubPackageManifest => {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const candidate = value as Partial<GithubPackageManifest>;
    return candidate.name === repository && isNonEmptyString(candidate.version);
};

const resolveSessionCache = (): SessionCache | null => {
    try {
        return globalThis.sessionStorage || null;
    } catch {
        return null;
    }
};

const buildPluginUpdateReminderKey = (
    owner: string,
    repository: string,
    currentVersion: string,
): string => `github:${owner}/${repository}:update-reminder-seen:v1:${currentVersion}`;

/** Read the version acknowledged in this browser session without risking plugin startup. */
export const readPluginUpdateReminderSeenVersion = ({
    currentVersion,
    repositoryUrl,
    sessionCache = resolveSessionCache(),
}: PluginUpdateReminderOptions): string | null => {
    if (!sessionCache) {
        return null;
    }
    try {
        const { owner, repository } = parseGithubRepository(repositoryUrl);
        const normalizedCurrentVersion = parseSemanticVersion(currentVersion).raw;
        const value = sessionCache.getItem(buildPluginUpdateReminderKey(
            owner,
            repository,
            normalizedCurrentVersion,
        ));
        return value ? parseSemanticVersion(value).raw : null;
    } catch {
        return null;
    }
};

/** Persist the acknowledged update for remounts during the current browser session. */
export const writePluginUpdateReminderSeenVersion = ({
    currentVersion,
    latestVersion,
    repositoryUrl,
    sessionCache = resolveSessionCache(),
}: WritePluginUpdateReminderOptions): void => {
    if (!sessionCache) {
        return;
    }
    try {
        const { owner, repository } = parseGithubRepository(repositoryUrl);
        const normalizedCurrentVersion = parseSemanticVersion(currentVersion).raw;
        const normalizedLatestVersion = parseSemanticVersion(latestVersion).raw;
        sessionCache.setItem(
            buildPluginUpdateReminderKey(owner, repository, normalizedCurrentVersion),
            normalizedLatestVersion,
        );
    } catch {
        // Reminder persistence is optional and must never affect plugin startup.
    }
};

const parseCachedResult = (
    value: unknown,
    currentVersion: string,
    owner: string,
    repository: string,
): PluginUpdateResult | null => {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const candidate = value as Partial<PluginUpdateResult>;
    if (
        candidate.channel !== 'formal'
        ||
        !isNonEmptyString(candidate.latestVersion)
        || !isNonEmptyString(candidate.releaseUrl)
    ) {
        return null;
    }
    try {
        const versionDifference = compareSemanticVersions(candidate.latestVersion, currentVersion);
        const releaseUrl = buildGithubReleaseUrl(owner, repository, candidate.latestVersion);
        if (candidate.releaseUrl !== releaseUrl) {
            return null;
        }
        if (candidate.status === 'current' && versionDifference <= 0) {
            const releasedAt = candidate.releasedAt === null
                ? null
                : isReleaseDate(candidate.releasedAt) ? candidate.releasedAt : null;
            if (candidate.releasedAt !== null && releasedAt === null) {
                return null;
            }
            return {
                status: 'current',
                channel: 'formal',
                latestVersion: candidate.latestVersion,
                releasedAt,
                releaseUrl,
            };
        }
        if (candidate.status === 'available' && versionDifference > 0) {
            const availableCandidate = candidate as Partial<Extract<PluginUpdateResult, { status: 'available' }>>;
            if (availableCandidate.notesStatus !== 'loaded' && availableCandidate.notesStatus !== 'missing') {
                return null;
            }
            const notes = availableCandidate.notesStatus === 'loaded'
                ? parseUserFacingReleaseNotes(availableCandidate.notes, candidate.latestVersion)
                : null;
            if (
                (availableCandidate.notesStatus === 'loaded' && !notes)
                || (availableCandidate.notesStatus === 'missing' && availableCandidate.notes !== null)
            ) {
                return null;
            }
            const releasedAt = notes?.releasedAt ?? null;
            if ((availableCandidate.releasedAt ?? null) !== releasedAt) {
                return null;
            }
            return {
                status: 'available',
                channel: 'formal',
                latestVersion: candidate.latestVersion,
                releasedAt,
                releaseUrl,
                notes,
                notesStatus: availableCandidate.notesStatus,
            };
        }
    } catch {
        return null;
    }
    return null;
};

const readCachedResult = (
    cache: SessionCache | null,
    key: string,
    currentVersion: string,
    owner: string,
    repository: string,
): PluginUpdateResult | null => {
    if (!cache) {
        return null;
    }
    try {
        const value = cache.getItem(key);
        if (!value) {
            return null;
        }
        return parseCachedResult(JSON.parse(value), currentVersion, owner, repository);
    } catch {
        return null;
    }
};

const writeCachedResult = (cache: SessionCache | null, key: string, result: PluginUpdateResult) => {
    if (!cache) {
        return;
    }
    try {
        cache.setItem(key, JSON.stringify(result));
    } catch {
        // Version checking must continue even when browser storage is unavailable.
    }
};

/**
 * Preview the local beta notes when configured; otherwise read the version already
 * merged to the repository's main branch and load notes pinned to its matching tag.
 * GitHub Raw avoids the shared anonymous REST API rate limit without exposing a token.
 */
export const checkPluginUpdate = async ({
    currentVersion,
    repositoryUrl,
    signal,
    fetchImpl = fetch,
    sessionCache = resolveSessionCache(),
    betaNotesUrl = null,
}: CheckPluginUpdateOptions): Promise<PluginUpdateResult> => {
    const normalizedCurrentVersion = parseSemanticVersion(currentVersion).raw;
    if (betaNotesUrl) {
        const betaResponse = await fetchImpl(betaNotesUrl, { signal, cache: 'no-store' });
        if (!betaResponse.ok) {
            throw new Error(`Beta release notes request failed with ${betaResponse.status}`);
        }
        const betaValue = parseBetaReleaseNotes(await betaResponse.json());
        if (!betaValue) {
            throw new Error('Beta release notes are invalid');
        }
        return {
            status: 'available',
            channel: 'beta',
            latestVersion: betaValue.version,
            releasedAt: betaValue.notes.releasedAt,
            releaseUrl: null,
            notes: betaValue.notes,
            notesStatus: 'loaded',
        };
    }

    const { owner, repository } = parseGithubRepository(repositoryUrl);
    const cacheKey = `github:${owner}/${repository}:update-check:v5:${normalizedCurrentVersion}`;
    const cachedResult = readCachedResult(
        sessionCache,
        cacheKey,
        normalizedCurrentVersion,
        owner,
        repository,
    );
    if (cachedResult) {
        return cachedResult;
    }

    const manifestResponse = await fetchImpl(
        `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/main/package.json`,
        { signal },
    );
    if (!manifestResponse.ok) {
        throw new Error(`GitHub version file request failed with ${manifestResponse.status}`);
    }
    const manifestValue: unknown = await manifestResponse.json();
    if (!isGithubPackageManifest(manifestValue, repository)) {
        throw new Error('GitHub version file is invalid');
    }

    const latestVersion = parseSemanticVersion(manifestValue.version).raw;
    const releaseUrl = buildGithubReleaseUrl(owner, repository, latestVersion);
    let notes: UserFacingReleaseNotes | null = null;
    let notesStatus: PluginUpdateNotesStatus = 'missing';
    const notesUrl = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/${encodeURIComponent(latestVersion)}/release-notes/${encodeURIComponent(latestVersion)}.json`;
    try {
        const notesResponse = await fetchImpl(notesUrl, { signal });
        if (notesResponse.ok) {
            notes = parseUserFacingReleaseNotes(await notesResponse.json(), latestVersion);
            notesStatus = notes ? 'loaded' : 'error';
        } else if (notesResponse.status !== 404) {
            notesStatus = 'error';
        }
    } catch (error) {
        if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
            throw error;
        }
        notesStatus = 'error';
    }

    if (compareSemanticVersions(latestVersion, normalizedCurrentVersion) <= 0) {
        const currentResult: PluginUpdateResult = {
            status: 'current',
            channel: 'formal',
            latestVersion,
            releasedAt: notes?.releasedAt ?? null,
            releaseUrl,
        };
        if (notesStatus !== 'error') {
            writeCachedResult(sessionCache, cacheKey, currentResult);
        }
        return currentResult;
    }

    const availableResult: PluginUpdateResult = {
        status: 'available',
        channel: 'formal',
        latestVersion,
        releasedAt: notes?.releasedAt ?? null,
        releaseUrl,
        notes,
        notesStatus,
    };
    if (notesStatus !== 'error') {
        writeCachedResult(sessionCache, cacheKey, availableResult);
    }
    return availableResult;
};

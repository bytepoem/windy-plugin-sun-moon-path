import { describe, expect, it, vi } from 'vitest';

import {
    checkPluginUpdate,
    compareSemanticVersions,
    readPluginUpdateReminderSeenVersion,
    selectPluginLinkVersion,
    writePluginUpdateReminderSeenVersion,
} from './pluginUpdate';

const repositoryUrl = 'https://github.com/bytepoem/windy-plugin-sun-moon-path';
const jsonResponse = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
});

const latestPackage = (version: string) => ({
    name: 'windy-plugin-sun-moon-path',
    version,
});

const userNotes = {
    version: '0.9.0',
    releasedAt: '2026-08-31',
    zh: {
        title: '更清晰的地图信息',
        summary: '本次更新改善地图和天气信息的查看体验。',
        items: [{ type: 'new', text: '新增降水雷达显示。' }],
    },
    en: {
        title: 'Clearer map information',
        summary: 'This update improves map and weather readability.',
        items: [{ type: 'new', text: 'Added precipitation radar.' }],
    },
};

const currentUserNotes = {
    ...userNotes,
    version: '0.8.1',
    releasedAt: '2026-08-29',
};

const patchUserNotes = {
    ...userNotes,
    version: '0.9.1',
    releasedAt: '2026-08-31',
    zh: {
        ...userNotes.zh,
        title: '更稳定的雷达状态',
    },
    en: {
        ...userNotes.en,
        title: 'More reliable radar status',
    },
};

describe('compareSemanticVersions', () => {
    it('compares numeric segments instead of plain text', () => {
        expect(compareSemanticVersions('0.10.0', '0.9.0')).toBeGreaterThan(0);
        expect(compareSemanticVersions('v1.2.3', '1.2.3')).toBe(0);
    });

    it('orders prereleases before their formal version', () => {
        expect(compareSemanticVersions('0.9.0-beta.2', '0.9.0-beta.10')).toBeLessThan(0);
        expect(compareSemanticVersions('0.9.0-beta.10', '0.9.0')).toBeLessThan(0);
        expect(compareSemanticVersions('0.9.0-Beta', '0.9.0-beta')).toBeLessThan(0);
    });

    it('rejects SemVer values with leading zeroes, empty identifiers, or unsafe integers', () => {
        expect(() => compareSemanticVersions('01.2.3', '1.2.3')).toThrow('Invalid semantic version');
        expect(() => compareSemanticVersions('1.2.3-alpha..1', '1.2.3')).toThrow('Invalid semantic version');
        expect(() => compareSemanticVersions('1.2.3-alpha.01', '1.2.3')).toThrow('Invalid semantic version');
        expect(() => compareSemanticVersions('9007199254740992.0.0', '1.0.0')).toThrow('Invalid semantic version');
    });
});

describe('selectPluginLinkVersion', () => {
    it('uses the installed version when current and the remote version only for an available update', () => {
        expect(selectPluginLinkVersion('0.9.1', {
            status: 'current',
            latestVersion: '0.9.0',
        })).toBe('0.9.1');
        expect(selectPluginLinkVersion('0.9.1', {
            status: 'available',
            latestVersion: '0.9.2',
        })).toBe('0.9.2');
    });
});

describe('plugin update reminder acknowledgement', () => {
    it('persists the viewed version across component remounts within the browser session', () => {
        const values = new Map<string, string>();
        const sessionCache = {
            getItem: (key: string) => values.get(key) || null,
            setItem: (key: string, value: string) => values.set(key, value),
        };

        expect(readPluginUpdateReminderSeenVersion({
            currentVersion: '0.8.1',
            repositoryUrl,
            sessionCache,
        })).toBeNull();

        writePluginUpdateReminderSeenVersion({
            currentVersion: '0.8.1',
            latestVersion: '0.9.0',
            repositoryUrl,
            sessionCache,
        });

        expect(readPluginUpdateReminderSeenVersion({
            currentVersion: '0.8.1',
            repositoryUrl,
            sessionCache,
        })).toBe('0.9.0');
        expect([...values.keys()]).toEqual([
            'github:bytepoem/windy-plugin-sun-moon-path:update-reminder-seen:v1:0.8.1',
        ]);
    });

    it('ignores malformed acknowledgement data', () => {
        const sessionCache = {
            getItem: () => 'not-a-version',
            setItem: vi.fn(),
        };

        expect(readPluginUpdateReminderSeenVersion({
            currentVersion: '0.8.1',
            repositoryUrl,
            sessionCache,
        })).toBeNull();
    });
});

describe('checkPluginUpdate', () => {
    it('uses an uncached local beta JSON before formal GitHub metadata', async () => {
        const sessionCache = { getItem: vi.fn(), setItem: vi.fn() };
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(userNotes));

        await expect(checkPluginUpdate({
            currentVersion: '0.8.1',
            repositoryUrl,
            betaNotesUrl: 'https://localhost:9999/release-notes/beta.json',
            fetchImpl,
            sessionCache,
        })).resolves.toEqual({
            status: 'available',
            channel: 'beta',
            latestVersion: '0.9.0',
            releasedAt: '2026-08-31',
            releaseUrl: null,
            notes: userNotes,
            seriesNotes: [userNotes],
            notesStatus: 'loaded',
        });
        expect(fetchImpl).toHaveBeenCalledWith(
            'https://localhost:9999/release-notes/beta.json',
            { signal: undefined, cache: 'no-store' },
        );
        expect(sessionCache.getItem).not.toHaveBeenCalled();
        expect(sessionCache.setItem).not.toHaveBeenCalled();
    });

    it('keeps beta notes visible after the local package version is bumped for release preparation', async () => {
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(userNotes));

        await expect(checkPluginUpdate({
            currentVersion: '0.9.0',
            repositoryUrl,
            betaNotesUrl: 'https://localhost:9999/release-notes/beta.json',
            fetchImpl,
            sessionCache: null,
        })).resolves.toMatchObject({
            status: 'available',
            channel: 'beta',
            latestVersion: '0.9.0',
            releasedAt: '2026-08-31',
            notes: userNotes,
            notesStatus: 'loaded',
        });
    });

    it('adds older formal notes from the same minor series behind the local beta notes', async () => {
        const fetchImpl = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(jsonResponse(patchUserNotes))
            .mockResolvedValueOnce(jsonResponse(userNotes));

        await expect(checkPluginUpdate({
            currentVersion: '0.9.1',
            repositoryUrl,
            betaNotesUrl: 'https://localhost:9999/release-notes/beta.json',
            fetchImpl,
            sessionCache: null,
        })).resolves.toMatchObject({
            status: 'available',
            channel: 'beta',
            latestVersion: '0.9.1',
            notes: patchUserNotes,
            seriesNotes: [patchUserNotes, userNotes],
            notesStatus: 'loaded',
        });
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('reads the latest version from the raw main package without using the rate-limited GitHub API', async () => {
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
            name: 'windy-plugin-sun-moon-path',
            version: '0.8.1',
        }));

        await expect(checkPluginUpdate({
            currentVersion: '0.8.1',
            repositoryUrl,
            fetchImpl,
            sessionCache: null,
        })).resolves.toMatchObject({ status: 'current', channel: 'formal', latestVersion: '0.8.1' });
        expect(fetchImpl).toHaveBeenCalledWith(
            'https://raw.githubusercontent.com/bytepoem/windy-plugin-sun-moon-path/main/package.json',
            { signal: undefined },
        );
    });

    it('loads the current version release notes when the installed version is already current', async () => {
        const fetchImpl = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(jsonResponse(latestPackage('0.8.1')))
            .mockResolvedValueOnce(jsonResponse(currentUserNotes))
            .mockResolvedValueOnce(jsonResponse({}, 404));

        await expect(checkPluginUpdate({
            currentVersion: '0.8.1',
            repositoryUrl,
            fetchImpl,
            sessionCache: null,
        })).resolves.toMatchObject({
            status: 'current',
            latestVersion: '0.8.1',
            releasedAt: '2026-08-29',
            notes: currentUserNotes,
            notesStatus: 'loaded',
        });
        expect(fetchImpl).toHaveBeenNthCalledWith(
            2,
            'https://raw.githubusercontent.com/bytepoem/windy-plugin-sun-moon-path/0.8.1/release-notes/0.8.1.json',
            { signal: undefined },
        );
    });

    it('does not show notes from an older formal version to a newer installed prerelease', async () => {
        const fetchImpl = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(jsonResponse(latestPackage('0.8.1')))
            .mockResolvedValueOnce(jsonResponse(currentUserNotes))
            .mockResolvedValueOnce(jsonResponse({}, 404));

        await expect(checkPluginUpdate({
            currentVersion: '0.9.0-beta.1',
            repositoryUrl,
            fetchImpl,
            sessionCache: null,
        })).resolves.toMatchObject({
            status: 'current',
            latestVersion: '0.8.1',
            releasedAt: null,
            notes: null,
            notesStatus: 'missing',
        });
    });

    it('rechecks when main catches up instead of caching an older formal version for a newer install', async () => {
        const values = new Map<string, string>();
        const sessionCache = {
            getItem: (key: string) => values.get(key) || null,
            setItem: (key: string, value: string) => values.set(key, value),
        };
        const fetchImpl = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(jsonResponse(latestPackage('0.8.1')))
            .mockResolvedValueOnce(jsonResponse(currentUserNotes))
            .mockResolvedValueOnce(jsonResponse({}, 404))
            .mockResolvedValueOnce(jsonResponse(latestPackage('0.9.0')))
            .mockResolvedValueOnce(jsonResponse(userNotes));

        const aheadResult = await checkPluginUpdate({
            currentVersion: '0.9.0',
            repositoryUrl,
            fetchImpl,
            sessionCache,
        });
        const caughtUpResult = await checkPluginUpdate({
            currentVersion: '0.9.0',
            repositoryUrl,
            fetchImpl,
            sessionCache,
        });

        expect(aheadResult).toMatchObject({
            status: 'current',
            latestVersion: '0.8.1',
            releaseUrl: null,
            notes: null,
            notesStatus: 'missing',
        });
        expect(caughtUpResult).toMatchObject({
            status: 'current',
            latestVersion: '0.9.0',
            releaseUrl: 'https://github.com/bytepoem/windy-plugin-sun-moon-path/releases/tag/0.9.0',
            notes: userNotes,
            notesStatus: 'loaded',
        });
        expect(fetchImpl).toHaveBeenCalledTimes(5);
        expect(values.size).toBe(1);
    });

    it('retries transient current-version notes failures instead of caching the missing log', async () => {
        const values = new Map<string, string>();
        const sessionCache = {
            getItem: (key: string) => values.get(key) || null,
            setItem: (key: string, value: string) => values.set(key, value),
        };
        const fetchImpl = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(jsonResponse(latestPackage('0.8.1')))
            .mockRejectedValueOnce(new TypeError('network unavailable'))
            .mockResolvedValueOnce(jsonResponse({}, 404))
            .mockResolvedValueOnce(jsonResponse(latestPackage('0.8.1')))
            .mockResolvedValueOnce(jsonResponse(currentUserNotes))
            .mockResolvedValueOnce(jsonResponse({}, 404));

        await expect(checkPluginUpdate({
            currentVersion: '0.8.1',
            repositoryUrl,
            fetchImpl,
            sessionCache,
        })).resolves.toMatchObject({
            status: 'current',
            notes: null,
            notesStatus: 'error',
        });
        expect(values.size).toBe(0);

        await expect(checkPluginUpdate({
            currentVersion: '0.8.1',
            repositoryUrl,
            fetchImpl,
            sessionCache,
        })).resolves.toMatchObject({
            status: 'current',
            notes: currentUserNotes,
            notesStatus: 'loaded',
        });
        expect(fetchImpl).toHaveBeenCalledTimes(6);
        expect(values.size).toBe(1);
    });

    it('loads user-facing notes from the matching release tag', async () => {
        const fetchImpl = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(jsonResponse(latestPackage('0.9.0')))
            .mockResolvedValueOnce(jsonResponse(userNotes));

        await expect(checkPluginUpdate({
            currentVersion: '0.8.1',
            repositoryUrl,
            fetchImpl,
            sessionCache: null,
        })).resolves.toEqual(expect.objectContaining({
            status: 'available',
            latestVersion: '0.9.0',
            releasedAt: '2026-08-31',
            releaseUrl: 'https://github.com/bytepoem/windy-plugin-sun-moon-path/releases/tag/0.9.0',
            notes: userNotes,
            notesStatus: 'loaded',
        }));
        expect(fetchImpl).toHaveBeenNthCalledWith(
            2,
            'https://raw.githubusercontent.com/bytepoem/windy-plugin-sun-moon-path/0.9.0/release-notes/0.9.0.json',
            { signal: undefined },
        );
    });

    it('loads every release note in the latest minor series from newest to oldest', async () => {
        const fetchImpl = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(jsonResponse(latestPackage('0.9.1')))
            .mockResolvedValueOnce(jsonResponse(patchUserNotes))
            .mockResolvedValueOnce(jsonResponse(userNotes));

        await expect(checkPluginUpdate({
            currentVersion: '0.9.1',
            repositoryUrl,
            fetchImpl,
            sessionCache: null,
        })).resolves.toMatchObject({
            status: 'current',
            latestVersion: '0.9.1',
            seriesNotes: [patchUserNotes, userNotes],
            notesStatus: 'loaded',
        });
        expect(fetchImpl).toHaveBeenNthCalledWith(
            3,
            'https://raw.githubusercontent.com/bytepoem/windy-plugin-sun-moon-path/0.9.0/release-notes/0.9.0.json',
            { signal: undefined },
        );
        expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it('keeps loaded series entries visible and marks the result retryable when one entry fails', async () => {
        const fetchImpl = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(jsonResponse(latestPackage('0.9.1')))
            .mockResolvedValueOnce(jsonResponse(patchUserNotes))
            .mockRejectedValueOnce(new TypeError('network unavailable'));

        await expect(checkPluginUpdate({
            currentVersion: '0.9.1',
            repositoryUrl,
            fetchImpl,
            sessionCache: null,
        })).resolves.toMatchObject({
            status: 'current',
            latestVersion: '0.9.1',
            notes: patchUserNotes,
            seriesNotes: [patchUserNotes],
            notesStatus: 'error',
        });
    });

    it('treats a missing latest release note as retryable even when an older series note loads', async () => {
        const values = new Map<string, string>();
        const sessionCache = {
            getItem: (key: string) => values.get(key) || null,
            setItem: (key: string, value: string) => values.set(key, value),
        };
        const fetchImpl = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(jsonResponse(latestPackage('0.9.1')))
            .mockResolvedValueOnce(jsonResponse({}, 404))
            .mockResolvedValueOnce(jsonResponse(userNotes));

        await expect(checkPluginUpdate({
            currentVersion: '0.9.1',
            repositoryUrl,
            fetchImpl,
            sessionCache,
        })).resolves.toMatchObject({
            status: 'current',
            latestVersion: '0.9.1',
            notes: null,
            seriesNotes: [userNotes],
            notesStatus: 'error',
        });
        expect(values.size).toBe(0);
    });

    it('keeps the update visible and retryable when the latest notes file is unavailable', async () => {
        const fetchImpl = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(jsonResponse(latestPackage('0.9.0')))
            .mockResolvedValueOnce(jsonResponse({}, 404));

        await expect(checkPluginUpdate({
            currentVersion: '0.8.1',
            repositoryUrl,
            fetchImpl,
            sessionCache: null,
        })).resolves.toMatchObject({
            status: 'available',
            latestVersion: '0.9.0',
            releasedAt: null,
            notes: null,
            notesStatus: 'error',
        });
    });

    it('rejects an invalid release date instead of displaying untrusted metadata', async () => {
        const fetchImpl = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(jsonResponse(latestPackage('0.9.0')))
            .mockResolvedValueOnce(jsonResponse({ ...userNotes, releasedAt: '2026-02-30' }));

        await expect(checkPluginUpdate({
            currentVersion: '0.8.1',
            repositoryUrl,
            fetchImpl,
            sessionCache: null,
        })).resolves.toMatchObject({
            status: 'available',
            latestVersion: '0.9.0',
            releasedAt: null,
            notes: null,
            notesStatus: 'error',
        });
    });

    it('does not cache a transient notes failure and loads the notes on retry', async () => {
        const values = new Map<string, string>();
        const sessionCache = {
            getItem: (key: string) => values.get(key) || null,
            setItem: (key: string, value: string) => values.set(key, value),
        };
        const fetchImpl = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(jsonResponse(latestPackage('0.9.0')))
            .mockRejectedValueOnce(new TypeError('network unavailable'))
            .mockResolvedValueOnce(jsonResponse(latestPackage('0.9.0')))
            .mockResolvedValueOnce(jsonResponse(userNotes));

        await expect(checkPluginUpdate({
            currentVersion: '0.8.1',
            repositoryUrl,
            fetchImpl,
            sessionCache,
        })).resolves.toMatchObject({
            status: 'available',
            latestVersion: '0.9.0',
            notes: null,
            notesStatus: 'error',
        });
        expect(values.size).toBe(0);

        await expect(checkPluginUpdate({
            currentVersion: '0.8.1',
            repositoryUrl,
            fetchImpl,
            sessionCache,
        })).resolves.toMatchObject({
            status: 'available',
            latestVersion: '0.9.0',
            notes: userNotes,
            notesStatus: 'loaded',
        });
        expect(fetchImpl).toHaveBeenCalledTimes(4);
        expect(values.size).toBe(1);
    });

    it('reuses a successful result within the browser session', async () => {
        const values = new Map<string, string>();
        const sessionCache = {
            getItem: (key: string) => values.get(key) || null,
            setItem: (key: string, value: string) => values.set(key, value),
        };
        const fetchImpl = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(jsonResponse(latestPackage('0.8.1')))
            .mockResolvedValueOnce(jsonResponse(currentUserNotes))
            .mockResolvedValueOnce(jsonResponse({}, 404));

        await checkPluginUpdate({ currentVersion: '0.8.1', repositoryUrl, fetchImpl, sessionCache });
        await checkPluginUpdate({ currentVersion: '0.8.1', repositoryUrl, fetchImpl, sessionCache });

        expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it('ignores malformed cached notes instead of rendering unvalidated session data', async () => {
        const cacheKey = 'github:bytepoem/windy-plugin-sun-moon-path:update-check:v7:0.8.1';
        const sessionCache = {
            getItem: (key: string) => key === cacheKey
                ? JSON.stringify({
                    status: 'available',
                    channel: 'formal',
                    latestVersion: '0.9.0',
                    releaseUrl: 'https://github.com/bytepoem/windy-plugin-sun-moon-path/releases/tag/0.9.0',
                    notes: { ...userNotes, zh: { ...userNotes.zh, items: [{ type: 'deploy', text: 'internal' }] } },
                    notesStatus: 'loaded',
                })
                : null,
            setItem: vi.fn(),
        };
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(latestPackage('0.8.1')));

        await expect(checkPluginUpdate({
            currentVersion: '0.8.1',
            repositoryUrl,
            fetchImpl,
            sessionCache,
        })).resolves.toMatchObject({ status: 'current', latestVersion: '0.8.1' });
        expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it('ignores a cached release link outside the configured GitHub repository', async () => {
        const cacheKey = 'github:bytepoem/windy-plugin-sun-moon-path:update-check:v7:0.8.1';
        const sessionCache = {
            getItem: (key: string) => key === cacheKey
                ? JSON.stringify({
                    status: 'available',
                    channel: 'formal',
                    latestVersion: '0.9.0',
                    releaseUrl: 'https://example.com/releases/tag/0.9.0',
                    notes: userNotes,
                    notesStatus: 'loaded',
                })
                : null,
            setItem: vi.fn(),
        };
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(latestPackage('0.8.1')));

        await expect(checkPluginUpdate({
            currentVersion: '0.8.1',
            repositoryUrl,
            fetchImpl,
            sessionCache,
        })).resolves.toMatchObject({ status: 'current', latestVersion: '0.8.1' });
        expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it('ignores a cached release link whose tag does not match the cached version', async () => {
        const cacheKey = 'github:bytepoem/windy-plugin-sun-moon-path:update-check:v7:0.8.1';
        const sessionCache = {
            getItem: (key: string) => key === cacheKey
                ? JSON.stringify({
                    status: 'available',
                    channel: 'formal',
                    latestVersion: '0.9.0',
                    releaseUrl: 'https://github.com/bytepoem/windy-plugin-sun-moon-path/releases/tag/unrelated',
                    notes: null,
                    notesStatus: 'missing',
                })
                : null,
            setItem: vi.fn(),
        };
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(latestPackage('0.8.1')));

        await expect(checkPluginUpdate({
            currentVersion: '0.8.1',
            repositoryUrl,
            fetchImpl,
            sessionCache,
        })).resolves.toMatchObject({ status: 'current', latestVersion: '0.8.1' });
        expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it('rejects failed GitHub version-file requests so the UI can offer a retry', async () => {
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 403));

        await expect(checkPluginUpdate({
            currentVersion: '0.8.1',
            repositoryUrl,
            fetchImpl,
            sessionCache: null,
        })).rejects.toThrow('GitHub version file request failed with 403');
    });
});

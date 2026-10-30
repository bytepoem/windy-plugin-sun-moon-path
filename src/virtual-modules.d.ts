declare module 'virtual:beta-release-notes-url' {
    /**
     * Local development builds receive the preview JSON URL; production builds receive null.
     */
    const betaReleaseNotesUrl: string | null;
    export default betaReleaseNotesUrl;
}

declare module 'virtual:diagnostic-build' {
    const build: { id: string; commit: string; local: boolean };
    export default build;
}

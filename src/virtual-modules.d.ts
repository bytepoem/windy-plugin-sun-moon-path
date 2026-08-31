declare module 'virtual:beta-release-notes-url' {
    /**
     * Local development builds receive the preview JSON URL; production builds receive null.
     */
    const betaReleaseNotesUrl: string | null;
    export default betaReleaseNotesUrl;
}

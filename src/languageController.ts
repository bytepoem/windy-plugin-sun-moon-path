import { prepareUiLanguage } from './localeMessages';
import { resolveUiLanguage, type UiLanguage, type UiLanguagePreference } from './uiLanguage';

export interface LanguageSelection {
    language: UiLanguage;
    preference: UiLanguagePreference;
}

/** Own the asynchronous selection transaction. Only the latest successful request may
 * update the UI and persistence. Host changes cannot replace a pending manual choice. */
export const createLanguageController = (options: {
    initial: LanguageSelection;
    usedLang: () => unknown;
    apply: (selection: LanguageSelection) => void;
    status: (loading: boolean, failed: boolean) => void;
    persist: (preference: UiLanguagePreference) => void;
    prepare?: (language: UiLanguage) => Promise<void>;
}) => {
    let current = options.initial;
    let desiredPreference = current.preference;
    let shouldPersist = false;
    let failedPreference: UiLanguagePreference | null = null;
    let revision = 0;
    let destroyed = false;
    const select = async (preference: UiLanguagePreference, persist = true): Promise<void> => {
        if (destroyed) { return; }
        desiredPreference = preference;
        failedPreference = null;
        // A newer host value replaces the load, but retains the user's pending choice
        // to follow Windy. Otherwise the UI would follow only until the next reopen.
        shouldPersist ||= persist;
        const request = ++revision;
        options.status(true, false);
        try {
            const language = resolveUiLanguage(preference, options.usedLang());
            await (options.prepare ?? prepareUiLanguage)(language);
            if (destroyed || request !== revision) { return; }
            const next = { language, preference };
            options.apply(next);
            current = next;
            if (shouldPersist) { options.persist(preference); }
            shouldPersist = false;
            options.status(false, false);
        } catch {
            if (destroyed || request !== revision) { return; }
            desiredPreference = current.preference;
            failedPreference = preference;
            shouldPersist = false;
            options.status(false, true);
        }
    };
    return {
        select,
        retry: () => select(failedPreference ?? current.preference),
        syncHost: () => desiredPreference === 'auto' ? select('auto', false) : Promise.resolve(),
        destroy: () => {
            destroyed = true;
            revision += 1;
        },
    };
};

import pluginConfig from './pluginConfig';
import type { PostHogUsageConfig } from './posthogUsageTransport';

// Public, write-only project token for US Cloud project 623982. This is not a
// personal API key and cannot read project data or administer the account.
export const postHogUsageConfig: PostHogUsageConfig = {
    projectToken: 'phc_uQLQXGoaLW2L7bnSb3rcTeUSNnbZcHtQZCYnM5UG4SJB',
    pluginVersion: pluginConfig.version,
    environment: 'production',
};

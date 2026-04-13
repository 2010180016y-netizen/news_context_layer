export const CANONICAL_ARTICLE_STATUSES = ['active', 'archived', 'blocked'];
export const STORY_CLUSTER_STATUSES = ['active', 'warm', 'archived'];
export const USER_STATUSES = ['active', 'inactive'];
export const SUBSCRIPTION_PLAN_CODES = ['free', 'founder_pass', 'pro', 'analyst', 'team'];
export const SUBSCRIPTION_STATUSES = ['inactive', 'active', 'expired', 'grace_period', 'refunded'];
export const BRIEFING_STATUSES = ['pending', 'sent', 'failed'];
export const FEEDBACK_TYPES = ['helpful', 'unrelated', 'outdated', 'missing_coverage', 'bug', 'free_text'];
export const CONSENT_TYPES = ['analytics_opt_in', 'privacy_terms', 'tos'];
export const DATABASE_TABLES = [
    'publishers',
    'feeds',
    'raw_entries',
    'canonical_articles',
    'article_versions',
    'article_features',
    'story_clusters',
    'cluster_members',
    'users',
    'devices',
    'subscriptions',
    'watchlists',
    'briefings',
    'briefing_items',
    'events',
    'feedback',
    'legal_consents'
];
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function asStringArray(value) {
    return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : [];
}
function coerceMeta(value, nowIso) {
    if (!isRecord(value)) {
        return {
            schema_source: 'docs/06_DB_Schema.sql',
            storage_adapter: 'file-backed-dev-store',
            applied_migrations: [],
            last_migrated_at: null,
            created_at: nowIso,
            updated_at: nowIso
        };
    }
    return {
        schema_source: typeof value['schema_source'] === 'string' ? value['schema_source'] : 'docs/06_DB_Schema.sql',
        storage_adapter: 'file-backed-dev-store',
        applied_migrations: asStringArray(value['applied_migrations']),
        last_migrated_at: typeof value['last_migrated_at'] === 'string' ? value['last_migrated_at'] : null,
        created_at: typeof value['created_at'] === 'string' ? value['created_at'] : nowIso,
        updated_at: typeof value['updated_at'] === 'string' ? value['updated_at'] : nowIso
    };
}
export function createEmptyStoreState(nowIso = new Date().toISOString()) {
    return {
        meta: {
            schema_source: 'docs/06_DB_Schema.sql',
            storage_adapter: 'file-backed-dev-store',
            applied_migrations: [],
            last_migrated_at: null,
            created_at: nowIso,
            updated_at: nowIso
        },
        publishers: [],
        feeds: [],
        raw_entries: [],
        canonical_articles: [],
        article_versions: [],
        article_features: [],
        story_clusters: [],
        cluster_members: [],
        users: [],
        devices: [],
        subscriptions: [],
        watchlists: [],
        briefings: [],
        briefing_items: [],
        events: [],
        feedback: [],
        legal_consents: []
    };
}
export function hydrateStoreState(value, nowIso = new Date().toISOString()) {
    if (!isRecord(value)) {
        return createEmptyStoreState(nowIso);
    }
    const emptyState = createEmptyStoreState(nowIso);
    return {
        meta: coerceMeta(value['meta'], nowIso),
        publishers: Array.isArray(value['publishers']) ? value['publishers'] : emptyState.publishers,
        feeds: Array.isArray(value['feeds']) ? value['feeds'] : emptyState.feeds,
        raw_entries: Array.isArray(value['raw_entries']) ? value['raw_entries'] : emptyState.raw_entries,
        canonical_articles: Array.isArray(value['canonical_articles'])
            ? value['canonical_articles']
            : emptyState.canonical_articles,
        article_versions: Array.isArray(value['article_versions'])
            ? value['article_versions']
            : emptyState.article_versions,
        article_features: Array.isArray(value['article_features'])
            ? value['article_features']
            : emptyState.article_features,
        story_clusters: Array.isArray(value['story_clusters'])
            ? value['story_clusters']
            : emptyState.story_clusters,
        cluster_members: Array.isArray(value['cluster_members'])
            ? value['cluster_members']
            : emptyState.cluster_members,
        users: Array.isArray(value['users']) ? value['users'] : emptyState.users,
        devices: Array.isArray(value['devices']) ? value['devices'] : emptyState.devices,
        subscriptions: Array.isArray(value['subscriptions'])
            ? value['subscriptions']
            : emptyState.subscriptions,
        watchlists: Array.isArray(value['watchlists']) ? value['watchlists'] : emptyState.watchlists,
        briefings: Array.isArray(value['briefings']) ? value['briefings'] : emptyState.briefings,
        briefing_items: Array.isArray(value['briefing_items'])
            ? value['briefing_items']
            : emptyState.briefing_items,
        events: Array.isArray(value['events']) ? value['events'] : emptyState.events,
        feedback: Array.isArray(value['feedback']) ? value['feedback'] : emptyState.feedback,
        legal_consents: Array.isArray(value['legal_consents'])
            ? value['legal_consents']
            : emptyState.legal_consents
    };
}
//# sourceMappingURL=store.js.map
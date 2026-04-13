import type { PaywallTriggerType, ProfileResponse, ResolveRequest, ResolveResponse, WatchlistItem } from '@news-context/shared-types';
import type { ParsedArticle } from '../content/types.js';
export declare function buildResolveRequestFromParsedArticle(article: ParsedArticle): ResolveRequest;
export declare function formatAuthorLine(authorNames: readonly string[]): string;
export declare function formatTimestamp(isoTimestamp: string | null | undefined, locale?: string): string;
export declare function buildResultHelperText(response: ResolveResponse): string | null;
export declare function buildStatusBadge(response: ResolveResponse): {
    readonly label: string;
    readonly tone: 'neutral' | 'warning';
} | null;
export declare function isCurrentClusterSaved(clusterId: string | null, watchlists: readonly WatchlistItem[]): boolean;
export declare function buildWatchlistUsageLabel(profile: ProfileResponse | null): string;
export declare function buildPlanLabel(profile: ProfileResponse | null): string;
export declare function hasFounderPass(profile: ProfileResponse | null): boolean;
export declare function canAccessBriefing(profile: ProfileResponse | null): boolean;
export declare function buildBriefingCtaLabel(profile: ProfileResponse | null): string;
export declare function buildPaywallTitle(trigger: PaywallTriggerType | null): string;
export declare function buildPaywallDescription(trigger: PaywallTriggerType | null): string;
//# sourceMappingURL=view-model.d.ts.map
import type { BriefingResponse, DeviceIdentity, PaywallTriggerType, ProfileResponse, ResolveResponse, WatchlistItem } from '@news-context/shared-types';
import type { ArticleParseResult, ParsedArticle } from '../content/types.js';
import type { PanelTabContext } from '../lib/messages.js';
import type { PanelRoute } from './routes.js';
export interface SidePanelPreferences {
    readonly analyticsOptIn: boolean;
    readonly onboardingCompleted: boolean;
    readonly apiBaseUrl?: string;
}
export type BlockedViewActionType = 'retry' | 'open_supported_page';
export interface BlockedViewAction {
    readonly type: BlockedViewActionType;
    readonly label: string;
}
export interface UnsupportedViewCopy {
    readonly title: string;
    readonly description: string;
    readonly primaryAction: BlockedViewAction;
    readonly secondaryAction?: BlockedViewAction;
}
export interface ErrorViewCopy {
    readonly title: string;
    readonly description: string;
    readonly primaryAction: BlockedViewAction;
}
export interface BriefingRecoveryCopy {
    readonly title: string;
    readonly description: string;
    readonly retryLabel: string;
}
export interface SidePanelState {
    readonly route: PanelRoute;
    readonly preferences: SidePanelPreferences;
    readonly identity: DeviceIdentity | null;
    readonly context: PanelTabContext | null;
    readonly parsedArticle: ParsedArticle | null;
    readonly resolveResponse: ResolveResponse | null;
    readonly profile: ProfileResponse | null;
    readonly watchlists: readonly WatchlistItem[];
    readonly briefing: BriefingResponse | null;
    readonly briefingLoading: boolean;
    readonly briefingError: string | null;
    readonly collectionsLoading: boolean;
    readonly actionInFlight: boolean;
    readonly checkoutPending: boolean;
    readonly unsupportedCopy: UnsupportedViewCopy | null;
    readonly errorCopy: ErrorViewCopy | null;
    readonly noticeMessage: string | null;
    readonly paywallMessage: string | null;
    readonly paywallTrigger: PaywallTriggerType | null;
}
export declare function createDefaultPreferences(): SidePanelPreferences;
export declare function createInitialSidePanelState(route: PanelRoute, preferences: SidePanelPreferences): SidePanelState;
export declare function createUnsupportedCopy(context: PanelTabContext | null, article: ArticleParseResult | null): UnsupportedViewCopy;
export declare function createErrorCopy(message?: string): ErrorViewCopy;
export declare function createBriefingRecoveryCopy(message?: string): BriefingRecoveryCopy;
//# sourceMappingURL=state.d.ts.map
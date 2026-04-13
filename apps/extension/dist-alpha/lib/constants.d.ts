import type { AppDescriptor } from '@news-context/shared-types';
export declare const EXTENSION_NAME = "News Context";
export declare const DEFAULT_SIDEPANEL_PATH = "sidepanel/index.html";
export declare const SUPPORTED_HOSTNAME = "n.news.naver.com";
export declare const DEFAULT_API_BASE_URL = "http://127.0.0.1:8787";
export declare const STORAGE_KEY_ANALYTICS_OPT_IN = "analyticsOptIn";
export declare const STORAGE_KEY_ONBOARDING_COMPLETED = "onboardingCompleted";
export declare const STORAGE_KEY_API_BASE_URL = "apiBaseUrl";
export declare const STORAGE_KEY_LAST_PANEL_CONTEXT = "lastPanelContext";
export declare const STORAGE_KEY_DEVICE_ID = "deviceId";
export declare const STORAGE_KEY_ANON_ID = "anonId";
export declare const STORAGE_KEY_CHECKOUT_RETURN = "checkoutReturn";
export declare const CONSENT_VERSION = "2026-04-10";
export declare const FREE_WATCHLIST_LIMIT = 1;
export declare const extensionDescriptor: AppDescriptor;
export declare function isSupportedNaverNewsUrl(rawUrl: string): boolean;
//# sourceMappingURL=constants.d.ts.map
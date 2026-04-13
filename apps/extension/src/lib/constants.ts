import type { AppDescriptor } from '@news-context/shared-types';

export const EXTENSION_NAME = 'News Context';
export const DEFAULT_SIDEPANEL_PATH = 'sidepanel/index.html';
export const SUPPORTED_HOSTNAME = 'n.news.naver.com';
export const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
export const STORAGE_KEY_ANALYTICS_OPT_IN = 'analyticsOptIn';
export const STORAGE_KEY_ONBOARDING_COMPLETED = 'onboardingCompleted';
export const STORAGE_KEY_API_BASE_URL = 'apiBaseUrl';
export const STORAGE_KEY_LAST_PANEL_CONTEXT = 'lastPanelContext';
export const STORAGE_KEY_DEVICE_ID = 'deviceId';
export const STORAGE_KEY_ANON_ID = 'anonId';
export const STORAGE_KEY_CHECKOUT_RETURN = 'checkoutReturn';
export const CONSENT_VERSION = '2026-04-10';
export const FREE_WATCHLIST_LIMIT = 1;

export const extensionDescriptor: AppDescriptor = {
  id: 'extension',
  displayName: 'News Context Extension',
  stage: 'skeleton',
};

export function isSupportedNaverNewsUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:' && url.hostname === SUPPORTED_HOSTNAME;
  } catch {
    return false;
  }
}

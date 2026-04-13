export const PANEL_ROUTES = ['onboarding', 'loading', 'main', 'watchlist', 'plan', 'settings', 'unsupported', 'error'] as const;

export type PanelRoute = (typeof PANEL_ROUTES)[number];

export const PANEL_PRIMARY_ROUTES = ['main', 'watchlist', 'plan', 'settings'] as const;

export type PanelPrimaryRoute = (typeof PANEL_PRIMARY_ROUTES)[number];

export function resolveInitialRoute(onboardingCompleted: boolean): PanelRoute {
  return onboardingCompleted ? 'loading' : 'onboarding';
}

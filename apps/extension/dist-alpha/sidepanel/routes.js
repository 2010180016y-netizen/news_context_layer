export const PANEL_ROUTES = ['onboarding', 'loading', 'main', 'watchlist', 'plan', 'settings', 'unsupported', 'error'];
export const PANEL_PRIMARY_ROUTES = ['main', 'watchlist', 'plan', 'settings'];
export function resolveInitialRoute(onboardingCompleted) {
    return onboardingCompleted ? 'loading' : 'onboarding';
}
//# sourceMappingURL=routes.js.map
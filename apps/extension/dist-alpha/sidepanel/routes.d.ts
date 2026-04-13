export declare const PANEL_ROUTES: readonly ["onboarding", "loading", "main", "watchlist", "plan", "settings", "unsupported", "error"];
export type PanelRoute = (typeof PANEL_ROUTES)[number];
export declare const PANEL_PRIMARY_ROUTES: readonly ["main", "watchlist", "plan", "settings"];
export type PanelPrimaryRoute = (typeof PANEL_PRIMARY_ROUTES)[number];
export declare function resolveInitialRoute(onboardingCompleted: boolean): PanelRoute;
//# sourceMappingURL=routes.d.ts.map
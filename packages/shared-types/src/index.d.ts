export type AppId = 'extension' | 'api' | 'jobs';
export type Stage = 'skeleton';
export interface AppDescriptor {
    readonly id: AppId;
    readonly displayName: string;
    readonly stage: Stage;
}
export interface HealthResponse {
    readonly status: 'ok';
    readonly service: AppId;
    readonly stage: Stage;
    readonly version: string;
}
export declare function createAppDescriptor(id: AppId, displayName: string): AppDescriptor;
export declare function createHealthResponse(service: AppId, version: string): HealthResponse;
export * from './fixtures.js';
export * from './briefing.js';
export * from './reporting.js';
export * from './resolve.js';
export * from './store.js';
export * from './support.js';
//# sourceMappingURL=index.d.ts.map
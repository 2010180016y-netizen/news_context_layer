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

export function createAppDescriptor(id: AppId, displayName: string): AppDescriptor {
  return {
    id,
    displayName,
    stage: 'skeleton',
  };
}

export function createHealthResponse(service: AppId, version: string): HealthResponse {
  return {
    status: 'ok',
    service,
    stage: 'skeleton',
    version,
  };
}

export * from './fixtures.js';
export * from './briefing.js';
export * from './reporting.js';
export * from './resolve.js';
export * from './store.js';
export * from './support.js';

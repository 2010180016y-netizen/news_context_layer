import type { HealthResponse } from '@news-context/shared-types';

export const API_VERSION = '0.1.0';

export function createApiHealthResponse(): HealthResponse {
  return {
    status: 'ok',
    service: 'api',
    stage: 'skeleton',
    version: API_VERSION,
  };
}

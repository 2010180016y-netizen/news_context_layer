import { describe, expect, it } from 'vitest';

import { createAppDescriptor, createHealthResponse } from '../src/index.js';

describe('shared-types', () => {
  it('creates an app descriptor for skeleton stage', () => {
    expect(createAppDescriptor('api', 'News Context API')).toEqual({
      id: 'api',
      displayName: 'News Context API',
      stage: 'skeleton',
    });
  });

  it('creates a health response payload', () => {
    expect(createHealthResponse('jobs', '0.1.0')).toEqual({
      status: 'ok',
      service: 'jobs',
      stage: 'skeleton',
      version: '0.1.0',
    });
  });
});

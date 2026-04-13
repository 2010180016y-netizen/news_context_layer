import { describe, expect, it, vi } from 'vitest';

import { buildPlaceholderMessage, jobsDescriptor, runPlaceholderWorker } from '../src/workers/run-placeholder-worker.js';

describe('jobs placeholder worker', () => {
  it('returns the expected descriptor', () => {
    expect(jobsDescriptor).toEqual({
      id: 'jobs',
      displayName: 'News Context Jobs',
      stage: 'skeleton',
    });
  });

  it('logs the placeholder message', () => {
    const logger = {
      info: vi.fn<(message: string) => void>(),
    };

    const message = runPlaceholderWorker(logger);

    expect(message).toBe(buildPlaceholderMessage());
    expect(logger.info).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledWith(buildPlaceholderMessage());
  });
});

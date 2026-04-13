import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SUPPORT_RUNTIME_CONFIG,
  buildAlphaRuntimeConfig,
  resolveSupportRuntimeConfig
} from '../scripts/support-runtime-config.mjs';

describe('support runtime build config', () => {
  it('keeps the support block even when no real support values are injected', () => {
    const runtimeConfig = buildAlphaRuntimeConfig({
      apiBaseUrl: new URL('https://staging-api.newscontext.example.com'),
      releaseChannel: 'alpha',
      argv: [],
      env: {}
    });

    expect(runtimeConfig).toEqual({
      apiBaseUrl: 'https://staging-api.newscontext.example.com',
      releaseChannel: 'alpha',
      support: DEFAULT_SUPPORT_RUNTIME_CONFIG
    });
  });

  it('reads support overrides from env and flags', () => {
    const runtimeConfig = buildAlphaRuntimeConfig({
      apiBaseUrl: new URL('https://staging-api.newscontext.example.com/'),
      releaseChannel: 'alpha',
      argv: ['--support-channel-status=partial', '--support-billing-url=mailto:billing@example.com'],
      env: {
        SUPPORT_RESPONSE_SLA: 'Within 1 business day',
        SUPPORT_BETA_URL: 'https://support.example/beta',
        SUPPORT_QUALITY_URL: 'https://support.example/quality',
        SUPPORT_B2B_URL: 'https://support.example/b2b'
      }
    });

    expect(runtimeConfig).toEqual({
      apiBaseUrl: 'https://staging-api.newscontext.example.com',
      releaseChannel: 'alpha',
      support: {
        channelStatus: 'partial',
        responseSla: 'Within 1 business day',
        betaSupportUrl: 'https://support.example/beta',
        billingUrl: 'mailto:billing@example.com',
        qualityIssueUrl: 'https://support.example/quality',
        b2bInquiryUrl: 'https://support.example/b2b'
      }
    });
  });

  it('rejects invalid non-empty support links and invalid status values', () => {
    expect(() =>
      resolveSupportRuntimeConfig([], {
        SUPPORT_BETA_URL: 'http://support.example/beta'
      })
    ).toThrow('SUPPORT_BETA_URL must use https: or mailto: when provided.');

    expect(() =>
      resolveSupportRuntimeConfig([], {
        SUPPORT_CHANNEL_STATUS: 'ready'
      })
    ).toThrow('SUPPORT_CHANNEL_STATUS must be one of draft, partial, or configured.');
  });
});

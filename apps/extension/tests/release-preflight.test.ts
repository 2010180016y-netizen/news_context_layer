import { describe, expect, it } from 'vitest';

import {
  evaluateReleasePreflight,
  parseGeneratedRuntimeConfigSource
} from '../../../scripts/lib/release-preflight.js';

const LEGAL_PAGE_SOURCES = {
  'docs/public/privacy-policy.html': '<html><body><h1>Privacy</h1><p>Operator: News Context operator.</p></body></html>',
  'docs/public/public-contact.html':
    '<html><body><h1>Public Contact</h1><p>Use the public issue tracker for alpha support.</p></body></html>'
} as const;

describe('release preflight helpers', () => {
  it('parses the generated runtime config source', () => {
    expect(
      parseGeneratedRuntimeConfigSource(`window.__NEWS_CONTEXT_CONFIG__ = {
  "apiBaseUrl": "https://staging-api.newscontext.example.com",
  "releaseChannel": "alpha",
  "support": {
    "channelStatus": "configured",
    "responseSla": "Same day",
    "betaSupportUrl": "https://support.example.com/beta",
    "billingUrl": "https://support.example.com/billing",
    "qualityIssueUrl": "https://support.example.com/quality",
    "b2bInquiryUrl": "mailto:hello@example.com"
  }
};`)
    ).toMatchObject({
      apiBaseUrl: 'https://staging-api.newscontext.example.com',
      releaseChannel: 'alpha',
      support: {
        channelStatus: 'configured'
      }
    });
  });

  it('treats placeholder support as warnings while keeping placeholder store values as blockers', () => {
    const result = evaluateReleasePreflight({
      manifest: {
        icons: {
          '16': 'icons/icon-16.png',
          '32': 'icons/icon-32.png',
          '48': 'icons/icon-48.png',
          '128': 'icons/icon-128.png'
        },
        action: {
          default_icon: {
            '16': 'icons/icon-16.png',
            '32': 'icons/icon-32.png',
            '48': 'icons/icon-48.png',
            '128': 'icons/icon-128.png'
          }
        },
        host_permissions: ['https://n.news.naver.com/*', 'https://staging-api.newscontext.example.com/*']
      },
      alphaRelease: {
        api_base_url: 'https://staging-api.newscontext.example.com',
        host_permissions: ['https://n.news.naver.com/*', 'https://staging-api.newscontext.example.com/*'],
        store_listing: {
          status: 'placeholder',
          privacyPolicyUrl: null,
          publicContactUrl: null,
          termsOfServiceUrl: null
        }
      },
      runtimeConfig: {
        apiBaseUrl: 'https://staging-api.newscontext.example.com',
        releaseChannel: 'alpha',
        support: {
          channelStatus: 'draft',
          responseSla: null,
          betaSupportUrl: null,
          billingUrl: null,
          qualityIssueUrl: null,
          b2bInquiryUrl: null
        }
      },
      existingRelativePaths: new Set([
        'icons/icon-16.png',
        'icons/icon-32.png',
        'icons/icon-48.png',
        'icons/icon-128.png'
      ]),
      legalPageSources: LEGAL_PAGE_SOURCES
    });

    expect(result.readyForSubmission).toBe(false);
    expect(result.blockers).not.toContain('SUPPORT_CHANNEL_STATUS must be configured before submission.');
    expect(result.blockers).not.toContain(
      'Missing configured support routes: SUPPORT_BETA_URL, SUPPORT_BILLING_URL, SUPPORT_QUALITY_URL, SUPPORT_B2B_URL.'
    );
    expect(result.checks.supportMissingKeys).toEqual([
      'SUPPORT_BETA_URL',
      'SUPPORT_BILLING_URL',
      'SUPPORT_QUALITY_URL',
      'SUPPORT_B2B_URL'
    ]);
    expect(result.checks.storeMissingKeys).toEqual([
      'STORE_PRIVACY_POLICY_URL',
      'STORE_PUBLIC_CONTACT_URL'
    ]);
    expect(result.warnings).toContain(
      'SUPPORT_CHANNEL_STATUS is not configured. Blocked-state support CTAs will stay on placeholder-safe fallback until real routes are injected.'
    );
    expect(result.warnings).toContain(
      'Support runtime routes are still placeholder-only: SUPPORT_BETA_URL, SUPPORT_BILLING_URL, SUPPORT_QUALITY_URL, SUPPORT_B2B_URL. This does not block alpha submission, but blocked-state CTAs will not open a real support destination yet.'
    );
  });

  it('allows submission when store metadata is configured even if support stays placeholder-only', () => {
    const result = evaluateReleasePreflight({
      manifest: {
        icons: {
          '16': 'icons/icon-16.png',
          '32': 'icons/icon-32.png',
          '48': 'icons/icon-48.png',
          '128': 'icons/icon-128.png'
        },
        action: {
          default_icon: {
            '16': 'icons/icon-16.png',
            '32': 'icons/icon-32.png',
            '48': 'icons/icon-48.png',
            '128': 'icons/icon-128.png'
          }
        },
        host_permissions: ['https://n.news.naver.com/*', 'https://staging-api.newscontext.example.com/*']
      },
      alphaRelease: {
        api_base_url: 'https://staging-api.newscontext.example.com',
        host_permissions: ['https://n.news.naver.com/*', 'https://staging-api.newscontext.example.com/*'],
        store_listing: {
          status: 'configured',
          privacyPolicyUrl: 'https://example.com/privacy',
          publicContactUrl: 'mailto:hello@example.com',
          termsOfServiceUrl: null
        }
      },
      runtimeConfig: {
        apiBaseUrl: 'https://staging-api.newscontext.example.com',
        releaseChannel: 'alpha',
        support: {
          channelStatus: 'draft',
          responseSla: null,
          betaSupportUrl: null,
          billingUrl: null,
          qualityIssueUrl: null,
          b2bInquiryUrl: null
        }
      },
      existingRelativePaths: new Set([
        'icons/icon-16.png',
        'icons/icon-32.png',
        'icons/icon-48.png',
        'icons/icon-128.png'
      ]),
      legalPageSources: LEGAL_PAGE_SOURCES
    });

    expect(result.readyForSubmission).toBe(true);
    expect(result.blockers).toHaveLength(0);
    expect(result.checks.supportConfigured).toBe(false);
    expect(result.checks.storeConfigured).toBe(true);
    expect(result.checks.hostPermissionsMatchReleaseMetadata).toBe(true);
    expect(result.manualStepsRemaining).toContain(
      'If this alpha needs live operator follow-up, inject real SUPPORT_* values before sharing it outside the core team.'
    );
  });

  it('marks configured support and store metadata as ready for submission', () => {
    const result = evaluateReleasePreflight({
      manifest: {
        icons: {
          '16': 'icons/icon-16.png',
          '32': 'icons/icon-32.png',
          '48': 'icons/icon-48.png',
          '128': 'icons/icon-128.png'
        },
        action: {
          default_icon: {
            '16': 'icons/icon-16.png',
            '32': 'icons/icon-32.png',
            '48': 'icons/icon-48.png',
            '128': 'icons/icon-128.png'
          }
        },
        host_permissions: ['https://n.news.naver.com/*', 'https://staging-api.newscontext.example.com/*']
      },
      alphaRelease: {
        api_base_url: 'https://staging-api.newscontext.example.com',
        host_permissions: ['https://n.news.naver.com/*', 'https://staging-api.newscontext.example.com/*'],
        store_listing: {
          status: 'configured',
          privacyPolicyUrl: 'https://example.com/privacy',
          publicContactUrl: 'mailto:hello@example.com',
          termsOfServiceUrl: 'https://example.com/terms'
        }
      },
      runtimeConfig: {
        apiBaseUrl: 'https://staging-api.newscontext.example.com',
        releaseChannel: 'alpha',
        support: {
          channelStatus: 'configured',
          responseSla: 'Same business day acknowledgement.',
          betaSupportUrl: 'https://support.example.com/beta',
          billingUrl: 'https://support.example.com/billing',
          qualityIssueUrl: 'https://support.example.com/quality',
          b2bInquiryUrl: 'mailto:pilot@example.com'
        }
      },
      existingRelativePaths: new Set([
        'icons/icon-16.png',
        'icons/icon-32.png',
        'icons/icon-48.png',
        'icons/icon-128.png'
      ]),
      legalPageSources: LEGAL_PAGE_SOURCES
    });

    expect(result.readyForSubmission).toBe(true);
    expect(result.blockers).toHaveLength(0);
    expect(result.manualStepsRemaining).toHaveLength(2);
    expect(result.checks.hostPermissionsMatchReleaseMetadata).toBe(true);
  });

  it('blocks submission when public legal pages still contain draft markers', () => {
    const result = evaluateReleasePreflight({
      manifest: {
        icons: {
          '16': 'icons/icon-16.png',
          '32': 'icons/icon-32.png',
          '48': 'icons/icon-48.png',
          '128': 'icons/icon-128.png'
        },
        action: {
          default_icon: {
            '16': 'icons/icon-16.png',
            '32': 'icons/icon-32.png',
            '48': 'icons/icon-48.png',
            '128': 'icons/icon-128.png'
          }
        },
        host_permissions: ['https://n.news.naver.com/*', 'https://staging-api.newscontext.example.com/*']
      },
      alphaRelease: {
        api_base_url: 'https://staging-api.newscontext.example.com',
        host_permissions: ['https://n.news.naver.com/*', 'https://staging-api.newscontext.example.com/*'],
        store_listing: {
          status: 'configured',
          privacyPolicyUrl: 'https://example.com/privacy',
          publicContactUrl: 'https://example.com/contact',
          termsOfServiceUrl: null
        }
      },
      runtimeConfig: {
        apiBaseUrl: 'https://staging-api.newscontext.example.com',
        releaseChannel: 'alpha',
        support: {
          channelStatus: 'configured',
          responseSla: 'Same business day acknowledgement.',
          betaSupportUrl: 'https://support.example.com/beta',
          billingUrl: 'https://support.example.com/billing',
          qualityIssueUrl: 'https://support.example.com/quality',
          b2bInquiryUrl: 'mailto:pilot@example.com'
        }
      },
      existingRelativePaths: new Set([
        'icons/icon-16.png',
        'icons/icon-32.png',
        'icons/icon-48.png',
        'icons/icon-128.png'
      ]),
      legalPageSources: {
        'docs/public/privacy-policy.html': '<html><body>Draft Public Page [Operator Name]</body></html>',
        'docs/public/public-contact.html': '<html><body>Draft Public Page</body></html>'
      }
    });

    expect(result.readyForSubmission).toBe(false);
    expect(result.blockers).toContain(
      'Public legal/contact pages still contain draft or placeholder markers: docs/public/privacy-policy.html, docs/public/public-contact.html.'
    );
    expect(result.checks.legalPagesWithDraftMarkers).toEqual([
      'docs/public/privacy-policy.html',
      'docs/public/public-contact.html'
    ]);
  });

  it('blocks submission when dist-alpha manifest hosts drift from alpha-release metadata', () => {
    const result = evaluateReleasePreflight({
      manifest: {
        icons: {
          '16': 'icons/icon-16.png',
          '32': 'icons/icon-32.png',
          '48': 'icons/icon-48.png',
          '128': 'icons/icon-128.png'
        },
        action: {
          default_icon: {
            '16': 'icons/icon-16.png',
            '32': 'icons/icon-32.png',
            '48': 'icons/icon-48.png',
            '128': 'icons/icon-128.png'
          }
        },
        host_permissions: ['https://n.news.naver.com/*', 'https://api.newscontext.example.com/*']
      },
      alphaRelease: {
        api_base_url: 'https://staging-api.newscontext.example.com',
        host_permissions: ['https://n.news.naver.com/*', 'https://staging-api.newscontext.example.com/*'],
        store_listing: {
          status: 'configured',
          privacyPolicyUrl: 'https://example.com/privacy',
          publicContactUrl: 'https://example.com/contact',
          termsOfServiceUrl: null
        }
      },
      runtimeConfig: {
        apiBaseUrl: 'https://staging-api.newscontext.example.com',
        releaseChannel: 'alpha',
        support: {
          channelStatus: 'draft',
          responseSla: null,
          betaSupportUrl: null,
          billingUrl: null,
          qualityIssueUrl: null,
          b2bInquiryUrl: null
        }
      },
      existingRelativePaths: new Set([
        'icons/icon-16.png',
        'icons/icon-32.png',
        'icons/icon-48.png',
        'icons/icon-128.png'
      ]),
      legalPageSources: LEGAL_PAGE_SOURCES
    });

    expect(result.readyForSubmission).toBe(false);
    expect(result.checks.hostPermissionsMatchReleaseMetadata).toBe(false);
    expect(result.blockers).toContain(
      'Release manifest host permissions do not exactly match alpha-release metadata.'
    );
  });
});

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_STORE_LISTING_METADATA,
  buildStoreListingReleaseMetadata,
  resolveStoreListingMetadata
} from '../scripts/release-metadata-config.mjs';

describe('release metadata config', () => {
  it('keeps store listing metadata on placeholder-safe defaults when no public values are injected', () => {
    expect(buildStoreListingReleaseMetadata([], {})).toEqual({
      ...DEFAULT_STORE_LISTING_METADATA,
      status: 'placeholder',
      requiredBeforeSubmissionKeys: ['STORE_PRIVACY_POLICY_URL', 'STORE_PUBLIC_CONTACT_URL'],
      recommendedKeys: ['STORE_TERMS_OF_SERVICE_URL'],
      missingRequiredKeys: ['STORE_PRIVACY_POLICY_URL', 'STORE_PUBLIC_CONTACT_URL']
    });
  });

  it('reads store listing overrides from env and flags', () => {
    expect(
      buildStoreListingReleaseMetadata(
        ['--store-public-contact-url=mailto:launch@example.com'],
        {
          STORE_PRIVACY_POLICY_URL: 'https://example.com/privacy',
          STORE_TERMS_OF_SERVICE_URL: 'https://example.com/terms'
        }
      )
    ).toEqual({
      privacyPolicyUrl: 'https://example.com/privacy',
      termsOfServiceUrl: 'https://example.com/terms',
      publicContactUrl: 'mailto:launch@example.com',
      status: 'configured',
      requiredBeforeSubmissionKeys: ['STORE_PRIVACY_POLICY_URL', 'STORE_PUBLIC_CONTACT_URL'],
      recommendedKeys: ['STORE_TERMS_OF_SERVICE_URL'],
      missingRequiredKeys: []
    });
  });

  it('rejects invalid non-empty listing URLs', () => {
    expect(() =>
      resolveStoreListingMetadata([], {
        STORE_PRIVACY_POLICY_URL: 'http://example.com/privacy'
      })
    ).toThrow('STORE_PRIVACY_POLICY_URL must use https: when provided.');

    expect(() =>
      resolveStoreListingMetadata([], {
        STORE_PUBLIC_CONTACT_URL: 'ftp://example.com/contact'
      })
    ).toThrow('STORE_PUBLIC_CONTACT_URL must use https: or mailto: when provided.');
  });
});

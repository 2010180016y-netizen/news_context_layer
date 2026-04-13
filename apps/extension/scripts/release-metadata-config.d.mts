export type StoreListingMetadata = {
  privacyPolicyUrl: string | null;
  termsOfServiceUrl: string | null;
  publicContactUrl: string | null;
};

export type StoreListingReleaseMetadata = StoreListingMetadata & {
  status: 'placeholder' | 'configured';
  requiredBeforeSubmissionKeys: readonly ['STORE_PRIVACY_POLICY_URL', 'STORE_PUBLIC_CONTACT_URL'];
  recommendedKeys: readonly ['STORE_TERMS_OF_SERVICE_URL'];
  missingRequiredKeys: string[];
};

export const DEFAULT_STORE_LISTING_METADATA: Readonly<StoreListingMetadata>;

export function resolveStoreListingMetadata(
  argv?: readonly string[],
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>
): StoreListingMetadata;

export function buildStoreListingReleaseMetadata(
  argv?: readonly string[],
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>
): StoreListingReleaseMetadata;

interface SupportRuntimeConfig {
  readonly channelStatus?: string | undefined;
  readonly responseSla?: string | null | undefined;
  readonly betaSupportUrl?: string | null | undefined;
  readonly billingUrl?: string | null | undefined;
  readonly qualityIssueUrl?: string | null | undefined;
  readonly b2bInquiryUrl?: string | null | undefined;
}

interface GeneratedRuntimeConfig {
  readonly apiBaseUrl?: string | undefined;
  readonly releaseChannel?: string | undefined;
  readonly support?: SupportRuntimeConfig | undefined;
}

interface GeneratedStoreListing {
  readonly privacyPolicyUrl?: string | null | undefined;
  readonly termsOfServiceUrl?: string | null | undefined;
  readonly publicContactUrl?: string | null | undefined;
  readonly status?: string | undefined;
  readonly missingRequiredKeys?: readonly string[] | undefined;
}

interface GeneratedAlphaRelease {
  readonly api_base_url?: string | undefined;
  readonly host_permissions?: readonly string[] | undefined;
  readonly store_listing?: GeneratedStoreListing | undefined;
}

interface GeneratedManifest {
  readonly icons?: Readonly<Record<string, string>> | undefined;
  readonly action?: {
    readonly default_icon?: Readonly<Record<string, string>> | undefined;
  } | undefined;
  readonly host_permissions?: readonly string[] | undefined;
}

export interface ReleasePreflightChecks {
  readonly iconSizes: readonly string[];
  readonly missingIconSizes: readonly string[];
  readonly missingIconFiles: readonly string[];
  readonly legalPageFiles: readonly string[];
  readonly missingLegalPageFiles: readonly string[];
  readonly legalPagesWithDraftMarkers: readonly string[];
  readonly supportMissingKeys: readonly string[];
  readonly supportConfigured: boolean;
  readonly storeMissingKeys: readonly string[];
  readonly storeConfigured: boolean;
  readonly insecureHostPermissions: readonly string[];
  readonly hostPermissionsMatchReleaseMetadata: boolean;
  readonly apiBaseUrl: string | null;
}

export interface ReleasePreflightResult {
  readonly readyForSubmission: boolean;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly manualStepsRemaining: readonly string[];
  readonly checks: ReleasePreflightChecks;
}

const REQUIRED_ICON_SIZES = ['16', '32', '48', '128'] as const;
const REQUIRED_LEGAL_PAGE_MARKERS = [
  {
    filePath: 'docs/public/privacy-policy.html',
    disallowedMarkers: ['Draft Public Page', '[Operator Name]', '[Public Contact Route]']
  },
  {
    filePath: 'docs/public/public-contact.html',
    disallowedMarkers: ['Draft Public Page', '[Operator Name]', '[Public Contact Email Or Form URL]']
  }
] as const;
const REQUIRED_SUPPORT_KEYS = [
  ['betaSupportUrl', 'SUPPORT_BETA_URL'],
  ['billingUrl', 'SUPPORT_BILLING_URL'],
  ['qualityIssueUrl', 'SUPPORT_QUALITY_URL'],
  ['b2bInquiryUrl', 'SUPPORT_B2B_URL']
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAllowedUrl(value: string | null | undefined, allowMailto: boolean): boolean {
  if (typeof value !== 'string' || value.trim() === '') {
    return false;
  }

  if (allowMailto && value.startsWith('mailto:')) {
    return true;
  }

  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function parseGeneratedRuntimeConfigSource(source: string): GeneratedRuntimeConfig {
  const prefix = 'window.__NEWS_CONTEXT_CONFIG__ =';
  const normalized = source.trim();

  if (!normalized.startsWith(prefix)) {
    throw new Error('Generated runtime config must start with window.__NEWS_CONTEXT_CONFIG__ =');
  }

  const jsonText = normalized.slice(prefix.length).trim().replace(/;$/, '');
  return JSON.parse(jsonText) as GeneratedRuntimeConfig;
}

export function evaluateReleasePreflight(input: {
  readonly manifest: GeneratedManifest;
  readonly alphaRelease: GeneratedAlphaRelease;
  readonly runtimeConfig: GeneratedRuntimeConfig;
  readonly existingRelativePaths: ReadonlySet<string>;
  readonly legalPageSources: Readonly<Record<string, string>>;
}): ReleasePreflightResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const manualStepsRemaining = [
    'Run the final stable Chrome confirmation checklist in docs/ALPHA_RELEASE_CHECKLIST.md before unlisted submission.'
  ];

  const manifestIcons = isRecord(input.manifest.icons) ? input.manifest.icons : {};
  const defaultIcons = isRecord(input.manifest.action?.default_icon)
    ? input.manifest.action?.default_icon
    : {};
  const support = input.runtimeConfig.support;
  const storeListing = input.alphaRelease.store_listing;
  const missingIconSizes: string[] = [];
  const missingIconFiles = new Set<string>();

  for (const iconSize of REQUIRED_ICON_SIZES) {
    const manifestIconPath = manifestIcons[iconSize];
    const actionIconPath = defaultIcons[iconSize];

    if (typeof manifestIconPath !== 'string' || typeof actionIconPath !== 'string') {
      missingIconSizes.push(iconSize);
      continue;
    }

    if (!input.existingRelativePaths.has(manifestIconPath.replace(/\\/g, '/'))) {
      missingIconFiles.add(manifestIconPath.replace(/\\/g, '/'));
    }

    if (!input.existingRelativePaths.has(actionIconPath.replace(/\\/g, '/'))) {
      missingIconFiles.add(actionIconPath.replace(/\\/g, '/'));
    }
  }

  if (missingIconSizes.length > 0) {
    blockers.push(`Missing manifest or action icon declarations for sizes: ${missingIconSizes.join(', ')}.`);
  }

  if (missingIconFiles.size > 0) {
    blockers.push(`Missing icon asset files: ${Array.from(missingIconFiles).join(', ')}.`);
  }

  const missingLegalPageFiles: string[] = [];
  const legalPagesWithDraftMarkers: string[] = [];

  for (const legalPage of REQUIRED_LEGAL_PAGE_MARKERS) {
    const source = input.legalPageSources[legalPage.filePath];

    if (typeof source !== 'string') {
      missingLegalPageFiles.push(legalPage.filePath);
      continue;
    }

    if (legalPage.disallowedMarkers.some((marker) => source.includes(marker))) {
      legalPagesWithDraftMarkers.push(legalPage.filePath);
    }
  }

  if (missingLegalPageFiles.length > 0) {
    blockers.push(`Missing public legal/contact source files: ${missingLegalPageFiles.join(', ')}.`);
  }

  if (legalPagesWithDraftMarkers.length > 0) {
    blockers.push(
      `Public legal/contact pages still contain draft or placeholder markers: ${legalPagesWithDraftMarkers.join(', ')}.`
    );
  }

  // This is the minimum release-safety check for host permissions today.
  // It blocks obviously unsafe localhost/http entries, but it is not yet a
  // closed allowlist for the final production host set.
  const insecureHostPermissions = [
    ...(input.manifest.host_permissions ?? []),
    ...(input.alphaRelease.host_permissions ?? [])
  ].filter((entry) => entry.includes('localhost') || entry.startsWith('http://'));

  const manifestHostPermissions = [...(input.manifest.host_permissions ?? [])].sort();
  const alphaReleaseHostPermissions = [...(input.alphaRelease.host_permissions ?? [])].sort();
  const hostPermissionsMatchReleaseMetadata =
    manifestHostPermissions.length === alphaReleaseHostPermissions.length &&
    manifestHostPermissions.every((entry, index) => entry === alphaReleaseHostPermissions[index]);

  if (insecureHostPermissions.length > 0) {
    blockers.push(`Insecure host permissions remain in the release package: ${insecureHostPermissions.join(', ')}.`);
  }

  if (!hostPermissionsMatchReleaseMetadata) {
    blockers.push('Release manifest host permissions do not exactly match alpha-release metadata.');
  }

  const apiBaseUrl = input.alphaRelease.api_base_url ?? input.runtimeConfig.apiBaseUrl ?? null;

  if (apiBaseUrl === null || !isAllowedUrl(apiBaseUrl, false)) {
    blockers.push('Alpha release metadata must carry a real https API base URL.');
  }

  const supportMissingKeys: string[] = [];

  for (const [configKey, envKey] of REQUIRED_SUPPORT_KEYS) {
    const value = isRecord(support) ? (support[configKey] as string | null | undefined) : null;

    if (!isAllowedUrl(value, true)) {
      supportMissingKeys.push(envKey);
    }
  }

  // Support CTAs are already placeholder-safe in-product. For an early unlisted alpha,
  // we warn when live operator routes are missing instead of blocking store submission.
  if (!isRecord(support) || support['channelStatus'] !== 'configured') {
    warnings.push(
      'SUPPORT_CHANNEL_STATUS is not configured. Blocked-state support CTAs will stay on placeholder-safe fallback until real routes are injected.'
    );
  }

  if (supportMissingKeys.length > 0) {
    warnings.push(
      `Support runtime routes are still placeholder-only: ${supportMissingKeys.join(', ')}. This does not block alpha submission, but blocked-state CTAs will not open a real support destination yet.`
    );
    manualStepsRemaining.push(
      'If this alpha needs live operator follow-up, inject real SUPPORT_* values before sharing it outside the core team.'
    );
  }

  manualStepsRemaining.push(
    'Create the canonical upload archive with npm.cmd run release:archive-alpha from the same rebuilt dist-alpha tree that passed preflight.'
  );

  const storeMissingKeys: string[] = [];

  // Store-listing metadata is different: Chrome Web Store submission still needs a real
  // privacy-policy URL and a public contact route, so these remain hard blockers.
  if (!isRecord(storeListing) || storeListing['status'] !== 'configured') {
    blockers.push('Store listing metadata is still placeholder-only.');
  }

  if (!isAllowedUrl(storeListing?.privacyPolicyUrl ?? null, false)) {
    storeMissingKeys.push('STORE_PRIVACY_POLICY_URL');
  }

  if (!isAllowedUrl(storeListing?.publicContactUrl ?? null, true)) {
    storeMissingKeys.push('STORE_PUBLIC_CONTACT_URL');
  }

  if (storeMissingKeys.length > 0) {
    blockers.push(`Missing store submission routes: ${storeMissingKeys.join(', ')}.`);
  }

  if (!isAllowedUrl(storeListing?.termsOfServiceUrl ?? null, false)) {
    warnings.push('STORE_TERMS_OF_SERVICE_URL is still empty. Leave it optional only if the release decision explicitly allows that.');
  }

  return {
    readyForSubmission: blockers.length === 0,
    blockers,
    warnings,
    manualStepsRemaining,
    checks: {
      iconSizes: REQUIRED_ICON_SIZES,
      missingIconSizes,
      missingIconFiles: Array.from(missingIconFiles),
      legalPageFiles: REQUIRED_LEGAL_PAGE_MARKERS.map((entry) => entry.filePath),
      missingLegalPageFiles,
      legalPagesWithDraftMarkers,
      supportMissingKeys,
      supportConfigured:
        supportMissingKeys.length === 0 && isRecord(support) && support['channelStatus'] === 'configured',
      storeMissingKeys,
      storeConfigured:
        storeMissingKeys.length === 0 && isRecord(storeListing) && storeListing['status'] === 'configured',
      insecureHostPermissions,
      hostPermissionsMatchReleaseMetadata,
      apiBaseUrl
    }
  };
}

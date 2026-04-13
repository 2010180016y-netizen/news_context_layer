const STORE_URL_OPTIONS = [
  ['store-privacy-policy-url', 'STORE_PRIVACY_POLICY_URL', 'privacyPolicyUrl', 'https'],
  ['store-terms-of-service-url', 'STORE_TERMS_OF_SERVICE_URL', 'termsOfServiceUrl', 'https'],
  ['store-public-contact-url', 'STORE_PUBLIC_CONTACT_URL', 'publicContactUrl', 'https-or-mailto']
];

export const DEFAULT_STORE_LISTING_METADATA = Object.freeze({
  privacyPolicyUrl: null,
  termsOfServiceUrl: null,
  publicContactUrl: null
});

function readArgumentValue(argv, name) {
  const prefix = `--${name}=`;
  const match = argv.find((entry) => entry.startsWith(prefix));
  return match === undefined ? null : match.slice(prefix.length);
}

function normalizeOptionalText(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function readBuildValue(argv, env, optionName, envName) {
  const argumentValue = readArgumentValue(argv, optionName);

  if (argumentValue !== null) {
    return normalizeOptionalText(argumentValue);
  }

  return normalizeOptionalText(env[envName]);
}

function normalizeUrl(value, envName, allowedScheme) {
  if (value === null) {
    return null;
  }

  if (allowedScheme === 'https-or-mailto' && value.startsWith('mailto:')) {
    return value;
  }

  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${envName} must be a valid ${allowedScheme} URL when provided.`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(
      allowedScheme === 'https-or-mailto'
        ? `${envName} must use https: or mailto: when provided.`
        : `${envName} must use https: when provided.`
    );
  }

  return parsed.toString();
}

export function resolveStoreListingMetadata(argv = process.argv.slice(2), env = process.env) {
  const listing = {
    ...DEFAULT_STORE_LISTING_METADATA
  };

  for (const [optionName, envName, configKey, allowedScheme] of STORE_URL_OPTIONS) {
    listing[configKey] = normalizeUrl(
      readBuildValue(argv, env, optionName, envName),
      envName,
      allowedScheme
    );
  }

  return listing;
}

export function buildStoreListingReleaseMetadata(argv = process.argv.slice(2), env = process.env) {
  const listing = resolveStoreListingMetadata(argv, env);
  const missingRequiredKeys = [];

  if (listing.privacyPolicyUrl === null) {
    missingRequiredKeys.push('STORE_PRIVACY_POLICY_URL');
  }

  if (listing.publicContactUrl === null) {
    missingRequiredKeys.push('STORE_PUBLIC_CONTACT_URL');
  }

  return {
    ...listing,
    status: missingRequiredKeys.length === 0 ? 'configured' : 'placeholder',
    requiredBeforeSubmissionKeys: ['STORE_PRIVACY_POLICY_URL', 'STORE_PUBLIC_CONTACT_URL'],
    recommendedKeys: ['STORE_TERMS_OF_SERVICE_URL'],
    missingRequiredKeys
  };
}

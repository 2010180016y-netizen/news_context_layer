const SUPPORT_URL_OPTIONS = [
  ['support-beta-url', 'SUPPORT_BETA_URL', 'betaSupportUrl'],
  ['support-billing-url', 'SUPPORT_BILLING_URL', 'billingUrl'],
  ['support-quality-url', 'SUPPORT_QUALITY_URL', 'qualityIssueUrl'],
  ['support-b2b-url', 'SUPPORT_B2B_URL', 'b2bInquiryUrl']
];

const SUPPORT_STATUS_VALUES = new Set(['draft', 'partial', 'configured']);

export const DEFAULT_SUPPORT_RUNTIME_CONFIG = Object.freeze({
  channelStatus: 'draft',
  responseSla: null,
  betaSupportUrl: null,
  billingUrl: null,
  qualityIssueUrl: null,
  b2bInquiryUrl: null
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

function normalizeSupportUrl(value, envName) {
  if (value === null) {
    return null;
  }

  if (value.startsWith('mailto:')) {
    return value;
  }

  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${envName} must be a valid https or mailto URL when provided.`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`${envName} must use https: or mailto: when provided.`);
  }

  return parsed.toString();
}

function normalizeChannelStatus(value) {
  if (value === null) {
    return DEFAULT_SUPPORT_RUNTIME_CONFIG.channelStatus;
  }

  if (!SUPPORT_STATUS_VALUES.has(value)) {
    throw new Error('SUPPORT_CHANNEL_STATUS must be one of draft, partial, or configured.');
  }

  return value;
}

export function resolveSupportRuntimeConfig(argv = process.argv.slice(2), env = process.env) {
  const runtimeConfig = {
    ...DEFAULT_SUPPORT_RUNTIME_CONFIG,
    channelStatus: normalizeChannelStatus(
      readBuildValue(argv, env, 'support-channel-status', 'SUPPORT_CHANNEL_STATUS')
    ),
    responseSla: readBuildValue(argv, env, 'support-response-sla', 'SUPPORT_RESPONSE_SLA')
  };

  for (const [optionName, envName, configKey] of SUPPORT_URL_OPTIONS) {
    runtimeConfig[configKey] = normalizeSupportUrl(
      readBuildValue(argv, env, optionName, envName),
      envName
    );
  }

  return runtimeConfig;
}

export function buildAlphaRuntimeConfig({
  apiBaseUrl,
  releaseChannel,
  argv = process.argv.slice(2),
  env = process.env
}) {
  return {
    apiBaseUrl: apiBaseUrl.toString().replace(/\/$/, ''),
    releaseChannel,
    support: resolveSupportRuntimeConfig(argv, env)
  };
}

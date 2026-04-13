export interface AlphaSupportRuntimeConfig {
  readonly channelStatus: 'draft' | 'partial' | 'configured';
  readonly responseSla: string | null;
  readonly betaSupportUrl: string | null;
  readonly billingUrl: string | null;
  readonly qualityIssueUrl: string | null;
  readonly b2bInquiryUrl: string | null;
}

export interface AlphaRuntimeConfig {
  readonly apiBaseUrl: string;
  readonly releaseChannel: string;
  readonly support: AlphaSupportRuntimeConfig;
}

export const DEFAULT_SUPPORT_RUNTIME_CONFIG: AlphaSupportRuntimeConfig;

export function resolveSupportRuntimeConfig(
  argv?: readonly string[],
  env?: Readonly<Record<string, string | undefined>>
): AlphaSupportRuntimeConfig;

export function buildAlphaRuntimeConfig(input: {
  readonly apiBaseUrl: URL;
  readonly releaseChannel: string;
  readonly argv?: readonly string[];
  readonly env?: Readonly<Record<string, string | undefined>>;
}): AlphaRuntimeConfig;

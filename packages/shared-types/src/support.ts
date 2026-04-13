export const SUPPORT_CHANNEL_TYPES = [
  'beta_user_support',
  'billing_issue',
  'parser_or_resolve_quality',
  'b2b_inquiry'
] as const;

export const SUPPORT_LINK_STATUSES = ['placeholder', 'configured'] as const;
export const SUPPORT_CONFIG_STATUSES = ['draft', 'partial', 'configured'] as const;

export type SupportChannelType = (typeof SUPPORT_CHANNEL_TYPES)[number];
export type SupportLinkStatus = (typeof SUPPORT_LINK_STATUSES)[number];
export type SupportConfigStatus = (typeof SUPPORT_CONFIG_STATUSES)[number];

export interface SupportChannelConfig {
  readonly type: SupportChannelType;
  readonly title: string;
  readonly description: string;
  readonly route_hint: string;
  readonly cta_label: string;
  readonly url: string | null;
  readonly status: SupportLinkStatus;
  readonly intake_fields: readonly string[];
  readonly config_key: string;
}

export interface SupportConfig {
  readonly channel_status: SupportConfigStatus;
  readonly response_sla: string;
  readonly channels: readonly SupportChannelConfig[];
}

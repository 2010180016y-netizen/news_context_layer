export declare const SUPPORT_CHANNEL_TYPES: readonly ["beta_user_support", "billing_issue", "parser_or_resolve_quality", "b2b_inquiry"];
export declare const SUPPORT_LINK_STATUSES: readonly ["placeholder", "configured"];
export declare const SUPPORT_CONFIG_STATUSES: readonly ["draft", "partial", "configured"];
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
//# sourceMappingURL=support.d.ts.map
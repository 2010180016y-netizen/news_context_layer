import type { SupportChannelConfig, SupportChannelType, SupportConfig } from '@news-context/shared-types';
export declare const SUPPORT_ENTRY_POINTS: readonly ["billing_paywall", "quality_review", "unsupported_or_error", "b2b_inquiry"];
export type SupportEntryPoint = (typeof SUPPORT_ENTRY_POINTS)[number];
interface SupportEntryPointConfig {
    readonly type: SupportEntryPoint;
    readonly channelType: SupportChannelType;
    readonly eyebrow: string;
    readonly title: string;
    readonly description: string;
    readonly actionLabel: string;
}
export declare function resolveSupportConfig(rawConfig: unknown): SupportConfig;
export declare function readSupportRuntimeConfig(): SupportConfig;
export declare function getSupportChannel(config: SupportConfig, type: SupportChannelType): SupportChannelConfig;
export declare function getSupportEntryPoint(type: SupportEntryPoint): SupportEntryPointConfig;
export declare function resolveSupportChannelTypeForEntryPoint(entryPoint: SupportEntryPoint): SupportChannelType;
export declare function getSupportChannelForEntryPoint(config: SupportConfig, entryPoint: SupportEntryPoint): SupportChannelConfig;
export declare function buildSupportFallbackNotice(channel: SupportChannelConfig, responseSla: string): string;
export declare function buildSupportEntryReadinessText(channel: SupportChannelConfig): string;
export declare function buildSupportStatusLabel(config: SupportConfig): string;
export declare function buildSupportChannelSummary(channel: SupportChannelConfig): string;
export declare function buildSupportChannelConfigSummary(channel: SupportChannelConfig): string;
export declare function buildSupportRuntimeSourceSummary(): string;
export declare function listSupportChannels(config: SupportConfig): readonly SupportChannelConfig[];
export {};
//# sourceMappingURL=support.d.ts.map
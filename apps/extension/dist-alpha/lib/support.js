const DEFAULT_SUPPORT_RESPONSE_SLA = 'Same business day acknowledgement, next-step response within 2 business days.';
const COMMON_INTAKE_FIELDS = [
    'article_url',
    'occurred_at',
    'plan_state',
    'screen_state',
    'expected_vs_actual'
];
const SUPPORT_CHANNEL_ORDER = [
    'beta_user_support',
    'billing_issue',
    'parser_or_resolve_quality',
    'b2b_inquiry'
];
export const SUPPORT_ENTRY_POINTS = [
    'billing_paywall',
    'quality_review',
    'unsupported_or_error',
    'b2b_inquiry'
];
const SUPPORT_ENTRY_POINT_CONFIG = {
    billing_paywall: {
        type: 'billing_paywall',
        channelType: 'billing_issue',
        eyebrow: '결제 문의',
        title: 'Founder Pass 결제나 unlock 상태가 기대와 다르면 바로 문의할 수 있습니다.',
        description: '결제 취소, Free 유지, checkout 완료 후 unlock 실패, plan state mismatch 같은 문제를 결제 문의 경로로 안내합니다.',
        actionLabel: '결제 문의 열기'
    },
    quality_review: {
        type: 'quality_review',
        channelType: 'parser_or_resolve_quality',
        eyebrow: '품질 제보',
        title: '맥락 결과가 어색하거나 관련 기사 연결이 이상하면 품질 제보로 이어집니다.',
        description: 'low-confidence, stale result, parser fallback, freshness/common signal mismatch가 보이면 기사 URL과 기대 결과를 함께 보내 주세요.',
        actionLabel: '품질 제보 열기'
    },
    unsupported_or_error: {
        type: 'unsupported_or_error',
        channelType: 'beta_user_support',
        eyebrow: '사용 중 문의',
        title: '지원되지 않는 페이지나 일시 오류가 반복되면 beta 문의로 이어집니다.',
        description: 'unsupported URL, side panel 열기 실패, onboarding confusion, network or runtime error를 beta 문의 경로에서 받습니다.',
        actionLabel: 'Beta 문의 열기'
    },
    b2b_inquiry: {
        type: 'b2b_inquiry',
        channelType: 'b2b_inquiry',
        eyebrow: 'B2B 문의',
        title: 'Starter Report나 pilot 미팅 문의는 B2B 경로로 바로 이어집니다.',
        description: 'sample issue report, daily briefing scaffold, JSON/CSV export, pilot follow-up은 B2B 문의 경로로 분리해 받습니다.',
        actionLabel: 'B2B 문의 열기'
    }
};
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function asOptionalString(value) {
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}
function normalizeSupportUrl(value) {
    const candidate = asOptionalString(value);
    if (candidate === null) {
        return null;
    }
    if (candidate.startsWith('mailto:')) {
        return candidate;
    }
    try {
        const parsed = new URL(candidate);
        return parsed.protocol === 'https:' ? parsed.toString() : null;
    }
    catch {
        return null;
    }
}
function buildChannel(type, url) {
    switch (type) {
        case 'beta_user_support':
            return {
                type,
                title: 'Beta 사용 중 문의',
                description: '열기, 로딩, unsupported, onboarding, 설정 동작처럼 extension side panel 사용 중 만나는 문제를 받습니다.',
                route_hint: 'extension side panel usage issue',
                cta_label: url === null ? '문의 안내 보기' : 'Beta 문의 열기',
                url,
                status: url === null ? 'placeholder' : 'configured',
                intake_fields: [...COMMON_INTAKE_FIELDS],
                config_key: 'SUPPORT_BETA_URL'
            };
        case 'billing_issue':
            return {
                type,
                title: '결제 / Founder Pass 문의',
                description: 'checkout, 결제 완료 후 unlock, 취소 후 Free 유지, plan state 반영 문제를 받습니다.',
                route_hint: 'checkout or plan-state issue',
                cta_label: url === null ? '문의 안내 보기' : '결제 문의 열기',
                url,
                status: url === null ? 'placeholder' : 'configured',
                intake_fields: [...COMMON_INTAKE_FIELDS, 'checkout_session_id'],
                config_key: 'SUPPORT_BILLING_URL'
            };
        case 'parser_or_resolve_quality':
            return {
                type,
                title: '기사 파싱 / 맥락 품질 제보',
                description: 'title 누락, low-confidence, related precision, freshness, common signal 품질 문제를 받습니다.',
                route_hint: 'parser or resolve quality issue',
                cta_label: url === null ? '제보 안내 보기' : '품질 제보 열기',
                url,
                status: url === null ? 'placeholder' : 'configured',
                intake_fields: [...COMMON_INTAKE_FIELDS, 'screenshot_optional'],
                config_key: 'SUPPORT_QUALITY_URL'
            };
        case 'b2b_inquiry':
            return {
                type,
                title: 'B2B / starter report 문의',
                description: 'sample issue report, daily briefing scaffold, JSON/CSV export, pilot 미팅 문의를 받습니다.',
                route_hint: 'starter report or pilot inquiry',
                cta_label: url === null ? '문의 안내 보기' : 'B2B 문의 열기',
                url,
                status: url === null ? 'placeholder' : 'configured',
                intake_fields: ['organization', 'use_case', 'meeting_context', 'requested_asset'],
                config_key: 'SUPPORT_B2B_URL'
            };
    }
}
function resolveChannelStatus(configuredCount, explicitStatus) {
    if (explicitStatus === 'draft' ||
        explicitStatus === 'partial' ||
        explicitStatus === 'configured') {
        return explicitStatus;
    }
    if (configuredCount === 0) {
        return 'draft';
    }
    if (configuredCount === SUPPORT_CHANNEL_ORDER.length) {
        return 'configured';
    }
    return 'partial';
}
export function resolveSupportConfig(rawConfig) {
    const record = isRecord(rawConfig) ? rawConfig : {};
    const channels = [
        buildChannel('beta_user_support', normalizeSupportUrl(record['betaSupportUrl'])),
        buildChannel('billing_issue', normalizeSupportUrl(record['billingUrl'])),
        buildChannel('parser_or_resolve_quality', normalizeSupportUrl(record['qualityIssueUrl'])),
        buildChannel('b2b_inquiry', normalizeSupportUrl(record['b2bInquiryUrl']))
    ];
    const configuredCount = channels.filter((channel) => channel.status === 'configured').length;
    const explicitStatus = asOptionalString(record['channelStatus']);
    return {
        channel_status: resolveChannelStatus(configuredCount, explicitStatus),
        response_sla: asOptionalString(record['responseSla']) ?? DEFAULT_SUPPORT_RESPONSE_SLA,
        channels
    };
}
export function readSupportRuntimeConfig() {
    const globals = globalThis;
    return resolveSupportConfig(globals.__NEWS_CONTEXT_CONFIG__?.support);
}
export function getSupportChannel(config, type) {
    const channel = config.channels.find((entry) => entry.type === type);
    if (channel === undefined) {
        throw new Error(`Unsupported support channel: ${type}`);
    }
    return channel;
}
export function getSupportEntryPoint(type) {
    return SUPPORT_ENTRY_POINT_CONFIG[type];
}
export function resolveSupportChannelTypeForEntryPoint(entryPoint) {
    return getSupportEntryPoint(entryPoint).channelType;
}
export function getSupportChannelForEntryPoint(config, entryPoint) {
    return getSupportChannel(config, resolveSupportChannelTypeForEntryPoint(entryPoint));
}
export function buildSupportFallbackNotice(channel, responseSla) {
    return `${channel.title} 문의 버튼이 아직 준비되지 않았습니다. 문의 시 ${channel.intake_fields.join(', ')} 정보를 함께 남겨 주시면 확인이 빨라집니다. 현재 목표 응답 기준은 ${responseSla}입니다.`;
}
export function buildSupportEntryReadinessText(channel) {
    if (channel.status === 'configured') {
        return '문의 버튼으로 바로 연결됩니다.';
    }
    return '문의 버튼이 아직 준비되지 않아 화면 안에서 안내만 먼저 제공합니다.';
}
export function buildSupportStatusLabel(config) {
    switch (config.channel_status) {
        case 'configured':
            return '문의 경로 준비됨';
        case 'partial':
            return '일부 경로만 연결됨';
        case 'draft':
        default:
            return '문의 경로 준비 중';
    }
}
export function buildSupportChannelSummary(channel) {
    if (channel.status === 'configured') {
        return `함께 남기면 빠른 확인에 도움이 되는 정보: ${channel.intake_fields.join(', ')}.`;
    }
    return `현재는 안내만 제공됩니다. 문의가 필요하면 ${channel.intake_fields.join(', ')} 정보를 함께 정리해 주세요.`;
}
export function buildSupportChannelConfigSummary(channel) {
    if (channel.status === 'configured') {
        return `Config key: ${channel.config_key}. Runtime link is configured. Allowed link values: https or mailto.`;
    }
    return `Config key: ${channel.config_key}. Runtime link is missing. Set a real https or mailto value before release.`;
}
export function buildSupportRuntimeSourceSummary() {
    return 'Local preview reads apps/extension/public/sidepanel/config.js. Alpha builds can override the same support keys through apps/extension/scripts/build-alpha.mjs using SUPPORT_* environment variables or --support-*-url flags.';
}
export function listSupportChannels(config) {
    return SUPPORT_CHANNEL_ORDER.map((type) => getSupportChannel(config, type));
}
//# sourceMappingURL=support.js.map
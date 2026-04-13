import { describe, expect, it } from 'vitest';

import {
  buildSupportChannelConfigSummary,
  buildSupportChannelSummary,
  buildSupportEntryReadinessText,
  buildSupportFallbackNotice,
  buildSupportRuntimeSourceSummary,
  buildSupportStatusLabel,
  getSupportChannel,
  getSupportChannelForEntryPoint,
  getSupportEntryPoint,
  resolveSupportChannelTypeForEntryPoint,
  resolveSupportConfig
} from '../src/lib/support.js';

describe('support config helpers', () => {
  it('returns placeholder channels and a safe user-facing fallback when runtime config is missing', () => {
    const config = resolveSupportConfig(undefined);
    const betaChannel = getSupportChannel(config, 'beta_user_support');

    expect(config.channel_status).toBe('draft');
    expect(config.response_sla).toBe(
      'Same business day acknowledgement, next-step response within 2 business days.'
    );
    expect(config.channels.every((channel) => channel.status === 'placeholder')).toBe(true);
    expect(buildSupportStatusLabel(config)).toBe('문의 경로 준비 중');
    expect(buildSupportEntryReadinessText(betaChannel)).toBe(
      '문의 버튼이 아직 준비되지 않아 화면 안에서 안내만 먼저 제공합니다.'
    );
    expect(buildSupportFallbackNotice(betaChannel, config.response_sla)).toContain(
      '문의 버튼이 아직 준비되지 않았습니다.'
    );
    expect(buildSupportFallbackNotice(betaChannel, config.response_sla)).not.toContain(
      'SUPPORT_BETA_URL'
    );
    expect(buildSupportChannelSummary(betaChannel)).toContain('현재는 안내만 제공됩니다.');
    expect(buildSupportChannelConfigSummary(betaChannel)).toContain(
      'Config key: SUPPORT_BETA_URL'
    );
    expect(buildSupportRuntimeSourceSummary()).toContain(
      'apps/extension/scripts/build-alpha.mjs'
    );
  });

  it('keeps configured support links and rejects unsafe or non-https values', () => {
    const config = resolveSupportConfig({
      channelStatus: 'partial',
      responseSla: 'Within 1 business day',
      betaSupportUrl: 'https://support.example/beta',
      billingUrl: 'mailto:billing@example.com',
      qualityIssueUrl: 'javascript:alert(1)',
      b2bInquiryUrl: 'http://sales.example/pilot'
    });

    expect(config.channel_status).toBe('partial');
    expect(config.response_sla).toBe('Within 1 business day');
    expect(getSupportChannel(config, 'beta_user_support')).toMatchObject({
      status: 'configured',
      url: 'https://support.example/beta'
    });
    expect(getSupportChannel(config, 'billing_issue')).toMatchObject({
      status: 'configured',
      url: 'mailto:billing@example.com'
    });
    expect(getSupportChannel(config, 'parser_or_resolve_quality')).toMatchObject({
      status: 'placeholder',
      url: null
    });
    expect(getSupportChannel(config, 'b2b_inquiry')).toMatchObject({
      status: 'placeholder',
      url: null
    });
  });

  it('maps blocked states to the correct support channels', () => {
    const config = resolveSupportConfig({
      betaSupportUrl: 'https://support.example/beta',
      billingUrl: 'mailto:billing@example.com',
      qualityIssueUrl: 'https://support.example/quality',
      b2bInquiryUrl: 'https://support.example/b2b'
    });

    expect(resolveSupportChannelTypeForEntryPoint('billing_paywall')).toBe('billing_issue');
    expect(resolveSupportChannelTypeForEntryPoint('quality_review')).toBe(
      'parser_or_resolve_quality'
    );
    expect(resolveSupportChannelTypeForEntryPoint('unsupported_or_error')).toBe(
      'beta_user_support'
    );
    expect(resolveSupportChannelTypeForEntryPoint('b2b_inquiry')).toBe('b2b_inquiry');

    expect(getSupportEntryPoint('billing_paywall')).toMatchObject({
      eyebrow: '결제 문의',
      actionLabel: '결제 문의 열기'
    });
    expect(getSupportEntryPoint('quality_review')).toMatchObject({
      eyebrow: '품질 제보'
    });
    expect(getSupportChannelForEntryPoint(config, 'unsupported_or_error')).toMatchObject({
      type: 'beta_user_support',
      url: 'https://support.example/beta'
    });
    expect(getSupportChannelForEntryPoint(config, 'b2b_inquiry')).toMatchObject({
      type: 'b2b_inquiry',
      url: 'https://support.example/b2b'
    });
  });
});

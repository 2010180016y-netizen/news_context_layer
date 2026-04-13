/* global window */

// Safe local defaults for local preview.
// Keep these support keys aligned with .env.example and docs/ops/SUPPORT_CONTACT_FLOW.md.
// Alpha/unlisted builds can override the same values through apps/extension/scripts/build-alpha.mjs.
window.__NEWS_CONTEXT_CONFIG__ = {
  apiBaseUrl: 'http://127.0.0.1:8787',
  releaseChannel: 'local',
  support: {
    channelStatus: 'draft',
    responseSla: null,
    betaSupportUrl: null,
    billingUrl: null,
    qualityIssueUrl: null,
    b2bInquiryUrl: null
  }
};

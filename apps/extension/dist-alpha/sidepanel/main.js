import { EXTENSION_NAME, FREE_WATCHLIST_LIMIT, STORAGE_KEY_CHECKOUT_RETURN } from '../lib/constants.js';
import { buildSupportChannelSummary, buildSupportEntryReadinessText, buildSupportFallbackNotice, getSupportChannelForEntryPoint, getSupportEntryPoint, buildSupportStatusLabel, getSupportChannel, listSupportChannels, readSupportRuntimeConfig } from '../lib/support.js';
import { buildArticleParseEventBundle, buildPanelOpenedEventProps, consumeCheckoutReturnSignal, createCheckoutSessionEntry, createPanelApiClient, createWatchlistEntry, deleteWatchlistEntry, getPlanLimitMessage, isPlanLimitError, loadAccountData, loadBriefing, loadOrCreateIdentity, loadPanelContext, loadParsedArticle, loadPreferences, loadResolveResponse, publishCheckoutReturnSignal, readCheckoutReturnFromWindowMessage, readCheckoutReturnFromUrl, resolvePanelApiOrigin, savePreferences, trackAnalyticsEvent, updateWatchlistEntry } from './hooks.js';
import { NewsContextApiError } from './api-client.js';
import { PANEL_PRIMARY_ROUTES, resolveInitialRoute } from './routes.js';
import { createBriefingRecoveryCopy, createDefaultPreferences, createErrorCopy, createInitialSidePanelState, createUnsupportedCopy } from './state.js';
import { buildBriefingCtaLabel, buildPlanLabel, buildPaywallDescription, buildPaywallTitle, buildResultHelperText, buildStatusBadge, buildWatchlistUsageLabel, canAccessBriefing, formatAuthorLine, formatTimestamp, hasFounderPass, isCurrentClusterSaved } from './view-model.js';
// This route is an honest fallback destination for unsupported tabs: it opens the
// Naver News home surface where the user can choose a supported article, rather
// than pretending the current unsupported tab can be resolved as-is.
const NAVER_NEWS_HOME_URL = 'https://n.news.naver.com/';
const FEEDBACK_OPTIONS = [
    { type: 'helpful', label: '이제 맥락이 보여요' },
    { type: 'unrelated', label: '관련도가 낮아요' },
    { type: 'outdated', label: '더 최신 기사 원해요' },
    { type: 'bug', label: '버그' }
];
const briefingContent = '';
let state = createInitialSidePanelState('onboarding', createDefaultPreferences());
let rootElement = null;
let activeResolveRunId = 0;
let activeCollectionsRunId = 0;
let ignoreNextCheckoutSignal = false;
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function isPrimaryRoute(route) {
    return PANEL_PRIMARY_ROUTES.includes(route);
}
function renderPrimaryNav() {
    const items = [
        { route: 'main', label: '현재 기사' },
        { route: 'watchlist', label: '저장한 이슈' },
        { route: 'plan', label: '플랜' },
        { route: 'settings', label: '설정' }
    ];
    return `
    <nav class="panel-nav" aria-label="Side panel sections">
      ${items
        .map((item) => `
            <button
              class="nav-pill ${state.route === item.route ? 'nav-pill-active' : ''}"
              data-action="navigate"
              data-route="${item.route}"
            >
              ${escapeHtml(item.label)}
            </button>
          `)
        .join('')}
    </nav>
  `;
}
function getRouteLabel(route) {
    switch (route) {
        case 'onboarding':
            return 'Setup';
        case 'loading':
            return 'Loading';
        case 'unsupported':
            return 'Unsupported';
        case 'error':
            return 'Needs attention';
        case 'main':
            return 'Current story';
        case 'watchlist':
            return 'Repeat use';
        case 'plan':
            return 'Upgrade';
        case 'settings':
            return 'Controls';
    }
}
function getSupportAvailabilityLabel(status) {
    return status === 'configured' ? '바로 문의' : '안내만 제공';
}
function renderShellMasthead() {
    // Keep a compact branded shell across every route so the side panel feels like one tool,
    // not a stack of disconnected states.
    return `
    <section class="panel-masthead">
      <div class="brand-stack">
        <div class="brand-mark">NC</div>
        <div>
          <p class="brand-kicker">${escapeHtml(getRouteLabel(state.route))}</p>
          <p class="brand-title">${escapeHtml(EXTENSION_NAME)}</p>
        </div>
      </div>
      <span class="brand-status">${escapeHtml(buildPlanLabel(state.profile))}</span>
    </section>
  `;
}
function renderNotices() {
    const parts = [];
    if (state.noticeMessage !== null) {
        parts.push(`<section class="notice-card">${escapeHtml(state.noticeMessage)}</section>`);
    }
    if (state.paywallMessage !== null) {
        const noticeEyebrow = state.paywallTrigger === 'briefing' ? '브리핑 잠금' : '저장 한도';
        const noticeTitle = state.paywallTrigger === 'briefing'
            ? '브리핑은 Founder Pass에서 먼저 엽니다.'
            : `Free는 ${FREE_WATCHLIST_LIMIT}개까지만 저장할 수 있습니다.`;
        parts.push(`
      <section class="notice-card notice-card-warning">
        <p class="eyebrow">${escapeHtml(noticeEyebrow)}</p>
        <h2 class="section-title">${escapeHtml(noticeTitle)}</h2>
        <p class="hero-copy">${escapeHtml(state.paywallMessage)}</p>
      </section>
    `);
    }
    return parts.join('');
}
function renderShell(content) {
    return `
    <main class="panel-shell panel-shell-${state.route}" data-route="${state.route}">
      ${renderShellMasthead()}
      ${isPrimaryRoute(state.route) ? renderPrimaryNav() : ''}
      ${renderNotices()}
      ${content}
    </main>
  `;
}
function renderMainMetrics() {
    const resolveResponse = state.resolveResponse;
    if (resolveResponse === null) {
        return '';
    }
    const distinctPublishers = new Set([
        resolveResponse.source_card.publisher_name,
        ...resolveResponse.related_articles.map((article) => article.publisher_name)
    ].filter((value) => typeof value === 'string' && value.trim() !== '')).size;
    const stats = [
        // These are fast-scan context signals for a 400px panel: coverage breadth, source diversity,
        // shared signals, and confidence. They intentionally summarize instead of adding more prose.
        {
            label: 'Matches',
            value: String(resolveResponse.related_articles.length),
            detail: 'same-issue articles'
        },
        {
            label: 'Sources',
            value: String(distinctPublishers),
            detail: 'distinct publishers'
        },
        {
            label: 'Signals',
            value: String(resolveResponse.common_signals.entities.length + resolveResponse.common_signals.numbers.length),
            detail: 'shared entities + numbers'
        },
        {
            label: 'Confidence',
            value: `${Math.round(resolveResponse.context_confidence * 100)}%`,
            detail: resolveResponse.state.replace(/_/g, ' ')
        }
    ];
    return `
    <section class="metrics-rail" aria-label="Context overview">
      ${stats
        .map((stat) => `
            <article class="metric-card">
              <span class="metric-label">${escapeHtml(stat.label)}</span>
              <strong class="metric-value">${escapeHtml(stat.value)}</strong>
              <span class="metric-detail">${escapeHtml(stat.detail)}</span>
            </article>
          `)
        .join('')}
    </section>
  `;
}
function renderSupportShortcut(entryPoint, overrides) {
    const supportConfig = readSupportRuntimeConfig();
    const entry = getSupportEntryPoint(entryPoint);
    const channel = getSupportChannelForEntryPoint(supportConfig, entryPoint);
    const title = overrides?.title ?? entry.title;
    const description = overrides?.description ?? entry.description;
    return `
    <section class="action-card">
      <div class="section-header section-header-tight">
        <div>
          <p class="eyebrow">${escapeHtml(entry.eyebrow)}</p>
          <h2 class="section-title">${escapeHtml(title)}</h2>
        </div>
        <span class="chip ${channel.status === 'configured' ? '' : 'chip-muted'}">${escapeHtml(getSupportAvailabilityLabel(channel.status))}</span>
      </div>
      <p class="helper-copy">${escapeHtml(description)}</p>
      <p class="helper-copy">${escapeHtml(buildSupportEntryReadinessText(channel))}</p>
      <div class="button-stack">
        <button
          class="button button-secondary"
          data-action="open-support-entry-point"
          data-entry-point="${entry.type}"
        >
          ${escapeHtml(channel.cta_label)}
        </button>
      </div>
    </section>
  `;
}
function renderOnboarding() {
    const analyticsChecked = state.preferences.analyticsOptIn ? 'checked' : '';
    // Stitch/Figma proposed a much richer editorial shell. We translate that
    // direction into the existing product scope instead of importing external
    // brand language, remote imagery, or dashboard-like navigation.
    return renderShell(`
    <section class="hero-card hero-card-editorial">
      <div class="hero-edition-row">
        <span class="edition-pill">Alpha Edition</span>
        <span class="hero-kicker">네이버 기사 옆에서 바로 보는 비교 맥락</span>
      </div>
      <div class="hero-grid">
        <div>
          <div class="hero-mark">NC</div>
          <p class="eyebrow">현재 기사 비교</p>
          <h1 class="hero-title">${escapeHtml(EXTENSION_NAME)}</h1>
          <p class="hero-copy">
            같은 이슈를 다루는 다른 보도를 한 화면에 모아, 지금 읽는 기사 옆에서 비교 흐름을 빠르게 확인합니다.
          </p>
        </div>
        <aside class="editorial-quote-card">
          <span class="quote-kicker">Launch principle</span>
          <p class="editorial-quote">
            기사 진위를 판정하지 않고, 같은 이슈를 둘러싼 보도 흐름과 공통 신호를 차분하게 보여줍니다.
          </p>
        </aside>
      </div>
      <div class="editorial-feature-grid">
        <article class="editorial-feature-card">
          <span class="feature-index">01</span>
          <strong class="feature-title">Coverage Compare</strong>
          <p class="helper-copy">현재 기사 출처와 최신성 신호를 기준으로 같은 이슈 보도 3~5개를 묶습니다.</p>
        </article>
        <article class="editorial-feature-card">
          <span class="feature-index">02</span>
          <strong class="feature-title">Repeat Use</strong>
          <p class="helper-copy">지금 본 이슈를 저장하고, 이후 다시 확인할 watchlist 흐름으로 이어집니다.</p>
        </article>
        <article class="editorial-feature-card">
          <span class="feature-index">03</span>
          <strong class="feature-title">Trust Boundary</strong>
          <p class="helper-copy">본문 전체를 영구 저장하지 않고, 비교에 필요한 메타데이터 중심으로 동작합니다.</p>
        </article>
      </div>
      <label class="consent-row">
        <span>익명 사용 통계 동의</span>
        <input type="checkbox" data-action="toggle-analytics" ${analyticsChecked} />
      </label>
      <div class="button-stack">
        <button class="button button-primary" data-action="start-context">현재 기사 비교하기</button>
        <button class="button button-secondary" data-action="skip-onboarding">나중에 하기</button>
      </div>
      <p class="legal-copy">
        버튼을 눌렀을 때만 기사 메타데이터를 비교 요청에 사용하며, 본문 전체를 영구 저장하지 않습니다.
      </p>
    </section>
    ${canAccessBriefing(state.profile)
        ? `
          <section class="related-section">
            <div class="section-header section-header-tight">
              <div>
                <p class="eyebrow">Daily Briefing</p>
                <h2 class="section-title">오늘 브리핑</h2>
              </div>
            </div>
            ${briefingContent}
          </section>
        `
        : ''}
  `);
}
function renderLoading() {
    // Keep the loading route launch-safe: this borrows the editorial pacing from
    // the design concept, but still renders entirely from local skeleton blocks.
    return renderShell(`
    <section class="panel-header panel-header-loading">
      <div>
        <div class="loading-kicker-row">
          <span class="status-dot"></span>
          <p class="eyebrow eyebrow-inline">맥락 정리 중</p>
        </div>
        <h1 class="section-title">같은 이슈 보도를 읽고 있습니다.</h1>
        <p class="loading-copy">현재 기사 출처, 공통 신호, 관련 보도 흐름을 차례로 정리합니다.</p>
      </div>
    </section>
    <section class="status-card skeleton-card loading-stage-card">
      <div class="skeleton-line skeleton-line-wide"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line skeleton-line-short"></div>
    </section>
    <section class="loading-feature-grid">
      <div class="signal-strip skeleton-card">
        <div class="skeleton-chip"></div>
        <div class="skeleton-chip"></div>
        <div class="skeleton-chip"></div>
      </div>
      <div class="status-card skeleton-card loading-side-card">
        <div class="skeleton-line skeleton-line-wide"></div>
        <div class="skeleton-line skeleton-line-short"></div>
      </div>
    </section>
    <section class="related-section">
      <div class="related-card skeleton-card"></div>
      <div class="related-card skeleton-card"></div>
      <div class="related-card skeleton-card"></div>
    </section>
  `);
}
function renderUnsupported() {
    const copy = state.unsupportedCopy;
    if (copy === null) {
        return '';
    }
    return renderShell(`
    <section class="hero-card">
      <p class="eyebrow">지원 상태</p>
      <h1 class="hero-title">${escapeHtml(copy.title)}</h1>
      <p class="hero-copy">${escapeHtml(copy.description)}</p>
      <div class="button-stack">
        <button class="button button-primary" data-action="${copy.primaryAction.type === 'open_supported_page' ? 'open-supported-page' : 'retry'}">${escapeHtml(copy.primaryAction.label)}</button>
        <button class="button button-secondary" data-action="open-supported-page">네이버 뉴스 홈 열기</button>
      </div>
    </section>
    ${renderSupportShortcut('unsupported_or_error', {
        title: '지원되지 않는 페이지나 side panel 사용 흐름 문제는 beta 사용자 지원으로 이어집니다.',
        description: '지원 페이지 안내만으로 해결되지 않으면 article URL, screen state, expected vs actual을 함께 적어 문의해 주세요.'
    })}
  `);
}
function renderError() {
    const copy = state.errorCopy;
    if (copy === null) {
        return '';
    }
    return renderShell(`
    <section class="hero-card">
      <p class="eyebrow">오류</p>
      <h1 class="hero-title">${escapeHtml(copy.title)}</h1>
      <p class="hero-copy">${escapeHtml(copy.description)}</p>
      <div class="button-stack">
        <button class="button button-primary" data-action="${copy.primaryAction.type === 'open_supported_page' ? 'open-supported-page' : 'retry'}">${escapeHtml(copy.primaryAction.label)}</button>
      </div>
    </section>
    ${renderSupportShortcut('unsupported_or_error', {
        title: '일시 오류가 반복되면 beta 사용자 지원으로 바로 연결할 수 있습니다.',
        description: 'network, timeout, runtime error는 article URL, occurred_at, screen state를 함께 보내면 재현 확인이 빨라집니다.'
    })}
  `);
}
function renderRelatedArticles() {
    const resolveResponse = state.resolveResponse;
    if (resolveResponse === null) {
        return '';
    }
    const helperText = buildResultHelperText(resolveResponse);
    return `
    <section class="related-section">
      <div class="section-header">
        <div>
          <p class="eyebrow">같은 이슈 다른 기사</p>
          <h2 class="section-title">관련 기사 ${resolveResponse.related_articles.length}건</h2>
        </div>
      </div>
      ${helperText === null ? '' : `<p class="helper-copy">${escapeHtml(helperText)}</p>`}
      <div class="related-list">
        ${resolveResponse.related_articles.length === 0
        ? '<div class="empty-helper">관련 기사를 아직 충분히 찾지 못했습니다.</div>'
        : resolveResponse.related_articles
            .map((article, index) => `
                    <button
                      class="related-card"
                      data-action="open-related"
                      data-url="${escapeHtml(article.url)}"
                      data-article-id="${escapeHtml(article.article_id)}"
                      data-publisher="${escapeHtml(article.publisher_name)}"
                      data-position="${index + 1}"
                    >
                      <div class="related-meta">
                        <span>${escapeHtml(article.publisher_name)}</span>
                        <span>${escapeHtml(formatTimestamp(article.published_at))}</span>
                      </div>
                      <strong class="related-title">${escapeHtml(article.title)}</strong>
                      <p class="related-summary">${escapeHtml(article.summary_line ?? '요약 정보 없음')}</p>
                    </button>
                  `)
            .join('')}
      </div>
    </section>
  `;
}
function renderCurrentActions() {
    const resolveResponse = state.resolveResponse;
    const clusterId = resolveResponse?.cluster_id ?? null;
    const alreadySaved = isCurrentClusterSaved(clusterId, state.watchlists);
    const saveLabel = state.actionInFlight
        ? '저장 중…'
        : alreadySaved
            ? '이미 저장한 이슈'
            : '이 이슈 저장';
    return `
    <section class="action-card">
      <div class="section-header section-header-tight">
        <div>
          <p class="eyebrow">재방문 장치</p>
          <h2 class="section-title">저장과 피드백</h2>
        </div>
        <span class="usage-chip">${escapeHtml(buildWatchlistUsageLabel(state.profile))}</span>
      </div>
      <div class="button-stack">
        <button
          class="button button-primary"
          data-action="save-watchlist"
          ${resolveResponse === null || alreadySaved || state.actionInFlight ? 'disabled' : ''}
        >
          ${escapeHtml(saveLabel)}
        </button>
        <button class="button button-secondary" data-action="navigate" data-route="watchlist">저장한 이슈 보기</button>
      </div>
      <div class="feedback-strip feedback-strip-actions">
        ${FEEDBACK_OPTIONS.map((option) => `
            <button class="chip chip-button chip-muted" data-action="submit-feedback" data-feedback="${option.type}">
              ${escapeHtml(option.label)}
            </button>
          `).join('')}
      </div>
    </section>
  `;
}
function renderMain() {
    const parsedArticle = state.parsedArticle;
    const resolveResponse = state.resolveResponse;
    if (parsedArticle === null || resolveResponse === null) {
        return '';
    }
    const badge = buildStatusBadge(resolveResponse);
    const signalNote = resolveResponse.state === 'low_confidence' || resolveResponse.common_signals.confidence < 0.5
        ? '공통 신호 정확도가 낮을 수 있습니다.'
        : null;
    const qualitySupportShortcut = resolveResponse.state === 'low_confidence' ||
        resolveResponse.state === 'insufficient_results' ||
        resolveResponse.common_signals.confidence < 0.5
        ? renderSupportShortcut('quality_review')
        : '';
    return renderShell(`
    <section class="panel-header">
      <div>
        <p class="eyebrow">현재 기사</p>
        <h1 class="section-title">이슈 비교 결과</h1>
      </div>
      <div class="header-actions">
        ${badge === null ? '' : `<span class="status-badge status-badge-${badge.tone}">${escapeHtml(badge.label)}</span>`}
        <button class="icon-button" data-action="refresh" aria-label="새로고침">↻</button>
        <button class="icon-button" data-action="navigate" data-route="settings" aria-label="설정">⚙</button>
      </div>
    </section>

    <section class="source-card source-card-editorial">
      <div class="source-card-top">
        <div>
          <p class="eyebrow">비교 기준 기사</p>
          <h2 class="source-title">${escapeHtml(resolveResponse.source_card.title)}</h2>
        </div>
        <span class="article-type-badge">${escapeHtml(resolveResponse.source_card.article_type)}</span>
      </div>
      <p class="source-context-note">지금 읽는 기사에서 같은 이슈로 묶인 보도 흐름을 정리했습니다.</p>
      <div class="source-meta">
        <span>${escapeHtml(resolveResponse.source_card.publisher_name ?? parsedArticle.publisher_name ?? '언론사 정보 없음')}</span>
        <span>${escapeHtml(formatAuthorLine(resolveResponse.source_card.author_names))}</span>
      </div>
      <div class="source-meta">
        <span>발행 ${escapeHtml(formatTimestamp(resolveResponse.source_card.published_at))}</span>
        ${resolveResponse.source_card.modified_at === null
        ? ''
        : `<span>수정 ${escapeHtml(formatTimestamp(resolveResponse.source_card.modified_at))}</span>`}
      </div>
    </section>

    ${renderMainMetrics()}

    <section class="freshness-banner freshness-${escapeHtml(resolveResponse.freshness.state)}">
      <strong>${escapeHtml(resolveResponse.freshness.message)}</strong>
      ${resolveResponse.freshness.newer_article_count === null
        ? ''
        : `<span>더 최신 기사 ${resolveResponse.freshness.newer_article_count}건</span>`}
    </section>

    <section class="signal-strip">
      <div class="signal-header">
        <p class="eyebrow">Common Signals</p>
        <span class="signal-confidence">확신도 ${Math.round(resolveResponse.common_signals.confidence * 100)}%</span>
      </div>
      <div class="chip-row">
        ${resolveResponse.common_signals.entities.length === 0
        ? '<span class="chip chip-muted">공통 개체명 없음</span>'
        : resolveResponse.common_signals.entities
            .map((entity) => `<span class="chip">${escapeHtml(entity)}</span>`)
            .join('')}
        ${resolveResponse.common_signals.numbers.length === 0
        ? '<span class="chip chip-muted">공통 숫자 없음</span>'
        : resolveResponse.common_signals.numbers
            .map((entry) => `<span class="chip chip-accent">${escapeHtml(entry)}</span>`)
            .join('')}
      </div>
      ${signalNote === null ? '' : `<p class="helper-copy">${escapeHtml(signalNote)}</p>`}
    </section>

    ${qualitySupportShortcut}
    ${renderRelatedArticles()}
    ${renderCurrentActions()}

    <p class="legal-copy legal-copy-bottom">
      이 도구는 기사 진위를 판정하지 않으며 비교와 맥락 제공을 위한 참고 기능입니다.
    </p>
  `);
}
function renderWatchlist() {
    const items = state.watchlists;
    const planLabel = buildPlanLabel(state.profile);
    const usageLabel = buildWatchlistUsageLabel(state.profile);
    const briefingLabel = buildBriefingCtaLabel(state.profile);
    const briefingContent = (() => {
        if (!canAccessBriefing(state.profile)) {
            return '';
        }
        if (state.briefingLoading) {
            return `
        <div class="related-list">
          <div class="related-card skeleton-card"></div>
          <div class="related-card skeleton-card"></div>
        </div>
      `;
        }
        if (state.briefingError !== null) {
            const recovery = createBriefingRecoveryCopy(state.briefingError);
            return `
        <div class="empty-helper">
          <strong>${escapeHtml(recovery.title)}</strong>
          <p class="helper-copy">${escapeHtml(recovery.description)}</p>
          <div class="empty-helper-actions">
            <button class="button button-secondary" data-action="open-briefing">${escapeHtml(recovery.retryLabel)}</button>
          </div>
        </div>
        ${renderSupportShortcut('unsupported_or_error', {
                title: '브리핑이 계속 열리지 않으면 beta 문의로 이어질 수 있습니다.',
                description: '브리핑을 다시 불러오지 못하면 article URL, occurred_at, screen state를 함께 남겨 주세요.'
            })}
      `;
        }
        if (state.briefing === null) {
            return '<p class="helper-copy">오늘 브리핑을 아직 불러오지 않았습니다.</p>';
        }
        if (state.briefing.items.length === 0) {
            return '<div class="empty-helper">오늘 브리핑에 담을 클러스터가 아직 충분하지 않습니다.</div>';
        }
        return `
      <div class="watchlist-list">
        ${state.briefing.items
            .map((item) => `
              <article class="watchlist-card">
                <div class="watchlist-card-top">
                  <div>
                    <strong class="watchlist-title">${escapeHtml(item.label)}</strong>
                    <p class="helper-copy">${escapeHtml(state.briefing?.date ?? '')} 브리핑</p>
                  </div>
                  <span class="chip chip-accent">새 기사 ${item.new_article_count}건</span>
                </div>
                <div class="related-list">
                  ${item.latest_articles
            .map((article) => `
                        <article class="related-card">
                          <div class="related-meta">
                            <span>${escapeHtml(article.publisher_name)}</span>
                            <span>${escapeHtml(formatTimestamp(article.published_at))}</span>
                          </div>
                          <strong class="related-title">${escapeHtml(article.title)}</strong>
                          <p class="related-summary">${escapeHtml(article.summary_line ?? '요약 정보 없음')}</p>
                        </article>
                      `)
            .join('')}
                </div>
              </article>
            `)
            .join('')}
      </div>
    `;
    })();
    void briefingContent;
    return renderShell(`
    <section class="panel-header">
      <div>
        <p class="eyebrow">개인 아카이브</p>
        <h1 class="section-title">다시 볼 이슈 목록</h1>
      </div>
      <div class="header-actions">
        <span class="status-badge status-badge-neutral">${escapeHtml(planLabel)}</span>
      </div>
    </section>

    <section class="status-card">
      <div class="section-header section-header-tight">
        <div>
          <p class="eyebrow">현재 한도</p>
          <h2 class="section-title">${escapeHtml(usageLabel)}</h2>
        </div>
      </div>
      <p class="helper-copy">
        ${hasFounderPass(state.profile)
        ? 'Founder Pass에서는 저장 한도와 브리핑 접근이 열립니다.'
        : 'Free 사용자는 이슈 1개까지만 저장할 수 있고, 브리핑은 Founder Pass에서 열립니다.'}
      </p>
    </section>

    <section class="related-section">
      <div class="section-header section-header-tight">
        <div>
          <p class="eyebrow">Saved Watchlists</p>
          <h2 class="section-title">저장한 이슈 ${items.length}개</h2>
        </div>
      </div>
      ${state.collectionsLoading && items.length === 0
        ? `
            <div class="related-list">
              <div class="related-card skeleton-card"></div>
              <div class="related-card skeleton-card"></div>
            </div>
          `
        : items.length === 0
            ? `
              <div class="empty-helper">
                아직 저장한 이슈가 없습니다.
                <div class="empty-helper-actions">
                  <button class="button button-secondary" data-action="navigate" data-route="main">현재 기사에서 저장하기</button>
                </div>
              </div>
            `
            : `
              <div class="watchlist-list">
                ${items
                .map((item) => `
                      <article class="watchlist-card">
                        <div class="watchlist-card-top">
                          <div>
                            <strong class="watchlist-title">${escapeHtml(item.label)}</strong>
                            <p class="helper-copy">마지막 업데이트 ${escapeHtml(formatTimestamp(item.last_seen_at))}</p>
                          </div>
                          <button class="icon-button icon-button-danger" data-action="delete-watchlist" data-watchlist-id="${escapeHtml(item.id)}" aria-label="삭제">✕</button>
                        </div>
                        <div class="chip-row">
                          <span class="chip chip-accent">새 기사 ${item.new_article_count}건</span>
                          ${item.plan_limit_reached
                ? '<span class="chip chip-muted">Free 한도 사용 중</span>'
                : ''}
                        </div>
                        <label class="consent-row consent-row-tight">
                          <span>업데이트 알림 준비 상태</span>
                          <input
                            type="checkbox"
                            data-action="toggle-watchlist-notifications"
                            data-watchlist-id="${escapeHtml(item.id)}"
                            ${item.notifications_enabled ? 'checked' : ''}
                          />
                        </label>
                      </article>
                    `)
                .join('')}
              </div>
            `}
    </section>

    <section class="action-card">
      <div class="section-header section-header-tight">
        <div>
          <p class="eyebrow">브리핑</p>
          <h2 class="section-title">${escapeHtml(briefingLabel)}</h2>
        </div>
      </div>
      <div class="button-stack">
        <button class="button button-primary" data-action="open-briefing">${escapeHtml(briefingLabel)}</button>
        ${hasFounderPass(state.profile)
        ? ''
        : '<button class="button button-secondary" data-action="navigate" data-route="plan">Founder Pass 보기</button>'}
      </div>
    </section>
  `);
}
function renderPlan() {
    const founderPassActive = hasFounderPass(state.profile);
    const primaryLabel = founderPassActive
        ? 'Founder Pass 활성화됨'
        : state.checkoutPending
            ? '결제 상태 확인 중…'
            : 'Founder Pass 구매';
    // The premium screen can feel more editorial, but it still has to preserve
    // the actual alpha business boundary: Founder Pass only, no team plan, no
    // SaaS pricing expansion, and no extra product scope.
    return renderShell(`
    <section class="panel-header">
      <div>
        <p class="eyebrow">플랜</p>
        <h1 class="section-title">${escapeHtml(buildPaywallTitle(state.paywallTrigger))}</h1>
      </div>
      <div class="header-actions">
        <span class="status-badge status-badge-neutral">${escapeHtml(buildPlanLabel(state.profile))}</span>
      </div>
    </section>

    <section class="hero-card hero-card-plan">
      <div class="hero-edition-row">
        <span class="edition-pill">Founder Pass</span>
        <span class="hero-kicker">반복해서 보는 이슈를 더 깊게</span>
      </div>
      <p class="hero-copy">${escapeHtml(buildPaywallDescription(state.paywallTrigger))}</p>
      ${state.paywallMessage === null
        ? ''
        : `<p class="helper-copy paywall-helper">${escapeHtml(state.paywallMessage)}</p>`}
      ${state.checkoutPending
        ? '<p class="helper-copy paywall-helper">결제 탭에서 완료하면 이 패널이 자동으로 잠금 해제를 반영합니다.</p>'
        : ''}
    </section>

    <section class="editorial-feature-grid editorial-feature-grid-plan">
      <article class="editorial-feature-card">
        <span class="feature-index">A</span>
        <strong class="feature-title">Saved Issues</strong>
        <p class="helper-copy">반복해서 보는 이슈를 더 넓게 저장하고, watchlist 흐름을 제한 없이 확장합니다.</p>
      </article>
      <article class="editorial-feature-card">
        <span class="feature-index">B</span>
        <strong class="feature-title">Daily Briefing</strong>
        <p class="helper-copy">저장한 이슈를 바탕으로 오늘의 briefing을 바로 열 수 있습니다.</p>
      </article>
      <article class="editorial-feature-card">
        <span class="feature-index">C</span>
        <strong class="feature-title">Repeat Reading</strong>
        <p class="helper-copy">한 번 보고 끝나는 비교가 아니라, 다시 확인하는 reading workflow에 맞춰 설계합니다.</p>
      </article>
    </section>

    <section class="plan-table">
      <div class="plan-grid plan-grid-head">
        <span></span>
        <strong>Free</strong>
        <strong>Founder Pass</strong>
      </div>
      <div class="plan-grid">
        <span>기사 비교</span>
        <span>가능</span>
        <span>가능</span>
      </div>
      <div class="plan-grid">
        <span>저장 가능한 이슈 수</span>
        <span>1개</span>
        <span>확장</span>
      </div>
      <div class="plan-grid">
        <span>브리핑 접근</span>
        <span>잠김</span>
        <span>열림</span>
      </div>
      <div class="plan-grid">
        <span>업데이트 알림</span>
        <span>준비 중</span>
        <span>준비 중</span>
      </div>
      <div class="plan-grid">
        <span>히스토리 확장</span>
        <span>제한</span>
        <span>확장 예정</span>
      </div>
    </section>

    <section class="action-card">
      <div class="button-stack">
        <button
          class="button button-primary"
          data-action="start-checkout"
          ${founderPassActive || state.checkoutPending ? 'disabled' : ''}
        >
          ${escapeHtml(primaryLabel)}
        </button>
        <button class="button button-secondary" data-action="navigate" data-route="main">메인으로 돌아가기</button>
      </div>
      <p class="legal-copy">
        Founder Pass는 이번 베타에서 1회 결제만 지원합니다. 정기구독과 팀 플랜은 아직 열지 않았습니다.
      </p>
    </section>
    ${renderSupportShortcut('billing_paywall')}
  `);
}
function renderSettings() {
    const analyticsChecked = state.preferences.analyticsOptIn ? 'checked' : '';
    const supportConfig = readSupportRuntimeConfig();
    const supportChannels = listSupportChannels(supportConfig).filter((channel) => channel.type !== 'b2b_inquiry');
    return renderShell(`
    <section class="panel-header">
      <div>
        <p class="eyebrow">설정 / 지원</p>
        <h1 class="section-title">읽기 환경과 문의 경로</h1>
      </div>
      <div class="header-actions">
        <span class="status-badge status-badge-neutral">${escapeHtml(buildPlanLabel(state.profile))}</span>
      </div>
    </section>

    <section class="hero-card">
      <label class="consent-row">
        <span>익명 사용 통계 동의</span>
        <input type="checkbox" data-action="toggle-analytics" ${analyticsChecked} />
      </label>
      <p class="helper-copy">
        동의한 경우에만 panel_opened, context_loaded, watchlist_saved 같은 핵심 이벤트를 전송합니다.
      </p>
      <div class="settings-grid">
        <div class="settings-item">
          <span class="settings-label">현재 플랜</span>
          <strong>${escapeHtml(buildPlanLabel(state.profile))}</strong>
        </div>
        <div class="settings-item">
          <span class="settings-label">저장 한도</span>
          <strong>${escapeHtml(buildWatchlistUsageLabel(state.profile))}</strong>
        </div>
        <div class="settings-item">
          <span class="settings-label">이메일 브리핑</span>
          <strong>${escapeHtml(canAccessBriefing(state.profile) ? 'Founder Pass 접근 가능' : 'Founder Pass에서 열림')}</strong>
        </div>
      </div>
      <p class="legal-copy">
        기사 메타데이터만 비교 요청에 사용하고, 본문 전체와 브라우저 전체 이력은 수집하지 않습니다.
      </p>
    </section>

    <section class="related-section">
      <div class="section-header section-header-tight">
        <div>
          <p class="eyebrow">Support / Contact</p>
          <h2 class="section-title">문의 경로와 운영 상태</h2>
        </div>
        <span class="usage-chip">${escapeHtml(buildSupportStatusLabel(supportConfig))}</span>
      </div>
      <p class="helper-copy">
        사용 중 문제, 결제 문의, 기사 파싱과 맥락 품질 제보는 여기서 확인할 수 있습니다. 바로 열 수 없는 항목은 화면 안에서 필요한 정보부터 안내합니다.
      </p>
      <div class="settings-grid">
        ${supportChannels
        .map((channel) => `
              <article class="settings-item">
                <div class="section-header section-header-tight">
                  <div>
                    <span class="settings-label">${escapeHtml(channel.title)}</span>
                    <strong>${escapeHtml(channel.status === 'configured' ? '문의 링크 준비됨' : '안내만 제공')}</strong>
                  </div>
                  <span class="chip ${channel.status === 'configured' ? '' : 'chip-muted'}">${escapeHtml(getSupportAvailabilityLabel(channel.status))}</span>
                </div>
                <p class="helper-copy">${escapeHtml(channel.description)}</p>
                <p class="helper-copy">${escapeHtml(buildSupportChannelSummary(channel))}</p>
                <button class="button button-secondary" data-action="open-support-channel" data-channel="${channel.type}">
                  ${escapeHtml(channel.cta_label)}
                </button>
              </article>
            `)
        .join('')}
      </div>
      <div class="settings-item">
        <span class="settings-label">Response SLA</span>
        <strong>${escapeHtml(supportConfig.response_sla)}</strong>
        <p class="helper-copy">
          문의 시 article URL, 발생 시각, 현재 plan, 화면 상태, 기대 결과와 실제 결과를 함께 남겨 주세요.
        </p>
      </div>
    </section>
  `);
}
function normalizeLaunchTrustCopy() {
    if (rootElement === null) {
        return;
    }
    if (state.route !== 'unsupported') {
        return;
    }
    const supportedPageButtons = Array.from(rootElement.querySelectorAll('[data-action="open-supported-page"]'));
    for (const button of supportedPageButtons) {
        button.textContent = '네이버 뉴스 홈 열기';
    }
    if (state.unsupportedCopy?.primaryAction.type === 'open_supported_page' &&
        supportedPageButtons.length > 1) {
        supportedPageButtons[supportedPageButtons.length - 1]?.remove();
    }
}
function render() {
    if (rootElement === null) {
        return;
    }
    switch (state.route) {
        case 'onboarding':
            rootElement.innerHTML = renderOnboarding();
            break;
        case 'loading':
            rootElement.innerHTML = renderLoading();
            break;
        case 'unsupported':
            rootElement.innerHTML = renderUnsupported();
            break;
        case 'error':
            rootElement.innerHTML = renderError();
            break;
        case 'main':
            rootElement.innerHTML = renderMain();
            break;
        case 'watchlist':
            rootElement.innerHTML = renderWatchlist();
            break;
        case 'plan':
            rootElement.innerHTML = renderPlan();
            break;
        case 'settings':
            rootElement.innerHTML = renderSettings();
            break;
    }
    normalizeLaunchTrustCopy();
    bindActions();
}
function setState(nextState) {
    state = nextState;
    render();
}
async function refreshAccountData(showLoading) {
    if (state.identity === null) {
        return;
    }
    const requestId = ++activeCollectionsRunId;
    if (showLoading) {
        setState({
            ...state,
            collectionsLoading: true
        });
    }
    try {
        const apiClient = createPanelApiClient(state.preferences);
        const accountData = await loadAccountData(apiClient, state.identity);
        if (requestId !== activeCollectionsRunId) {
            return;
        }
        setState({
            ...state,
            profile: accountData.profile,
            watchlists: accountData.watchlists,
            collectionsLoading: false
        });
    }
    catch (error) {
        if (requestId !== activeCollectionsRunId) {
            return;
        }
        setState({
            ...state,
            collectionsLoading: false,
            noticeMessage: error instanceof Error ? error.message : '저장 상태를 불러오지 못했습니다.'
        });
    }
}
async function trackPanelOpened(context) {
    if (state.identity === null || context.url === null) {
        return;
    }
    await trackAnalyticsEvent(createPanelApiClient(state.preferences), state.preferences, state.identity, 'panel_opened', await buildPanelOpenedEventProps(context));
}
async function startResolveFlow() {
    const requestId = ++activeResolveRunId;
    setState({
        ...state,
        route: 'loading',
        unsupportedCopy: null,
        errorCopy: null,
        noticeMessage: null,
        paywallMessage: null,
        paywallTrigger: null,
        checkoutPending: false
    });
    try {
        const context = await loadPanelContext();
        await trackPanelOpened(context);
        if (requestId !== activeResolveRunId) {
            return;
        }
        if (!context.supported || context.url === null) {
            if (state.identity !== null) {
                const apiClient = createPanelApiClient(state.preferences);
                const analyticsBundle = await buildArticleParseEventBundle(context, null);
                await trackAnalyticsEvent(apiClient, state.preferences, state.identity, 'article_parsed', analyticsBundle.articleParsedProps);
                if (analyticsBundle.parseFailureProps !== null) {
                    await trackAnalyticsEvent(apiClient, state.preferences, state.identity, 'parse_failure', analyticsBundle.parseFailureProps);
                }
            }
            setState({
                ...state,
                route: 'unsupported',
                context,
                parsedArticle: null,
                resolveResponse: null,
                unsupportedCopy: createUnsupportedCopy(context, null),
                noticeMessage: null,
                paywallTrigger: null,
                checkoutPending: false
            });
            return;
        }
        const parsedResponse = await loadParsedArticle();
        const article = parsedResponse.article;
        if (requestId !== activeResolveRunId) {
            return;
        }
        if (state.identity !== null) {
            const apiClient = createPanelApiClient(state.preferences);
            const analyticsBundle = await buildArticleParseEventBundle(context, article);
            await trackAnalyticsEvent(apiClient, state.preferences, state.identity, 'article_parsed', analyticsBundle.articleParsedProps);
            if (analyticsBundle.parseFailureProps !== null) {
                await trackAnalyticsEvent(apiClient, state.preferences, state.identity, 'parse_failure', analyticsBundle.parseFailureProps);
            }
        }
        if (!context.supported || article.status === 'unsupported') {
            setState({
                ...state,
                route: 'unsupported',
                context,
                parsedArticle: null,
                resolveResponse: null,
                unsupportedCopy: createUnsupportedCopy(context, article),
                noticeMessage: null,
                paywallTrigger: null,
                checkoutPending: false
            });
            return;
        }
        const apiClient = createPanelApiClient(state.preferences);
        const parsedArticle = article;
        const resolveStartedAt = performance.now();
        const resolveResponse = await loadResolveResponse(apiClient, parsedArticle);
        const resolveLatencyMs = Math.round(performance.now() - resolveStartedAt);
        if (requestId !== activeResolveRunId) {
            return;
        }
        setState({
            ...state,
            route: 'main',
            context,
            parsedArticle,
            resolveResponse,
            unsupportedCopy: null,
            errorCopy: null,
            paywallMessage: null,
            paywallTrigger: null,
            checkoutPending: false
        });
        if (state.identity !== null) {
            await trackAnalyticsEvent(apiClient, state.preferences, state.identity, 'context_loaded', {
                article_id: resolveResponse.article_id,
                cluster_id: resolveResponse.cluster_id,
                context_confidence: resolveResponse.context_confidence,
                resolve_latency_ms: resolveLatencyMs,
                related_count: resolveResponse.related_articles.length,
                freshness_state: resolveResponse.freshness.state,
                result_state: resolveResponse.state
            });
        }
        void refreshAccountData(false);
    }
    catch (error) {
        if (requestId !== activeResolveRunId) {
            return;
        }
        setState({
            ...state,
            route: 'error',
            resolveResponse: null,
            unsupportedCopy: null,
            errorCopy: createErrorCopy(error instanceof Error ? error.message : undefined),
            checkoutPending: false
        });
    }
}
async function completeOnboarding() {
    const nextPreferences = {
        ...state.preferences,
        onboardingCompleted: true
    };
    await savePreferences(nextPreferences);
    setState({
        ...state,
        preferences: nextPreferences,
        route: 'loading',
        paywallTrigger: null,
        checkoutPending: false
    });
    await startResolveFlow();
}
// Keep the secondary onboarding CTA true to its wording: dismiss setup for now,
// but do not silently trigger the same resolve flow as the primary CTA.
async function deferOnboarding() {
    const nextPreferences = {
        ...state.preferences,
        onboardingCompleted: true
    };
    await savePreferences(nextPreferences);
    setState({
        ...state,
        preferences: nextPreferences,
        route: 'watchlist',
        paywallTrigger: null,
        checkoutPending: false,
        noticeMessage: '준비가 되면 뉴스 기사에서 다시 비교를 시작할 수 있습니다.'
    });
}
async function navigateToRoute(route) {
    setState({
        ...state,
        route,
        noticeMessage: null,
        ...(route === 'plan' ? {} : { paywallMessage: null })
    });
    if ((route === 'watchlist' || route === 'plan' || route === 'settings') && state.identity !== null) {
        void refreshAccountData(true);
        return;
    }
    if (route === 'main' && state.resolveResponse === null && state.preferences.onboardingCompleted) {
        await startResolveFlow();
    }
}
function resolvePostCheckoutRoute() {
    switch (state.paywallTrigger) {
        case 'briefing':
            return 'watchlist';
        case 'watchlist_limit':
            return 'main';
        case 'upgrade_cta':
        case 'history':
        default:
            return 'plan';
    }
}
async function openPaywall(trigger, message) {
    setState({
        ...state,
        route: 'plan',
        paywallTrigger: trigger,
        paywallMessage: message,
        checkoutPending: false,
        actionInFlight: false,
        noticeMessage: null
    });
    if (state.identity !== null) {
        await trackAnalyticsEvent(createPanelApiClient(state.preferences), state.preferences, state.identity, 'paywall_viewed', {
            trigger_type: trigger ?? 'upgrade_cta',
            plan_code: state.profile?.plan.code ?? 'free'
        });
    }
}
async function handleCheckoutReturn(signal, trackPurchaseEvent) {
    if (state.identity === null) {
        return;
    }
    const apiClient = createPanelApiClient(state.preferences);
    const accountData = await loadAccountData(apiClient, state.identity);
    const nextRoute = signal.result === 'success' ? resolvePostCheckoutRoute() : 'plan';
    setState({
        ...state,
        route: nextRoute,
        profile: accountData.profile,
        watchlists: accountData.watchlists,
        checkoutPending: false,
        actionInFlight: false,
        paywallTrigger: signal.result === 'success' ? null : state.paywallTrigger,
        paywallMessage: signal.result === 'cancel' ? '결제가 취소되어 Free 플랜을 유지합니다.' : null,
        noticeMessage: signal.result === 'success'
            ? 'Founder Pass가 활성화되었습니다. 저장 한도와 브리핑 접근이 열렸습니다.'
            : '결제가 취소되어 Free 플랜을 유지합니다.'
    });
    if (trackPurchaseEvent && signal.result === 'success') {
        await trackAnalyticsEvent(apiClient, state.preferences, state.identity, 'purchase_completed', {
            plan_code: signal.plan_code,
            provider: signal.provider ?? 'mock_founder_pass',
            billing_type: 'one_time'
        });
    }
}
async function handleStartCheckout() {
    if (state.identity === null || hasFounderPass(state.profile)) {
        return;
    }
    setState({
        ...state,
        checkoutPending: true,
        actionInFlight: true,
        noticeMessage: null
    });
    try {
        const apiClient = createPanelApiClient(state.preferences);
        const session = await createCheckoutSessionEntry(apiClient, state.identity, {
            plan_code: 'founder_pass'
        });
        await trackAnalyticsEvent(apiClient, state.preferences, state.identity, 'checkout_started', {
            plan_code: 'founder_pass',
            provider: session.provider,
            trigger_type: state.paywallTrigger ?? 'upgrade_cta'
        });
        // Keep window.opener so the hosted return bridge can post the checkout outcome
        // back into the side panel without relying on a blocked chrome-extension redirect.
        const checkoutWindow = window.open(session.checkout_url, '_blank');
        if (checkoutWindow === null) {
            throw new Error('Checkout popup was blocked. Please allow popups for News Context and retry.');
        }
        setState({
            ...state,
            route: 'plan',
            checkoutPending: true,
            actionInFlight: false,
            noticeMessage: '결제 탭을 열었습니다. 완료 후 이 패널이 자동으로 갱신됩니다.'
        });
    }
    catch (error) {
        setState({
            ...state,
            checkoutPending: false,
            actionInFlight: false,
            noticeMessage: error instanceof Error ? error.message : '결제를 시작하지 못했습니다.'
        });
    }
}
async function handleBriefingAccess() {
    if (state.identity === null) {
        return;
    }
    if (canAccessBriefing(state.profile)) {
        setState({
            ...state,
            route: 'watchlist',
            briefingLoading: true,
            briefingError: null,
            noticeMessage: null
        });
        try {
            const briefing = await loadBriefing(createPanelApiClient(state.preferences), state.identity);
            setState({
                ...state,
                route: 'watchlist',
                briefing,
                briefingLoading: false,
                briefingError: null,
                noticeMessage: briefing.items.length === 0
                    ? '오늘 브리핑을 만들 데이터가 아직 충분하지 않습니다.'
                    : `오늘 브리핑 ${briefing.items.length}건을 불러왔습니다.`
            });
            return;
        }
        catch (error) {
            if (error instanceof NewsContextApiError && error.statusCode === 403) {
                await openPaywall('briefing', error.message);
                return;
            }
            setState({
                ...state,
                route: 'watchlist',
                briefingLoading: false,
                briefingError: error instanceof Error ? error.message : '브리핑을 불러오지 못했습니다.',
                noticeMessage: null
            });
            return;
        }
        setState({
            ...state,
            noticeMessage: 'Founder Pass에서 브리핑 접근이 열렸습니다. 실제 브리핑 본문은 다음 단계에서 연결됩니다.'
        });
        return;
    }
    await openPaywall('briefing', '브리핑 전체 열람은 Founder Pass에서 먼저 엽니다.');
}
async function handleSaveWatchlist() {
    if (state.identity === null || state.resolveResponse === null) {
        return;
    }
    const currentClusterId = state.resolveResponse.cluster_id;
    if (isCurrentClusterSaved(currentClusterId, state.watchlists)) {
        setState({
            ...state,
            noticeMessage: '이미 저장한 이슈입니다.'
        });
        return;
    }
    setState({
        ...state,
        actionInFlight: true,
        paywallMessage: null,
        paywallTrigger: null,
        noticeMessage: null
    });
    const apiClient = createPanelApiClient(state.preferences);
    try {
        await createWatchlistEntry(apiClient, state.identity, {
            cluster_id: currentClusterId,
            label: state.resolveResponse.source_card.title,
            notifications_enabled: true
        });
        const accountData = await loadAccountData(apiClient, state.identity);
        setState({
            ...state,
            profile: accountData.profile,
            watchlists: accountData.watchlists,
            actionInFlight: false,
            noticeMessage: '이슈를 저장했습니다.'
        });
        await trackAnalyticsEvent(apiClient, state.preferences, state.identity, 'watchlist_saved', {
            cluster_id: currentClusterId,
            plan_code: accountData.profile.plan.code,
            used_count: accountData.profile.limits.watchlists_used,
            limit_count: accountData.profile.limits.watchlists_max
        });
    }
    catch (error) {
        if (isPlanLimitError(error)) {
            await openPaywall('watchlist_limit', getPlanLimitMessage(error) ?? '저장 한도에 도달했습니다.');
            return;
        }
        setState({
            ...state,
            actionInFlight: false,
            noticeMessage: error instanceof Error ? error.message : '이슈를 저장하지 못했습니다.'
        });
    }
}
async function handleDeleteWatchlist(watchlistId) {
    if (state.identity === null) {
        return;
    }
    setState({
        ...state,
        actionInFlight: true,
        noticeMessage: null
    });
    try {
        const apiClient = createPanelApiClient(state.preferences);
        await deleteWatchlistEntry(apiClient, state.identity, watchlistId);
        const accountData = await loadAccountData(apiClient, state.identity);
        setState({
            ...state,
            profile: accountData.profile,
            watchlists: accountData.watchlists,
            actionInFlight: false,
            noticeMessage: '저장한 이슈를 삭제했습니다.'
        });
    }
    catch (error) {
        setState({
            ...state,
            actionInFlight: false,
            noticeMessage: error instanceof Error ? error.message : '저장한 이슈를 삭제하지 못했습니다.'
        });
    }
}
async function handleToggleWatchlistNotifications(watchlistId, enabled) {
    if (state.identity === null) {
        return;
    }
    try {
        const apiClient = createPanelApiClient(state.preferences);
        await updateWatchlistEntry(apiClient, state.identity, watchlistId, {
            notifications_enabled: enabled
        });
        const accountData = await loadAccountData(apiClient, state.identity);
        setState({
            ...state,
            profile: accountData.profile,
            watchlists: accountData.watchlists,
            noticeMessage: enabled ? '업데이트 알림 상태를 켰습니다.' : '업데이트 알림 상태를 껐습니다.'
        });
    }
    catch (error) {
        setState({
            ...state,
            noticeMessage: error instanceof Error ? error.message : '알림 상태를 변경하지 못했습니다.'
        });
    }
}
async function handleFeedback(feedbackType) {
    if (state.identity === null || state.resolveResponse === null) {
        return;
    }
    await trackAnalyticsEvent(createPanelApiClient(state.preferences), state.preferences, state.identity, 'feedback_submitted', {
        feedback_type: feedbackType,
        article_id: state.resolveResponse.article_id,
        cluster_id: state.resolveResponse.cluster_id,
        free_text_present: false
    });
    setState({
        ...state,
        noticeMessage: '의견 감사합니다. 다음 비교 품질 개선에 반영하겠습니다.'
    });
}
function handleOpenSupportChannel(channelType) {
    const supportConfig = readSupportRuntimeConfig();
    const channel = getSupportChannel(supportConfig, channelType);
    if (channel.url !== null) {
        window.open(channel.url, '_blank', 'noopener,noreferrer');
        setState({
            ...state,
            noticeMessage: `${channel.title} 채널을 새 탭에서 열었습니다.`
        });
        return;
    }
    setState({
        ...state,
        noticeMessage: buildSupportFallbackNotice(channel, supportConfig.response_sla)
    });
}
function handleOpenSupportEntryPoint(entryPoint) {
    const supportConfig = readSupportRuntimeConfig();
    const channel = getSupportChannelForEntryPoint(supportConfig, entryPoint);
    handleOpenSupportChannel(channel.type);
}
function bindActions() {
    if (rootElement === null) {
        return;
    }
    for (const navigationButton of Array.from(rootElement.querySelectorAll('[data-action="navigate"]'))) {
        navigationButton.addEventListener('click', () => {
            const route = navigationButton.dataset['route'];
            if (route === 'main' || route === 'watchlist' || route === 'plan' || route === 'settings') {
                void navigateToRoute(route);
            }
        });
    }
    const analyticsToggle = rootElement.querySelector('[data-action="toggle-analytics"]');
    analyticsToggle?.addEventListener('change', (event) => {
        void (async () => {
            const currentTarget = event.currentTarget;
            if (!(currentTarget instanceof HTMLInputElement)) {
                return;
            }
            const nextPreferences = {
                ...state.preferences,
                analyticsOptIn: currentTarget.checked
            };
            await savePreferences(nextPreferences);
            setState({
                ...state,
                preferences: nextPreferences,
                noticeMessage: currentTarget.checked
                    ? '익명 사용 통계를 켰습니다.'
                    : '익명 사용 통계를 끄고 추가 전송을 중단했습니다.'
            });
        })();
    });
    rootElement.querySelector('[data-action="start-context"]')?.addEventListener('click', () => {
        void completeOnboarding();
    });
    rootElement.querySelector('[data-action="skip-onboarding"]')?.addEventListener('click', () => {
        void deferOnboarding();
    });
    rootElement.querySelector('[data-action="retry"]')?.addEventListener('click', () => {
        void startResolveFlow();
    });
    rootElement.querySelector('[data-action="refresh"]')?.addEventListener('click', () => {
        void startResolveFlow();
    });
    rootElement.querySelector('[data-action="save-watchlist"]')?.addEventListener('click', () => {
        void handleSaveWatchlist();
    });
    rootElement.querySelector('[data-action="open-briefing"]')?.addEventListener('click', () => {
        void handleBriefingAccess();
    });
    rootElement.querySelector('[data-action="start-checkout"]')?.addEventListener('click', () => {
        void handleStartCheckout();
    });
    rootElement.querySelector('[data-action="open-supported-page"]')?.addEventListener('click', () => {
        window.open(NAVER_NEWS_HOME_URL, '_blank', 'noopener,noreferrer');
    });
    for (const supportButton of Array.from(rootElement.querySelectorAll('[data-action="open-support-channel"]'))) {
        supportButton.addEventListener('click', () => {
            const channel = supportButton.dataset['channel'];
            if (channel === 'beta_user_support' ||
                channel === 'billing_issue' ||
                channel === 'parser_or_resolve_quality' ||
                channel === 'b2b_inquiry') {
                handleOpenSupportChannel(channel);
            }
        });
    }
    for (const supportButton of Array.from(rootElement.querySelectorAll('[data-action="open-support-entry-point"]'))) {
        supportButton.addEventListener('click', () => {
            const entryPoint = supportButton.dataset['entryPoint'];
            if (entryPoint === 'billing_paywall' ||
                entryPoint === 'quality_review' ||
                entryPoint === 'unsupported_or_error' ||
                entryPoint === 'b2b_inquiry') {
                handleOpenSupportEntryPoint(entryPoint);
            }
        });
    }
    for (const feedbackButton of Array.from(rootElement.querySelectorAll('[data-action="submit-feedback"]'))) {
        feedbackButton.addEventListener('click', () => {
            const feedbackType = feedbackButton.dataset['feedback'];
            if (typeof feedbackType === 'string') {
                void handleFeedback(feedbackType);
            }
        });
    }
    for (const relatedButton of Array.from(rootElement.querySelectorAll('[data-action="open-related"]'))) {
        relatedButton.addEventListener('click', () => {
            const url = relatedButton.dataset['url'];
            if (url === undefined) {
                return;
            }
            if (state.identity !== null && state.resolveResponse !== null) {
                void trackAnalyticsEvent(createPanelApiClient(state.preferences), state.preferences, state.identity, 'related_article_clicked', {
                    cluster_id: state.resolveResponse.cluster_id,
                    related_article_id: relatedButton.dataset['articleId'] ?? null,
                    position: Number(relatedButton.dataset['position'] ?? '0'),
                    publisher_name: relatedButton.dataset['publisher'] ?? null
                });
            }
            window.open(url, '_blank', 'noopener,noreferrer');
        });
    }
    for (const deleteButton of Array.from(rootElement.querySelectorAll('[data-action="delete-watchlist"]'))) {
        deleteButton.addEventListener('click', () => {
            const watchlistId = deleteButton.dataset['watchlistId'];
            if (typeof watchlistId === 'string') {
                void handleDeleteWatchlist(watchlistId);
            }
        });
    }
    for (const toggle of Array.from(rootElement.querySelectorAll('[data-action="toggle-watchlist-notifications"]'))) {
        toggle.addEventListener('change', (event) => {
            const currentTarget = event.currentTarget;
            if (!(currentTarget instanceof HTMLInputElement)) {
                return;
            }
            const watchlistId = currentTarget.dataset['watchlistId'];
            if (typeof watchlistId === 'string') {
                void handleToggleWatchlistNotifications(watchlistId, currentTarget.checked);
            }
        });
    }
}
function clearCheckoutQueryParams() {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete('checkout_result');
    currentUrl.searchParams.delete('checkout_session_id');
    currentUrl.searchParams.delete('checkout_plan_code');
    currentUrl.searchParams.delete('checkout_provider');
    history.replaceState({}, document.title, currentUrl.toString());
}
function registerCheckoutSignalListener() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local' || changes[STORAGE_KEY_CHECKOUT_RETURN] === undefined) {
            return;
        }
        if (ignoreNextCheckoutSignal) {
            ignoreNextCheckoutSignal = false;
            return;
        }
        void (async () => {
            const signal = await consumeCheckoutReturnSignal();
            if (signal !== null) {
                await handleCheckoutReturn(signal, false);
            }
        })();
    });
}
function registerCheckoutReturnBridgeListener() {
    window.addEventListener('message', (event) => {
        let apiOrigin;
        try {
            apiOrigin = resolvePanelApiOrigin(state.preferences);
        }
        catch {
            return;
        }
        if (event.origin !== apiOrigin) {
            return;
        }
        const signal = readCheckoutReturnFromWindowMessage(event.data);
        if (signal === null) {
            return;
        }
        // The hosted return bridge already validated the billing outcome shape on the API side,
        // so the panel only needs to verify origin and then reuse the normal checkout handler.
        void handleCheckoutReturn(signal, true);
    });
}
async function bootstrap() {
    const root = document.getElementById('app');
    if (!(root instanceof HTMLDivElement)) {
        throw new Error('Expected side panel root element to exist.');
    }
    rootElement = root;
    registerCheckoutSignalListener();
    registerCheckoutReturnBridgeListener();
    const checkoutReturnFromUrl = readCheckoutReturnFromUrl(window.location.href);
    if (checkoutReturnFromUrl !== null) {
        ignoreNextCheckoutSignal = true;
        await publishCheckoutReturnSignal(checkoutReturnFromUrl);
        clearCheckoutQueryParams();
    }
    const [preferences, identity] = await Promise.all([
        loadPreferences(),
        loadOrCreateIdentity()
    ]);
    setState({
        ...createInitialSidePanelState(resolveInitialRoute(preferences.onboardingCompleted), preferences),
        identity
    });
    void refreshAccountData(false);
    if (checkoutReturnFromUrl !== null) {
        await handleCheckoutReturn(checkoutReturnFromUrl, true);
        return;
    }
    const storedCheckoutReturn = await consumeCheckoutReturnSignal();
    if (storedCheckoutReturn !== null) {
        await handleCheckoutReturn(storedCheckoutReturn, false);
        return;
    }
    if (preferences.onboardingCompleted) {
        await startResolveFlow();
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        void bootstrap();
    }, { once: true });
}
else {
    void bootstrap();
}
//# sourceMappingURL=main.js.map
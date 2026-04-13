export function buildResolveRequestFromParsedArticle(article) {
    return {
        url: article.url,
        ...(article.canonical_url === undefined ? {} : { canonical_url: article.canonical_url }),
        title: article.title,
        ...(article.publisher_name === undefined ? {} : { publisher_name: article.publisher_name }),
        author_names: article.author_names,
        ...(article.published_at === undefined ? {} : { published_at: article.published_at }),
        ...(article.modified_at === undefined ? {} : { modified_at: article.modified_at }),
        ...(article.article_type === undefined ? {} : { article_type: article.article_type }),
        ...(article.section === undefined ? {} : { section: article.section }),
        keywords: article.keywords,
        ...(article.body_excerpt === undefined ? {} : { body_excerpt: article.body_excerpt }),
        correction_note_detected: article.correction_note_detected,
        parse_confidence: article.parse_confidence,
        page_lang: 'ko'
    };
}
export function formatAuthorLine(authorNames) {
    if (authorNames.length === 0) {
        return '기자명 없음';
    }
    if (authorNames.length === 1) {
        return authorNames[0] ?? '기자명 없음';
    }
    return `${authorNames[0]} 외 ${authorNames.length - 1}명`;
}
export function formatTimestamp(isoTimestamp, locale = 'ko-KR') {
    if (isoTimestamp === undefined || isoTimestamp === null) {
        return '시간 정보 없음';
    }
    return new Intl.DateTimeFormat(locale, {
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    }).format(new Date(isoTimestamp));
}
export function buildResultHelperText(response) {
    if (response.state === 'low_confidence') {
        return '관련 기사 정확도가 낮을 수 있습니다. 제목과 공통 신호를 함께 확인해 주세요.';
    }
    if (response.state === 'insufficient_results') {
        return '관련 기사가 충분하지 않아 현재는 일부만 먼저 보여드리고 있습니다.';
    }
    if (response.related_articles.length < 3) {
        return '관련 기사 수가 아직 적어 비교 범위가 좁을 수 있습니다.';
    }
    return null;
}
export function buildStatusBadge(response) {
    if (response.state === 'low_confidence') {
        return {
            label: '낮은 확신',
            tone: 'warning'
        };
    }
    if (response.state === 'insufficient_results' || response.state === 'success_partial') {
        return {
            label: '부분 결과',
            tone: 'neutral'
        };
    }
    return null;
}
export function isCurrentClusterSaved(clusterId, watchlists) {
    if (clusterId === null) {
        return false;
    }
    return watchlists.some((watchlist) => watchlist.cluster_id === clusterId);
}
export function buildWatchlistUsageLabel(profile) {
    if (profile === null) {
        return '저장 한도 확인 중';
    }
    return `저장 ${profile.limits.watchlists_used}/${profile.limits.watchlists_max}`;
}
export function buildPlanLabel(profile) {
    if (profile === null) {
        return '플랜 확인 중';
    }
    switch (profile.plan.code) {
        case 'free':
            return 'Free';
        case 'founder_pass':
            return 'Founder Pass';
        default:
            return profile.plan.code;
    }
}
export function hasFounderPass(profile) {
    return profile !== null && profile.plan.code === 'founder_pass' && profile.plan.status === 'active';
}
export function canAccessBriefing(profile) {
    return profile !== null && profile.limits.briefing_enabled;
}
export function buildBriefingCtaLabel(profile) {
    return canAccessBriefing(profile) ? '브리핑 보기' : '브리핑은 Founder Pass에서 열립니다';
}
export function buildPaywallTitle(trigger) {
    switch (trigger) {
        case 'briefing':
            return '브리핑까지 이어 보려면';
        case 'upgrade_cta':
            return '더 깊게 추적하려면';
        case 'history':
            return '이슈 히스토리까지 보려면';
        case 'watchlist_limit':
        default:
            return '더 깊게 추적하려면';
    }
}
export function buildPaywallDescription(trigger) {
    switch (trigger) {
        case 'briefing':
            return '브리핑 접근과 저장 확장을 Founder Pass에서 먼저 엽니다.';
        case 'history':
            return '최근 본 이슈와 브리핑 진입은 Founder Pass 이후에 확장됩니다.';
        case 'upgrade_cta':
            return '저장, 브리핑, 더 많은 이슈 추적을 Founder Pass로 먼저 엽니다.';
        case 'watchlist_limit':
        default:
            return '저장, 브리핑, 더 많은 이슈 추적을 사용하세요.';
    }
}
//# sourceMappingURL=view-model.js.map
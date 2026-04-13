import { SUPPORTED_HOSTNAME, isSupportedNaverNewsUrl } from '../lib/constants.js';
const LOW_CONFIDENCE_THRESHOLDS = {
    jsonld: 0.82,
    meta: 0.78,
    dom: 0.72
};
const TITLE_SELECTORS = [
    '#title_area',
    '#title_area span',
    '.media_end_head_headline',
    '.newsct_article h2',
    'h2#title_area'
];
const PUBLISHER_TEXT_SELECTORS = ['.media_end_head_top_logo', '.press_logo', '.media_end_linked_more_point'];
const PUBLISHER_ALT_SELECTORS = ['.media_end_head_top_logo img', '.press_logo img'];
const AUTHOR_SELECTORS = ['.media_end_head_journalist_name', '.byline_s', '[data-author]', '.media_end_head_byline'];
const PUBLISHED_SELECTORS = ['.media_end_head_info_datestamp time', '.media_end_head_info_datestamp [data-date-time]'];
const MODIFIED_SELECTORS = ['.media_end_head_info_datestamp [data-modify-date-time]', '.media_end_head_info_datestamp time'];
const SECTION_SELECTORS = ['.media_end_categorize_item', '.Nitem_link', '.media_end_categorize em', '[data-section-name]'];
const BODY_SELECTORS = ['#dic_area', '#newsct_article', '.newsct_article', '.go_trans._article_content'];
const CORRECTION_SELECTORS = ['#dic_area', '#newsct_article', '.media_end_head_info_datestamp'];
const CORRECTION_PATTERN = /(correction|updated|정정|수정|바로잡습니다|추가)/i;
function cleanText(value) {
    if (value === undefined || value === null) {
        return undefined;
    }
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized === '' ? undefined : normalized;
}
function uniqueStrings(values) {
    return Array.from(new Set(values.filter((value) => value !== undefined)));
}
function normalizeDate(value) {
    if (value === undefined) {
        return undefined;
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
}
function normalizeUrl(value, baseUrl) {
    if (value === undefined) {
        return undefined;
    }
    try {
        const normalized = new URL(value, baseUrl);
        normalized.hash = '';
        return normalized.toString();
    }
    catch {
        return undefined;
    }
}
function chooseFirst(...values) {
    return values.find((value) => value !== undefined);
}
function splitDelimitedList(value) {
    if (value === undefined) {
        return [];
    }
    return uniqueStrings(value
        .split(/[,\u00b7/|]/)
        .map((entry) => cleanText(entry)));
}
function splitAuthorNames(value) {
    if (value === undefined) {
        return [];
    }
    const cleaned = cleanText(value
        .replace(/\s*(기자|특파원|논설위원|에디터)\b/gi, '')
        .replace(/\([^)]*\)/g, ' '));
    return cleaned === undefined ? [] : splitDelimitedList(cleaned.replace(/\s+and\s+/gi, ','));
}
function inferArticleType(typeHint, section, title) {
    const normalized = `${typeHint ?? ''} ${section ?? ''} ${title ?? ''}`.toLowerCase();
    if (normalized.includes('editorial')) {
        return 'editorial';
    }
    if (normalized.includes('opinion')) {
        return 'opinion';
    }
    if (normalized.includes('analysis') || normalized.includes('reportage')) {
        return 'analysis';
    }
    if (normalized.includes('newsarticle') || normalized.includes('article') || normalized.includes('news')) {
        return 'news';
    }
    return title === undefined ? undefined : 'news';
}
function truncateBodyExcerpt(value) {
    const cleaned = cleanText(value);
    if (cleaned === undefined) {
        return undefined;
    }
    return cleaned.length <= 280 ? cleaned : `${cleaned.slice(0, 277)}...`;
}
function buildConfidenceBucket(score) {
    if (score >= 0.9) {
        return 'high';
    }
    if (score >= 0.75) {
        return 'medium';
    }
    return 'low';
}
function collectElementTexts(document, selectors) {
    const values = [];
    for (const selector of selectors) {
        for (const node of Array.from(document.querySelectorAll(selector))) {
            const text = cleanText(node.textContent);
            if (text !== undefined) {
                values.push(text);
            }
        }
    }
    return uniqueStrings(values);
}
function collectAttributeValues(document, selectors, attributeName) {
    const values = [];
    for (const selector of selectors) {
        for (const node of Array.from(document.querySelectorAll(selector))) {
            const value = cleanText(node.getAttribute(attributeName));
            if (value !== undefined) {
                values.push(value);
            }
        }
    }
    return uniqueStrings(values);
}
function collectDateCandidates(document, selectors) {
    const values = [];
    for (const selector of selectors) {
        for (const node of Array.from(document.querySelectorAll(selector))) {
            const candidate = cleanText(node.getAttribute('datetime') ??
                node.getAttribute('data-date-time') ??
                node.getAttribute('data-modify-date-time') ??
                node.textContent);
            if (candidate !== undefined) {
                values.push(candidate);
            }
        }
    }
    return uniqueStrings(values);
}
function buildMetaMap(document) {
    const meta = {};
    for (const node of Array.from(document.querySelectorAll('meta'))) {
        const key = cleanText(node.getAttribute('property') ?? node.getAttribute('name') ?? node.getAttribute('itemprop'));
        const content = cleanText(node.getAttribute('content'));
        if (key === undefined || content === undefined) {
            continue;
        }
        const normalizedKey = key.toLowerCase();
        if (!(normalizedKey in meta)) {
            meta[normalizedKey] = content;
        }
    }
    const canonicalHref = cleanText(document.querySelector('link[rel="canonical"]')?.getAttribute('href'));
    if (canonicalHref !== undefined && !('canonical' in meta)) {
        meta['canonical'] = canonicalHref;
    }
    return meta;
}
function createEmptyDomSnapshot() {
    return {
        canonical_candidates: [],
        title_candidates: [],
        publisher_candidates: [],
        author_candidates: [],
        published_at_candidates: [],
        modified_at_candidates: [],
        section_candidates: [],
        keyword_candidates: [],
        body_candidates: [],
        correction_candidates: []
    };
}
function createEmptyLayer() {
    return {
        author_names: [],
        keywords: [],
        correction_note_detected: false
    };
}
function hasAnySnapshotSignal(snapshot) {
    return (snapshot.json_ld_blocks.length > 0 ||
        Object.keys(snapshot.meta).length > 0 ||
        snapshot.dom.canonical_candidates.length > 0 ||
        snapshot.dom.title_candidates.length > 0 ||
        snapshot.dom.publisher_candidates.length > 0 ||
        snapshot.dom.author_candidates.length > 0 ||
        snapshot.dom.published_at_candidates.length > 0 ||
        snapshot.dom.modified_at_candidates.length > 0 ||
        snapshot.dom.section_candidates.length > 0 ||
        snapshot.dom.keyword_candidates.length > 0 ||
        snapshot.dom.body_candidates.length > 0);
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function arrayFromUnknown(value) {
    if (Array.isArray(value)) {
        return value;
    }
    return value === undefined ? [] : [value];
}
function extractObjectName(value) {
    if (typeof value === 'string') {
        return cleanText(value);
    }
    if (isRecord(value)) {
        return chooseFirst(cleanText(typeof value['name'] === 'string' ? value['name'] : undefined), cleanText(typeof value['legalName'] === 'string' ? value['legalName'] : undefined), cleanText(typeof value['alternateName'] === 'string' ? value['alternateName'] : undefined));
    }
    return undefined;
}
function extractAuthorArray(value) {
    return uniqueStrings(arrayFromUnknown(value).flatMap((entry) => {
        const byName = extractObjectName(entry);
        if (byName !== undefined) {
            return splitAuthorNames(byName);
        }
        return [];
    }));
}
function extractKeywords(value) {
    if (Array.isArray(value)) {
        return uniqueStrings(value.map((entry) => (typeof entry === 'string' ? cleanText(entry) : undefined)));
    }
    if (typeof value === 'string') {
        return splitDelimitedList(value);
    }
    return [];
}
function collectJsonLdCandidates(parsed) {
    const candidates = [];
    function visit(node) {
        if (Array.isArray(node)) {
            for (const entry of node) {
                visit(entry);
            }
            return;
        }
        if (!isRecord(node)) {
            return;
        }
        candidates.push(node);
        if ('@graph' in node) {
            visit(node['@graph']);
        }
    }
    visit(parsed);
    return candidates;
}
function isArticleLike(node) {
    const typeValues = arrayFromUnknown(node['@type'])
        .map((entry) => (typeof entry === 'string' ? entry.toLowerCase() : ''))
        .filter((entry) => entry !== '');
    return typeValues.some((entry) => entry.includes('article') || entry.includes('newsarticle'));
}
function extractJsonLdLayer(blocks, baseUrl) {
    let bestLayer = createEmptyLayer();
    let bestScore = -1;
    for (const block of blocks) {
        try {
            const parsed = JSON.parse(block);
            const nodes = collectJsonLdCandidates(parsed).filter((entry) => isArticleLike(entry));
            for (const node of nodes) {
                const section = cleanText(typeof node['articleSection'] === 'string' ? node['articleSection'] : undefined);
                const title = chooseFirst(cleanText(typeof node['headline'] === 'string' ? node['headline'] : undefined), cleanText(typeof node['name'] === 'string' ? node['name'] : undefined));
                const description = chooseFirst(cleanText(typeof node['description'] === 'string' ? node['description'] : undefined), cleanText(typeof node['abstract'] === 'string' ? node['abstract'] : undefined));
                const bodyText = chooseFirst(cleanText(typeof node['articleBody'] === 'string' ? node['articleBody'] : undefined), description);
                const canonicalUrl = normalizeUrl(chooseFirst(cleanText(typeof node['url'] === 'string' ? node['url'] : undefined), cleanText(typeof node['mainEntityOfPage'] === 'string' ? node['mainEntityOfPage'] : undefined), isRecord(node['mainEntityOfPage'])
                    ? cleanText(typeof node['mainEntityOfPage']['@id'] === 'string' ? node['mainEntityOfPage']['@id'] : undefined)
                    : undefined), baseUrl);
                const publisherName = extractObjectName(node['publisher']);
                const authorNames = extractAuthorArray(node['author']);
                const publishedAt = normalizeDate(cleanText(typeof node['datePublished'] === 'string' ? node['datePublished'] : undefined));
                const modifiedAt = normalizeDate(cleanText(typeof node['dateModified'] === 'string' ? node['dateModified'] : undefined));
                const articleType = inferArticleType(arrayFromUnknown(node['@type'])
                    .map((entry) => (typeof entry === 'string' ? entry : undefined))
                    .find((entry) => entry !== undefined), section, title);
                const keywords = extractKeywords(node['keywords']);
                const layer = {
                    canonical_url: canonicalUrl,
                    title,
                    publisher_name: publisherName,
                    author_names: authorNames,
                    published_at: publishedAt,
                    modified_at: modifiedAt,
                    article_type: articleType,
                    section,
                    keywords,
                    og_description: description,
                    body_excerpt: truncateBodyExcerpt(bodyText),
                    correction_note_detected: CORRECTION_PATTERN.test(`${title ?? ''} ${bodyText ?? ''}`)
                };
                const score = (layer.title !== undefined ? 4 : 0) +
                    (layer.publisher_name !== undefined ? 2 : 0) +
                    (layer.published_at !== undefined ? 2 : 0) +
                    (layer.body_excerpt !== undefined ? 1 : 0) +
                    (layer.keywords.length > 0 ? 1 : 0);
                if (score > bestScore) {
                    bestLayer = layer;
                    bestScore = score;
                }
            }
        }
        catch {
            continue;
        }
    }
    return bestLayer;
}
function extractMetaLayer(meta, baseUrl) {
    const title = chooseFirst(meta['og:title'], meta['twitter:title'], meta['title']);
    const section = chooseFirst(meta['article:section'], meta['naver-section'], meta['section']);
    const ogDescription = chooseFirst(meta['og:description'], meta['description']);
    const bodyExcerpt = truncateBodyExcerpt(ogDescription);
    return {
        canonical_url: normalizeUrl(chooseFirst(meta['og:url'], meta['canonical']), baseUrl),
        title: cleanText(title),
        publisher_name: cleanText(chooseFirst(meta['og:site_name'], meta['application-name'], meta['site_name'])),
        author_names: uniqueStrings([
            ...splitAuthorNames(meta['author']),
            ...splitAuthorNames(meta['article:author']),
            ...splitAuthorNames(meta['twitter:creator'])
        ]),
        published_at: normalizeDate(chooseFirst(meta['article:published_time'], meta['og:regdate'], meta['og:pubdate'])),
        modified_at: normalizeDate(chooseFirst(meta['article:modified_time'], meta['og:modified_time'])),
        article_type: inferArticleType(meta['article:type'], section, title),
        section: cleanText(section),
        keywords: uniqueStrings([
            ...splitDelimitedList(meta['news_keywords']),
            ...splitDelimitedList(meta['keywords'])
        ]),
        og_description: cleanText(ogDescription),
        body_excerpt: bodyExcerpt,
        correction_note_detected: CORRECTION_PATTERN.test(`${title ?? ''} ${ogDescription ?? ''}`)
    };
}
function extractDomLayer(snapshot, baseUrl) {
    const title = snapshot.title_candidates[0];
    const section = snapshot.section_candidates[0];
    const bodyCandidate = snapshot.body_candidates[0];
    const excerpt = truncateBodyExcerpt(bodyCandidate);
    return {
        canonical_url: normalizeUrl(snapshot.canonical_candidates[0], baseUrl),
        title,
        publisher_name: snapshot.publisher_candidates[0],
        author_names: uniqueStrings(snapshot.author_candidates.flatMap((entry) => splitAuthorNames(entry))),
        published_at: normalizeDate(snapshot.published_at_candidates[0]),
        modified_at: normalizeDate(snapshot.modified_at_candidates[0]),
        article_type: inferArticleType(undefined, section, title),
        section,
        keywords: uniqueStrings(snapshot.keyword_candidates.flatMap((entry) => splitDelimitedList(entry))),
        og_description: undefined,
        body_excerpt: excerpt,
        correction_note_detected: CORRECTION_PATTERN.test(snapshot.correction_candidates.join(' '))
    };
}
function mergeField(...values) {
    return values.find((value) => value !== undefined);
}
function mergeLayers(parserPath, jsonLd, meta, dom) {
    const orderedLayers = parserPath === 'jsonld'
        ? [jsonLd, meta, dom]
        : parserPath === 'meta'
            ? [meta, jsonLd, dom]
            : [dom, jsonLd, meta];
    const [primaryLayer, secondaryLayer, tertiaryLayer] = orderedLayers;
    return {
        canonical_url: mergeField(primaryLayer.canonical_url, secondaryLayer.canonical_url, tertiaryLayer.canonical_url),
        title: mergeField(primaryLayer.title, secondaryLayer.title, tertiaryLayer.title),
        publisher_name: mergeField(primaryLayer.publisher_name, secondaryLayer.publisher_name, tertiaryLayer.publisher_name),
        author_names: uniqueStrings([...primaryLayer.author_names, ...secondaryLayer.author_names, ...tertiaryLayer.author_names]),
        published_at: mergeField(primaryLayer.published_at, secondaryLayer.published_at, tertiaryLayer.published_at),
        modified_at: mergeField(primaryLayer.modified_at, secondaryLayer.modified_at, tertiaryLayer.modified_at),
        article_type: mergeField(primaryLayer.article_type, secondaryLayer.article_type, tertiaryLayer.article_type),
        section: mergeField(primaryLayer.section, secondaryLayer.section, tertiaryLayer.section),
        keywords: uniqueStrings([...primaryLayer.keywords, ...secondaryLayer.keywords, ...tertiaryLayer.keywords]),
        og_description: mergeField(primaryLayer.og_description, secondaryLayer.og_description, tertiaryLayer.og_description),
        body_excerpt: mergeField(primaryLayer.body_excerpt, secondaryLayer.body_excerpt, tertiaryLayer.body_excerpt),
        correction_note_detected: primaryLayer.correction_note_detected ||
            secondaryLayer.correction_note_detected ||
            tertiaryLayer.correction_note_detected
    };
}
function pickParserPath(jsonLd, meta) {
    if (jsonLd.title !== undefined) {
        return 'jsonld';
    }
    if (meta.title !== undefined) {
        return 'meta';
    }
    return 'dom';
}
function computeIssues(parserPath, merged) {
    const issues = [];
    if (parserPath === 'dom') {
        issues.push('dom_fallback');
    }
    if (merged.publisher_name === undefined) {
        issues.push('missing_publisher_name');
    }
    if (merged.published_at === undefined) {
        issues.push('missing_published_at');
    }
    if (merged.article_type === undefined) {
        issues.push('missing_article_type');
    }
    if (merged.section === undefined) {
        issues.push('missing_section');
    }
    if (merged.body_excerpt === undefined) {
        issues.push('missing_body_excerpt');
    }
    if (merged.published_at !== undefined &&
        merged.modified_at !== undefined &&
        Date.parse(merged.modified_at) < Date.parse(merged.published_at)) {
        issues.push('modified_before_published');
    }
    return issues;
}
function computeParseConfidence(parserPath, merged, issues) {
    let score = parserPath === 'jsonld' ? 0.62 : parserPath === 'meta' ? 0.48 : 0.32;
    score += merged.canonical_url !== undefined ? 0.04 : 0;
    score += merged.title !== undefined ? 0.14 : 0;
    score += merged.publisher_name !== undefined ? 0.08 : 0;
    score += merged.author_names.length > 0 ? 0.05 : 0;
    score += merged.published_at !== undefined ? 0.11 : 0;
    score += merged.modified_at !== undefined ? 0.04 : 0;
    score += merged.article_type !== undefined ? 0.05 : 0;
    score += merged.section !== undefined ? 0.04 : 0;
    score += merged.keywords.length > 0 ? 0.03 : 0;
    score += merged.body_excerpt !== undefined ? 0.07 : 0;
    score += merged.correction_note_detected ? 0.02 : 0;
    if (issues.includes('dom_fallback')) {
        score -= 0.04;
    }
    if (issues.includes('missing_publisher_name')) {
        score -= 0.1;
    }
    if (issues.includes('missing_published_at')) {
        score -= 0.12;
    }
    if (issues.includes('modified_before_published')) {
        score -= 0.12;
    }
    const clamped = Math.min(1, Math.max(0, score));
    return Number(clamped.toFixed(3));
}
function isLowConfidence(parserPath, parseConfidence, status, issues) {
    if (status === 'partial') {
        return true;
    }
    if (issues.includes('modified_before_published')) {
        return true;
    }
    return parseConfidence < LOW_CONFIDENCE_THRESHOLDS[parserPath];
}
function hasPartialStatus(issues) {
    return issues.some((issue) => ['dom_fallback', 'missing_publisher_name', 'missing_published_at', 'modified_before_published'].includes(issue));
}
function buildParsedArticle(url, parserPath, merged, issues) {
    const parseConfidence = computeParseConfidence(parserPath, merged, issues);
    const confidenceBucket = buildConfidenceBucket(parseConfidence);
    const status = hasPartialStatus(issues) ? 'partial' : 'success';
    const lowConfidence = isLowConfidence(parserPath, parseConfidence, status, issues);
    return {
        status,
        parser_path: parserPath,
        url,
        ...(merged.canonical_url === undefined ? {} : { canonical_url: merged.canonical_url }),
        title: merged.title ?? '',
        ...(merged.publisher_name === undefined ? {} : { publisher_name: merged.publisher_name }),
        author_names: merged.author_names,
        ...(merged.published_at === undefined ? {} : { published_at: merged.published_at }),
        ...(merged.modified_at === undefined ? {} : { modified_at: merged.modified_at }),
        ...(merged.article_type === undefined ? {} : { article_type: merged.article_type }),
        ...(merged.section === undefined ? {} : { section: merged.section }),
        keywords: merged.keywords,
        ...(merged.og_description === undefined ? {} : { og_description: merged.og_description }),
        ...(merged.body_excerpt === undefined ? {} : { body_excerpt: merged.body_excerpt }),
        correction_note_detected: merged.correction_note_detected,
        parse_confidence: parseConfidence,
        confidence_bucket: confidenceBucket,
        low_confidence: lowConfidence,
        issues
    };
}
function createUnsupportedArticleResult(url, parserPath, failureReason, issues) {
    return {
        status: 'unsupported',
        parser_path: parserPath,
        url,
        parse_confidence: 0,
        confidence_bucket: 'low',
        low_confidence: true,
        issues,
        failure_reason: failureReason
    };
}
export function buildArticleExtractionSnapshot(document, rawUrl = document.location.href) {
    const meta = buildMetaMap(document);
    return {
        url: rawUrl,
        json_ld_blocks: Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
            .map((node) => cleanText(node.textContent))
            .filter((node) => node !== undefined),
        meta,
        dom: {
            canonical_candidates: uniqueStrings([
                cleanText(document.querySelector('link[rel="canonical"]')?.getAttribute('href')),
                cleanText(meta['canonical'])
            ]),
            title_candidates: collectElementTexts(document, TITLE_SELECTORS),
            publisher_candidates: uniqueStrings([
                ...collectAttributeValues(document, PUBLISHER_ALT_SELECTORS, 'alt'),
                ...collectElementTexts(document, PUBLISHER_TEXT_SELECTORS)
            ]),
            author_candidates: uniqueStrings([
                ...collectElementTexts(document, AUTHOR_SELECTORS),
                ...collectAttributeValues(document, AUTHOR_SELECTORS, 'data-author')
            ]),
            published_at_candidates: collectDateCandidates(document, PUBLISHED_SELECTORS),
            modified_at_candidates: collectDateCandidates(document, MODIFIED_SELECTORS),
            section_candidates: collectElementTexts(document, SECTION_SELECTORS),
            keyword_candidates: uniqueStrings([
                cleanText(meta['keywords']),
                cleanText(meta['news_keywords'])
            ]),
            body_candidates: collectElementTexts(document, BODY_SELECTORS),
            correction_candidates: collectElementTexts(document, CORRECTION_SELECTORS)
        }
    };
}
export function parseArticleSnapshot(snapshot) {
    const url = snapshot.url;
    if (!isSupportedNaverNewsUrl(url)) {
        return createUnsupportedArticleResult(url, 'dom', 'unsupported_host', ['unsupported_host']);
    }
    if (!hasAnySnapshotSignal(snapshot)) {
        return createUnsupportedArticleResult(url, 'dom', 'empty_document', ['empty_snapshot']);
    }
    const jsonLdLayer = extractJsonLdLayer(snapshot.json_ld_blocks, url);
    const metaLayer = extractMetaLayer(snapshot.meta, url);
    const domLayer = extractDomLayer(snapshot.dom, url);
    const parserPath = pickParserPath(jsonLdLayer, metaLayer);
    const merged = mergeLayers(parserPath, jsonLdLayer, metaLayer, domLayer);
    if (cleanText(merged.title) === undefined) {
        return createUnsupportedArticleResult(url, parserPath, 'missing_title', ['missing_title']);
    }
    return buildParsedArticle(url, parserPath, merged, computeIssues(parserPath, merged));
}
export function extractArticle(document, rawUrl = document.location.href) {
    if (document.location.hostname !== SUPPORTED_HOSTNAME && !isSupportedNaverNewsUrl(rawUrl)) {
        return createUnsupportedArticleResult(rawUrl, 'dom', 'unsupported_host', ['unsupported_host']);
    }
    return parseArticleSnapshot(buildArticleExtractionSnapshot(document, rawUrl));
}
export function createEmptyArticleSnapshot(url) {
    return {
        url,
        json_ld_blocks: [],
        meta: {},
        dom: createEmptyDomSnapshot()
    };
}
//# sourceMappingURL=extractArticle.js.map
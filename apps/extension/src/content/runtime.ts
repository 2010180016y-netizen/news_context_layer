import type { ArticleExtractionSnapshot } from './types.js';

export function captureArticleSnapshotRuntime(rawUrl?: string): ArticleExtractionSnapshot {
  const url = rawUrl ?? window.location.href;

  function cleanText(value: string | null | undefined): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized === '' ? undefined : normalized;
  }

  function uniqueStrings(values: readonly (string | undefined)[]): string[] {
    return Array.from(new Set(values.filter((value): value is string => value !== undefined)));
  }

  function collectElementTexts(selectors: readonly string[]): string[] {
    const values: string[] = [];

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

  function collectAttributeValues(selectors: readonly string[], attributeName: string): string[] {
    const values: string[] = [];

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

  function collectDateCandidates(selectors: readonly string[]): string[] {
    const values: string[] = [];

    for (const selector of selectors) {
      for (const node of Array.from(document.querySelectorAll(selector))) {
        const candidate = cleanText(
          node.getAttribute('datetime') ??
            node.getAttribute('data-date-time') ??
            node.getAttribute('data-modify-date-time') ??
            node.textContent
        );

        if (candidate !== undefined) {
          values.push(candidate);
        }
      }
    }

    return uniqueStrings(values);
  }

  function buildMetaMap(): Record<string, string> {
    const meta: Record<string, string> = {};

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

  const titleSelectors = [
    '#title_area',
    '#title_area span',
    '.media_end_head_headline',
    '.newsct_article h2',
    'h2#title_area'
  ] as const;
  const publisherTextSelectors = ['.media_end_head_top_logo', '.press_logo', '.media_end_linked_more_point'] as const;
  const publisherAltSelectors = ['.media_end_head_top_logo img', '.press_logo img'] as const;
  const authorSelectors = ['.media_end_head_journalist_name', '.byline_s', '[data-author]', '.media_end_head_byline'] as const;
  const publishedSelectors = ['.media_end_head_info_datestamp time', '.media_end_head_info_datestamp [data-date-time]'] as const;
  const modifiedSelectors = ['.media_end_head_info_datestamp [data-modify-date-time]', '.media_end_head_info_datestamp time'] as const;
  const sectionSelectors = ['.media_end_categorize_item', '.Nitem_link', '.media_end_categorize em', '[data-section-name]'] as const;
  const bodySelectors = ['#dic_area', '#newsct_article', '.newsct_article', '.go_trans._article_content'] as const;
  const correctionSelectors = ['#dic_area', '#newsct_article', '.media_end_head_info_datestamp'] as const;
  const meta = buildMetaMap();

  return {
    url,
    json_ld_blocks: Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .map((node) => cleanText(node.textContent))
      .filter((node): node is string => node !== undefined),
    meta,
    dom: {
      canonical_candidates: uniqueStrings([
        cleanText(document.querySelector('link[rel="canonical"]')?.getAttribute('href')),
        cleanText(meta['canonical'])
      ]),
      title_candidates: collectElementTexts(titleSelectors),
      publisher_candidates: uniqueStrings([
        ...collectAttributeValues(publisherAltSelectors, 'alt'),
        ...collectElementTexts(publisherTextSelectors)
      ]),
      author_candidates: uniqueStrings([
        ...collectElementTexts(authorSelectors),
        ...collectAttributeValues(authorSelectors, 'data-author')
      ]),
      published_at_candidates: collectDateCandidates(publishedSelectors),
      modified_at_candidates: collectDateCandidates(modifiedSelectors),
      section_candidates: collectElementTexts(sectionSelectors),
      keyword_candidates: uniqueStrings([
        cleanText(meta['keywords']),
        cleanText(meta['news_keywords'])
      ]),
      body_candidates: collectElementTexts(bodySelectors),
      correction_candidates: collectElementTexts(correctionSelectors)
    }
  };
}

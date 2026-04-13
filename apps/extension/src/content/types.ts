import type { ArticleType, ParseStatus, ParserPath } from '@news-context/shared-types';

export const PARSE_CONFIDENCE_BUCKETS = ['high', 'medium', 'low'] as const;

export type ParseConfidenceBucket = (typeof PARSE_CONFIDENCE_BUCKETS)[number];
export type ArticleParseFailureReason = 'missing_title' | 'unsupported_host' | 'empty_document';

export type ParsedFieldName =
  | 'canonical_url'
  | 'title'
  | 'publisher_name'
  | 'author_names'
  | 'published_at'
  | 'modified_at'
  | 'article_type'
  | 'section'
  | 'keywords'
  | 'og_description'
  | 'body_excerpt';

export interface ArticleDomSnapshot {
  readonly canonical_candidates: readonly string[];
  readonly title_candidates: readonly string[];
  readonly publisher_candidates: readonly string[];
  readonly author_candidates: readonly string[];
  readonly published_at_candidates: readonly string[];
  readonly modified_at_candidates: readonly string[];
  readonly section_candidates: readonly string[];
  readonly keyword_candidates: readonly string[];
  readonly body_candidates: readonly string[];
  readonly correction_candidates: readonly string[];
}

export interface ArticleExtractionSnapshot {
  readonly url: string;
  readonly json_ld_blocks: readonly string[];
  readonly meta: Readonly<Record<string, string>>;
  readonly dom: ArticleDomSnapshot;
}

export interface ParsedArticle {
  readonly status: Exclude<ParseStatus, 'unsupported'>;
  readonly parser_path: ParserPath;
  readonly url: string;
  readonly canonical_url?: string | undefined;
  readonly title: string;
  readonly publisher_name?: string | undefined;
  readonly author_names: readonly string[];
  readonly published_at?: string | undefined;
  readonly modified_at?: string | undefined;
  readonly article_type?: ArticleType | undefined;
  readonly section?: string | undefined;
  readonly keywords: readonly string[];
  readonly og_description?: string | undefined;
  readonly body_excerpt?: string | undefined;
  readonly correction_note_detected: boolean;
  readonly parse_confidence: number;
  readonly confidence_bucket: ParseConfidenceBucket;
  readonly low_confidence: boolean;
  readonly issues: readonly string[];
}

export interface UnsupportedArticleParse {
  readonly status: 'unsupported';
  readonly parser_path: ParserPath;
  readonly url: string;
  readonly parse_confidence: 0;
  readonly confidence_bucket: 'low';
  readonly low_confidence: true;
  readonly issues: readonly string[];
  readonly failure_reason: ArticleParseFailureReason;
}

export type ArticleParseResult = ParsedArticle | UnsupportedArticleParse;

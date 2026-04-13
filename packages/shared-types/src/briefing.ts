import type { ReportArticleDigest } from './reporting.js';

export interface GetBriefingRequest {
  readonly date?: string | undefined;
}

export interface BriefingResponseItem {
  readonly cluster_id: string;
  readonly label: string;
  readonly new_article_count: number;
  readonly latest_articles: readonly ReportArticleDigest[];
}

export interface BriefingResponse {
  readonly date: string;
  readonly items: readonly BriefingResponseItem[];
}

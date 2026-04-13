import type { ArticleExtractionSnapshot, ArticleParseResult } from './types.js';
export declare function buildArticleExtractionSnapshot(document: Document, rawUrl?: string): ArticleExtractionSnapshot;
export declare function parseArticleSnapshot(snapshot: ArticleExtractionSnapshot): ArticleParseResult;
export declare function extractArticle(document: Document, rawUrl?: string): ArticleParseResult;
export declare function createEmptyArticleSnapshot(url: string): ArticleExtractionSnapshot;
//# sourceMappingURL=extractArticle.d.ts.map
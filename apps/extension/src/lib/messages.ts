import type { ArticleParseResult } from '../content/types.js';

export interface PanelTabContext {
  readonly tabId: number | null;
  readonly url: string | null;
  readonly supported: boolean;
}

export interface GetPanelContextMessage {
  readonly type: 'sidepanel:get-context';
}

export interface ExtractCurrentArticleMessage {
  readonly type: 'sidepanel:extract-current-article';
}

export type SidePanelRuntimeMessage = GetPanelContextMessage | ExtractCurrentArticleMessage;

export interface GetPanelContextResponse {
  readonly ok: true;
  readonly context: PanelTabContext;
}

export interface ExtractCurrentArticleResponse {
  readonly ok: true;
  readonly context: PanelTabContext;
  readonly article: ArticleParseResult;
}

export interface RuntimeErrorResponse {
  readonly ok: false;
  readonly context: PanelTabContext | null;
  readonly error: 'missing_tab' | 'execution_failed';
  readonly message: string;
}

export type SidePanelRuntimeResponse =
  | GetPanelContextResponse
  | ExtractCurrentArticleResponse
  | RuntimeErrorResponse;

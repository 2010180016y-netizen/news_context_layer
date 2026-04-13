import type { PanelTabContext, SidePanelRuntimeMessage, SidePanelRuntimeResponse } from '../lib/messages.js';

import { captureArticleSnapshotRuntime } from '../content/runtime.js';
import { parseArticleSnapshot } from '../content/extractArticle.js';
import {
  DEFAULT_SIDEPANEL_PATH,
  EXTENSION_NAME,
  STORAGE_KEY_LAST_PANEL_CONTEXT,
  isSupportedNaverNewsUrl
} from '../lib/constants.js';

let lastPanelContext: PanelTabContext | null = null;

function buildUnsupportedArticle(url: string, issue: string) {
  return {
    status: 'unsupported' as const,
    parser_path: 'dom' as const,
    url,
    parse_confidence: 0 as const,
    confidence_bucket: 'low' as const,
    low_confidence: true as const,
    issues: [issue],
    failure_reason: 'missing_title' as const
  };
}

async function persistPanelContext(context: PanelTabContext): Promise<void> {
  lastPanelContext = context;
  await chrome.storage.local.set({
    [STORAGE_KEY_LAST_PANEL_CONTEXT]: context
  });
}

async function loadPanelContext(): Promise<PanelTabContext | null> {
  if (lastPanelContext !== null) {
    return lastPanelContext;
  }

  const stored = await chrome.storage.local.get(STORAGE_KEY_LAST_PANEL_CONTEXT);
  const candidate = stored[STORAGE_KEY_LAST_PANEL_CONTEXT];

  if (
    typeof candidate === 'object' &&
    candidate !== null &&
    'tabId' in candidate &&
    'url' in candidate &&
    'supported' in candidate
  ) {
    lastPanelContext = candidate as PanelTabContext;
    return lastPanelContext;
  }

  return null;
}

async function openSidePanelForTab(tab: chrome.tabs.Tab): Promise<void> {
  const tabId = tab.id;

  if (tabId === undefined) {
    return;
  }

  const context: PanelTabContext = {
    tabId,
    url: tab.url ?? null,
    supported: tab.url !== undefined && isSupportedNaverNewsUrl(tab.url)
  };

  await persistPanelContext(context);
  await chrome.sidePanel.setOptions({
    tabId,
    enabled: true,
    path: DEFAULT_SIDEPANEL_PATH
  });
  await chrome.sidePanel.open({ tabId });
}

async function extractCurrentArticleFromContext(context: PanelTabContext): Promise<SidePanelRuntimeResponse> {
  if (context.tabId === null || context.url === null) {
    return {
      ok: false,
      context,
      error: 'missing_tab',
      message: '현재 탭 정보를 찾을 수 없습니다.'
    };
  }

  if (!context.supported) {
    return {
      ok: true,
      context,
      article: buildUnsupportedArticle(context.url, 'unsupported_host')
    };
  }

  try {
    const [injectionResult] = await chrome.scripting.executeScript({
      target: {
        tabId: context.tabId
      },
      func: captureArticleSnapshotRuntime,
      args: [context.url]
    });
    const snapshot = injectionResult?.result;

    if (snapshot === undefined) {
      return {
        ok: false,
        context,
        error: 'execution_failed',
        message: '기사 메타데이터를 읽지 못했습니다.'
      };
    }

    return {
      ok: true,
      context: {
        ...context,
        url: snapshot.url
      },
      article: parseArticleSnapshot(snapshot)
    };
  } catch (error: unknown) {
    return {
      ok: false,
      context,
      error: 'execution_failed',
      message: error instanceof Error ? error.message : '기사 추출 중 오류가 발생했습니다.'
    };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.info(`[extension] ${EXTENSION_NAME} side panel ready`);
});

chrome.action.onClicked.addListener((tab) => {
  void openSidePanelForTab(tab);
});

chrome.runtime.onMessage.addListener((message: SidePanelRuntimeMessage, _sender, sendResponse) => {
  void (async () => {
    if (message.type === 'sidepanel:get-context') {
      const context = await loadPanelContext();

      sendResponse({
        ok: true,
        context:
          context ??
          ({
            tabId: null,
            url: null,
            supported: false
          } satisfies PanelTabContext)
      } satisfies SidePanelRuntimeResponse);
      return;
    }

    if (message.type === 'sidepanel:extract-current-article') {
      const context = await loadPanelContext();

      if (context === null) {
        sendResponse({
          ok: false,
          context: null,
          error: 'missing_tab',
          message: '현재 기사 탭을 먼저 열어 주세요.'
        } satisfies SidePanelRuntimeResponse);
        return;
      }

      sendResponse(await extractCurrentArticleFromContext(context));
    }
  })();

  return true;
});

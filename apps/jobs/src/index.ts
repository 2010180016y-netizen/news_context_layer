import { pathToFileURL } from 'node:url';

import { runRssFetchWorker } from './ingest/fetch-rss.js';
import { runSitemapIngestWorker } from './ingest/fetch-sitemap.js';
import { createTextFetcher } from './ingest/fetchers.js';
import { runPlaceholderWorker } from './workers/run-placeholder-worker.js';

export function startJobsWorker(): string {
  return runPlaceholderWorker();
}

export * from './briefing/index.js';
export { createTextFetcher, runRssFetchWorker, runSitemapIngestWorker };
export type { IngestFetchMode, TextFetcher } from './ingest/fetchers.js';

function isDirectExecution(metaUrl: string): boolean {
  const entryPath = process.argv[1];
  return entryPath !== undefined && metaUrl === pathToFileURL(entryPath).href;
}

if (isDirectExecution(import.meta.url)) {
  startJobsWorker();
}

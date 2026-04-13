import type { AppDescriptor } from '@news-context/shared-types';

export interface WorkerLogger {
  info(message: string): void;
}

export const jobsDescriptor: AppDescriptor = {
  id: 'jobs',
  displayName: 'News Context Jobs',
  stage: 'skeleton',
};

export function buildPlaceholderMessage(): string {
  return 'jobs placeholder worker is ready for ingest and feature pipelines.';
}

export function runPlaceholderWorker(logger: WorkerLogger = console): string {
  const message = buildPlaceholderMessage();
  logger.info(message);
  return message;
}

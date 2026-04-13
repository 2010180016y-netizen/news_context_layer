import { randomUUID } from 'node:crypto';

import type {
  FeedRecord,
  FeedSeedLoadSummary,
  FeedSourceSeed,
  FeedWithPublisher,
  FeedRepositoryPort,
  FeedType,
  PublisherRecord
} from '@news-context/shared-types';

import type { FileNewsContextStore } from './file-store.js';

function composePublisherNotes(seed: FeedSourceSeed): string {
  return [
    seed.notes,
    `parser_order=${seed.parser_order.join('>')}`,
    `article_type_detection=${seed.article_type_detection}`,
    `seed_status=${seed.status}`
  ].join(' | ');
}

function isPublisherActive(seed: FeedSourceSeed): boolean {
  return seed.status !== 'blocked' && seed.status !== 'paused';
}

export class FeedRepository implements FeedRepositoryPort {
  public constructor(private readonly store: FileNewsContextStore) {}

  public async upsertFromSeed(seeds: readonly FeedSourceSeed[]): Promise<FeedSeedLoadSummary> {
    return this.store.writeState((state) => {
      let insertedPublishers = 0;
      let updatedPublishers = 0;
      let insertedFeeds = 0;
      let updatedFeeds = 0;

      for (const seed of seeds) {
        let publisher = state.publishers.find((entry) => entry.domain === seed.domain);
        const nowIso = new Date().toISOString();

        if (publisher === undefined) {
          publisher = {
            id: randomUUID(),
            name: seed.publisher_name,
            domain: seed.domain,
            is_active: isPublisherActive(seed),
            rss_supported: seed.feeds.some((feed) => feed.feed_type === 'rss'),
            notes: composePublisherNotes(seed),
            created_at: nowIso,
            updated_at: nowIso
          } satisfies PublisherRecord;
          state.publishers.push(publisher);
          insertedPublishers += 1;
        } else {
          publisher.name = seed.publisher_name;
          publisher.is_active = isPublisherActive(seed);
          publisher.rss_supported = seed.feeds.some((feed) => feed.feed_type === 'rss');
          publisher.notes = composePublisherNotes(seed);
          publisher.updated_at = nowIso;
          updatedPublishers += 1;
        }

        for (const feedSeed of seed.feeds) {
          const existingFeed = state.feeds.find(
            (entry) =>
              entry.publisher_id === publisher.id &&
              entry.feed_type === feedSeed.feed_type &&
              entry.url === feedSeed.url
          );

          if (existingFeed === undefined) {
            state.feeds.push({
              id: randomUUID(),
              publisher_id: publisher.id,
              feed_type: feedSeed.feed_type,
              url: feedSeed.url,
              section: feedSeed.section,
              status: feedSeed.status,
              last_fetched_at: null,
              last_error: null,
              created_at: nowIso,
              updated_at: nowIso
            } satisfies FeedRecord);
            insertedFeeds += 1;
          } else {
            existingFeed.section = feedSeed.section;
            existingFeed.status = feedSeed.status;
            existingFeed.updated_at = nowIso;
            updatedFeeds += 1;
          }
        }
      }

      return {
        inserted_publishers: insertedPublishers,
        updated_publishers: updatedPublishers,
        inserted_feeds: insertedFeeds,
        updated_feeds: updatedFeeds
      } satisfies FeedSeedLoadSummary;
    });
  }

  public async listFeedsByType(feedType: FeedType): Promise<FeedWithPublisher[]> {
    const state = await this.store.readState();

    return state.feeds
      .filter((feed) => feed.feed_type === feedType && feed.status === 'active')
      .map((feed) => {
        const publisher = state.publishers.find((entry) => entry.id === feed.publisher_id);

        if (publisher === undefined) {
          throw new Error(`Publisher ${feed.publisher_id} not found for feed ${feed.id}.`);
        }

        return {
          ...feed,
          publisher_name: publisher.name,
          publisher_domain: publisher.domain
        } satisfies FeedWithPublisher;
      });
  }

  public async markFetchResult(feedId: string, fetchedAt: string, errorMessage: string | null): Promise<void> {
    await this.store.writeState((state) => {
      const feed = state.feeds.find((entry) => entry.id === feedId);

      if (feed === undefined) {
        throw new Error(`Feed ${feedId} not found.`);
      }

      feed.last_fetched_at = fetchedAt;
      feed.last_error = errorMessage;
      feed.updated_at = fetchedAt;

      if (errorMessage !== null) {
        feed.status = 'error';
      } else if (feed.status === 'error') {
        feed.status = 'active';
      }
    });
  }
}

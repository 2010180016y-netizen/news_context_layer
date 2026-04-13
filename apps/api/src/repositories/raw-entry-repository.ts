import { createHash, randomUUID } from 'node:crypto';

import type {
  RawEntryRecord,
  RawEntryRepositoryPort,
  RawEntryUpsertInput,
  RawEntryUpsertSummary
} from '@news-context/shared-types';

import type { FileNewsContextStore } from './file-store.js';

function buildRawEntryIdentity(entry: {
  feed_id: string;
  source_guid: string | null;
  source_url: string;
  title: string | undefined;
  published_at: string | undefined;
}): string {
  if (entry.source_guid !== null) {
    return `guid:${entry.feed_id}:${entry.source_guid}`;
  }

  const hash = createHash('sha256');
  hash.update(entry.feed_id);
  hash.update('|');
  hash.update(entry.source_url);
  hash.update('|');
  hash.update(entry.title ?? '');
  hash.update('|');
  hash.update(entry.published_at ?? '');

  return `hash:${hash.digest('hex')}`;
}

function rawEntryIdentity(record: RawEntryRecord): string {
  return buildRawEntryIdentity({
    feed_id: record.feed_id,
    source_guid: record.source_guid,
    source_url: record.source_url,
    title: record.raw_payload.title,
    published_at: record.raw_payload.published_at
  });
}

export class RawEntryRepository implements RawEntryRepositoryPort {
  public constructor(private readonly store: FileNewsContextStore) {}

  public async upsertEntries(entries: readonly RawEntryUpsertInput[]): Promise<RawEntryUpsertSummary> {
    return this.store.writeState((state) => {
      let inserted = 0;
      let updated = 0;
      const savedEntries: RawEntryRecord[] = [];

      for (const entry of entries) {
        const identity = buildRawEntryIdentity({
          feed_id: entry.feed_id,
          source_guid: entry.source_guid,
          source_url: entry.source_url,
          title: entry.raw_payload.title,
          published_at: entry.raw_payload.published_at
        });

        const existing = state.raw_entries.find((record) => rawEntryIdentity(record) === identity);

        if (existing === undefined) {
          const created: RawEntryRecord = {
            id: randomUUID(),
            feed_id: entry.feed_id,
            source_guid: entry.source_guid,
            source_url: entry.source_url,
            raw_payload: {
              ...entry.raw_payload
            },
            fetched_at: entry.fetched_at,
            normalized: false,
            normalized_at: null,
            created_at: entry.fetched_at
          };
          state.raw_entries.push(created);
          savedEntries.push(created);
          inserted += 1;
          continue;
        }

        existing.source_url = entry.source_url;
        existing.raw_payload = {
          ...entry.raw_payload
        };
        existing.fetched_at = entry.fetched_at;
        existing.normalized = false;
        existing.normalized_at = null;
        savedEntries.push(existing);
        updated += 1;
      }

      return {
        inserted,
        updated,
        entries: savedEntries
      } satisfies RawEntryUpsertSummary;
    });
  }

  public async markNormalized(entryIds: readonly string[], normalizedAt: string): Promise<void> {
    await this.store.writeState((state) => {
      const idSet = new Set(entryIds);

      for (const entry of state.raw_entries) {
        if (!idSet.has(entry.id)) {
          continue;
        }

        entry.normalized = true;
        entry.normalized_at = normalizedAt;
      }
    });
  }
}

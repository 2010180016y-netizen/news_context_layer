-- news-context v1 Gate 2 storage foundation
-- Source of truth: docs/06_DB_Schema.sql
-- Notes:
--   - Production target remains PostgreSQL/Supabase.
--   - Device-linked briefings are enabled here to match the current anonymous auth lock.
-- Recommended extensions:
-- create extension if not exists pgcrypto;
-- create extension if not exists citext;

create table if not exists publishers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text not null unique,
  is_active boolean not null default true,
  rss_supported boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists feeds (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid references publishers(id) on delete cascade,
  feed_type text not null check (feed_type in ('rss','sitemap','search_fallback')),
  url text not null,
  section text,
  status text not null default 'active' check (status in ('active','paused','error')),
  last_fetched_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists raw_entries (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid references feeds(id) on delete cascade,
  source_guid text,
  source_url text not null,
  raw_payload jsonb,
  fetched_at timestamptz not null default now(),
  normalized boolean not null default false,
  normalized_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists raw_entries_feed_guid_uq
on raw_entries(feed_id, source_guid)
where source_guid is not null;

create table if not exists canonical_articles (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid references publishers(id) on delete set null,
  canonical_url text not null,
  source_url text not null,
  title text not null,
  subtitle text,
  author_json jsonb,
  published_at timestamptz,
  modified_at timestamptz,
  article_type text not null default 'unknown' check (article_type in ('news','opinion','analysis','editorial','unknown')),
  section text,
  excerpt text,
  thumbnail_url text,
  language_code text not null default 'ko',
  hash_title text,
  status text not null default 'active' check (status in ('active','archived','blocked')),
  parse_confidence numeric(5,4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists canonical_articles_canonical_url_uq
on canonical_articles(canonical_url);

create index if not exists canonical_articles_published_at_idx
on canonical_articles(published_at desc);

create index if not exists canonical_articles_publisher_published_idx
on canonical_articles(publisher_id, published_at desc);

create index if not exists canonical_articles_article_type_idx
on canonical_articles(article_type);

create table if not exists article_versions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references canonical_articles(id) on delete cascade,
  version_no integer not null,
  title text not null,
  excerpt text,
  published_at timestamptz,
  modified_at timestamptz,
  change_reason text,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(article_id, version_no)
);

create table if not exists article_features (
  article_id uuid primary key references canonical_articles(id) on delete cascade,
  title_tokens text[] default '{}',
  entities_json jsonb default '[]'::jsonb,
  numbers_json jsonb default '[]'::jsonb,
  keywords_json jsonb default '[]'::jsonb,
  embedding jsonb,
  feature_version text not null default 'v1',
  computed_at timestamptz not null default now()
);

create table if not exists story_clusters (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  status text not null default 'active' check (status in ('active','warm','archived')),
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  article_count integer not null default 0,
  top_entities_json jsonb default '[]'::jsonb,
  top_numbers_json jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists story_clusters_last_seen_idx
on story_clusters(last_seen_at desc);

create index if not exists story_clusters_status_idx
on story_clusters(status);

create table if not exists cluster_members (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references story_clusters(id) on delete cascade,
  article_id uuid not null references canonical_articles(id) on delete cascade,
  score numeric(6,5) not null,
  rank_in_cluster integer,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique(cluster_id, article_id)
);

create index if not exists cluster_members_cluster_score_idx
on cluster_members(cluster_id, score desc);

create index if not exists cluster_members_article_idx
on cluster_members(article_id);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email citext unique,
  email_verified_at timestamptz,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  anon_id text not null unique,
  user_id uuid references users(id) on delete set null,
  platform text not null default 'chrome_extension',
  app_version text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists devices_user_idx
on devices(user_id);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  device_id uuid references devices(id) on delete set null,
  plan_code text not null check (plan_code in ('free','founder_pass','pro','analyst','team')),
  status text not null check (status in ('inactive','active','expired','grace_period','refunded')),
  provider text,
  provider_ref text,
  started_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_idx
on subscriptions(user_id);

create index if not exists subscriptions_device_idx
on subscriptions(device_id);

create table if not exists watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  device_id uuid references devices(id) on delete cascade,
  cluster_id uuid not null references story_clusters(id) on delete cascade,
  label text,
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  last_viewed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (user_id is not null or device_id is not null)
);

create unique index if not exists watchlists_user_cluster_uq
on watchlists(user_id, cluster_id)
where user_id is not null;

create unique index if not exists watchlists_device_cluster_uq
on watchlists(device_id, cluster_id)
where device_id is not null;

create index if not exists watchlists_cluster_idx
on watchlists(cluster_id);

create table if not exists briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  device_id uuid references devices(id) on delete cascade,
  briefing_date date not null,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  check (user_id is not null or device_id is not null)
);

create unique index if not exists briefings_user_date_uq
on briefings(user_id, briefing_date)
where user_id is not null;

create unique index if not exists briefings_device_date_uq
on briefings(device_id, briefing_date)
where device_id is not null;

create table if not exists briefing_items (
  id uuid primary key default gen_random_uuid(),
  briefing_id uuid not null references briefings(id) on delete cascade,
  cluster_id uuid not null references story_clusters(id) on delete cascade,
  priority_score numeric(6,5) not null default 0,
  new_article_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique(briefing_id, cluster_id)
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  anon_id text not null,
  user_id uuid references users(id) on delete set null,
  device_id uuid references devices(id) on delete set null,
  event_name text not null,
  event_props jsonb default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists events_name_ts_idx
on events(event_name, occurred_at desc);

create index if not exists events_anon_ts_idx
on events(anon_id, occurred_at desc);

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  anon_id text not null,
  user_id uuid references users(id) on delete set null,
  article_id uuid references canonical_articles(id) on delete set null,
  cluster_id uuid references story_clusters(id) on delete set null,
  feedback_type text not null check (feedback_type in ('helpful','unrelated','outdated','missing_coverage','bug','free_text')),
  free_text text,
  created_at timestamptz not null default now()
);

create index if not exists feedback_cluster_idx
on feedback(cluster_id);

create index if not exists feedback_type_idx
on feedback(feedback_type);

create table if not exists legal_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  device_id uuid references devices(id) on delete cascade,
  consent_type text not null check (consent_type in ('analytics_opt_in','privacy_terms','tos')),
  consent_version text not null,
  consented boolean not null,
  created_at timestamptz not null default now(),
  check (user_id is not null or device_id is not null)
);

create index if not exists legal_consents_device_idx
on legal_consents(device_id, consent_type, created_at desc);

create index if not exists legal_consents_user_idx
on legal_consents(user_id, consent_type, created_at desc);

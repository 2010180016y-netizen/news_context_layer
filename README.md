# news-context monorepo

This repository contains the Gate 2 engineering baseline for the News Context product.
The current scope keeps the monorepo, docs, fixtures, ingest foundation, resolve stack, side panel UX, watchlist flow, and alpha release workflow aligned with `docs/DECISION_LOCK.md`.

## Current planning docs
- `plan.md`: current execution snapshot and next recommended sequence
- `docs/DECISION_LOCK.md`: scope and guardrail source of truth
- `docs/09_Backlog_Roadmap_StageGates.md`: stage gate roadmap plus current implementation snapshot
- `docs/10_Repo_Structure_and_Handoff.md`: actual repository structure and handoff checklist
- `docs/ops/OPERATIONS_HANDOFF.md`: latest operations blocker/non-blocker summary

## Workspace layout
- `docs/`: product, architecture, schema, QA, and decision documents
- `apps/extension/`: Chrome MV3 extension shell
- `apps/api/`: API bootstrap plus repository layer
- `apps/jobs/`: ingest and worker code
- `packages/shared-types/`: shared TypeScript contracts and store models
- `infra/migrations/`: schema migrations derived from `docs/06_DB_Schema.sql`
- `infra/seeds/`: publisher and feed seed data

## Tooling
- package manager: `pnpm`
- monorepo: `pnpm workspace + Turborepo`
- language: `TypeScript strict`
- lint: `ESLint`
- formatting: `Prettier`
- test: `Vitest`

## Quick start
1. `corepack enable`
2. `pnpm install`
3. `pnpm db:migrate`
4. `pnpm seed:feeds`
5. `pnpm ingest:rss`
6. `pnpm ingest:sitemap`
7. `pnpm lint`
8. `pnpm test`
9. `pnpm typecheck`
10. `pnpm build:alpha`

If plain `pnpm` is not available in the shell, use `corepack pnpm ...`.

## Main scripts
- `pnpm build`
- `pnpm db:migrate`
- `pnpm seed:feeds`
- `pnpm ingest:rss`
- `pnpm ingest:sitemap`
- `pnpm fixtures:validate`
- `pnpm benchmark:resolve`
- `pnpm lint`
- `pnpm test`
- `pnpm typecheck`
- `pnpm build:alpha`

## Local ingest store
- Local migrate, seed, and ingest commands write to `infra/dev-data/news-context.store.json` by default.
- This file-backed store mirrors the documented schema so the repository can verify ingest behavior without a live Postgres instance.
- Production DB integration remains a follow-up step on top of `infra/migrations/001_init.sql`.

## Fixture and quality inputs
- `infra/migrations/001_init.sql`
- `infra/seeds/feed_sources.seed.json`
- `sample-fixtures/naver-articles.json`
- `sample-fixtures/resolve-benchmark.json`
- `scripts/import-fixtures.ts`
- `scripts/benchmark-resolve.ts`

## Alpha release notes
- `pnpm build:alpha` creates `apps/extension/dist-alpha` for the unlisted alpha channel.
- `apps/extension/dist-alpha/manifest.json` removes localhost permissions and keeps only Naver News plus the configured HTTPS API origin.
- `apps/extension/dist-alpha/sidepanel/config.js` contains the alpha API base URL and release channel.
- Release gating notes live in `docs/ALPHA_RELEASE_CHECKLIST.md` and `docs/QA_EXECUTION_NOTES.md`.

## Current non-goals
- live payment provider integration
- briefing email delivery
- browser push notifications
- live Postgres provisioning

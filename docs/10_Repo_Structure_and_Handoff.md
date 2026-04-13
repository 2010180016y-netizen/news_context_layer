# 10. 리포지토리 구조 및 핸드오프 문서

## 1. 목적
이 문서는 현재 monorepo의 실제 구조, 어떤 경로가 source of truth인지, 다음 담당자가 무엇부터 읽어야 하는지 정리한다.
이전의 “권장 구조” 설명 대신, 현재 코드베이스에 맞는 실제 구조와 handoff 기준을 우선 기록한다.

---

## 2. 현재 리포지토리 전략
### 현재 방식
**pnpm workspace 기반 모노레포**

### 현재 도구
- package manager: `pnpm`
- workspace orchestration: `pnpm workspace + turbo.json`
- language: `TypeScript strict`
- lint / format / test: `ESLint`, `Prettier`, `Vitest`

---

## 3. 실제 최상위 구조
```text
news-context-layer-specs/
├─ apps/
│  ├─ extension/
│  ├─ api/
│  └─ jobs/
├─ packages/
│  ├─ shared-types/
│  └─ scoring/
├─ docs/
│  ├─ 01_PRD.md
│  ├─ 09_Backlog_Roadmap_StageGates.md
│  ├─ 10_Repo_Structure_and_Handoff.md
│  ├─ 13_QA_Checklist.md
│  ├─ QA_EXECUTION_NOTES.md
│  ├─ DECISION_LOCK.md
│  └─ ops/
├─ infra/
│  ├─ migrations/
│  ├─ seeds/
│  ├─ exports/
│  └─ dev-data/
├─ sample-fixtures/
├─ scripts/
├─ plan.md
├─ package.json
├─ pnpm-workspace.yaml
├─ turbo.json
└─ README.md
```

---

## 4. 앱별 실제 구조

## apps/extension
### 주요 경로
- `public/manifest.json`
- `public/sidepanel/config.js`
- `src/background/index.ts`
- `src/content/extractArticle.ts`
- `src/content/runtime.ts`
- `src/sidepanel/main.ts`
- `src/sidepanel/api-client.ts`
- `src/sidepanel/hooks.ts`
- `src/lib/constants.ts`
- `src/lib/support.ts`
- `tests/*`

### 역할
- 현재 탭 기사 추출
- side panel 상태/UI 렌더링
- resolve / watchlist / briefing / billing shell / support surface 연결
- local storage, consent, support placeholder 처리

## apps/api
### 주요 경로
- `src/server.ts`
- `src/routes/resolve.ts`
- `src/routes/watchlists.ts`
- `src/routes/events.ts`
- `src/routes/profile.ts`
- `src/routes/checkout.ts`
- `src/routes/briefings.ts`
- `src/services/resolve-service.ts`
- `src/services/cluster-service.ts`
- `src/services/briefing-service.ts`
- `src/services/billing-service.ts`
- `src/repositories/file-store.ts`
- `tests/*`

### 역할
- resolve / watchlist / events / profile / checkout / briefing API 제공
- file-backed local store 기반 persistence
- briefing / starter pack / billing shell과 연결되는 서비스 계층

## apps/jobs
### 주요 경로
- `src/ingest/fetch-rss.ts`
- `src/ingest/fetch-sitemap.ts`
- `src/ingest/normalizer.ts`
- `src/briefing/build-daily-briefing.ts`
- `src/briefing/build-sample-issue-report.ts`
- `src/briefing/build-b2b-starter-pack.ts`
- `src/workers/run-placeholder-worker.ts`
- `tests/*`

### 역할
- RSS / sitemap 수집
- canonical normalization
- daily briefing scaffold
- sample issue report / starter pack 생성

## packages/shared-types
### 주요 경로
- `src/fixtures.ts`
- `src/resolve.ts`
- `src/store.ts`
- `src/briefing.ts`
- `src/reporting.ts`
- `src/support.ts`

### 역할
- extension / api / jobs가 공유하는 계약과 store 모델 제공

## packages/scoring
### 주요 경로
- `src/index.ts`
- `tests/scoring.test.ts`

### 역할
- resolve scoring과 feature generation 로직 제공

---

## 5. source of truth 문서
- 제품 범위와 가드레일: `docs/DECISION_LOCK.md`
- 장기 로드맵과 현재 실행 순서: `docs/09_Backlog_Roadmap_StageGates.md`
- 최신 작업 계획: `plan.md`
- QA 기준과 실행 결과: `docs/13_QA_Checklist.md`, `docs/QA_EXECUTION_NOTES.md`
- 운영 handoff: `docs/ops/OPERATIONS_HANDOFF.md`
- 세일즈/카피 일관성: `docs/ops/COPY_CONSISTENCY_CHECK.md`

---

## 6. generated artifacts와 source 구분
### source
- `apps/*/src`
- `packages/*/src`
- `scripts/*`
- `docs/*`

### generated
- `infra/exports/*`
- `apps/extension/dist/*`
- `apps/extension/dist-alpha/*`
- `packages/shared-types/src/*.js`, `*.d.ts` 계열은 build 결과물이므로 직접 편집하지 않는다.

---

## 7. 다음 담당자용 handoff 순서
1. `plan.md`로 현재 우선순위 확인
2. `docs/DECISION_LOCK.md`로 범위와 비범위 재확인
3. `docs/QA_EXECUTION_NOTES.md`로 최신 검증 결과 확인
4. `docs/ops/OPERATIONS_HANDOFF.md`로 blocker / non-blocker 확인
5. 필요한 경우 `infra/exports/*`를 다시 생성해 최신 산출물부터 맞춘다

---

## 8. 실행 기준 명령
```bash
pnpm lint
pnpm test
pnpm typecheck
pnpm benchmark:resolve -- --iterations=50
pnpm ops:starter-pack
```

plain `pnpm`이 바로 잡히지 않으면 `corepack pnpm ...`로 실행한다.

---

## 9. 현재 handoff 체크리스트
- [x] 현재 구조 기준 문서가 실제 폴더와 맞는다.
- [x] 주요 source of truth 문서가 정리돼 있다.
- [x] generated artifact 경로가 문서화돼 있다.
- [x] 운영 blocker / non-blocker 문서가 있다.
- [x] 다음 담당자가 다시 탐색하지 않고 시작할 수 있는 실행 순서가 있다.

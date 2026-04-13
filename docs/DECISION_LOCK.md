# DECISION LOCK

## 1. 문서 목적
- 잠금일: 2026-04-10
- 기준 단계: Gate 2 기술 알파 개발 착수
- 근거 문서: `01_PRD.md`, `02_IA_UserFlows.md`, `03_Wireframes_and_ScreenSpecs.md`, `04_Technical_Architecture.md`, `05_API_Spec_OpenAPI.yaml`, `06_DB_Schema.md`, `07_Analytics_EventTaxonomy.md`, `08_Security_Privacy_Legal.md`, `09_Backlog_Roadmap_StageGates.md`, `10_Repo_Structure_and_Handoff.md`, `11_OpenQuestions_and_Decisions.md`, `13_QA_Checklist.md`, `14_Publisher_Support_Matrix.md`
- 개발 착수 범위와 충돌하는 문구가 기존 문서에 있으면, 이 문서를 우선 기준으로 사용한다.
- 이 문서에 없는 확장 범위는 기본적으로 이번 단계 비범위로 본다.

## 2. 이번 잠금의 적용 범위
- 대상: 개발 착수에 직접 필요한 제품 범위, 비범위, 결제 시점, auth 기준, summary 방식, 알림 방식, 데이터 소스 우선순위
- 비대상: Gate 3 이후 상용화 상세, provider 최종 선택, 장기 확장, B2B 상품화, 모델 고도화

## 3. 잠금된 결정
### DL-001. v1 개발 착수 범위
- 지원 표면은 `네이버 뉴스 데스크톱 기사 페이지`로 한정한다.
- 제품 형태는 `Chrome MV3 확장프로그램 + Side Panel`로 고정한다.
- 이번 단계 구현 대상은 아래 항목만 포함한다.
  - 사용자 클릭 시 Side Panel 열기
  - 현재 기사 파싱
  - 출처 카드
  - 같은 이슈 기사 3~5개 비교
  - 최신성/업데이트 경고
  - 공통 신호 스트립
  - watchlist 1개 저장
  - 피드백 수집
  - 익명 사용통계 opt-in

### DL-002. 이번 단계 비범위
- 아래 항목은 이번 단계에서 구현하지 않는다.
  - 진실/거짓 판정
  - 기자/언론사 스코어링
  - 정치 성향 스코어링
  - 상시 감시형 자동 배지
  - 유튜브/소셜 지원
  - 모바일 앱
  - LLM 기반 AI 요약
  - 정기결제
  - API 판매
  - 다중 watchlist
  - 이메일 브리핑 발송
  - paywall 노출/결제 연동
  - 기본 계정 시스템

### DL-003. 결제 시점
- Founder Pass 1회 결제와 paywall은 `Gate 3 유료 베타`부터 다룬다.
- 일정 기준으로는 `Week 11-12`가 최초 도입 시점이다.
- `Gate 2 기술 알파` 개발 착수 범위에는 결제 UI, checkout session, billing sync를 포함하지 않는다.
- `09_Backlog_Roadmap_StageGates.md`에 있는 `paywall/Founder Pass`는 백로그 우선순위로 해석하며, 현재 착수 범위를 뜻하지 않는다.
- 결제 형태는 `Founder Pass 1회 결제 우선`으로 고정하고, 정기결제는 후속 단계에서만 검토한다.

### DL-004. auth 방식
- Gate 2의 사용자 식별 기준은 `device-based anonymous only`로 고정한다.
- 식별 단위는 `anon_id`와 디바이스 기반 `X-User-Token`이다.
- watchlist 1개 저장, consent, analytics, feedback는 모두 디바이스 기준으로 연결한다.
- 이메일 계정, magic link, 소셜 로그인은 이번 단계에서 도입하지 않는다.
- 계정 이식성이나 결제 복구가 필요해지는 시점에만 이메일 등록 흐름을 재검토한다.

### DL-005. summary 방식
- 관련 기사 카드의 `summary_line`은 `OG description`을 1순위로 사용한다.
- OG description이 없거나 품질이 낮으면 `title/excerpt/keywords` 기반 규칙 압축을 사용한다.
- 이번 단계에서는 LLM 생성 요약을 사용하지 않는다.
- 안전한 입력이 부족하면 임의 생성하지 않고 summary를 비워 둔다.

### DL-006. 알림 방식
- Gate 2에는 외부 발송형 알림을 구현하지 않는다.
- 알림/브리핑이 실제로 출시되는 첫 방식은 `이메일 브리핑 우선`으로 고정한다.
- 브라우저 푸시/실시간 알림은 이번 단계와 Gate 3 초기 범위에서 제외한다.
- 문서와 스키마에 있는 `notifications_enabled`는 후속 retention 기능을 위한 예약 필드로 간주하고, 현재 단계 필수 구현 범위로 해석하지 않는다.

### DL-007. 데이터 소스 우선순위
- 수집 우선순위는 아래 순서로 고정한다.
  1. 언론사 RSS
  2. 언론사 사이트맵
  3. 공개 기사 메타데이터/페이지 메타
  4. Naver Search API fallback
- `Naver Search API`는 예외 처리용 fallback이며, 핵심 의존 소스로 취급하지 않는다.
- 초기 운영은 주요 언론사 RSS/사이트맵 확보가 먼저이고, 검색 API는 수집 공백 보완에만 사용한다.

### DL-008. 플랫폼 및 정책 가드레일
- 확장프로그램 제약은 `Chrome MV3`, `Side Panel`, `activeTab` 기반 클릭 실행으로 고정한다.
- 원격 호스팅 코드 사용은 금지한다.
- 익명 사용통계는 opt-in일 때만 수집한다.
- 제품 포지셔닝은 비교/출처/최신성 제공이며, 판정 도구로 표현하지 않는다.

## 4. Gate 이후 결정
|항목|상태|결정 시점|메모|
|---|---|---|---|
|결제 provider 최종 선택|Gate 이후 결정|Week 9 이전, Gate 3 준비 시작 전|네이버페이/카카오페이/토스페이먼츠/Paddle 중 선택|
|이메일 등록 또는 magic link 도입 여부|Gate 이후 결정|Gate 3 설계 착수 시|현재는 디바이스 기반만으로 개발 시작 가능|
|embedding 모델 및 external API 사용 기준|Gate 이후 결정|알파 정확도 검증 후|현재는 rules 중심으로 시작|
|브라우저 푸시 알림 도입 여부|Gate 이후 결정|이메일 브리핑 검증 후|초기 retention 전달은 이메일 우선|
|네이버 외 독립 언론사/다음 지원 확장 시점|Gate 이후 결정|v2 범위 정의 시|현재 읽기 표면은 네이버 기사 페이지 고정|
|유튜브 뉴스 지원 시점|Gate 이후 결정|v2.5/v3 기획 시|이번 단계 비범위|
|B2B 리포트 템플릿 세분화|Gate 이후 결정|Gate 4 탐색 시|초기 제품 착수에 불필요|
|Analyst 플랜의 CSV export 필요성|Gate 이후 결정|v2 monetization 기획 시|현재는 검증 대상 아님|
|provenance/C2PA 결합 시점|Gate 이후 결정|장기 신호 전략 수립 시|현재는 문맥 비교 제품에 집중|

## 5. 개발 착수 기준 체크리스트
- [x] v1 개발 착수 범위가 기능 단위로 고정되었다.
- [x] 이번 단계 비범위가 roadmap 항목과 분리되어 고정되었다.
- [x] 결제는 Gate 3부터라는 일정 기준이 고정되었다.
- [x] auth 기본값이 디바이스 익명 기준으로 고정되었다.
- [x] summary 방식이 OG 우선 + 규칙 압축 fallback으로 고정되었다.
- [x] 알림 방식이 이메일 우선, 현재 단계 미구현으로 고정되었다.
- [x] 데이터 소스 우선순위와 fallback 위치가 고정되었다.
- [x] MV3/remote hosted code 금지/opt-in analytics 가드레일이 재확인되었다.
- [x] 이후 구현 단계는 이 문서를 다시 열지 않고 개발을 시작할 수 있다.

## 6. 변경 규칙
- 이 문서의 잠금 항목을 변경하려면 `11_OpenQuestions_and_Decisions.md`에 새 결정 로그를 남긴다.
- Gate 이후 결정 항목이 앞당겨질 경우, 먼저 이 문서와 `11_OpenQuestions_and_Decisions.md`를 같이 갱신한다.

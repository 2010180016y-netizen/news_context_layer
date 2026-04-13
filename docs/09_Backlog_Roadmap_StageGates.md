# 09. 백로그 / 로드맵 / Stage Gate

## 1. 문서 목적
이 문서는 개발 우선순위, 12주 실행 계획, Gate 기준, 에픽/스토리 수준 백로그를 정리한다.

---

## 2. 우선순위 원칙
### 우선순위 기준
1. 핵심 가치 전달에 직접 연결되는가
2. 정확도/신뢰를 높이는가
3. 유료화 기반을 만드는가
4. 구현 복잡도가 과도하지 않은가

### v1 우선순위
1. 기사 파싱
2. 같은 이슈 매칭
3. Side Panel 렌더링
4. 최신성 신호
5. 공통 신호
6. watchlist 1개
7. analytics
8. paywall/Founder Pass

---

## 3. Stage Gate
## Gate 0 — 문제 검증
### 활동
- 인터뷰 15명
- 가격 수용도 조사
- maker story 메시지 테스트

### 통과 기준
- 12/15 이상이 문제 공감
- 8/15 이상이 저장/알림 니즈 표현
- 적정 가격대 응답이 월 5,000~10,000원 범위에 수렴

---

## Gate 1 — 프로토타입 검증
### 활동
- Figma 클릭형 프로토타입
- 50명 사용성 테스트

### 통과 기준
- “유용하다” 60%+
- “다시 쓰겠다” 50%+
- watchlist CTA 클릭률 15%+

---

## Gate 2 — 기술 알파
### 활동
- unlisted alpha 배포
- 네이버 기사 지원
- resolve API 연동

### 통과 기준
- parser success ≥ 90%
- related precision ≥ 80%
- D1 activation ≥ 40%
- D7 repeat ≥ 25%

---

## Gate 3 — 유료 베타
### 활동
- Founder Pass 결제
- paywall 실험
- community seeding

### 통과 기준
- paywall view → purchase 8%+
- watchlist save 15%+
- 월 매출 300만원+

---

## Gate 4 — B2B 탐색
### 활동
- 샘플 리포트 배포
- B2B 후보 미팅 5건+
- Starter Report 제안

### 통과 기준
- 유료 파일럿 1건+
- 동일 고객 2개월차 유지

---

## 3.5 현재 구현 스냅샷 (2026-04-10)
이 문서는 원래 계획 문서이지만, 현재 리포지토리 상태와 크게 어긋나지 않도록 최신 구현 범위를 함께 기록한다.

### 현재 코드베이스에 반영된 기반
- 네이버 뉴스 기사 대상 parser / resolve / side panel 기본 흐름
- watchlist / analytics / settings / support placeholder 흐름
- Founder Pass 베타용 paywall shell과 mock checkout
- `/v1/briefings` retrieval
- sample issue report / daily briefing scaffold / starter pack export

### 아직 운영 blocker인 항목
- 실제 support/contact 운영 채널 값
- 외부 미팅용 demo corpus 현실화

### 현재 권장 우선순위
1. support/contact 실 운영 값 반영
2. demo corpus 보강 및 export 재생성
3. export smoke CI 연결
4. 이후에만 세일즈 확장 또는 운영 deep link 보강

---

## 4. 12주 실행 일정
## Week 1–2
### PM / 리서치
- 인터뷰 15명
- 가격 수용도 조사
- 문제 문장 고정

### 데이터
- RSS 대상 매체 20곳 리스트업
- sitemap 수집 테스트

### 법무
- 개인정보처리방침 초안
- 이용약관 초안
- 면책 문구 초안

### 디자인
- 핵심 화면 와이어프레임 확정

---

## Week 3–4
### 백엔드
- ingest pipeline 초안
- article canonicalization 구현
- story cluster prototype
- resolve API 초안

### 프론트
- Chrome MV3 scaffold
- action click → sidePanel 오픈 흐름
- onboarding 화면

### 분석
- 이벤트 taxonomy 확정
- events ingestion API 구현

---

## Week 5–6
### 백엔드
- feature extraction
- resolve scoring 개선
- freshness logic 구현

### 프론트
- 기사 파싱 구현
- 메인 컨텍스트 패널 구현
- error/unsupported state 구현

### QA
- 샘플 URL 300개 파싱 테스트

---

## Week 7–8
### 프론트
- watchlist 저장
- feedback chips
- settings / consent 화면

### 백엔드
- watchlist API
- feedback API
- analytics 저장

### 운영
- alpha 모집 페이지 준비

---

## Week 9–10
### 배포
- unlisted alpha 배포
- 100명 테스트

### 개선
- parser fail top domain 수정
- low-confidence 분기 추가
- scoring threshold 조정

### 리서치
- 유료화 관심 인터뷰

---

## Week 11–12
### 결제
- Founder Pass 결제 연동
- paywall 구현

### 성장
- 커뮤니티 게시글 3건
- 랜딩페이지/SEO 초안

### B2B
- 샘플 리포트 1건 발행
- B2B 후보 10곳 정리

---

## 5. 에픽 구조
## Epic A. Extension Shell
### 목표
확장프로그램 기본 골격과 Side Panel UX 완성

### Stories
- MV3 manifest 구성
- action icon click handler
- sidePanel route system
- local storage/anon_id 생성
- settings page

## Epic B. Article Parsing
### 목표
네이버 뉴스 기사에서 안정적으로 메타데이터 추출

### Stories
- JSON-LD parser
- OG/meta parser
- DOM fallback parser
- parser confidence score
- parser QA fixture 세트

## Epic C. Context Resolve
### 목표
같은 이슈 기사와 최신성 신호 반환

### Stories
- resolve endpoint
- candidate generation
- ranking rules
- common signals generation
- low-confidence state

## Epic D. Watchlist & Retention
### 목표
저장/재방문 흐름 구현

### Stories
- save issue
- list watchlists
- watchlist limit logic
- future briefing scaffold

## Epic E. Analytics
### 목표
D1/D7/전환 측정 가능하게 만들기

### Stories
- event client SDK
- event ingestion API
- event validation
- basic dashboards

## Epic F. Billing
### 목표
Founder Pass 유료화

### Stories
- paywall
- checkout session
- success/cancel routing
- subscription state sync

## Epic G. Operations
### 목표
운영 가능한 상태 확보

### Stories
- feed admin seed file
- blocked publisher handling
- support email flow
- error monitoring

---

## 6. 개발 티켓 레벨 제안
### Backend tickets
- BE-001 feeds table / seed script
- BE-002 RSS fetch worker
- BE-003 sitemap ingest worker
- BE-004 canonical article normalizer
- BE-005 article_features generator
- BE-006 cluster engine v1
- BE-007 resolve API
- BE-008 watchlist CRUD API
- BE-009 events ingestion API
- BE-010 feedback API
- BE-011 billing session API

### Frontend tickets
- FE-001 MV3 manifest + bootstrap
- FE-002 action click + sidePanel open
- FE-003 onboarding UI
- FE-004 article parser service
- FE-005 loading / error states
- FE-006 main context panel
- FE-007 related article cards
- FE-008 signal strip
- FE-009 watchlist tab
- FE-010 settings tab
- FE-011 paywall UI

### QA tickets
- QA-001 parser fixture set 구축
- QA-002 top-5 precision sample review sheet
- QA-003 UI state checklist
- QA-004 payment success/failure checklist

---

## 7. Definition of Done
### 기능 공통 DoD
- PRD 요구사항 충족
- 에러 상태 처리 완료
- 이벤트 로그 연결 완료
- QA 시나리오 통과
- 법무 문구 반영 완료
- feature flag 여부 결정 완료

### 출시 DoD
- Chrome unlisted 등록 가능 패키지 생성
- 개인정보처리방침/약관 링크 노출
- 오류 모니터링 활성화
- 지원 페이지 목록 문서화

# 03. 와이어프레임 및 화면 명세

## 1. 문서 목적
이 문서는 디자인 시안이 나오기 전, 개발과 디자인이 동일한 레이아웃/컴포넌트 구조를 공유하기 위한 화면 명세서다. 실제 UI 디자인은 이 구조를 유지한 채 시각 언어만 정교화한다.

---

## 2. 공통 레이아웃
### Side Panel 기본 폭
- 권장 너비: 400px
- 최소 지원: 360px
- 최대 권장: 480px

### 패널 기본 구조
1. 상단 헤더
2. 본문 스크롤 영역
3. 하단 고정 CTA 또는 보조 액션 영역

### 공통 컴포넌트
- HeaderBar
- StatusBadge
- SourceCard
- SignalStrip
- RelatedArticleCard
- EmptyState
- ErrorState
- CTAButton
- SecondaryButton
- FeedbackChips
- LegalNotice

---

## 3. 화면 목록
- WF-01 온보딩 / 웰컴
- WF-02 로딩 상태
- WF-03 메인 컨텍스트 패널
- WF-04 저장한 이슈 목록
- WF-05 결제 / 플랜 비교
- WF-06 설정 / 정책 / 동의
- WF-07 오류 / 미지원 상태

참고 SVG 파일:
- `wireframes/WF-01-onboarding.svg`
- `wireframes/WF-02-loading.svg`
- `wireframes/WF-03-main-context.svg`
- `wireframes/WF-04-watchlist.svg`
- `wireframes/WF-05-paywall.svg`
- `wireframes/WF-06-settings.svg`
- `wireframes/WF-07-error-state.svg`

---

## 4. 화면 상세 명세

## WF-01 온보딩 / 웰컴
### 목적
- 첫 설치 후 제품 가치와 데이터 처리 원칙을 설명한다.
- 첫 사용 행동을 유도한다.

### 주요 컴포넌트
1. 제품명 / 태그라인
2. 핵심 가치 3줄 요약
3. `현재 기사 비교하기` CTA
4. `익명 사용 통계 동의` 토글
5. `어떤 정보가 전송되나요?` 링크
6. 면책 문구

### 레이아웃
- 상단: 아이콘 + 제품명
- 중단: 가치 설명 3 bullet
- 하단: CTA → 동의 토글 → 법무 링크

### CTA 문구
- Primary: `현재 기사 비교하기`
- Secondary: `나중에 하기`

### 상태
- `first_install`
- `consent_required`
- `consent_completed`

### 이벤트
- `onboarding_viewed`
- `consent_analytics_set`
- `onboarding_cta_clicked`

---

## WF-02 로딩 상태
### 목적
- 사용자가 처리 중임을 이해하고 이탈하지 않게 한다.

### 주요 컴포넌트
1. HeaderBar
2. SourceCard skeleton
3. SignalStrip skeleton
4. RelatedArticleCard skeleton x3
5. 하단 보조 메시지

### 문구
- `기사를 읽는 중…`
- `같은 이슈 보도를 찾고 있습니다.`

### 상태 전이
- 성공 → WF-03
- 파싱 실패 → WF-07
- 타임아웃 → WF-07 with retry

### 이벤트
- `panel_opened`
- `article_parse_started`
- `context_resolve_requested`

---

## WF-03 메인 컨텍스트 패널
### 목적
핵심 가치를 전달하는 메인 화면.

### 영역 구성
#### 1) Header
- 좌측: `현재 기사`
- 우측: 새로고침 아이콘 / 설정 아이콘

#### 2) SourceCard
표시 항목
- 기사 제목(최대 2줄)
- 언론사명
- 기자명
- 발행시각
- 수정시각
- 기사 유형 배지

#### 3) Freshness Banner
상태별 색상은 나중에 정의하되, 문구는 상태마다 고정
- Fresh: `이 기사는 현재 이슈의 최신권 기사입니다.`
- Watch newer: `이 이슈의 더 최신 기사가 4건 있습니다.`
- Updated: `이 기사는 발행 후 수정되었습니다.`
- Older context: `이 이슈는 이후 보도가 더 많이 나왔습니다.`

#### 4) Common Signal Strip
- 공통 언급 개체명 3개
- 공통 숫자/날짜 2개
- low-confidence 시 툴팁 제공

#### 5) Related Articles Section
- 제목: `같은 이슈 다른 기사`
- 카드 3~5개

카드 구성
- 언론사
- 상대 시각 또는 절대 시각
- 제목 2줄
- 1줄 요약
- score는 사용자에게 숨김, 내부 디버그 모드에서만 노출

#### 6) Action Area
- Primary: `이 이슈 저장`
- Secondary chips:
  - `도움 됐어요`
  - `관련도가 낮아요`
  - `더 최신 기사 원해요`
  - `버그`

#### 7) Legal Notice
- `이 도구는 기사의 진위를 판정하지 않으며, 비교와 맥락 제공을 위한 참고 도구입니다.`

### 상태
- `success_full`
- `success_partial`
- `low_confidence`
- `insufficient_results`

### 이벤트
- `context_loaded`
- `related_article_clicked`
- `watchlist_save_clicked`
- `feedback_submitted`

---

## WF-04 저장한 이슈 목록
### 목적
- 저장 이슈를 다시 찾고, 반복 사용을 만든다.
- 유료 기능의 필요성을 보여준다.

### 레이아웃
#### 상단
- 탭명: `저장한 이슈`
- 플랜 배지

#### 목록 카드
각 카드 표시 항목
- cluster label
- 마지막 업데이트 시각
- 새 기사 수
- 업데이트 여부 배지
- 알림 on/off 상태

#### 하단 CTA
- Free 사용자: `더 많이 저장하려면 업그레이드`
- 유료 사용자: `브리핑 보기`

### 빈 상태
- 문구: `아직 저장한 이슈가 없습니다.`
- CTA: `현재 기사에서 이슈 저장하기`

### 이벤트
- `watchlist_viewed`
- `watchlist_item_clicked`
- `watchlist_notification_toggled`
- `paywall_viewed`

---

## WF-05 결제 / 플랜 비교
### 목적
- 무료와 유료의 차이를 명확하게 보여주고 결제를 유도한다.

### 레이아웃
#### 상단
- 제목: `더 깊게 추적하려면`
- 설명: `저장, 브리핑, 더 많은 이슈 추적을 사용하세요.`

#### 비교 테이블
행 항목
- 기사 비교
- 저장 가능한 이슈 수
- 브리핑
- 업데이트 알림
- 히스토리

열 항목
- Free
- Founder Pass 또는 Pro

#### CTA
- Primary: `Founder Pass 구매`
- Secondary: `나중에`

#### 보조 설명
- 환불 정책 요약
- 자동결제 여부 요약

### 이벤트
- `paywall_viewed`
- `checkout_started`
- `purchase_completed`

---

## WF-06 설정 / 정책 / 동의
### 목적
- 사용자 신뢰 확보
- 최소 권한 및 데이터 처리 원칙 노출

### 섹션
1. 익명 사용통계 토글
2. 이메일 브리핑 수신 여부
3. 개인정보처리방침 링크
4. 이용약관 링크
5. 면책 고지
6. 문의하기

### 이벤트
- `settings_viewed`
- `consent_analytics_set`
- `briefing_email_toggled`

---

## WF-07 오류 / 미지원 상태
### 목적
- 실패 상황에서 신뢰를 유지한다.

### 상태 유형
1. 지원하지 않는 페이지
2. 기사 파싱 실패
3. 관련 기사 부족
4. 서버 오류
5. low-confidence 결과

### 상태별 문구 예시
#### 미지원 페이지
- `현재 페이지는 아직 지원하지 않습니다.`
- CTA: `지원 페이지 보기`

#### 파싱 실패
- `기사 정보를 충분히 읽지 못했습니다.`
- CTA: `다시 시도`

#### 관련 기사 부족
- `관련 기사를 충분히 찾지 못했습니다.`
- CTA: `피드백 보내기`

#### 서버 오류
- `잠시 후 다시 시도해 주세요.`
- CTA: `다시 시도`

#### low-confidence
- `관련 기사 정확도가 낮을 수 있습니다.`
- CTA: `피드백 보내기`

---

## 5. 컴포넌트 명세
### SourceCard
필수 props
- `title`
- `publisherName`
- `authorNames[]`
- `publishedAt`
- `modifiedAt`
- `articleType`

### RelatedArticleCard
필수 props
- `publisherName`
- `publishedAt`
- `title`
- `summaryLine`
- `url`

### FreshnessBanner
필수 props
- `state`
- `message`

허용 state
- `fresh`
- `watch_newer`
- `updated`
- `older_context`

### SignalStrip
필수 props
- `entities[]`
- `numbers[]`
- `confidence`

### FeedbackChips
옵션
- helpful
- unrelated
- outdated
- bug
- free_text

---

## 6. 반응형/해상도 원칙
- Side Panel 내 스크롤은 세로만 허용
- 긴 제목은 2줄 말줄임
- 시간 정보는 좁을 경우 상대시간 우선
- 요약 1줄은 모바일 고려 없이 데스크톱 기준

---

## 7. QA 체크포인트
### WF-03 메인 패널
- 발행/수정 시각이 둘 다 없을 때 레이아웃 깨지지 않아야 함
- 기자명 2명 이상일 때 줄바꿈 규칙 필요
- 카드가 3개 미만일 때 empty helper 노출
- 피드백 제출 후 중복 제출 방지

### WF-04 watchlist
- 저장 이슈가 1개도 없을 때 빈 상태 노출
- Free 사용자가 한도 초과 시 paywall로 자연스럽게 연결

### WF-05 paywall
- Founder Pass 상태에서는 CTA가 비활성화되어야 함
- 만료 상태에서 재구매 노출


# 07. 애널리틱스 / 이벤트 택소노미

## 1. 문서 목적
이 문서는 제품 성공 기준을 측정할 수 있도록 이벤트 정의, 퍼널, 코호트, 주요 지표 계산식을 정리한다.

---

## 2. 측정 원칙
1. 설치 수보다 **활성화와 반복 사용**이 중요하다.
2. 익명 사용통계는 opt-in 기반으로 수집한다.
3. 이벤트는 제품 개선에 필요한 최소 집합부터 시작한다.
4. 이벤트는 제품 이벤트와 운영 이벤트를 분리한다.

---

## 3. 측정 대상 KPI
### 북극성에 가까운 지표
- `weekly_context_users` : 주간 컨텍스트 조회 사용자 수

### 핵심 제품 KPI
- D1 activation
- D7 repeat
- context load success rate
- watchlist save rate
- helpful feedback rate
- paywall conversion

### 품질 KPI
- parser success rate
- related article precision QA
- freshness warning useful rate
- low-confidence rate

---

## 4. 이벤트 목록
## 필수 이벤트
### 1) install_completed
설치 완료 후 최초 런칭 시 내부 발화

속성:
- anon_id
- app_version
- install_source (store/community/seo/direct/unknown)
- ts

### 2) onboarding_viewed
온보딩 화면 노출

### 3) consent_analytics_set
익명 사용통계 동의 여부 설정

속성:
- consented (boolean)
- consent_version

### 4) panel_opened
사이드패널 열림

속성:
- page_domain
- page_url_hash
- page_type_guess

### 5) article_parsed
기사 파싱 완료

속성:
- parse_success (boolean)
- parse_confidence
- parser_source (jsonld/meta/dom)
- publisher_domain
- article_type

### 6) context_loaded
컨텍스트 응답 성공

속성:
- article_id
- cluster_id
- context_confidence
- resolve_latency_ms
- related_count
- freshness_state
- result_state (success_full/success_partial/low_confidence/insufficient_results)

### 7) related_article_clicked
관련 기사 카드 클릭

속성:
- cluster_id
- related_article_id
- position (1~5)
- publisher_name

### 8) watchlist_saved
이슈 저장 성공

속성:
- cluster_id
- plan_code
- used_count
- limit_count

### 9) paywall_viewed
과금 유도 화면 노출

속성:
- trigger_type (watchlist_limit/briefing/upgrade_cta/history)
- plan_code

### 10) checkout_started
결제 시작

속성:
- plan_code
- provider
- trigger_type

### 11) purchase_completed
결제 완료

속성:
- plan_code
- provider
- amount
- currency

### 12) feedback_submitted
피드백 제출

속성:
- feedback_type
- article_id
- cluster_id
- free_text_present (boolean)

---

## 5. 계산식
### D1 activation
정의: 설치 당일 또는 설치 후 24시간 내 `context_loaded`를 1회 이상 발생시킨 설치 사용자 비율

```text
D1 activation = 설치 후 24시간 내 context_loaded 발생 사용자 / install_completed 사용자
```

### D7 repeat
정의: 첫 `context_loaded` 이후 7일 내 다시 `context_loaded`를 발생시킨 사용자 비율

```text
D7 repeat = 첫 context_loaded 사용자 중 7일 내 2회 이상 context_loaded 사용자 / 첫 context_loaded 사용자
```

### watchlist save rate
```text
watchlist save rate = watchlist_saved 사용자 / context_loaded 사용자
```

### helpful feedback rate
```text
helpful feedback rate = feedback_type=helpful 건수 / 전체 feedback_submitted 건수
```

### paywall conversion
```text
paywall conversion = purchase_completed 사용자 / paywall_viewed 사용자
```

---

## 6. 이벤트 속성 표준
### 공통 속성
- anon_id
- user_id (nullable)
- device_id (nullable)
- app_version
- locale
- ts

### 기사 관련 속성
- article_id
- cluster_id
- publisher_domain
- article_type
- parse_confidence
- context_confidence

### 결제 관련 속성
- plan_code
- provider
- amount
- billing_type (one_time/recurring)

---

## 7. 대시보드 구성
### Dashboard A. Activation
- installs
- onboarding viewed
- panel opened
- article parsed success/fail
- context loaded
- D1 activation

### Dashboard B. Retention
- D1, D7, D14 repeat
- weekly active context users
- recent users by acquisition source

### Dashboard C. Quality
- parse success by domain
- resolve latency p50/p95
- result state ratio
- low-confidence rate
- feedback distribution

### Dashboard D. Monetization
- paywall viewed
- checkout started
- purchase completed
- conversion by trigger type
- Founder Pass revenue

---

## 8. 샘플 SQL
### D1 activation
```sql
with installs as (
  select anon_id, min(occurred_at) as install_ts
  from events
  where event_name = 'install_completed'
  group by 1
), activations as (
  select i.anon_id
  from installs i
  join events e
    on e.anon_id = i.anon_id
   and e.event_name = 'context_loaded'
   and e.occurred_at <= i.install_ts + interval '24 hours'
  group by i.anon_id
)
select count(*)::float / nullif((select count(*) from installs), 0) as d1_activation
from activations;
```

### watchlist save rate
```sql
with loaders as (
  select distinct anon_id
  from events
  where event_name = 'context_loaded'
), savers as (
  select distinct anon_id
  from events
  where event_name = 'watchlist_saved'
)
select count(*)::float / nullif((select count(*) from loaders), 0) as save_rate
from savers;
```

---

## 9. 운영 이벤트
제품 이벤트 외에 시스템 품질 추적용 이벤트를 남긴다.
- `ingest_job_started`
- `ingest_job_completed`
- `ingest_job_failed`
- `cluster_recompute_completed`
- `billing_webhook_received`
- `billing_webhook_failed`

이 이벤트는 사용자 analytics와 별도 테이블 또는 log pipeline으로 분리 가능하다.

---

## 10. 개인정보 주의사항
- 본문 전문, 댓글, 계정 쿠키 등 민감 데이터는 이벤트 속성으로 수집하지 않는다.
- page_url은 가능하면 해시 처리한다.
- free_text feedback는 PII 포함 가능성이 있어 별도 접근 제한이 필요하다.

---

## 11. 릴리즈 전 점검
- [ ] 이벤트 naming convention 확정
- [ ] 모든 이벤트에 anon_id 주입 확인
- [ ] opt-in false일 때 analytics 미전송 확인
- [ ] QA 환경에서는 sandbox flag 추가
- [ ] 대시보드 최소 4종 구성 완료


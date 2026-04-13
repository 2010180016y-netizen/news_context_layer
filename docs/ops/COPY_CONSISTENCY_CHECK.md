# Copy Consistency Check

## 목적
- 제품, 결제, B2B 메시지가 서로 충돌하지 않도록 source of truth를 잠근다.
- 문서 카피와 generated export가 같은 축을 공유하는지 확인한다.

## Source Of Truth
- 제품/브랜드 기본 문구: `docs/12_CopyDeck.md`
- 랜딩/세일즈 축: `docs/ops/LANDING_COPY_ASSETS.md`
- B2B 미팅 흐름: `docs/ops/B2B_TALK_TRACK.md`
- starter pack 구조/범위: `docs/ops/B2B_STARTER_PACK_DRAFT.md`
- generated export: `infra/exports/b2b/starter-pack-sample.json`

## Message Axes
| 축 | 고정 문구 방향 | Export 반영 위치 |
|---|---|---|
| 즉시 가치 | 현재 기사에서 같은 이슈의 다른 보도, 출처, 최신성 신호를 바로 비교 | `positioning.immediate_value`, `proof_points[0]` |
| 반복 사용 | watchlist와 daily briefing scaffold로 다시 돌아올 이유를 만듦 | `positioning.repeat_use_value`, `proof_points[1]` |
| Founder Pass | 더 많은 watchlist 저장과 briefing 접근을 여는 베타 업그레이드 | `positioning.founder_pass_reason`, `sales_notes[1]` |
| B2B Starter Report | 대시보드 없이도 파일 형태로 coverage 차이와 공통 신호를 전달 | `positioning.b2b_demo_value`, `sales_notes[0]` |
| 범위 가드레일 | external API, team dashboard, 월 정기구독은 beta 약속 아님 | `positioning.scope_guardrail`, `proof_points[2]`, `sales_notes[2]` |

## Consistency Rules
- Founder Pass는 개인 반복 사용 업그레이드로만 설명한다.
- Starter Report는 대시보드 대체가 아니라 초기 파일 전달형 제안 자료로 설명한다.
- external API 판매, team dashboard, 월 정기구독은 beta 범위가 아니라고 명시한다.
- "진위 판정" 또는 "언론사 점수화" 표현은 사용하지 않는다.

## Release Check
- `docs/12_CopyDeck.md`의 결제/세일즈 문구와 `starter-pack-sample.json`의 positioning/sales_notes가 충돌하지 않는다.
- `docs/ops/LANDING_COPY_ASSETS.md`와 `docs/ops/B2B_TALK_TRACK.md`가 같은 메시지 축을 사용한다.
- generated CSV/JSON는 같은 가드레일을 유지한다.

## Gate After
- team / analyst 세부 플랜 카피
- SEO용 장문 카피
- external API 판매 제안 문구

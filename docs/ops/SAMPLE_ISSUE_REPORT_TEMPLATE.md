# Sample Issue Report Template

## Purpose
- 내부 데모와 B2B 미팅에서 "현재 이슈를 어떻게 묶고 보여주는가"를 설명하는 샘플 포맷이다.
- 실제 Analyst 상품 스펙이나 외부 API 판매 범위를 잠그지 않는다.

## Header
- Report title: `{cluster_label} coverage snapshot`
- Report date: `{generated_at}`
- Report id: `{report_id}`
- Source: `story_clusters + cluster_members`

## What This Tracks
- Cluster label: `{cluster_label}`
- Coverage window: `{first_seen_at} ~ {last_seen_at}`
- Publisher count: `{publisher_count}`
- Article count: `{article_count}`
- Resolve state: `{resolve_state}`

## Why It Matters
- Angle: `{angle}`
- Freshness note: `{freshness_note}`
- Recommended action: `{recommended_action}`

## Common Signals
- Entities: `{top_entities}`
- Numbers: `{top_numbers}`

## Related Coverage Table
| publisher | title | published_at | score | summary_line |
|---|---|---|---|---|
| `{publisher_name}` | `{title}` | `{published_at}` | `{score}` | `{summary_line}` |

## Delivery Notes
- JSON export path: `infra/exports/reports/sample-issue-report.json`
- CSV export path: `infra/exports/reports/sample-issue-report.csv`
- 이 템플릿은 내부 샘플용이며, 최종 유료 플랜 entitlement를 고정하지 않는다.

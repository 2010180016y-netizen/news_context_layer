# 14. 지원 매체 / 파싱 매트릭스 (템플릿)

## 1. 목적
지원하는 매체별 파싱 방식, 피드 소스, known issue를 한 눈에 관리한다.

## 2. 컬럼 정의
- publisher_name
- domain
- primary_source (rss/sitemap/api)
- parser_order (jsonld/meta/dom)
- article_type_detection
- last_tested_at
- status
- notes

## 3. 예시 표
|publisher_name|domain|primary_source|parser_order|article_type_detection|status|notes|
|---|---|---|---|---|---|---|
|예시 언론사|example.com|rss|jsonld > meta > dom|section + keywords|active|-
|네이버 뉴스 기사 페이지|n.news.naver.com|api+page parse|jsonld > meta > dom|keywords + breadcrumb|active|우선 지원

## 4. 운영 규칙
- 파싱 실패율 상승 시 이 문서를 먼저 갱신
- 매체별 known issue를 notes에 기록
- status: active / partial / paused / blocked


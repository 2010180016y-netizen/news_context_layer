# 08. 보안 / 프라이버시 / 법무 요구사항

## 1. 목적
이 문서는 출시 전 반드시 충족해야 하는 보안, 개인정보, 저작권, 고지 관련 요구사항을 정리한다.

---

## 2. 제품 원칙
1. 사용자가 클릭할 때만 동작한다.
2. 상시 브라우징 감시는 하지 않는다.
3. 기사 본문 전체를 영구 저장하지 않는다.
4. 광고 타게팅 목적 데이터 활용을 하지 않는다.
5. 제품은 판정기가 아니라 비교/맥락 참고 도구다.

---

## 3. Chrome 정책 관점 요구사항
### 권한 최소화
허용:
- `activeTab`
- `sidePanel`
- `storage`
- `scripting`

금지/지양:
- `<all_urls>` 광범위 권한
- 불필요한 host permissions
- background에서 상시 페이지 수집

### 코드 정책
- 원격 호스팅 JS 실행 금지
- 외부 스크립트 동적 주입 금지
- 확장프로그램 JS/CSS는 번들된 정적 파일만 사용

### 데이터 공개
스토어 등록 시 아래를 명확히 써야 한다.
- 어떤 데이터를 전송하는지
- 왜 필요한지
- 광고에 쓰지 않는지
- 상시 감시하지 않는지

---

## 4. 개인정보 처리 원칙
### 수집 가능 항목
- 익명 anon_id
- app_version
- 사용 이벤트
- 사용자가 본 현재 기사 관련 최소 메타데이터
- 사용자가 직접 입력한 이메일(가입/브리핑 수신 시)

### 저장 가능 항목
- cluster 저장 기록
- plan 상태
- 동의 이력
- 피드백

### 저장 지양 항목
- 전체 브라우징 이력
- 광고 식별용 프로필
- 기사 전문 영구 저장
- 로그인 쿠키 / 세션 정보

### 최소 전송 원칙
클라이언트에서 서버로 보내는 기본 payload는 아래 중심으로 제한한다.
- canonical_url
- title
- publisher_name
- author_names
- published_at
- modified_at
- article_type
- section
- keywords
- body_excerpt (필요 시 제한 길이)
- parse_confidence

---

## 5. 동의 및 고지
### 첫 실행 시 고지
문구 예시:
- `이 제품은 사용자가 버튼을 눌렀을 때만 현재 기사 정보를 읽습니다.`
- `익명 사용 통계는 제품 개선 목적이며, 동의한 경우에만 수집합니다.`
- `이 도구는 기사의 진위를 판정하지 않으며, 관련 보도를 비교하는 참고 도구입니다.`

### 필수 링크
- 개인정보처리방침
- 이용약관
- 문의/삭제 요청 안내

### 동의 기록
- analytics opt-in
- privacy policy 확인
- tos 확인
- 각 버전별 timestamp 기록

---

## 6. 저작권 원칙
### 허용 방향
- 제목, 언론사, 기자명, 발행/수정시각 등 메타데이터 활용
- 원문 링크 제공
- 짧은 재구성형 summary line 생성
- 유사 기사 비교를 위한 feature/embedding 저장

### 지양 방향
- 기사 전문 장기 보관
- 긴 직접 인용 누적 노출
- 본문 전체 재배포 느낌의 UI

### 운영 규칙
- 삭제/수정 요청 처리 프로세스 마련
- 차단/제외 처리 가능한 `status=blocked` 지원
- summary line은 원문 문장을 그대로 길게 복사하지 않도록 룰 설정

---

## 7. 표현 규칙
### 사용 금지 표현
- 허위 기사
- 가짜 뉴스
- 틀린 기사
- 오보 확정
- 정확도 87점
- 이 매체는 이 이슈를 다루지 않았다

### 사용 허용 표현
- 관련 기사를 찾았습니다
- 관련 기사를 충분히 찾지 못했습니다
- 더 최신 보도가 있습니다
- 발행 후 수정되었습니다
- 공통으로 언급된 키워드입니다
- 참고용 비교 도구입니다

---

## 8. 접근 통제
### 운영자 권한 분리
- 개발자: staging/prod read logs
- 운영자: 피드 상태 및 publisher 관리
- CS 담당: user/account limited view
- analyst: B2B report data access only

### 민감 테이블 접근 제한
- users
- subscriptions
- feedback (free_text)
- legal_consents

---

## 9. 보안 체크리스트
- [ ] secret은 서버 환경변수에만 저장
- [ ] 클라이언트 번들에 API secret 없음
- [ ] rate limit 적용
- [ ] checkout callback 검증
- [ ] CSP 설정 확인
- [ ] 사용자 입력 sanitization
- [ ] free_text feedback XSS 방어
- [ ] audit log 최소 확보

---

## 10. 출시 전 필수 문서
### 반드시 필요
- 개인정보처리방침
- 이용약관
- 면책 고지
- 데이터 삭제 요청 프로세스 안내
- support 이메일 또는 폼

### 권장
- publisher removal 요청 처리 정책
- content source policy
- beta disclaimer

---

## 11. 운영 시나리오
### 시나리오 A. 사용자 데이터 삭제 요청
1. 사용자 본인 확인
2. user/device 기반 데이터 조회
3. watchlist, events, feedback, consents 처리 범위 확인
4. 법적 보관 항목 제외 후 삭제
5. 처리 완료 통지

### 시나리오 B. 언론사 차단 요청
1. 요청 내용 접수
2. 관련 URL / domain / reason 확인
3. `canonical_articles.status = blocked` 및 ingest 제외 가능
4. 캐시 무효화
5. 처리 완료 회신

### 시나리오 C. 부정확한 비교 결과 항의
1. 관련 cluster / article 확인
2. feedback tagging
3. scoring rule 조정 대상 분류
4. QA 재검토


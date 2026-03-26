# Server (Express + TypeScript)

진입점: `server/src/index.ts`

## Directory Structure

```
server/src/
  index.ts               # Express 엔트리포인트, API/admin 라우트 마운트, dashboard 정적 파일 서빙
  config/
    admin-auth.ts        # 관리자 인증 ENV 파싱
    database.ts          # core DB 초기화
    analytics-db.ts      # analytics DB 초기화
    request-logs-db.ts   # 월별 request log DB 초기화
  routes/
    api.ts               # /v1 핸들러
    admin-auth.ts        # /admin/auth 핸들러
    admin.ts             # /admin CRUD 핸들러
    analytics.ts         # /admin/analytics 핸들러
  services/
    RouterService.ts     # 백엔드 선택 및 포워딩
    ModelCatalogService.ts # 백엔드 모델 캐시, 모델 인덱스, rewrite/fallback 규칙
    AnalyticsService.ts  # 사용량 집계 및 요청 로그 조회
    ScriptEngine.ts      # 스크립트 오케스트레이션
  utils/
    adminAuth.ts         # 관리자 세션/토큰 인증 + CSRF 검사
    adminSecurity.ts     # 비밀번호/토큰 보안 유틸
    logger.ts            # 콘솔 로깅
```

## Runtime Behavior

- `/v1/**` 는 공개 라우터 API를 유지한다
- `/health` 는 공개 상태 확인 엔드포인트를 유지한다
- `/admin/**` 는 관리자 API 표면을 유지한다
- `/dashboard` 와 `/dashboard/**` 는 빌드된 관리자 SPA를 서빙한다
- 빌드된 `client/dist` 가 있으면 관리자 UI를 함께 제공하고, 없으면 API 전용 모드처럼 동작한다
- 서버 시작 시 활성 백엔드의 `/v1/models` 를 조회해 메모리 모델 카탈로그를 초기화한다
- 라우팅은 DB가 아니라 메모리 모델 카탈로그를 사용하고, 비활성 백엔드는 모델 조회와 후보 선택에서 항상 제외된다

라우트 우선순위는 다음과 같다.

1. `/admin/auth`
2. `/admin/analytics`
3. `/admin`
4. `/v1`
5. `/health`
6. `/dashboard` 정적 파일 + SPA fallback
7. `404`

## Storage

- `DB_DIR` 에 `core.db`, `analytics.db`, `request_logs/request_logs_YYYY-MM.db` 가 저장된다
- `core.db` 에는 `admin_sessions`, `admin_api_tokens` 도 함께 저장된다
- `core.db` 에는 `backend_models`, `model_rewrites` 도 저장된다
- 시간 경계 계산은 `TZ` 기준이다

## Model Routing

- 요청 모델명은 먼저 전역 `model_rewrites` 규칙을 확인한다
- `force=1` 규칙은 항상 `source_model -> target_model` 로 변환한다
- `force=0` 규칙은 원본 모델을 서빙하는 허용 가능한 활성 백엔드가 없을 때만 fallback 으로 적용한다
- 최종 모델을 서빙하는 허용 가능한 활성 백엔드가 없으면 `/v1/chat/completions` 는 모델 미지원 오류를 반환한다
- `/v1/models` 는 허용 가능한 활성 백엔드들의 캐시된 모델 목록 합집합을 반환한다

참고:
- 세부 라우팅 규칙과 캐시 트리거는 [docs/model-routing.md](./model-routing.md) 참고

## Analytics 메모

- `/admin/analytics` 는 기존 usage/requests/metrics 외에 chart 전용 집계 endpoint를 함께 제공한다.
- 추가 endpoint: `daily-totals`, `backend-quality`, `model-trends`, `response-length-histogram`, `response-length-box-plot`
- `AnalyticsService` 는 `analytics.db` 의 일별 집계와 `request_logs_YYYY-MM.db` 의 범위 조회를 함께 사용해 시계열/분포 데이터를 만든다.
- 모델 추이 키는 `response_model -> routed_model -> request_model -> unknown` 순서로 결정한다.
- response length 계열 집계는 `completion_tokens` 가 있는 요청만 포함한다.
- 자세한 화면/API 설명은 [docs/analytics.md](./analytics.md) 참고.

## Deployment Notes

- 권장 런타임은 단일 OCI 이미지다
- 이 이미지는 아래를 함께 포함한다
  - 서버 런타임
  - 빌드된 관리자 대시보드 자산
  - database 스키마 파일
- `docker-compose` 에서는 API와 관리자 UI를 단일 포트로 노출할 수 있다
- Kubernetes에서는 Traefik이 아래처럼 path 기준으로 나눈다
  - 공개: `/v1/**`, `/health`
  - 내부 전용: `/admin/**`, `/dashboard`, `/dashboard/**`

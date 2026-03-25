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
- 시간 경계 계산은 `TZ` 기준이다

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

# Server (Express + TypeScript)

진입점: `server/src/index.ts`

## Directory Structure

```
server/src/
  index.ts               # Express 엔트리포인트(CORS, 라우터 마운트, health 핸들러, 관리자 인증 적용)
  config/
    db-paths.ts          # DB_DIR 기준 파일 경로 계산
    database.ts          # Core SQLite 연결 및 스키마 초기화
    analytics-db.ts      # Analytics SQLite 연결 및 스키마 초기화
    request-logs-db.ts   # 월별 request_logs SQLite 연결 및 스키마 초기화
    admin-auth.ts        # 관리자 인증 ENV 파싱, auth mode / OIDC / TTL 설정
  models/
    User.ts              # 사용자 CRUD (create, findById, findByApiKey, update, delete, regenerateApiKey)
    Backend.ts           # 백엔드 CRUD (create, findById, findAll, update, delete)
    Permission.ts        # 권한 관리 (user-backend 매핑)
    Script.ts            # 스크립트 CRUD (타입별 필터링, 활성화/비활성화)
    AdminSession.ts      # 관리자 세션 저장/조회/만료 처리
    AdminApiToken.ts     # 관리자 API 토큰 발급/조회/폐기
  routes/
    auth.ts              # Bearer 토큰 인증 미들웨어 (사용자 API 키 검증, 권한 로드)
    api.ts               # OpenAI 호환 프록시 핸들러 (/v1/chat/completions, /v1/models)
    admin-auth.ts        # 관리자 로그인, 세션, OIDC, 관리자 토큰 API
    admin.ts             # Admin CRUD 핸들러 (users, backends, permissions, /admin/health, /admin/scripts 마운트)
    scripts.ts           # Script 관리/테스트 핸들러
    analytics.ts         # Analytics 조회 핸들러
  services/
    RouterService.ts     # 활성 백엔드 선택, HTTP 요청 포워딩, header/body 정규화
    AnalyticsService.ts  # 일별 사용량 메트릭 집계 + request_logs 조회
    RequestLogService.ts # 월별 request_logs 기록/조회
    ScriptEngine.ts      # 스크립트 체인 오케스트레이션 (onRequest/onResponse 적용)
    ScriptExecutor.ts    # isolated-vm 기반 스크립트 컴파일/실행 (5s timeout, 50MB memory)
  utils/
    apiKey.ts            # API 키 생성 (sk-{timestamp}-{random}, crypto.randomBytes)
    adminAuth.ts         # 관리자 principal 추출, 세션/토큰 인증 미들웨어, CSRF 검증
    adminSecurity.ts     # 비밀번호 hash 검증, 토큰 생성/hash, OIDC state/nonce 처리
    logger.ts            # 컬러 콘솔 로거
    time.ts              # TZ 기준 날짜/월 계산, UTC timestamp 생성
```

## Request Flow

```text
Client -> auth.ts (사용자 API 키 검증, 권한 로드)
       -> RouterService.selectBackend (허용된 활성 백엔드 중 1개 선택)
       -> ScriptEngine.applyOnRequestScripts (요청 변조)
       -> RouterService.forwardRequest (백엔드로 프록시)
       -> ScriptEngine.applyOnResponseScripts (응답 컨텍스트 후처리 결과)
       -> AnalyticsService.logRequest (집계 + 월별 request_logs 기록)
       -> Response
```

참고:
- 라우터 마운트는 `server/src/index.ts` 에서 직접 수행한다.
- `/admin/**` 는 별도 관리자 인증 레이어를 거친 뒤 각 CRUD/analytics 라우트로 들어간다.
- `/admin/auth/*` 만 관리자 영역 내 공개 예외 엔드포인트다.
- `onResponse` 훅은 실행되지만 현재 구현에서는 반환값을 최종 HTTP 응답에 다시 반영하지 않는다.

## Time & Storage

- DB 루트는 `DB_DIR`로 설정한다. 파일은 `core.db`, `analytics.db`, `request_logs/request_logs_YYYY-MM.db` 구조로 생성된다.
- `core.db`에는 관리자 세션과 관리자 API 토큰을 위한 `admin_sessions`, `admin_api_tokens` 테이블도 생성된다.
- 일/월 경계 계산은 `TZ` 기준으로 수행된다.
- 저장되는 timestamp 문자열은 UTC ISO 형식으로 통일된다.

## Admin Auth Notes

- 관리자 브라우저 인증은 서버사이드 세션 + `HttpOnly` 쿠키를 사용한다.
- 자동화용 관리자 인증은 Bearer 관리자 API 토큰을 사용한다.
- 세션 기반 `POST/PUT/DELETE` 요청에는 CSRF 검사가 적용된다.
- OIDC는 generic discovery 방식으로 동작하며, 허용 이메일은 `OIDC_ALLOWED_EMAILS`로 제한한다.
- 권장 배포는 public/admin 게이트웨이 분리 구조다. public 쪽은 `/v1/**`, `/health`만 노출하고 admin 쪽은 관리자 프론트와 `/admin/**`를 same-origin으로 제공한다.

## Dependencies

| Package | Purpose |
|---------|---------|
| express@5 | 웹 프레임워크 |
| better-sqlite3 | SQLite 드라이버 |
| isolated-vm | 스크립트 샌드박스 실행 |
| zod | 입력 검증 |
| cors | CORS 미들웨어 |
| dotenv | 환경변수 로딩 |

## Tests

통합 테스트: `server/tests/integration/`
- `api.test.ts` - 인증, 에러, 프록시 핸들러
- `admin-auth.test.ts` - 관리자 로그인, 세션, CSRF, 관리자 토큰
- `admin.test.ts` - Admin CRUD
- `routing.test.ts` - 백엔드 선택, 요청 포워딩
- `scripts.test.ts` - 스크립트 생성, 실행, 검증

테스트 유틸: `server/tests/utils/` (`testApp.ts`, `mockBackend.ts`, `adminClient.ts`)

벤치마크: `server/benchmarks/` (`index.ts`, `runner.ts`, `scenarios.ts`, `report.ts`, `stats.ts`)

사용 문서:
- [docs/benchmarks.md](./benchmarks.md) - benchmark CLI usage, modes, output, caveats
- [docs/admin-auth.md](./admin-auth.md) - 관리자 인증, 세션, CSRF, 관리자 토큰
- [docs/oidc.md](./oidc.md) - OpenID Connect 설정과 allowlist 정책

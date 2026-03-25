# Server (Express + TypeScript)

진입점: `server/src/index.ts`

## Directory Structure

```
server/src/
  index.ts              # Express 앱 팩토리 (CORS, 라우트 설정, health 엔드포인트)
  config/
    database.ts         # Core SQLite 연결 및 스키마 초기화
    analytics-db.ts     # Analytics SQLite 연결 및 스키마 초기화
  models/
    User.ts             # 사용자 CRUD (create, findById, findByApiKey, update, delete, regenerateApiKey)
    Backend.ts          # 백엔드 CRUD (create, findById, findAll, activate/deactivate)
    Permission.ts       # 권한 관리 (user-backend 매핑)
    Script.ts           # 스크립트 CRUD (타입별 필터링, 활성화/비활성화)
  routes/
    index.ts            # 라우트 마운팅
    auth.ts             # Bearer 토큰 인증 미들웨어 (API 키 검증, 권한 로드)
    api.ts              # OpenAI 호환 프록시 엔드포인트 (/v1/chat/completions, /v1/models)
    admin.ts            # Admin CRUD 엔드포인트 (users, backends, permissions)
    scripts.ts          # Script 관리 엔드포인트
    analytics.ts        # Analytics 조회 엔드포인트
  services/
    RouterService.ts    # 백엔드 선택 (랜덤 로드밸런싱) 및 HTTP 요청 포워딩
    AnalyticsService.ts # 요청 로깅, 일별 사용량/메트릭 집계
    ScriptEngine.ts     # 스크립트 체인 오케스트레이션 (onRequest/onResponse 훅 적용)
    ScriptExecutor.ts   # isolated-vm 기반 스크립트 컴파일/실행 (5s timeout, 50MB memory)
  utils/
    apiKey.ts           # API 키 생성 (sk-{timestamp}-{random}, crypto.randomBytes)
    logger.ts           # 컬러 콘솔 로거
```

## Request Flow

```
Client → auth.ts (API 키 검증, 권한 로드)
       → RouterService.selectBackend (랜덤 선택)
       → ScriptEngine.applyOnRequestScripts (요청 변조)
       → RouterService.forwardRequest (백엔드 프록시)
       → ScriptEngine.applyOnResponseScripts (응답 변조)
       → AnalyticsService.logRequest (로깅)
       → Response
```

## Dependencies

| Package | Purpose |
|---------|---------|
| express@5 | 웹 프레임워크 |
| better-sqlite3 | SQLite 드라이버 |
| isolated-vm | 스크립트 샌드박스 실행 |
| zod | 입력 검증 |
| node-fetch | 백엔드 HTTP 요청 |
| cors | CORS 미들웨어 |
| dotenv | 환경변수 로딩 |

## Tests

통합 테스트: `server/tests/integration/`
- `api.test.ts` — 인증, 인가, 프록시 엔드포인트
- `admin.test.ts` — Admin CRUD
- `routing.test.ts` — 백엔드 선택, 요청 포워딩
- `scripts.test.ts` — 스크립트 생성, 실행, 훅

테스트 유틸: `server/tests/integration/utils/` (testApp.ts, mockBackend.ts)

벤치마크: `server/benchmarks/` (runner.ts, scenarios.ts, report.ts, stats.ts)

사용 문서:
- [docs/benchmarks.md](/C:/Users/user/Sync/Workspace/kyush-llm-router/docs/benchmarks.md) - benchmark CLI usage, modes, output, caveats

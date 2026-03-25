# Kyush LLM Router

다중 사용자 LLM 라우팅 프록시. API 키 인증, 백엔드 라우팅, 스크립트 기반 요청/응답 조작, 사용량 모니터링을 제공한다.

## Tech Stack

pnpm monorepo | Express 5 + TypeScript | Solid.js + Vite | SQLite (better-sqlite3) | isolated-vm

## Project Structure

```
server/          Express 백엔드 (포트 3000)
client/          Solid.js 어드민 대시보드 (포트 3002)
shared/          공유 TypeScript 타입
database/        SQL 스키마 원본
docs/            세부 문서
scripts/         개발 스크립트
```

## Entry Points

- Server: `server/src/index.ts`
- Client: `client/src/index.tsx`
- Shared types: `shared/types.ts`
- DB schema: `database/schema.sql`, `database/analytics-schema.sql`

## Key Concepts

**인증**: `Authorization: Bearer <api_key>` → `auth.ts` 미들웨어 → 사용자 식별 + 권한 로드

**요청 흐름**:
```
Client → Auth → Script(onRequest) → RouterService → Backend → Script(onResponse) → Response
                                                                                  → AnalyticsService(log)
```

**Script Engine**: isolated-vm 샌드박스에서 JS 실행. 3가지 타입: per-user, per-backend, per-user-backend

**Database**: core.db (users, backends, permissions, user_scripts) + analytics.db (request_logs, usage_stats, backend_metrics)

## Development

```bash
pnpm install        # 의존성 설치
pnpm run dev        # 서버 + 클라이언트 동시 실행
pnpm test           # 서버 테스트 실행
pnpm run bench      # 벤치마크 실행
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_PORT` | 3000 | Express 서버 포트 |
| `CLIENT_PORT` | 3001 | Vite 개발 서버 포트 |
| `CORE_DB_PATH` | ./data/core.db | Core DB 경로 |
| `ANALYTICS_DB_PATH` | ./data/analytics.db | Analytics DB 경로 |
| `ADMIN_PASSWORD` | (필수) | 어드민 비밀번호 |
| `CORS_ORIGINS` | localhost origins | 허용 CORS 오리진 |

## Detailed Docs

클라이언트 중심
- [docs/client.md](docs/client.md) — 클라이언트 구조, 라우트, 컴포넌트
- [docs/frontend-design.md](docs/frontend-design.md) — 프론트엔드 디자인 가이드

서버 중심
- [docs/server.md](docs/server.md) — 서버 구조, 서비스, 모델, 의존성
- [docs/database.md](docs/database.md) — DB 테이블 스키마 전체
- [docs/api.md](docs/api.md) — API 엔드포인트 레퍼런스
- [docs/scripts.md](docs/scripts.md) — Script Engine 사용법, 타입, 예제

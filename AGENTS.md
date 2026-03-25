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
- DB schema: `database/schema.sql`, `database/analytics-schema.sql`, `database/request-logs-schema.sql`

## Key Concepts

**인증**: `Authorization: Bearer <api_key>` → `auth.ts` 미들웨어 → 사용자 식별 + 권한 로드. 이 키는 라우터 접속용이며, 업스트림 요청에는 전달되지 않는다. 업스트림 `Authorization`은 `backends.api_key`가 있을 때만 해당 값으로 주입된다.

**관리자 인증**: 관리자 프론트와 `/admin/**` API는 별도 관리자 인증을 사용한다. 브라우저는 서버사이드 세션 + `HttpOnly` 쿠키, 자동화는 관리자 API 토큰을 사용하며, 인증 모드는 `ADMIN_AUTH_MODE=env|oidc|both` 로 제어한다.

**요청 흐름**:
```
Client → Auth → Script(onRequest) → RouterService → Backend → Script(onResponse) → Response
                                                                                  → AnalyticsService(log)
```

**Script Engine**: isolated-vm 샌드박스에서 JS 실행. 3가지 타입: per-user, per-backend, per-user-backend

**Database**: `DB_DIR` 하위에 `core.db` (users, backends, permissions, user_scripts), `analytics.db` (usage_stats, backend_metrics), `request_logs/request_logs_YYYY-MM.db` (상세 요청 로그)

**관리자 세션/토큰 저장**: `core.db` 안에 `admin_sessions`, `admin_api_tokens` 테이블이 생성되며, 관리자 로그인 세션과 자동화용 관리자 토큰을 저장한다.

**상세 로그 조회**: `month` 또는 `date`를 지정하면 해당 월 DB 1개만 조회한다. 둘 다 없으면 최신 월부터 월별 DB를 순차 조회하며 `offset`/`limit`을 적용한다.

**배포 분리**: 권장 운영 배포는 public/admin 게이트웨이 2개 진입점이다. public gateway는 `/v1/**`, `/health`만 외부 공개하고, admin gateway는 내부망/VPN에서만 관리자 프론트와 `/admin/**`를 제공한다.

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
| `DB_DIR` | ./data | DB 루트 경로 (`core.db`, `analytics.db`, `request_logs/` 생성 위치) |
| `TZ` | UTC | 일/월 경계 계산용 타임존. 저장 timestamp는 UTC |
| `CORS_ORIGINS` | localhost origins | 허용 CORS 오리진 |
| `ADMIN_AUTH_MODE` | `both` | 관리자 로그인 모드 (`env`, `oidc`, `both`) |
| `ADMIN_USERNAME` | `admin` 예시 | ENV 관리자 로그인 아이디 |
| `ADMIN_PASSWORD_HASH` | (권장 필수) | 관리자 비밀번호 hash (`sha256$...` 또는 `scrypt$...`) |
| `ADMIN_SESSION_SECRET` | (필수) | 관리자 세션/토큰 hash salt 용 비밀값 |
| `ADMIN_SESSION_TTL_HOURS` | `12` | 관리자 세션 만료 시간 |
| `ADMIN_API_TOKEN_TTL_DAYS` | `30` | 관리자 API 토큰 만료 일수 |
| `ADMIN_TRUSTED_PROXY_IPS` | empty | 관리자 경로 접근을 허용할 프록시 IP 목록 |
| `OIDC_ISSUER_URL` | empty | OpenID Connect issuer URL |
| `OIDC_CLIENT_ID` | empty | OIDC client id |
| `OIDC_CLIENT_SECRET` | empty | OIDC client secret |
| `OIDC_REDIRECT_URI` | empty | OIDC callback URL |
| `OIDC_ALLOWED_EMAILS` | empty | 관리자 접근을 허용할 이메일 목록 |
| `OIDC_SCOPES` | `openid profile email` | OIDC authorization scope |

## Detailed Docs

클라이언트 중심
- [docs/client.md](docs/client.md) — 클라이언트 구조, 라우트, 컴포넌트
- [docs/frontend-design.md](docs/frontend-design.md) — 프론트엔드 디자인 가이드
- [docs/admin-auth.md](docs/admin-auth.md) — 관리자 인증, 세션, CSRF, 관리자 토큰
- [docs/oidc.md](docs/oidc.md) — OpenID Connect 설정과 allowlist 정책

서버 중심
- [docs/server.md](docs/server.md) — 서버 구조, 서비스, 모델, 의존성
- [docs/database.md](docs/database.md) — DB 테이블 스키마 전체
- [docs/api.md](docs/api.md) — API 엔드포인트 레퍼런스
- [docs/k8s-traefik.md](docs/k8s-traefik.md) — Traefik IngressRoute, 내부망 IP allowlist 기반 Kubernetes 배포 예시
- [docs/scripts.md](docs/scripts.md) — Script Engine 사용법, 타입, 예제
- [docs/benchmarks.md](docs/benchmarks.md) — benchmark CLI 사용법

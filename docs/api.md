# API Reference

서버 포트: `SERVER_PORT` (기본 3000)

---

## Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | 서버 상태 확인 (status, timestamp) |
| GET | `/admin/health` | 관리자 인증이 필요한 Admin 라우터 상태 확인 (status, timestamp) |

## OpenAI-Compatible Proxy (인증 필요)

`Authorization: Bearer <user_api_key>` 헤더 필수.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/chat/completions` | Chat completions 프록시 (스크립트 적용, 분석 로깅) |
| GET | `/v1/models` | 사용 가능한 모델 목록 |

`/v1/**`는 기존 사용자 API 키 인증을 유지하며 관리자 인증과 분리된다.

## Admin API

`/admin/**`는 기본적으로 관리자 인증이 필요하다. 브라우저는 세션 쿠키, 자동화는 `Authorization: Bearer <admin_api_token>` 방식으로 접근한다.

세션 기반 요청에서 `POST`, `PUT`, `DELETE`를 호출할 때는 `GET /admin/auth/session`에서 받은 CSRF 토큰을 `X-CSRF-Token` 헤더로 함께 보내야 한다.

### Auth

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/auth/session` | 현재 관리자 로그인 상태, principal, auth mode, CSRF 토큰 조회 |
| POST | `/admin/auth/login` | ENV 관리자 계정 로그인 후 세션 쿠키 발급 |
| POST | `/admin/auth/logout` | 현재 관리자 세션 종료 |
| GET | `/admin/auth/oidc/start` | OIDC 로그인 시작 |
| GET | `/admin/auth/oidc/callback` | OIDC code exchange 후 세션 생성, 관리자 화면으로 redirect |
| GET | `/admin/auth/tokens` | 현재 관리자 principal이 발급한 API 토큰 목록 조회 |
| POST | `/admin/auth/tokens` | 새 관리자 API 토큰 발급 |
| DELETE | `/admin/auth/tokens/:id` | 관리자 API 토큰 폐기 |

### Users

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/users` | 전체 사용자 목록 |
| POST | `/admin/users` | 사용자 생성 (API 키 자동 발급) |
| GET | `/admin/users/:id` | 사용자 조회 |
| PUT | `/admin/users/:id` | 사용자 수정 (name, email, is_active, detail_logging) |
| DELETE | `/admin/users/:id` | 사용자 삭제 |
| POST | `/admin/users/:id/regenerate-api-key` | API 키 재발급 |

### Backends

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/backends` | 전체 백엔드 목록 |
| POST | `/admin/backends` | 백엔드 생성 (name, base_url, api_key, detail_logging) |
| GET | `/admin/backends/:id` | 백엔드 조회 |
| PUT | `/admin/backends/:id` | 백엔드 수정 |
| DELETE | `/admin/backends/:id` | 백엔드 삭제 |

### Permissions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/permissions` | 전체 권한 목록 |
| GET | `/admin/permissions/user/:userId` | 사용자별 권한 조회 |
| GET | `/admin/permissions/backend/:backendId` | 백엔드별 권한 조회 |
| POST | `/admin/permissions` | 권한 부여 (user_id, backend_id) |
| DELETE | `/admin/permissions?user_id=X&backend_id=Y` | 권한 해제 |

### Scripts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/scripts` | 전체 스크립트 목록 |
| GET | `/admin/scripts/active` | 활성 스크립트 목록 |
| GET | `/admin/scripts/type/:type` | 타입별 스크립트 목록 |
| GET | `/admin/scripts/:id` | 스크립트 조회 |
| POST | `/admin/scripts` | 스크립트 생성 |
| PUT | `/admin/scripts/:id` | 스크립트 수정 |
| DELETE | `/admin/scripts/:id` | 스크립트 삭제 |
| POST | `/admin/scripts/:id/activate` | 스크립트 활성화 |
| POST | `/admin/scripts/:id/deactivate` | 스크립트 비활성화 |
| POST | `/admin/scripts/:id/test` | 스크립트 테스트 실행 (`request` 필수, `user`/`backend` 선택) |

### Analytics

| Method | Path | Query Params | Description |
|--------|------|-------------|-------------|
| GET | `/admin/analytics/usage` | userId, backendId, days | 사용량 통계 |
| GET | `/admin/analytics/requests` | month, date, limit, offset, q, userId, backendId, endpoint, detailLogged | 월별 상세 요청 로그 조회 |
| GET | `/admin/analytics/metrics` | backendId, days | 백엔드 성능 메트릭 |

상세 로그는 `users.detail_logging=1` 또는 `backends.detail_logging=1`일 때만 request/response header/body가 저장된다.

참고:
- 관리자 인증과 세션/토큰 정책은 [docs/admin-auth.md](./admin-auth.md) 참고
- OpenID Connect 설정은 [docs/oidc.md](./oidc.md) 참고

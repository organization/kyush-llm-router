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
| POST | `/v1/chat/completions` | Chat completions 프록시 (모델 카탈로그 기반 라우팅, 스크립트 적용, 분석 로깅) |
| GET | `/v1/models` | 허용 가능한 활성 백엔드들의 캐시된 모델 목록 합집합 |

`/v1/**`는 기존 사용자 API 키 인증을 유지하며 관리자 인증과 분리된다.

추가 동작:
- `/v1/chat/completions` 는 요청 모델명을 먼저 전역 rewrite 규칙으로 해석한 뒤, 최종 모델을 서빙하는 허용 가능한 활성 백엔드만 후보로 사용한다
- `force=true` rewrite 는 항상 적용된다
- `force=false` rewrite 는 원본 모델을 서빙하는 허용 가능한 활성 백엔드가 없을 때만 fallback 으로 적용된다
- 최종 후보가 없으면 모델 미지원 오류를 반환하고 `request_model`, `routed_model` 을 함께 내려준다

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
| GET | `/admin/backends/:id/models` | 백엔드별 모델 스냅샷 + 메모리 캐시 상태 조회 |
| POST | `/admin/backends/:id/models/refresh` | 활성 백엔드 모델 캐시 강제 갱신 |

### Models

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/models/cache` | 전체 메모리 모델 캐시 상태와 모델 집계 조회 |
| GET | `/admin/model-rewrites` | 전역 모델 rewrite 규칙 목록 |
| POST | `/admin/model-rewrites` | 전역 모델 rewrite 규칙 생성 (`force=true` 면 항상 rewrite, 아니면 fallback) |
| PUT | `/admin/model-rewrites/:id` | 전역 모델 rewrite 규칙 수정 |
| DELETE | `/admin/model-rewrites/:id` | 전역 모델 rewrite 규칙 삭제 |

`GET /admin/backends/:id/models` 응답에는 아래가 함께 포함된다.
- `backend`: 백엔드 기본 정보 + 캐시 요약
- `cache`: 메모리 캐시 상태 (`ready`, `uninitialized`, `error`, `inactive`)
- `snapshots`: DB에 저장된 마지막 모델 스냅샷
- `models`: 현재 메모리 캐시에 올라와 있는 모델 ID 목록

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
| GET | `/admin/analytics/daily-totals` | backendId, days | 일별 전체 request/token 합계 |
| GET | `/admin/analytics/backend-quality` | backendId, days | 일별 backend response time / error / success rate 시계열 |
| GET | `/admin/analytics/model-trends` | backendId, days, limit | 모델별 일별 요청 추이 |
| GET | `/admin/analytics/response-length-histogram` | backendId, days, bins | `completion_tokens` 분포 histogram |
| GET | `/admin/analytics/response-length-box-plot` | backendId, days | `completion_tokens` 일별 box plot 요약 |

상세 로그는 `users.detail_logging=1` 또는 `backends.detail_logging=1`일 때만 request/response header/body가 저장된다.

- `model-trends` 는 `response_model -> routed_model -> request_model -> unknown` 순서로 모델 키를 결정한다.
- response length 계열 endpoint는 `completion_tokens` 가 있는 요청만 집계한다.
- 자세한 내용은 [docs/analytics.md](./analytics.md) 참고.

### Dashboard Summary

| Method | Path | Query Params | Description |
|--------|------|-------------|-------------|
| GET | `/admin/dashboard/summary` | days | Dashboard 홈용 운영 요약, backend/script/access context, 최소 시계열 집계 반환 |

참고:
- 관리자 인증과 세션/토큰 정책은 [docs/admin-auth.md](./admin-auth.md) 참고
- OpenID Connect 설정은 [docs/oidc.md](./oidc.md) 참고

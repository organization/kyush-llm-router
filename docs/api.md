# API Reference

서버 포트: `SERVER_PORT` (기본 3000)

---

## Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | 서버 상태 확인 (status, timestamp) |

## OpenAI-Compatible Proxy (인증 필요)

`Authorization: Bearer <user_api_key>` 헤더 필수.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/chat/completions` | Chat completions 프록시 (스크립트 적용, 분석 로깅) |
| GET | `/v1/models` | 사용 가능한 모델 목록 |

## Admin API

### Users

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/users` | 전체 사용자 목록 |
| POST | `/admin/users` | 사용자 생성 (API 키 자동 발급) |
| GET | `/admin/users/:id` | 사용자 조회 |
| PUT | `/admin/users/:id` | 사용자 수정 (name, email, is_active) |
| DELETE | `/admin/users/:id` | 사용자 삭제 |
| POST | `/admin/users/:id/regenerate-api-key` | API 키 재발급 |

### Backends

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/backends` | 전체 백엔드 목록 |
| POST | `/admin/backends` | 백엔드 생성 (name, base_url, api_key) |
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
| DELETE | `/admin/permissions?user_id=X&backend_id=Y` | 권한 삭제 |

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
| POST | `/admin/scripts/:id/test` | 스크립트 테스트 실행 |

### Analytics

| Method | Path | Query Params | Description |
|--------|------|-------------|-------------|
| GET | `/admin/analytics/usage` | userId, backendId, days | 사용량 통계 |
| GET | `/admin/analytics/requests` | limit, offset | 요청 로그 (페이지네이션) |
| GET | `/admin/analytics/metrics` | backendId, days | 백엔드 성능 메트릭 |

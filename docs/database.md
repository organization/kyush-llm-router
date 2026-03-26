# Database Schema

DB는 `DB_DIR` 하위에 분리 저장된다.

스키마 원본: [database/schema.sql](../database/schema.sql), [database/analytics-schema.sql](../database/analytics-schema.sql), [database/request-logs-schema.sql](../database/request-logs-schema.sql)

---

## Core Database (`core.db`)

### users

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| api_key | TEXT | UNIQUE NOT NULL |
| name | TEXT | NOT NULL |
| email | TEXT | |
| is_active | BOOLEAN | DEFAULT 1 |
| detail_logging | INTEGER | NOT NULL DEFAULT 0 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

Indexes: `idx_users_api_key(api_key)`

### backends

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| name | TEXT | UNIQUE NOT NULL |
| base_url | TEXT | NOT NULL |
| api_key | TEXT | |
| is_active | BOOLEAN | DEFAULT 1 |
| detail_logging | INTEGER | NOT NULL DEFAULT 0 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

### backend_models

백엔드가 마지막으로 광고한 모델 스냅샷. 요청 라우팅에는 사용하지 않고 관리자 조회와 오프라인 확인용으로만 사용한다.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| backend_id | INTEGER | NOT NULL, FK → `backends(id)` |
| model_id | TEXT | NOT NULL |
| raw_json | TEXT | |
| fetched_at | TEXT | NOT NULL |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |

Unique: `(backend_id, model_id)`

Indexes: `idx_backend_models_backend(backend_id)`, `idx_backend_models_model(model_id)`

### model_rewrites

요청 모델명을 실제 라우팅 모델명으로 변환하는 전역 규칙.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| source_model | TEXT | UNIQUE NOT NULL |
| target_model | TEXT | NOT NULL |
| is_active | BOOLEAN | DEFAULT 1 |
| force | BOOLEAN | DEFAULT 0 |
| note | TEXT | |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |

의미:
- `force = 1`: 항상 `target_model` 로 rewrite
- `force = 0`: 원본 모델을 서빙하는 허용 가능한 활성 백엔드가 없을 때만 fallback rewrite

### permissions

`users`와 `backends`의 many-to-many 관계.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| user_id | INTEGER | NOT NULL, FK → `users(id)` |
| backend_id | INTEGER | NOT NULL, FK → `backends(id)` |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

Unique: `(user_id, backend_id)`

Indexes: `idx_permissions_user(user_id)`, `idx_permissions_backend(backend_id)`

### user_scripts

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| name | TEXT | UNIQUE NOT NULL |
| script_type | TEXT | NOT NULL, CHECK IN (`'per-user-backend'`, `'per-backend'`, `'per-user'`) |
| target_user_id | INTEGER | FK → `users(id)` |
| target_backend_id | INTEGER | FK → `backends(id)` |
| script_code | TEXT | NOT NULL |
| is_active | BOOLEAN | DEFAULT 1 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

Indexes: `idx_user_scripts_type`, `idx_user_scripts_active`, `idx_user_scripts_target_user`, `idx_user_scripts_target_backend`

### admin_sessions

관리자 브라우저 로그인 세션 저장소. 세션 쿠키 원문은 저장하지 않고 `session_token_hash`를 저장한다.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| session_token_hash | TEXT | UNIQUE NOT NULL |
| provider | TEXT | NOT NULL, CHECK IN (`'env'`, `'oidc'`) |
| subject | TEXT | NOT NULL |
| username | TEXT | |
| email | TEXT | |
| display_name | TEXT | NOT NULL |
| csrf_token | TEXT | NOT NULL |
| expires_at | TEXT | NOT NULL |
| last_used_at | TEXT | |
| revoked_at | TEXT | |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |

Indexes: `idx_admin_sessions_subject(subject)`, `idx_admin_sessions_expires_at(expires_at)`

### admin_api_tokens

자동화/서비스 연동용 관리자 API 토큰 저장소. DB에는 토큰 원문이 아니라 `token_hash`와 `token_prefix`만 저장한다.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| token_hash | TEXT | UNIQUE NOT NULL |
| name | TEXT | NOT NULL |
| provider | TEXT | NOT NULL, CHECK IN (`'env'`, `'oidc'`) |
| subject | TEXT | NOT NULL |
| username | TEXT | |
| email | TEXT | |
| display_name | TEXT | NOT NULL |
| token_prefix | TEXT | NOT NULL |
| expires_at | TEXT | NOT NULL |
| last_used_at | TEXT | |
| revoked_at | TEXT | |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |

Indexes: `idx_admin_api_tokens_subject(subject)`, `idx_admin_api_tokens_expires_at(expires_at)`

---

## Analytics Database (`analytics.db`)

일별 집계 테이블. 날짜 경계는 `TZ`, 저장 timestamp는 UTC 기준이다.

### usage_stats

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| user_id | INTEGER | NOT NULL |
| backend_id | INTEGER | NOT NULL |
| date | DATE | NOT NULL |
| total_requests | INTEGER | DEFAULT 0 |
| total_tokens | INTEGER | DEFAULT 0 |

Unique: `(user_id, backend_id, date)`

Indexes: `idx_usage_stats_user`, `idx_usage_stats_date`

### backend_metrics

백엔드별 일별 성능 집계.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| backend_id | INTEGER | NOT NULL |
| date | DATE | NOT NULL |
| total_requests | INTEGER | DEFAULT 0 |
| total_tokens | INTEGER | DEFAULT 0 |
| avg_response_time_ms | REAL | DEFAULT 0 |
| error_count | INTEGER | DEFAULT 0 |
| success_rate | REAL | DEFAULT 1.0 |

Unique: `(backend_id, date)`

Indexes: `idx_backend_metrics_backend`, `idx_backend_metrics_date`

## Monthly Request Logs (`request_logs/request_logs_YYYY-MM.db`)

월별 상세 요청 로그는 별도 SQLite 파일에 저장된다.

### request_logs

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| user_id | INTEGER | NOT NULL |
| backend_id | INTEGER | NOT NULL |
| endpoint | TEXT | NOT NULL |
| request_model | TEXT | |
| routed_model | TEXT | rewrite 후 실제 라우팅에 사용된 모델 |
| response_model | TEXT | |
| prompt_tokens | INTEGER | |
| completion_tokens | INTEGER | |
| total_tokens | INTEGER | |
| status_code | INTEGER | |
| response_time_ms | INTEGER | |
| error_message | TEXT | |
| detail_logged | INTEGER | NOT NULL DEFAULT 0 |
| local_date | TEXT | `TZ` 기준 `YYYY-MM-DD` |
| request_headers | TEXT | JSON 문자열 |
| request_body | TEXT | JSON 또는 raw 문자열 |
| response_headers | TEXT | JSON 문자열 |
| response_body | TEXT | JSON 또는 raw 문자열 |
| created_at | TEXT | UTC ISO timestamp |

Indexes: `idx_request_logs_created_at`, `idx_request_logs_local_date`, `idx_request_logs_user`, `idx_request_logs_backend`, `idx_request_logs_endpoint`, `idx_request_logs_detail_logged`

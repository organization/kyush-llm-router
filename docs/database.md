# Database Schema

두 개의 SQLite 데이터베이스를 사용한다. 설정 데이터는 `core.db`, 운영 데이터는 `analytics.db`에 저장된다.

스키마 원본: [database/schema.sql](../database/schema.sql), [database/analytics-schema.sql](../database/analytics-schema.sql)

---

## Core Database (core.db)

### users

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| api_key | TEXT | UNIQUE NOT NULL |
| name | TEXT | NOT NULL |
| email | TEXT | |
| is_active | BOOLEAN | DEFAULT 1 |
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
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

### permissions

users와 backends의 many-to-many 관계.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| user_id | INTEGER | NOT NULL, FK → users(id) |
| backend_id | INTEGER | NOT NULL, FK → backends(id) |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

Unique: `(user_id, backend_id)`
Indexes: `idx_permissions_user(user_id)`, `idx_permissions_backend(backend_id)`

### user_scripts

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| name | TEXT | UNIQUE NOT NULL |
| script_type | TEXT | NOT NULL, CHECK IN ('per-user-backend', 'per-backend', 'per-user') |
| target_user_id | INTEGER | FK → users(id) |
| target_backend_id | INTEGER | FK → backends(id) |
| script_code | TEXT | NOT NULL |
| is_active | BOOLEAN | DEFAULT 1 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

Indexes: `idx_user_scripts_type`, `idx_user_scripts_active`, `idx_user_scripts_target_user`, `idx_user_scripts_target_backend`

---

## Analytics Database (analytics.db)

### request_logs

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| user_id | INTEGER | NOT NULL |
| backend_id | INTEGER | NOT NULL |
| endpoint | TEXT | NOT NULL |
| request_model | TEXT | |
| response_model | TEXT | |
| prompt_tokens | INTEGER | |
| completion_tokens | INTEGER | |
| total_tokens | INTEGER | |
| status_code | INTEGER | |
| response_time_ms | INTEGER | |
| error_message | TEXT | |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

Indexes: `idx_request_logs_user`, `idx_request_logs_backend`, `idx_request_logs_date(created_at)`, `idx_request_logs_user_backend`

### usage_stats

일별 집계 테이블.

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

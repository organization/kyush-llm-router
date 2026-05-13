-- Core Database Schema
-- Stores users, backends, and permissions

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    is_active BOOLEAN DEFAULT 1,
    detail_logging INTEGER NOT NULL DEFAULT 0,
    copy_reasoning_to_reasoning_content INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backends table
CREATE TABLE IF NOT EXISTS backends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    base_url TEXT NOT NULL,
    api_key TEXT,
    is_active BOOLEAN DEFAULT 1,
    detail_logging INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backend model snapshots (offline/admin visibility only)
CREATE TABLE IF NOT EXISTS backend_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backend_id INTEGER NOT NULL,
    model_id TEXT NOT NULL,
    raw_json TEXT,
    fetched_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (backend_id) REFERENCES backends(id) ON DELETE CASCADE,
    UNIQUE(backend_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_backend_models_backend ON backend_models(backend_id);
CREATE INDEX IF NOT EXISTS idx_backend_models_model ON backend_models(model_id);

-- Global model rewrite rules
CREATE TABLE IF NOT EXISTS model_rewrites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_model TEXT UNIQUE NOT NULL,
    target_model TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    force BOOLEAN DEFAULT 0,
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Permissions table (many-to-many: users ↔ backends)
CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    backend_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (backend_id) REFERENCES backends(id) ON DELETE CASCADE,
    UNIQUE(user_id, backend_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
CREATE INDEX IF NOT EXISTS idx_permissions_user ON permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_permissions_backend ON permissions(backend_id);

-- User Scripts table
CREATE TABLE IF NOT EXISTS user_scripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    script_type TEXT NOT NULL CHECK(script_type IN ('per-user-backend', 'per-backend', 'per-user')),
    target_user_id INTEGER,
    target_backend_id INTEGER,
    script_code TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (target_backend_id) REFERENCES backends(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_scripts_type ON user_scripts(script_type);
CREATE INDEX IF NOT EXISTS idx_user_scripts_active ON user_scripts(is_active);
CREATE INDEX IF NOT EXISTS idx_user_scripts_target_user ON user_scripts(target_user_id);
CREATE INDEX IF NOT EXISTS idx_user_scripts_target_backend ON user_scripts(target_backend_id);

-- Admin sessions table
CREATE TABLE IF NOT EXISTS admin_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_token_hash TEXT UNIQUE NOT NULL,
    provider TEXT NOT NULL CHECK(provider IN ('env', 'oidc')),
    subject TEXT NOT NULL,
    username TEXT,
    email TEXT,
    display_name TEXT NOT NULL,
    csrf_token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_used_at TEXT,
    revoked_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_subject ON admin_sessions(subject);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);

-- Admin API tokens table
CREATE TABLE IF NOT EXISTS admin_api_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    provider TEXT NOT NULL CHECK(provider IN ('env', 'oidc')),
    subject TEXT NOT NULL,
    username TEXT,
    email TEXT,
    display_name TEXT NOT NULL,
    token_prefix TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_used_at TEXT,
    revoked_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_api_tokens_subject ON admin_api_tokens(subject);
CREATE INDEX IF NOT EXISTS idx_admin_api_tokens_expires_at ON admin_api_tokens(expires_at);

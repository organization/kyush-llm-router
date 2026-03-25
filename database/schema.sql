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

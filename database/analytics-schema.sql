-- Analytics Database Schema
-- Stores request logs, usage stats, and backend metrics

-- Request logs table
CREATE TABLE IF NOT EXISTS request_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    backend_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL,
    request_model TEXT,
    response_model TEXT,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    status_code INTEGER,
    response_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usage stats table (aggregated daily per user-backend pair)
CREATE TABLE IF NOT EXISTS usage_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    backend_id INTEGER NOT NULL,
    date DATE NOT NULL,
    total_requests INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    UNIQUE(user_id, backend_id, date)
);

-- Backend metrics table (aggregated daily per backend)
CREATE TABLE IF NOT EXISTS backend_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backend_id INTEGER NOT NULL,
    date DATE NOT NULL,
    total_requests INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    avg_response_time_ms REAL DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    success_rate REAL DEFAULT 1.0,
    UNIQUE(backend_id, date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_request_logs_user ON request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_backend ON request_logs(backend_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_date ON request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_request_logs_user_backend ON request_logs(user_id, backend_id);
CREATE INDEX IF NOT EXISTS idx_usage_stats_user ON usage_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_stats_date ON usage_stats(date);
CREATE INDEX IF NOT EXISTS idx_backend_metrics_backend ON backend_metrics(backend_id);
CREATE INDEX IF NOT EXISTS idx_backend_metrics_date ON backend_metrics(date);

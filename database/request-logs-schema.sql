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
    detail_logged INTEGER NOT NULL DEFAULT 0,
    local_date TEXT NOT NULL,
    request_headers TEXT,
    request_body TEXT,
    response_headers TEXT,
    response_body TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_request_logs_local_date ON request_logs(local_date);
CREATE INDEX IF NOT EXISTS idx_request_logs_user ON request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_backend ON request_logs(backend_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_endpoint ON request_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_request_logs_detail_logged ON request_logs(detail_logged);


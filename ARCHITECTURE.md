# Kyush LLM Router Architecture Document

## Overview

Kyush LLM Router is a proxy server that manages multiple users and routes their requests to various OpenAI-compatible backend APIs. It provides API key-based authentication, user permission management, and usage monitoring through an admin web dashboard.

## System Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                                  │
├─────────────────────┬───────────────────────────────┬─────────────────────┤
│  LLM Clients        │  Admin Dashboard              │  Vite Dev Server    │
│  (OpenAI SDK etc)   │  (Solid.js + Vite)            │  (Port 5173)        │
└──────────┬──────────┴──────────────┬────────────────┴──────────┬──────────┘
           │                         │                           │
           │  OpenAI-Compatible API  │  REST API                 │
           │  (Port 3000)            │  (Port 3001)              │
           ▼                         ▼                           │
┌───────────────────────────────────────────────────────────────────────────┐
│                         Router Server (Node.js/Express)                    │
│                              (Port 3000)                                   │
├───────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────────────┐    │
│  │  Authentication Middleware                                        │    │
│  │  - API Key Validation                                             │    │
│  │  - Rate Limiting                                                  │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│  ┌───────────────────────────────────────────────────────────────────┐    │
│  │  Request Router                                                   │    │
│  │  - Backend Selection                                              │    │
│  │  - Load Balancing (optional)                                      │    │
│  │  - Request/Response Transformation                                │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│  ┌───────────────────────────────────────────────────────────────────┐    │
│  │  Admin API Endpoints (proxied to Vite dev server)                │    │
│  │  - User Management                                                │    │
│  │  - Backend Management                                             │    │
│  │  - Permission Management                                          │    │
│  │  - Usage Analytics                                                │    │
│  └───────────────────────────────────────────────────────────────────┘    │
└────────────────────────────┬──────────────────────────────────────────────┘
                             │
           ┌─────────────────┴─────────────────┐
           ▼                                   ▼
┌───────────────────────┐         ┌─────────────────────────┐
│  Core Database        │         │  Analytics Database     │
│  (SQLite - core.db)   │         │  (SQLite - analytics.db)│
├───────────────────────┤         ├─────────────────────────┤
│  - users              │         │  - request_logs         │
│  - backends           │         │  - usage_stats          │
│  - permissions        │         │  - backend_metrics      │
└───────────────────────┘         └─────────────────────────┘
           │                                   │
           └─────────────────┬─────────────────┘
                             ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                              Backend Layer                                 │
├───────────────────────────────────────────────────────────────────────────┤
│  Multiple OpenAI-Compatible APIs (vLLM, SGLang, etc.)                     │
└───────────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
kyush-llm-router/
├── server/
│   ├── src/
│   │   ├── index.ts                  # Express app entry point
│   │   ├── config/
│   │   │   ├── database.ts           # Core SQLite connection
│   │   │   └── analytics-db.ts       # Analytics SQLite connection
│   │   ├── routes/
│   │   │   ├── api.ts                # OpenAI-compatible API proxy
│   │   │   ├── admin.ts              # Admin management API
│   │   │   └── auth.ts               # Authentication middleware
│   │   ├── models/
│   │   │   ├── User.ts               # User model
│   │   │   ├── Backend.ts            # Backend model
│   │   │   └── Permission.ts         # Permission model
│   │   ├── analytics/
│   │   │   ├── RequestLog.ts         # Request log model (analytics DB)
│   │   │   ├── UsageStats.ts         # Usage stats model (analytics DB)
│   │   │   └── BackendMetrics.ts     # Backend metrics model
│   │   ├── services/
│   │   │   ├── AuthService.ts        # API key validation
│   │   │   ├── RouterService.ts      # Backend routing logic
│   │   │   └── AnalyticsService.ts   # Usage tracking
│   │   └── utils/
│   │       └── logger.ts             # Logging utility
│   ├── package.json
│   └── tsconfig.json
│
├── client/
│   ├── src/
│   │   ├── index.tsx                 # Solid.js entry point
│   │   ├── App.tsx                   # Main application component
│   │   ├── routes/
│   │   │   ├── Dashboard.tsx         # Main dashboard
│   │   │   ├── Users.tsx             # User management
│   │   │   ├── Backends.tsx          # Backend management
│   │   │   ├── Permissions.tsx       # Permission management
│   │   │   └── Analytics.tsx         # Usage monitoring
│   │   ├── components/
│   │   │   ├── Layout.tsx            # Admin layout
│   │   │   ├── UserTable.tsx         # User list table
│   │   │   ├── BackendTable.tsx      # Backend list table
│   │   │   └── StatsChart.tsx        # Usage chart component
│   │   ├── api/
│   │   │   └── client.ts             # API client for admin endpoints
│   │   └── types/
│   │       └── index.ts              # TypeScript type definitions
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── shared/
│   └── types.ts                      # Shared type definitions
│
├── database/
│   ├── schema.sql                    # Core database schema
│   └── analytics-schema.sql          # Analytics database schema
│
├── scripts/
│   └── dev.js                        # Dev server launcher (runs both)
│
├── docker-compose.yml                # Docker Compose setup
├── package.json                      # Root package.json (scripts)
└── README.md
```

## Core Components

### 1. Server (Node.js/Express)

#### Authentication Middleware (`src/routes/auth.ts`)
- Validates API keys from incoming requests
- Extracts user identity from `Authorization: Bearer <api_key>` header
- Returns 401 if authentication fails
- Attaches user info to request object for downstream handlers

#### API Proxy Route (`src/routes/api.ts`)
```typescript
// OpenAI-compatible endpoints
POST /v1/chat/completions
POST /v1/completions
GET  /v1/models
```
- Forwards requests to selected backend
- Handles request/response transformation
- Logs all requests for analytics

#### Admin API Route (`src/routes/admin.ts`)
```typescript
// User Management
POST   /admin/users          # Create user
GET    /admin/users          # List users
PUT    /admin/users/:id      # Update user
DELETE /admin/users/:id      # Delete user

// Backend Management
POST   /admin/backends       # Add backend
GET    /admin/backends       # List backends
PUT    /admin/backends/:id   # Update backend
DELETE /admin/backends/:id   # Delete backend

// Permission Management
POST   /admin/permissions    # Grant permission
DELETE /admin/permissions    # Revoke permission
GET    /admin/permissions    # List permissions

// Analytics
GET    /admin/analytics/usage       # Usage statistics
GET    /admin/analytics/requests    # Request logs
```

#### Router Service (`src/services/RouterService.ts`)
- Selects appropriate backend based on:
  - User's permissions
  - Backend availability
  - Load balancing strategy (round-robin, least-loaded)
- Handles backend failures with retry logic

### 2. Client (Solid.js + Vite)

#### Pages
- **Dashboard**: Overview of system status, recent activity
- **Users**: CRUD operations for users, API key generation
- **Backends**: Manage backend API configurations
- **Permissions**: Assign/revoke backend access per user
- **Analytics**: View usage statistics and request logs

#### Key Features
- Real-time updates via polling or WebSocket (optional)
- Form validation for user/backend input
- Error handling with user-friendly messages
- Responsive design for various screen sizes

### 3. Databases (SQLite)

#### Core Database Schema (core.db)

```sql
-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backends table
CREATE TABLE backends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    base_url TEXT NOT NULL,
    api_key TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table (many-to-many: users ↔ backends)
CREATE TABLE permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    backend_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (backend_id) REFERENCES backends(id),
    UNIQUE(user_id, backend_id)
);

-- Indexes for performance
CREATE INDEX idx_users_api_key ON users(api_key);
CREATE INDEX idx_permissions_user ON permissions(user_id);
CREATE INDEX idx_permissions_backend ON permissions(backend_id);
```

#### Analytics Database Schema (analytics.db)

```sql
-- Request logs table
CREATE TABLE request_logs (
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (backend_id) REFERENCES backends(id)
);

-- Usage stats table (aggregated daily)
CREATE TABLE usage_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    backend_id INTEGER NOT NULL,
    date DATE NOT NULL,
    total_requests INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (backend_id) REFERENCES backends(id),
    UNIQUE(user_id, backend_id, date)
);

-- Backend metrics table (aggregated metrics per backend)
CREATE TABLE backend_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backend_id INTEGER NOT NULL,
    date DATE NOT NULL,
    total_requests INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    avg_response_time_ms REAL DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    success_rate REAL DEFAULT 1.0,
    FOREIGN KEY (backend_id) REFERENCES backends(id),
    UNIQUE(backend_id, date)
);

-- Indexes for performance
CREATE INDEX idx_request_logs_user ON request_logs(user_id);
CREATE INDEX idx_request_logs_backend ON request_logs(backend_id);
CREATE INDEX idx_request_logs_date ON request_logs(created_at);
CREATE INDEX idx_usage_stats_user ON usage_stats(user_id);
CREATE INDEX idx_usage_stats_date ON usage_stats(date);
CREATE INDEX idx_backend_metrics_backend ON backend_metrics(backend_id);
CREATE INDEX idx_backend_metrics_date ON backend_metrics(date);
```

## API Design

### OpenAI-Compatible API Proxy

The router exposes the same API interface as OpenAI, making it easy for clients to integrate.

#### Example Request
```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer <user_api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-3",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

#### Example Response
```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "llama-3",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help you?"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 15,
    "total_tokens": 25
  }
}
```

### Admin API

#### Create User
```bash
POST /admin/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}

Response: {
  "id": 1,
  "name": "John Doe",
  "api_key": "sk-xxx...",
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### Add Backend
```bash
POST /admin/backends
Content-Type: application/json

{
  "name": "vLLM Server 1",
  "base_url": "http://localhost:8000/v1",
  "api_key": "backend-key-xxx"
}
```

## Security Considerations

1. **API Key Storage**: API keys are stored hashed in the database
2. **Transport Security**: Use HTTPS in production
3. **Rate Limiting**: Implement per-user rate limits
4. **Input Validation**: Validate all admin API inputs
5. **CORS**: Configure CORS for admin dashboard only

## Deployment

### Development

Run both server and client with a single command:

```bash
npm run dev
```

This starts:
- Express server on port 3000
- Vite dev server on port 3001 (admin API routes proxied from Express)

### Docker Compose

```yaml
version: '3.8'

services:
  router:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - SERVER_PORT=3000
      - CLIENT_PORT=3001
      - CORE_DB_PATH=/data/core.db
      - ANALYTICS_DB_PATH=/data/analytics.db
    volumes:
      - router-data:/data
    restart: unless-stopped

volumes:
  router-data:
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVER_PORT` | Express server port | `3000` |
| `CLIENT_PORT` | Vite dev server port | `3001` |
| `CORE_DB_PATH` | Core database path | `./data/core.db` |
| `ANALYTICS_DB_PATH` | Analytics database path | `./data/analytics.db` |
| `ADMIN_PASSWORD` | Admin dashboard password | (required) |

## Development Roadmap

### Phase 1: Core Infrastructure
- [ ] Set up Express server with TypeScript
- [ ] Implement SQLite database schema
- [ ] Create user and backend models
- [ ] Implement API key authentication

### Phase 2: API Proxy
- [ ] Implement OpenAI-compatible API endpoints
- [ ] Add request forwarding to backends
- [ ] Implement basic routing logic
- [ ] Add request logging

### Phase 3: Admin API
- [ ] Implement CRUD endpoints for users
- [ ] Implement CRUD endpoints for backends
- [ ] Implement permission management
- [ ] Add usage analytics endpoints

### Phase 4: Admin Dashboard
- [ ] Set up Solid.js + Vite project
- [ ] Create user management UI
- [ ] Create backend management UI
- [ ] Create permission management UI
- [ ] Create analytics dashboard

### Phase 5: Advanced Features
- [ ] Add rate limiting
- [ ] Implement load balancing
- [ ] Add WebSocket for real-time updates
- [ ] Implement backend health checks

## Technology Stack Summary

| Component | Technology |
|-----------|------------|
| Backend | Node.js 18+, Express.js, TypeScript |
| Core Database | SQLite (better-sqlite3) |
| Analytics Database | SQLite (better-sqlite3) |
| Frontend | Solid.js, Vite, TypeScript |
| HTTP Client | Axios/Fetch |
| Charts | Chart.js or Solid-chart |
| Styling | Tailwind CSS or CSS Modules |
| Validation | Zod |
| Testing | Vitest (frontend), Jest (backend) |
| Dev Server | Concurrently for running both servers |

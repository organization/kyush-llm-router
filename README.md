# Kyush LLM Router

Multi-user LLM routing proxy with API key management and usage monitoring.

## Features

- **Multi-user support**: Manage multiple users with individual API keys
- **Backend routing**: Route requests to multiple OpenAI-compatible backends (vLLM, SGLang, etc.)
- **Permission management**: Control which users can access which backends
- **Usage monitoring**: Track request logs, token usage, and backend metrics
- **Admin dashboard**: Web UI for managing users, backends, and permissions

## Architecture

```
┌─────────────────┐     ┌──────────────────────────────────────┐
│  LLM Clients    │────▶│  Router Server (Port 3000)           │
│  (OpenAI SDK)   │     │  - Authentication                    │
└─────────────────┘     │  - Request Routing                   │
                        │  - Admin API                         │
                        └─────────────────┬────────────────────┘
                                          │
                        ┌─────────────────┴────────────────────┐
                        ▼                                      ▼
                ┌─────────────────┐                  ┌─────────────────┐
                │  core.db        │                  │  analytics.db   │
                │  - users        │                  │  - request_logs │
                │  - backends     │                  │  - usage_stats  │
                │  - permissions  │                  │  - metrics      │
                └─────────────────┘                  └─────────────────┘
```

## Quick Start

### Development

1. Install dependencies:
```bash
npm install
```

2. Start development servers:
```bash
npm run dev
```

This starts:
- Express API server on http://localhost:3000
- Vite admin dashboard on http://localhost:3001

### Production with Docker

1. Build and run:
```bash
docker-compose up -d
```

2. Set admin password via environment variable:
```bash
ADMIN_PASSWORD=your_secure_password docker-compose up -d
```

## Project Structure

```
kyush-llm-router/
├── server/           # Express backend
├── client/           # Solid.js admin dashboard
├── database/         # SQL schema files
├── scripts/          # Development scripts
└── docs/             # Documentation
```

## API Endpoints

### OpenAI-Compatible API (Port 3000)

```
POST /v1/chat/completions
POST /v1/completions
GET  /v1/models
```

### Admin API (Port 3001)

```
# User Management
POST   /admin/users
GET    /admin/users
PUT    /admin/users/:id
DELETE /admin/users/:id

# Backend Management
POST   /admin/backends
GET    /admin/backends
PUT    /admin/backends/:id
DELETE /admin/backends/:id

# Permission Management
POST   /admin/permissions
DELETE /admin/permissions
GET    /admin/permissions

# Analytics
GET    /admin/analytics/usage
GET    /admin/analytics/requests
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVER_PORT` | Express server port | `3000` |
| `CLIENT_PORT` | Vite dev server port | `3001` |
| `CORE_DB_PATH` | Core database path | `./data/core.db` |
| `ANALYTICS_DB_PATH` | Analytics database path | `./data/analytics.db` |
| `ADMIN_PASSWORD` | Admin dashboard password | Required |

## License

MIT

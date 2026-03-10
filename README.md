# Kyush LLM Router

Multi-user LLM routing proxy with API key management, usage monitoring, and script-based request/response manipulation.

## Features

- **Multi-user support**: Manage multiple users with individual API keys
- **Backend routing**: Route requests to multiple OpenAI-compatible backends (vLLM, SGLang, etc.) with load balancing
- **Permission management**: Control which users can access which backends
- **Usage monitoring**: Track request logs, token usage, and backend metrics
- **Script engine**: Execute JavaScript code in secure isolates to manipulate requests/responses
  - `onRequest`: Modify requests before forwarding to backend
  - `onResponse`: Modify responses before returning to client
  - Script types: `per-user`, `per-backend`, `per-user-backend`
- **Admin dashboard**: Web UI for managing users, backends, permissions, and scripts

## Architecture

```
┌─────────────────┐     ┌──────────────────────────────────────┐
│  LLM Clients    │────▶│  Router Server (Port 3000)           │
│  (OpenAI SDK)   │     │  - Authentication                    │
└─────────────────┘     │  - Request Routing                   │
                        │  - Script Execution (isolated-vm)    │
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
                │  - user_scripts │                  │                 │
                └─────────────────┘                  └─────────────────┘
```

## Quick Start

### Development

1. Install dependencies:
```bash
pnpm install
```

2. Start development servers:
```bash
pnpm run dev
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
│   ├── src/
│   │   ├── config/   # Database configuration
│   │   ├── models/   # Data models (User, Backend, Permission, Script)
│   │   ├── routes/   # API routes (admin, api, scripts, analytics)
│   │   ├── services/ # RouterService, ScriptEngine, AnalyticsService
│   │   └── utils/    # Utilities (apiKey, logger)
│   ├── tests/        # Integration tests
│   └── benchmarks/   # Performance benchmarks
├── client/           # Solid.js admin dashboard
│   └── src/
│       ├── api/      # API client
│       ├── components/ # UI components
│       └── types/    # TypeScript types
├── shared/           # Shared TypeScript types
├── scripts/          # Development scripts
└── docs/             # Documentation
```

## API Endpoints

### OpenAI-Compatible API (Port 3000)

```
POST /v1/chat/completions  # Chat completions with routing & scripting
GET  /v1/models            # List available models
```

### Admin API (Port 3001)

```
# User Management
POST   /admin/users                    # Create user
GET    /admin/users                    # List all users
GET    /admin/users/:id                # Get user by ID
PUT    /admin/users/:id                # Update user
DELETE /admin/users/:id                # Delete user
POST   /admin/users/:id/regenerate-api-key  # Regenerate API key

# Backend Management
POST   /admin/backends                 # Create backend
GET    /admin/backends                 # List all backends
GET    /admin/backends/:id             # Get backend by ID
PUT    /admin/backends/:id             # Update backend
DELETE /admin/backends/:id             # Delete backend

# Permission Management
POST   /admin/permissions              # Create permission
GET    /admin/permissions              # List all permissions
GET    /admin/permissions/user/:userId # Get permissions by user
GET    /admin/permissions/backend/:backendId  # Get permissions by backend
DELETE /admin/permissions              # Delete permission (query params: user_id, backend_id)

# Script Management
GET    /admin/scripts                  # List all scripts
GET    /admin/scripts/active           # List active scripts
GET    /admin/scripts/type/:type       # List scripts by type
GET    /admin/scripts/:id              # Get script by ID
POST   /admin/scripts                  # Create script
PUT    /admin/scripts/:id              # Update script
DELETE /admin/scripts/:id              # Delete script
POST   /admin/scripts/:id/activate     # Activate script
POST   /admin/scripts/:id/deactivate   # Deactivate script
POST   /admin/scripts/:id/test         # Test script

# Analytics
GET    /admin/analytics/usage          # Get usage statistics
GET    /admin/analytics/requests       # Get request logs
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVER_PORT` | Express server port | `3000` |
| `CLIENT_PORT` | Vite dev server port | `3001` |
| `CORE_DB_PATH` | Core database path | `./data/core.db` |
| `ANALYTICS_DB_PATH` | Analytics database path | `./data/analytics.db` |
| `ADMIN_PASSWORD` | Admin dashboard password | Required |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:5173,http://localhost:3001` |

## Script Engine

The router supports JavaScript code execution in secure isolated VMs for request/response manipulation.

### Script Types

- **per-user**: Applied to all requests from a specific user
- **per-backend**: Applied to all requests going to a specific backend
- **per-user-backend**: Applied to requests from a specific user to a specific backend

### Script Context

Scripts have access to:
- `user`: User information (id, name, email)
- `backend`: Backend information (id, name, base_url)
- `request`: Request details (method, path, headers, body, isStream)
- `response`: Response details (status, headers, body, isStream)

### Example Script

```javascript
export async function onRequest(context) {
  // Add custom headers to all requests
  context.request.headers['X-Custom-Header'] = 'value';
  return context;
}

export async function onResponse(context) {
  // Log response status
  console.log(`Response status: ${context.response.status}`);
  return context;
}
```

## Testing

Run tests:
```bash
pnpm test
```

Run benchmarks:
```bash
pnpm run bench
```

## License

MIT
# OpenID Connect Setup

관리자 OIDC 인증은 generic OpenID Connect discovery와 authorization code flow를 사용한다.

## Required Environment Variables

| Variable | Description |
|----------|-------------|
| `ADMIN_AUTH_MODE` | `oidc` 또는 `both` |
| `ADMIN_SESSION_SECRET` | state/session 보호용 비밀값 |
| `OIDC_ISSUER_URL` | issuer URL |
| `OIDC_CLIENT_ID` | client id |
| `OIDC_CLIENT_SECRET` | client secret |
| `OIDC_REDIRECT_URI` | callback URL |
| `OIDC_ALLOWED_EMAILS` | 관리자 allowlist |
| `OIDC_SCOPES` | 기본값 `openid profile email` |

## Local Example

```env
ADMIN_AUTH_MODE=both
ADMIN_SESSION_SECRET=replace-with-long-random-secret
OIDC_ISSUER_URL=https://your-issuer.example.com
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_REDIRECT_URI=http://localhost:3000/admin/auth/oidc/callback
OIDC_ALLOWED_EMAILS=admin1@example.com,admin2@example.com
OIDC_SCOPES=openid profile email
```

## Production Example

```env
ADMIN_AUTH_MODE=both
ADMIN_SESSION_SECRET=replace-with-long-random-secret
OIDC_ISSUER_URL=https://auth.example.com/realms/main
OIDC_CLIENT_ID=kyush-router-admin
OIDC_CLIENT_SECRET=replace-with-client-secret
OIDC_REDIRECT_URI=https://router-admin.internal.example.com/admin/auth/oidc/callback
OIDC_ALLOWED_EMAILS=admin1@example.com,admin2@example.com
OIDC_SCOPES=openid profile email
```

## Flow

1. 브라우저가 `GET /admin/auth/oidc/start` 로 이동한다
2. 서버가 공급자 authorization endpoint 로 redirect 한다
3. 공급자가 `OIDC_REDIRECT_URI` 로 다시 redirect 한다
4. 서버가 code exchange 를 수행하고 사용자를 검증한다
5. 이메일이 allowlist 에 있으면 관리자 세션을 생성한다
6. 브라우저는 `/dashboard` 로 진입한다

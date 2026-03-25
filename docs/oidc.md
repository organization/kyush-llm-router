# OpenID Connect Setup

관리자 인증은 generic OpenID Connect discovery 기반으로 동작한다.  
특정 공급자 전용 분기 없이 issuer metadata 와 authorization code flow 를 사용한다.

## Required Environment Variables

| Variable | Description |
|----------|-------------|
| `ADMIN_AUTH_MODE` | `oidc` 또는 `both` |
| `ADMIN_SESSION_SECRET` | state, nonce, session 보호용 비밀값 |
| `OIDC_ISSUER_URL` | issuer URL |
| `OIDC_CLIENT_ID` | client id |
| `OIDC_CLIENT_SECRET` | client secret |
| `OIDC_REDIRECT_URI` | callback URL |
| `OIDC_ALLOWED_EMAILS` | 관리자 허용 이메일 목록 |
| `OIDC_SCOPES` | 기본값 `openid profile email` |

## Minimal Example

```env
ADMIN_AUTH_MODE=both
ADMIN_SESSION_SECRET=replace-with-long-random-secret
OIDC_ISSUER_URL=https://your-issuer.example.com
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_REDIRECT_URI=http://localhost:3002/admin/auth/oidc/callback
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
OIDC_REDIRECT_URI=https://admin.internal.example.com/admin/auth/oidc/callback
OIDC_ALLOWED_EMAILS=admin1@example.com,admin2@example.com
OIDC_SCOPES=openid profile email
```

## Flow

1. 브라우저가 `GET /admin/auth/oidc/start` 로 이동한다.
2. 서버는 discovery metadata 를 읽고 authorization endpoint 로 redirect 한다.
3. IdP 로그인 후 `OIDC_REDIRECT_URI` 로 callback 된다.
4. 서버는 code exchange 를 수행하고 ID token / userinfo 에서 principal 을 구성한다.
5. 이메일이 `OIDC_ALLOWED_EMAILS` 에 포함되면 관리자 세션을 생성한다.
6. 이후 브라우저는 세션 쿠키로 `/admin/**` 를 호출한다.

## Allowlist Policy

- 관리자 승인은 이메일 allowlist 로 제한한다.
- allowlist 에 없는 계정은 인증에 성공해도 관리자 권한을 얻지 못한다.
- 이메일 비교는 운영 중 표기 흔들림을 막기 위해 소문자 정규화를 전제로 하는 편이 좋다.

## Notes

- `OIDC_REDIRECT_URI` 는 실제 브라우저가 접근하는 관리자 origin 기준이어야 한다.
- 관리자 프론트가 same-origin `/admin/**` 를 사용하므로 callback 도 같은 origin 아래 두는 구성이 가장 단순하다.
- `OIDC_ALLOWED_EMAILS` 가 비어 있으면 운영 환경에서는 사실상 관리자 승인이 열려버릴 수 있으므로 명시적으로 설정하는 편이 안전하다.
- OIDC 는 관리자 인증 수단일 뿐이며, 내부망 접근 제어와 세션/토큰 정책을 대체하지 않는다.

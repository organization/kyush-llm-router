# Admin Authentication

관리자 영역은 `/admin/**` API와 관리자 프론트엔드 전체를 포함한다.  
`/v1/**` 와 `/health` 는 기존 사용자 API 키 인증 또는 공개 엔드포인트 계약을 유지한다.

## Authentication Modes

`ADMIN_AUTH_MODE` 로 관리자 로그인 방식을 제어한다.

| Mode | Description |
|------|-------------|
| `env` | ENV 기반 관리자 아이디/비밀번호 로그인만 허용 |
| `oidc` | OpenID Connect 로그인만 허용 |
| `both` | ENV 로그인과 OIDC 로그인을 모두 허용 |

기본 추천값은 `both`.

## Protected Surface

아래 경로는 관리자 인증이 필요하다.

- `/admin/users`
- `/admin/backends`
- `/admin/permissions`
- `/admin/scripts`
- `/admin/analytics/*`
- `/admin/health`

예외 공개 경로:

- `POST /admin/auth/login`
- `GET /admin/auth/session`
- `GET /admin/auth/oidc/start`
- `GET /admin/auth/oidc/callback`

## Session Model

브라우저 로그인은 서버사이드 세션 + `HttpOnly` 쿠키를 사용한다.

- 쿠키 이름: `kyush_admin_session`
- `SameSite=Lax`
- `Secure`: production 환경에서 활성화
- 세션 TTL: `ADMIN_SESSION_TTL_HOURS`

세션 데이터는 `core.db` 의 `admin_sessions` 테이블에 저장된다.

## CSRF

세션 기반 관리자 요청은 CSRF 보호를 적용한다.

- `GET /admin/auth/session` 응답에 `csrfToken` 이 포함된다.
- 프론트엔드는 `POST`, `PUT`, `DELETE` 요청마다 `X-CSRF-Token` 헤더를 보낸다.
- Bearer 관리자 API 토큰 요청에는 CSRF를 적용하지 않는다.

## Admin API Tokens

자동화나 서비스 연동은 관리자 API 토큰을 사용할 수 있다.

- 발급 API: `POST /admin/auth/tokens`
- 조회 API: `GET /admin/auth/tokens`
- 폐기 API: `DELETE /admin/auth/tokens/:id`

토큰은 최초 발급 시 1회만 원문이 반환된다.  
DB에는 hash 와 prefix 만 저장된다.

대상 테이블:

- `admin_api_tokens`

## ENV Login

ENV 로그인은 아래 설정이 필요하다.

| Variable | Description |
|----------|-------------|
| `ADMIN_USERNAME` | 관리자 로그인 아이디 |
| `ADMIN_PASSWORD_HASH` | 비밀번호 hash |
| `ADMIN_SESSION_SECRET` | 세션/토큰 hash salt 및 비밀값 |

현재 구현은 아래 hash 형식을 지원한다.

- `sha256$<hex>`
- `scrypt$<salt_hex>$<derived_hex>`

`ADMIN_PASSWORD_HASH` 는 평문 비밀번호 대신 hash 값으로만 저장하는 것을 전제로 한다.

## Admin Session API

### `GET /admin/auth/session`

현재 관리자 세션 정보를 반환한다.

```json
{
  "authenticated": true,
  "authMode": "both",
  "csrfToken": "base64url-token",
  "principal": {
    "provider": "env",
    "subject": "env:admin",
    "username": "admin",
    "displayName": "admin"
  }
}
```

### `POST /admin/auth/login`

요청 본문:

```json
{
  "username": "admin",
  "password": "your-password"
}
```

성공 시 세션 쿠키를 발급하고 `AdminSessionResponse` 를 반환한다.

### `POST /admin/auth/logout`

현재 세션을 무효화하고 세션 쿠키를 제거한다.

## Deployment Notes

운영 배포는 관리자 영역과 공개 라우팅을 분리하는 구성이 권장된다.

- public gateway: `/v1/**`, `/health`
- admin gateway: 관리자 SPA + `/admin/**`

관리자 프론트는 내부 전용 origin 에서 `/admin/**` 상대 경로만 호출한다.  
이 구조로 브라우저 CORS 복잡도를 줄이고 관리자 라우팅을 외부 공개하지 않을 수 있다.

# Admin Authentication

관리자 표면은 아래 두 부분으로 구성된다.

- 관리자 API: `/admin/**`
- 관리자 UI: `/dashboard`, `/dashboard/**`

OpenAI 호환 라우터 표면은 그대로 유지된다.

- `/v1/**`
- `/health`

## Authentication Modes

`ADMIN_AUTH_MODE` 가 사용 가능한 관리자 로그인 방식을 제어한다.

| Mode | Description |
|------|-------------|
| `env` | 아이디/비밀번호 로그인만 허용 |
| `oidc` | OpenID Connect 로그인만 허용 |
| `both` | ENV 로그인과 OIDC 로그인을 모두 허용 |

## Protected Surface

아래 경로는 관리자 인증이 필요하다.

- `/admin/users`
- `/admin/backends`
- `/admin/permissions`
- `/admin/scripts`
- `/admin/analytics/*`
- `/admin/health`

관리자 인증 내부의 공개 예외 경로:

- `POST /admin/auth/login`
- `GET /admin/auth/session`
- `GET /admin/auth/oidc/start`
- `GET /admin/auth/oidc/callback`

## Session Model

- 브라우저 인증은 서버사이드 세션 + `HttpOnly` 쿠키를 사용한다
- 쿠키 이름: `kyush_admin_session`
- 세션 TTL: `ADMIN_SESSION_TTL_HOURS`
- 세션 레코드는 `core.db` 의 `admin_sessions` 테이블에 저장된다

## CSRF

- `GET /admin/auth/session` 응답에 `csrfToken` 이 포함된다
- 세션 기반 `POST`, `PUT`, `DELETE` 요청은 `X-CSRF-Token` 을 보내야 한다
- Bearer 관리자 API 토큰 요청에는 CSRF를 적용하지 않는다

## Admin API Tokens

- 발급: `POST /admin/auth/tokens`
- 조회: `GET /admin/auth/tokens`
- 폐기: `DELETE /admin/auth/tokens/:id`

원본 토큰은 생성 시 1회만 반환된다. DB에는 hash와 prefix만 저장된다.

## ENV Login

| Variable | Description |
|----------|-------------|
| `ADMIN_USERNAME` | 관리자 로그인 아이디 |
| `ADMIN_PASSWORD_HASH` | 비밀번호 hash |
| `ADMIN_SESSION_SECRET` | 세션/토큰용 비밀값 |

지원하는 hash 형식:

- `sha256$<hex>`
- `scrypt$<salt_hex>$<derived_hex>`

### Password Hash Generation Examples

빠른 로컬 테스트용 `sha256` 예시:

```bash
node -e "const crypto=require('crypto'); const password=process.argv[1]; console.log('sha256$'+crypto.createHash('sha256').update(password).digest('hex'))" "change-me"
```

운영 권장 `scrypt` 예시:

```bash
node -e "const crypto=require('crypto'); const password=process.argv[1]; const salt=crypto.randomBytes(16).toString('hex'); const derived=crypto.scryptSync(password, Buffer.from(salt,'hex'), 64).toString('hex'); console.log(`scrypt$${salt}$${derived}`)" "change-me"
```

## UI Flow

- 브라우저 진입 경로는 `/dashboard`
- 관리자 SPA는 `/admin/**` 로 관리자 API를 호출한다
- 로그인 성공 후 기본 이동 경로는 `/dashboard`
- OIDC `next` 값은 `/dashboard` 경로들로 제한된다

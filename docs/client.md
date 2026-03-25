# Client (Solid.js + Vite)

관리자 대시보드 진입점: `client/src/index.tsx`

## Directory Structure

```
client/src/
  index.tsx                 # DOM 렌더링 진입점
  App.tsx                   # 관리자 인증 부트스트랩 + 라우트 정의
  auth.tsx                  # 관리자 세션 컨텍스트, session bootstrap, login/logout/token helpers
  api/
    client.ts               # Admin API 클라이언트 (credentials: include, /admin same-origin 호출)
  types/
    index.ts                # TypeScript 타입 정의
  routes/
    Dashboard.tsx           # 운영 요약, 최근 요청, 관리자 토큰 관리
    Users.tsx               # 사용자 CRUD
    Backends.tsx            # 백엔드 CRUD
    Permissions.tsx         # 권한 매핑 관리
    Analytics.tsx           # 분석 화면
    DetailLogs.tsx          # 상세 요청 로그 탐색
    Scripts.tsx             # 스크립트 관리 및 테스트
  components/
    LoginGate.tsx           # 로그인 화면, ENV 로그인 폼, OIDC 버튼
  ui/
    patterns/               # AppShell 등 페이지 패턴
    primitives/             # 공통 입력/표시 컴포넌트
    styles/                 # CSS 레이어
```

## Routes

관리자 UI의 브라우저 진입 경로는 `/dashboard` 이다.

| URL | Component | Description |
|-----|-----------|-------------|
| `/dashboard` | Dashboard | 시스템 개요 |
| `/dashboard/users` | Users | 사용자 관리 |
| `/dashboard/backends` | Backends | 백엔드 관리 |
| `/dashboard/permissions` | Permissions | 권한 관리 |
| `/dashboard/analytics` | Analytics | 분석 대시보드 |
| `/dashboard/detail-logs` | DetailLogs | 상세 요청 로그 탐색 |
| `/dashboard/scripts` | Scripts | 스크립트 관리 |

모든 관리자 라우트는 로그인 게이트 아래에서 렌더링된다.

## Dev And Production

- 개발 서버 포트: `3002`
- 개발 API 프록시: `/admin` -> `http://localhost:3000`
- 운영에서는 Express 서버가 빌드된 `client/dist`를 직접 서빙한다
- 운영 브라우저 진입 경로: `http://<host>:3000/dashboard`

SPA는 `/dashboard`를 라우터 base로 사용하고, 관리자 API는 계속 `/admin/**`로 호출한다.

## Admin Auth Notes

- 앱 시작 시 `GET /admin/auth/session`으로 세션을 복구한다
- 인증되지 않은 상태에서는 `LoginGate`가 렌더링된다
- ENV 로그인과 OIDC 로그인을 함께 사용할 수 있다
- 세션 기반 쓰기 요청에는 `X-CSRF-Token`이 자동 포함된다
- 401 응답이 오면 UI는 로그인 상태로 되돌아간다

# Client (Solid.js + Vite)

Admin 대시보드 진입점: `client/src/index.tsx`

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
    Dashboard.tsx           # 메인 운영 요약 스트립 + 최근 요청 테이블 + 관리자 토큰 관리
    Users.tsx               # 사용자 관리, CRUD, API 키 재발급, 개별 상세 로그 토글
    Backends.tsx            # 백엔드 관리, CRUD (name, base_url, api_key, detail_logging, is_active)
    Permissions.tsx         # 권한 관리, user-backend 매핑, 추가/해제
    Analytics.tsx           # 분석 탭, 최근 요청, 사용량 통계, 백엔드 메트릭 차트/표
    DetailLogs.tsx          # 상세 로그 검색 뷰, 텍스트 검색, 사용자/백엔드 필터 + 페이지 + 페이로드 인스펙터
    Scripts.tsx             # 스크립트 관리, 목록, 요약, 편집기, 테스트, 활성/비활성화
  components/
    Layout.tsx              # AppShell 래퍼
    EditModal.tsx           # 레거시 범용 편집 모달
    ScriptEditor.tsx        # Monaco 에디터 래퍼 (TypeScript 하이라이트)
    LoginGate.tsx           # 로그인 화면, ENV 로그인 폼, OIDC 시작 버튼
  ui/
    index.ts                # primitives/patterns 재수출
    primitives/             # Button, Dialog, Select, Tabs, TextField 등
    patterns/               # AppShell, DataGrid, PageHeader, SummaryStrip 등
    styles/                 # token/base/layout/pattern CSS 레이어
    stories/                # Storybook workbench 스토리
```

## Routes

| URL | Component | Description |
|-----|-----------|-------------|
| `/` | Dashboard | 시스템 개요 |
| `/users` | Users | 사용자 관리 |
| `/backends` | Backends | 백엔드 관리 |
| `/permissions` | Permissions | 권한 관리 |
| `/analytics` | Analytics | 집계 기반 분석 대시보드 |
| `/detail-logs` | DetailLogs | 상세 요청 로그 검색/인스펙션 |
| `/scripts` | Scripts | 스크립트 관리 |

모든 관리자 라우트는 로그인 게이트 아래에서만 렌더링된다.

## Styling

공통 UI 레이어는 `client/src/ui/styles.css` 에서 시작하고, 내부적으로 `tokens.css`, `base.css`, `layout.css`, `patterns.css`, `pages.css` 를 불러온다.

- `@kobalte/core` 기반 primitive wrapper와 공통 pattern을 사용한다.
- 페이지는 `AppShell`, `PageHeader`, `Panel`, `DataGrid`, `SummaryStrip`, `FormDialog`, `ConfirmDialog` 조합으로 구성된다.
- Storybook(`client/.storybook`)에서 같은 스타일 레이어를 사용하는 workbench를 운영한다.
- 라이트 테마와 dense 콘솔형 레이아웃을 기본 전제로 둔다.

## Dependencies

| Package | Purpose |
|---------|---------|
| solid-js | UI 프레임워크 |
| @solidjs/router | 클라이언트 사이드 라우터 |
| @kobalte/core | headless UI primitive |
| lucide-solid | 아이콘 세트 |
| solid-monaco | Monaco 에디터 통합 |
| vite | 빌드 도구 + 개발 서버 |

## Dev Server

포트: 3002 (`vite.config.ts`), 개발 중 API 프록시 `/admin` → `http://localhost:3000`

운영 배포에서는 관리자 프론트가 admin gateway 뒤에서 same-origin `/admin/**`를 호출한다. 브라우저가 내부 서버 주소를 직접 알 필요는 없다.

## Admin Auth Notes

- 앱 시작 시 `GET /admin/auth/session`으로 현재 로그인 상태와 CSRF 토큰을 불러온다.
- 인증되지 않은 상태에서는 관리자 화면 대신 `LoginGate`가 렌더링된다.
- ENV 로그인 폼과 OIDC 로그인 버튼을 함께 제공한다.
- 세션 기반 변경 요청은 `X-CSRF-Token` 헤더를 자동으로 포함한다.
- 401 응답은 재로그인 흐름으로, 403 응답은 권한 오류 표시로 처리한다.
- 관리자 API 토큰 생성/폐기는 Dashboard에서 수행한다.

## Analytics Notes

- `Analytics` 화면은 최근 요청/사용량 메트릭의 집계 뷰를 보여준다.
- 상세 요청 로그 검색은 별도 `DetailLogs` 화면에서 처리한다.
- analytics API 클라이언트는 `month`, `date`, `q`, `limit`, `offset`, `userId`, `backendId`, `endpoint`, `detailLogged` 필터를 지원한다.

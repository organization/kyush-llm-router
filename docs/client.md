# Client (Solid.js + Vite)

Admin 대시보드. 진입점: `client/src/index.tsx`

## Directory Structure

```
client/src/
  index.tsx                 # DOM 렌더링 진입점
  App.tsx                   # 라우터 정의 (7개 라우트)
  api/
    client.ts               # Admin API 클라이언트 (users, backends, permissions, scripts, analytics)
  types/
    index.ts                # TypeScript 타입 정의
  routes/
    Dashboard.tsx           # 홈 — 운영 요약 스트립 + 최근 요청 테이블
    Users.tsx               # 사용자 관리 — CRUD, API 키 재발급, 검색, 상세 로깅 토글
    Backends.tsx            # 백엔드 관리 — CRUD (name, base_url, api_key, detail_logging, is_active)
    Permissions.tsx         # 권한 관리 — user-backend 매핑, 추가/회수
    Analytics.tsx           # 분석 — 최근 요청, 사용량 집계, 백엔드 메트릭 패널
    DetailLogs.tsx          # 상세 로그 탐색 — 월/일/검색/사용자/백엔드 필터 + 페이징 + 페이로드 인스펙터
    Scripts.tsx             # 스크립트 관리 — 목록, 요약, 편집기, 테스트, 활성화/비활성화
  components/
    Layout.tsx              # AppShell 래퍼
    EditModal.tsx           # 레거시 범용 편집 모달
    ScriptEditor.tsx        # Monaco 에디터 래퍼 (TypeScript 하이라이팅)
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
| `/detail-logs` | DetailLogs | 상세 요청 로그 탐색/인스펙션 |
| `/scripts` | Scripts | 스크립트 관리 |

## Styling

공통 UI 레이어는 `client/src/ui/styles.css` 에서 시작하며, 내부적으로 `tokens.css`, `base.css`, `layout.css`, `patterns.css`, `pages.css` 를 불러온다.

- `@kobalte/core` 기반 primitive wrapper와 공통 pattern을 사용한다.
- 페이지는 `AppShell`, `PageHeader`, `Panel`, `DataGrid`, `SummaryStrip`, `FormDialog`, `ConfirmDialog` 조합으로 구성된다.
- Storybook(`client/.storybook`)에서 같은 스타일 레이어를 사용해 workbench를 유지한다.
- 라이트/다크 테마와 dense 콘솔형 레이아웃을 기본 전제로 한다.

## Dependencies

| Package | Purpose |
|---------|---------|
| solid-js | UI 프레임워크 |
| @solidjs/router | 클라이언트 사이드 라우팅 |
| @kobalte/core | headless UI primitive |
| lucide-solid | 아이콘 세트 |
| solid-monaco | Monaco 에디터 통합 |
| vite | 빌드 도구 + 개발 서버 |

## Dev Server

포트: 3002 (vite.config.ts), API 프록시: `/api` → `http://localhost:3000`

## Analytics Notes

- `Analytics` 화면은 최근 요청/사용량/메트릭의 집계 뷰를 보여준다.
- 상세 요청 로그 탐색은 별도 `DetailLogs` 화면에서 처리한다.
- analytics API 클라이언트는 `month`, `date`, `q`, `limit`, `offset`, `userId`, `backendId`, `endpoint`, `detailLogged` 필터를 지원한다.

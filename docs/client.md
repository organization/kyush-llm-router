# Client (Solid.js + Vite)

Admin 대시보드. 진입점: `client/src/index.tsx`

## Directory Structure

```
client/src/
  index.tsx                 # DOM 렌더링 진입점
  App.tsx                   # 라우터 정의 (6개 라우트)
  api/
    client.ts               # Admin API 클라이언트 (users, backends, permissions, scripts, analytics)
  types/
    index.ts                # TypeScript 타입 정의
  routes/
    Dashboard.tsx           # 홈 — 요약 카드 (사용자 수, 활성 백엔드, 최근 요청) + 최근 요청 테이블
    Users.tsx               # 사용자 관리 — CRUD, API 키 발급/재발급, 활성화 토글
    Backends.tsx            # 백엔드 관리 — CRUD (name, base_url, api_key)
    Permissions.tsx         # 권한 관리 — user-backend 매핑
    Analytics.tsx           # 분석 — 요청 로그, 사용량 통계, 백엔드 메트릭
    Scripts.tsx             # 스크립트 관리 — CRUD, 테스트, 활성화/비활성화
  components/
    Layout.tsx              # 사이드바 네비게이션 + 메인 콘텐츠 레이아웃
    EditModal.tsx           # 범용 편집 모달 (동적 폼 필드)
    ScriptEditor.tsx        # Monaco 에디터 래퍼 (TypeScript 하이라이팅)
```

## Routes

| URL | Component | Description |
|-----|-----------|-------------|
| `/` | Dashboard | 시스템 개요 |
| `/users` | Users | 사용자 관리 |
| `/backends` | Backends | 백엔드 관리 |
| `/permissions` | Permissions | 권한 관리 |
| `/analytics` | Analytics | 분석 대시보드 |
| `/scripts` | Scripts | 스크립트 관리 |

## Styling

CSS 프레임워크 없음. 인라인 `style` props 사용.
- 다크 사이드바 (#1e293b), 라이트 배경 (#f1f5f9), 화이트 카드
- Flexbox / Grid 레이아웃

## Dependencies

| Package | Purpose |
|---------|---------|
| solid-js | UI 프레임워크 |
| @solidjs/router | 클라이언트 사이드 라우팅 |
| solid-monaco | Monaco 에디터 통합 |
| vite | 빌드 도구 + 개발 서버 |

## Dev Server

포트: 3002 (vite.config.ts), API 프록시: `/api` → `http://localhost:3000`

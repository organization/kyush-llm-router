# Frontend Design Guide

Kyush LLM Router client의 새 UI 기준 문서. 이 문서는 기존 인라인 스타일 기반 화면을 점진적으로 `@kobalte/core` 중심의 조밀한 운영 콘솔 UI로 전환하기 위한 공통 기준이다.

## 1. 목표와 디자인 원칙

### Compact Operational Console

이 프로젝트의 어드민 UI는 "넓고 여유 있는 마케팅 화면"이 아니라 "운영자가 빠르게 읽고 조작하는 콘솔"을 목표로 한다.

- 작은 화면에서도 주요 지표와 조작 수단이 한 번에 보여야 한다.
- 카드와 패널은 시각적으로 분리되되, 공간을 많이 차지하면 안 된다.
- 중요 정보는 크기와 대비로 구분하고, 덜 중요한 정보는 작은 텍스트와 밀도 높은 보조 레이블로 정리한다.
- 좁은 화면, 긴 ID, 긴 URL, API 키, 긴 스크립트 이름처럼 overflow가 자주 발생하는 데이터를 기본 시나리오로 간주한다.
- 사용자가 예상하는 관리자 UI 행동을 지원해야 한다.
  - 탭 전환
  - 키보드 포커스 이동
  - 단축키 힌트 노출
  - destructive action 확인
  - 로딩/빈 상태/오류 상태 표현

### 미학적 방향

루트의 `frontend-design.md`를 참고하되, 본 프로젝트는 과한 장식 대신 다음 성격을 유지한다.

- 2000년대 운영 도구에 가까운 정보 밀도
- 얇은 border, 작은 radius, 촘촘한 행 높이
- 대형 hero 대신 요약 스트립, 표, 패널, 탭, 유틸리티 바 중심 구성
- 장식은 배경 질감보다 타이포그래피와 정렬 정확도로 해결

## 2. 토큰 시스템

모든 신규 화면은 하드코딩된 색상/여백/반경 대신 semantic token을 사용한다.

### 2.1 색상 토큰

```css
:root {
  color-scheme: light dark;

  --color-bg: #f3f4f6;
  --color-bg-elevated: #ffffff;
  --color-bg-panel: #fbfbfc;
  --color-bg-inset: #e8eaee;

  --color-text: #111318;
  --color-text-muted: #5b6472;
  --color-text-soft: #737b88;

  --color-border: #c8cdd6;
  --color-border-strong: #98a2b3;
  --color-border-danger: #d56b6b;

  --color-accent: #2357d8;
  --color-accent-strong: #173ea4;
  --color-accent-soft: #dbe7ff;
  --color-focus: #2c6bff;

  --color-success: #1f7a45;
  --color-success-soft: #d8f2df;
  --color-warning: #946200;
  --color-warning-soft: #fff0c2;
  --color-danger: #b42318;
  --color-danger-soft: #fddfdb;

  --color-overlay: rgb(10 14 20 / 0.52);
  --shadow-panel: 0 1px 2px rgb(16 24 40 / 0.06);
  --shadow-dialog: 0 12px 32px rgb(15 23 42 / 0.18);
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #111317;
    --color-bg-elevated: #181b20;
    --color-bg-panel: #1d2127;
    --color-bg-inset: #0d0f13;

    --color-text: #f2f4f8;
    --color-text-muted: #b4bcc9;
    --color-text-soft: #9099a8;

    --color-border: #343b46;
    --color-border-strong: #5f6b7a;
    --color-border-danger: #8c3b3b;

    --color-accent: #79a6ff;
    --color-accent-strong: #a9c5ff;
    --color-accent-soft: #162848;
    --color-focus: #8cb4ff;

    --color-success: #72d39a;
    --color-success-soft: #173323;
    --color-warning: #e7c062;
    --color-warning-soft: #3f3010;
    --color-danger: #ff8a80;
    --color-danger-soft: #431d1f;

    --color-overlay: rgb(0 0 0 / 0.64);
    --shadow-panel: 0 1px 2px rgb(0 0 0 / 0.35);
    --shadow-dialog: 0 18px 44px rgb(0 0 0 / 0.45);
  }
}
```

규칙:

- `--color-bg`는 페이지 바탕, `--color-bg-elevated`는 카드/모달, `--color-bg-panel`은 표/사이드 패널, `--color-bg-inset`은 코드/보조 영역에 사용한다.
- 상태 색은 항상 soft 배경과 짝으로 사용한다.
- 포커스는 테마와 무관하게 항상 충분히 눈에 띄어야 한다.
- 이후 수동 테마 전환을 추가할 수 있도록 `[data-theme="light"]`, `[data-theme="dark"]` 오버라이드를 같은 이름의 토큰으로 덮어쓸 수 있게 설계한다.

### 2.2 간격 토큰

```css
:root {
  --space-1: 2px;
  --space-2: 4px;
  --space-3: 6px;
  --space-4: 8px;
  --space-5: 12px;
  --space-6: 16px;
  --space-7: 20px;
  --space-8: 24px;
  --space-9: 32px;
}
```

규칙:

- 기본 조밀 레이아웃은 `4px`, `6px`, `8px`, `12px`를 중심으로 조합한다.
- 대형 카드 패딩처럼 넓은 여백을 기본값으로 두지 않는다.
- 리스트 행, 폼 필드, 버튼 사이 간격은 먼저 `--space-3` 또는 `--space-4`를 검토한다.

### 2.3 반경, 선, 그림자

```css
:root {
  --radius-1: 2px;
  --radius-2: 4px;
  --radius-3: 6px;

  --line-1: 1px;
  --line-2: 1.5px;
}
```

규칙:

- 기본 radius는 `2px` 또는 `4px`.
- 데이터 표, 툴바, 패널은 가능한 한 `2px` 또는 `4px`을 유지한다.
- 큰 모달도 `6px`을 넘기지 않는다.
- 구분은 그림자보다 border를 우선 사용한다.

### 2.4 타이포그래피

작은 크기에서도 시인성이 높은 조합을 사용한다. 기본 방향:

- UI 본문/레이블: `Pretendard`, `Noto Sans KR`, `system-ui`, `sans-serif`
- 숫자/ID/URL/토큰: `JetBrains Mono`, `Consolas`, `monospace`
- 작은 보조 정보 전용: 기본 본문과 동일 계열이되 자간과 대비를 조정해 촘촘하게 배치

```css
:root {
  --font-ui: "Pretendard", "Noto Sans KR", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Consolas", monospace;
  --font-micro: "Pretendard", "Noto Sans KR", system-ui, sans-serif;

  --text-1: 11px;
  --text-2: 12px;
  --text-3: 13px;
  --text-4: 14px;
  --text-5: 16px;
  --text-6: 18px;
  --text-7: 22px;

  --leading-tight: 1.2;
  --leading-ui: 1.35;
  --leading-copy: 1.5;
}
```

규칙:

- 기본 UI 텍스트는 `13px` 또는 `14px`.
- 테이블/메타데이터/상태 텍스트는 `11px` 또는 `12px`.
- 페이지 제목만 `18px` 이상을 허용한다.
- 부가 정보는 작은 텍스트로 배치하되, 대비가 부족하면 안 된다.
- 숫자 정렬, API 키 prefix, URL, script type 등은 monospace 또는 tabular 숫자를 우선 고려한다.

### 2.5 포커스와 레이어

```css
:root {
  --focus-ring: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-focus);
  --z-header: 20;
  --z-sticky: 30;
  --z-popover: 40;
  --z-dialog: 50;
  --z-toast: 60;
}
```

규칙:

- 포커스는 hover보다 우선한다.
- sticky header, dropdown, dialog가 겹칠 때 레이어 순서를 문서화된 값으로만 관리한다.

## 3. 레이아웃 기준

### 3.1 페이지 셸

- 좌측 내비게이션은 "크고 넓은 앱 셸"이 아니라 조밀한 도구 패널이어야 한다.
- 본문은 최대 너비 고정형이 아니라 데이터 양에 따라 유연하게 확장한다.
- 기본 레이아웃은 다음 3층 구조를 사용한다.
  - 글로벌 셸: 내비게이션, 전체 배경, 테마/세션 정보
  - 페이지 헤더: 제목, 설명, 주요 액션, 보조 단축키 힌트
  - 본문 영역: 요약 스트립 + 툴바 + 표/패널

```tsx
<div class="app-shell">
  <aside class="nav-rail">...</aside>
  <div class="workspace">
    <header class="page-header">
      <div>
        <h1>Scripts</h1>
        <p>요청/응답 스크립트 정책을 관리합니다.</p>
      </div>
      <div class="page-actions">
        <button>새 스크립트</button>
        <kbd>Ctrl</kbd><kbd>N</kbd>
      </div>
    </header>

    <section class="summary-strip">...</section>
    <section class="content-panel">...</section>
  </div>
</div>
```

```css
.app-shell {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  min-height: 100vh;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-ui);
}

.nav-rail {
  border-right: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  padding: var(--space-5);
}

.workspace {
  min-width: 0;
  padding: var(--space-6);
  display: grid;
  gap: var(--space-5);
}

.page-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: var(--space-5);
}
```

### 3.2 요약 스트립

- Dashboard, Analytics의 상단 수치 카드는 큰 박스 3개보다 "짧은 수평 스트립"을 우선한다.
- 각 셀은 제목, 핵심 수치, 작은 보조 수치 1개까지 허용한다.
- 카드형 UI가 필요해도 패딩을 크게 주지 않는다.

### 3.3 분할 패널

Scripts 화면처럼 목록과 편집기가 함께 필요한 경우 split panel을 기본 패턴으로 삼는다.

- 좌측: 목록/필터/타깃 메타
- 우측: 편집기/세부설정/테스트 결과
- 좁은 화면에서는 세로 스택으로 전환한다.

## 4. 컴포넌트 기준 (`@kobalte/core`)

`@kobalte/core`는 headless primitive를 제공하므로, 스타일은 이 문서의 토큰과 패턴에 맞춰 직접 입힌다.

### 4.1 Tabs

용도:

- Dashboard/Analytics의 다중 데이터 묶음
- Settings 성격의 세부 항목 전환
- Scripts 편집기의 코드/대상/테스트 결과 전환

규칙:

- 탭 헤더 높이는 낮게 유지한다.
- 활성 탭은 색상+하단선 또는 inset 배경으로 표시한다.
- 탭 라벨 오른쪽에 작은 count/badge를 둘 수 있다.
- 탭은 반드시 키보드 화살표 이동을 지원해야 한다.

```tsx
import * as Tabs from "@kobalte/core/tabs";

<Tabs.Root class="tabs" defaultValue="request">
  <Tabs.List class="tabs__list" aria-label="Script sections">
    <Tabs.Trigger class="tabs__trigger" value="request">Request</Tabs.Trigger>
    <Tabs.Trigger class="tabs__trigger" value="response">Response</Tabs.Trigger>
    <Tabs.Trigger class="tabs__trigger" value="test">Test</Tabs.Trigger>
  </Tabs.List>

  <Tabs.Content class="tabs__panel" value="request">...</Tabs.Content>
  <Tabs.Content class="tabs__panel" value="response">...</Tabs.Content>
  <Tabs.Content class="tabs__panel" value="test">...</Tabs.Content>
</Tabs.Root>
```

### 4.2 Dialog

용도:

- Add/Edit User
- Add/Edit Backend
- Grant Permission
- Script test result 요약

규칙:

- 단순 입력 모달은 `480px` 내외.
- 복합 편집 모달은 `720px` 또는 `min(920px, 92vw)`.
- 헤더, 본문, 푸터를 구분하고 푸터 액션은 오른쪽 정렬.
- 모달 내부에서도 overflow를 통제한다.
- 포커스 트랩, ESC 닫기, 초기 포커스 대상 지정이 필요하다.

```tsx
import * as Dialog from "@kobalte/core/dialog";

<Dialog.Root>
  <Dialog.Trigger class="button-primary">Add User</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay class="dialog-overlay" />
    <Dialog.Content class="dialog-content">
      <Dialog.Title>User 생성</Dialog.Title>
      <Dialog.Description>필수 필드만 먼저 입력합니다.</Dialog.Description>
      <form class="dense-form">...</form>
      <div class="dialog-footer">...</div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

### 4.3 Dropdown Menu / Popover / Tooltip

- `DropdownMenu`: 행 단위 액션을 압축할 때 사용
- `Popover`: 행 인라인 세부 정보나 추가 메타 노출
- `Tooltip`: 잘린 텍스트, 단축키 설명, 위험 액션 보조 설명

규칙:

- 기본 액션이 2개 이하일 때는 버튼을 직접 노출한다.
- 액션이 3개 이상이면 overflow menu를 검토한다.
- tooltip은 필수 정보의 유일한 전달 수단이 되면 안 된다.
- 잘린 API 키, URL, 스크립트 대상명은 hover/focus 시 tooltip 또는 popover로 전체 값을 볼 수 있어야 한다.

### 4.4 Select / Checkbox / Switch

- 기존 native `select`는 단계적으로 `@kobalte/core` 기반 커스텀 select로 전환한다.
- 다만 밀도와 접근성을 해치지 않도록 input 높이를 낮게 유지한다.
- `Checkbox`는 행 높이를 키우지 않는 compact label과 함께 사용한다.
- `Switch`는 즉시 반영되는 on/off 토글에만 사용하고, 저장이 필요한 폼 값에는 checkbox를 우선한다.

### 4.5 Toast / Alert

- 성공 알림은 짧게 자동 사라짐.
- 실패 알림은 원인과 재시도 방향을 포함한 alert 또는 inline error로 보여준다.
- destructive action 이후에는 toast만 띄우고 끝내지 말고, 화면 상태도 즉시 갱신해야 한다.

## 5. 데이터 표시 패턴

### 5.1 Dense Table

Users, Backends, Permissions, Scripts, Dashboard Recent Requests, Analytics 표에 공통 적용한다.

규칙:

- 기본 행 높이는 작게 유지하되 클릭/포커스 가능한 최소 영역은 확보한다.
- 헤더는 sticky 가능하게 설계한다.
- 테이블 바깥 래퍼가 horizontal scroll을 담당한다.
- 긴 셀은 아래 규칙 중 하나를 반드시 선택한다.
  - 한 줄 truncate + tooltip
  - 줄바꿈 허용
  - 열 최소폭 보장 후 스크롤
- 상태 열, 숫자 열, 액션 열은 가능한 좁게 유지한다.

```tsx
<div class="table-shell">
  <table class="dense-table">
    <thead>
      <tr>
        <th>ID</th>
        <th>Name</th>
        <th>API Key</th>
        <th>Status</th>
        <th class="col-actions">Actions</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="cell-mono">12</td>
        <td>ops-admin</td>
        <td class="cell-truncate" title="sk-router-very-long-value">
          sk-router-very-long-value
        </td>
        <td><span class="badge badge--success">Active</span></td>
        <td class="cell-actions">...</td>
      </tr>
    </tbody>
  </table>
</div>
```

```css
.table-shell {
  min-width: 0;
  overflow: auto;
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
}

.dense-table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
  font-size: var(--text-2);
}

.dense-table th,
.dense-table td {
  padding: 7px 8px;
  border-bottom: 1px solid var(--color-border);
  vertical-align: middle;
}

.dense-table th {
  position: sticky;
  top: 0;
  background: var(--color-bg-panel);
  text-align: left;
  white-space: nowrap;
}

.cell-truncate {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-mono {
  font-family: var(--font-mono);
  font-size: var(--text-1);
}
```

### 5.2 상태 배지

- 상태 배지는 채도보다 대비를 우선한다.
- 높이는 낮고 텍스트는 짧아야 한다.
- `Active`, `Inactive`, `Error`, `Draft`, `Assigned` 같은 한 단어 중심으로 유지한다.

### 5.3 메타데이터 클러스터

주요 정보 주변의 작은 텍스트 묶음은 다음 형태를 기본으로 한다.

```tsx
<div class="meta-cluster">
  <span class="meta-key">Model</span>
  <span class="meta-value">gpt-4.1-mini</span>
  <span class="meta-key">Backend</span>
  <span class="meta-value">OpenAI Main</span>
  <span class="meta-key">Updated</span>
  <span class="meta-value">5m ago</span>
</div>
```

규칙:

- 중요한 제목 아래 또는 표 셀 내부에 배치한다.
- 작은 텍스트지만 키/값 구분은 분명해야 한다.
- 텍스트 크기를 줄이더라도 줄 간격과 대비는 유지한다.

### 5.4 명령/필터 바

표 위에는 큰 hero 대신 compact command bar를 둔다.

```tsx
<div class="command-bar">
  <div class="command-bar__group">
    <input placeholder="Search users" />
    <button>Active only</button>
    <button>Backend: All</button>
  </div>
  <div class="command-bar__group">
    <span class="hint">/ 검색</span>
    <button class="button-primary">Add User</button>
  </div>
</div>
```

규칙:

- 왼쪽은 필터, 오른쪽은 주요 액션과 단축키 힌트.
- 필터는 1행 유지가 어렵다면 wrap을 허용하되, 버튼 간격은 계속 조밀해야 한다.

## 6. 폼과 편집 패턴

### 6.1 Dense Form

- 라벨과 필드는 세로 배치하되 간격을 작게 유지한다.
- 필수 표시, 설명, 검증 메시지는 한 시야 안에 모인다.
- 긴 텍스트/URL/API Key 필드는 monospace 적용을 검토한다.

```css
.dense-form {
  display: grid;
  gap: var(--space-4);
}

.field {
  display: grid;
  gap: var(--space-2);
}

.field input,
.field textarea,
.field button,
.field [role="combobox"] {
  min-height: 32px;
  padding: 0 var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-2);
  background: var(--color-bg-elevated);
  color: var(--color-text);
}
```

### 6.2 Overflow-safe Field Layout

Backend URL, API Key, Script target 조합처럼 값이 긴 경우는 다음 규칙을 적용한다.

- 단일 행 필드가 너무 길면 전체 width를 먹지 않도록 `minmax(0, 1fr)`를 사용한다.
- prefix/suffix 버튼이 붙은 입력은 grid로 나눈다.
- 편집 전에는 truncate, 편집 상태에서는 full value를 보여준다.

```css
.field-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-3);
}
```

### 6.3 Script Editor 영역

Scripts는 일반 CRUD보다 복합도가 높으므로 별도 규칙을 둔다.

- 상단: script 이름, 타입, 대상 선택
- 중단: 코드/설명/테스트 탭
- 하단: 활성 상태, 테스트 결과, 저장 액션
- 편집기 주변에는 작은 메타 정보와 단축키 힌트를 같이 둔다.
- Monaco 같은 코드 편집기는 주변 패널 밀도와 맞추기 위해 외곽 패딩을 최소화한다.

## 7. 상호작용 기준

### 7.1 키보드와 단축키

- 모든 주요 화면은 최소 1개 이상의 빠른 조작 단축키를 문서화할 수 있어야 한다.
- 단축키 표시는 버튼 오른쪽, command bar, 또는 panel header 보조영역에 둔다.
- 예시:
  - `/`: 검색 포커스
  - `Ctrl+N`: 새 항목 생성
  - `Ctrl+S`: 스크립트 저장
  - `Esc`: 모달 닫기

`<kbd>` 스타일 예시:

```css
kbd {
  display: inline-flex;
  align-items: center;
  min-height: 18px;
  padding: 0 4px;
  border: 1px solid var(--color-border-strong);
  border-radius: 3px;
  background: var(--color-bg-panel);
  font: 500 var(--text-1) / 1 var(--font-mono);
}
```

### 7.2 상태 전이

- hover는 보조 신호, active/focus는 주 신호로 취급한다.
- destructive 버튼은 빨간색을 남용하지 말고 실제 위험 액션에만 사용한다.
- 성공/실패 상태는 색과 문구를 함께 제공한다.

### 7.3 로딩 / 빈 상태 / 오류 상태

- 로딩: spinner만 두지 말고 영역 skeleton 또는 `Loading users...` 같은 맥락 문구를 제공한다.
- 빈 상태: "없음"만 보여주지 말고 다음 행동을 안내한다.
- 오류 상태: 실패 이유와 재시도 액션을 함께 제공한다.

예시:

```tsx
<section class="panel-state">
  <h3>등록된 backend가 없습니다</h3>
  <p>라우팅을 시작하려면 첫 backend를 추가하세요.</p>
  <button class="button-primary">Add Backend</button>
</section>
```

### 7.4 확인 대화상자

- 삭제, 권한 회수, API 키 재생성은 확인 대화상자를 거친다.
- 대화상자는 대상 이름과 영향을 명시한다.
- 가능하면 브라우저 기본 `confirm()` 대신 `@kobalte/core` dialog 기반으로 통일한다.

## 8. 화면별 매핑 기준

이 문서는 실제 현재 라우트와 연결되어야 한다.

### Dashboard

- 상단 대형 카드 대신 summary strip
- Recent Requests는 dense table + sticky header
- 새로고침은 우측 상단 action cluster

### Users

- 검색 + 상태 필터 + Add User command bar
- API Key 셀은 truncate + copy action + tooltip
- Edit/Add는 compact dialog

### Backends

- Base URL은 monospace + overflow 처리
- Active 상태는 badge
- Add/Edit dialog는 URL 입력과 API Key 입력을 overflow-safe form으로 구성

### Permissions

- user/backend 조합은 dense table
- Add Permission은 compact dialog 또는 inline panel
- revoke는 명시적 destructive action

### Analytics

- 여러 표를 나란히 둘 때 card보다 panel grid
- 요청/사용량/백엔드 메트릭은 탭 또는 split panel 후보
- 숫자는 정렬과 단위 표기를 일관되게 유지

### Scripts

- 이 화면이 새 디자인 시스템의 기준 화면이 된다.
- 목록, 타입 badge, 대상 메타, 테스트 결과, 편집기 탭 패턴을 모두 포함한다.
- 긴 코드 편집 영역과 조밀한 설정 패널의 공존을 우선 해결한다.

## 9. 구현 가이드라인

### 해야 하는 것

- semantic token을 먼저 만들고 화면에 적용한다.
- 인라인 스타일을 점진적으로 공통 class와 토큰 기반 스타일로 치환한다.
- `@kobalte/core` primitive로 상호작용 로직을 통일한다.
- 모바일보다는 "좁은 데스크톱 폭" 대응을 우선 설계하되, 최소한의 반응형 스택 전환을 제공한다.
- overflow 정책을 컴포넌트마다 명시한다.

### 피해야 하는 것

- 큰 radius와 과한 drop shadow
- 여백으로만 계층을 표현하는 느슨한 레이아웃
- 보라색 중심의 전형적인 AI 스타일
- 툴팁에만 의존하는 핵심 정보
- 페이지별로 제각각인 색상/버튼/테이블 스타일

## 10. 최소 수용 기준

새로 만드는 모든 client 화면 또는 리팩터링되는 기존 화면은 다음을 만족해야 한다.

- light/dark 모두에서 읽기 가능하다.
- 좁은 폭에서 긴 텍스트가 레이아웃을 깨지 않는다.
- 키보드 포커스와 탭 이동이 보인다.
- 주요 액션과 destructive 액션이 시각적으로 구분된다.
- 표, 모달, 필터 바, 상태 배지 중 해당 화면에 필요한 공통 패턴을 재사용한다.
- 페이지 로직과 무관한 스타일 상수는 semantic token으로 대체한다.

## 11. 첫 적용 우선순위

가이드 문서 자체는 구현 순서를 강제하지 않지만, 실제 적용 시에는 다음 순서가 가장 안전하다.

1. 토큰과 전역 테마 레이어
2. 레이아웃 셸과 command bar
3. dense table / badge / button / input 공통 스타일
4. `@kobalte/core` dialog, tabs, tooltip, select
5. Scripts 화면과 Users 화면 시범 전환

이 순서는 이후 마이그레이션 작업의 기본 기준으로 사용한다.

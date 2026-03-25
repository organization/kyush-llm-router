# Client UI Kit Workbench

`client`의 UI kit은 실제 라우트와 Storybook이 함께 사용하는 공통 레이어다. 초기 목적은 workbench 검증이었지만, 현재는 앱 셸과 주요 페이지 패턴에도 연결되어 있다.

## 구성

- `client/src/ui/styles.css`
  - 전역 semantic token 진입점, 하위 style 레이어 import
- `client/src/ui/primitives`
  - `@kobalte/core` wrapper와 공통 스타일 계약
- `client/src/ui/patterns`
  - `AppShell`, `DataGrid`, `LogConsole`, `CommandBar`, `FieldRow`, `StatusBadge` 등
- `client/src/ui/index.ts`
  - app/routes 에서 사용하는 primitives/patterns 재수출
- `client/src/ui/stories`
  - primitive와 pattern 검토용 Storybook stories
- `client/.storybook`
  - Storybook workbench 설정

## 1차 시범 적용 대상

### Users

- `DataGrid`
- compact dialog
- `CommandBar`
- `StatusBadge`

### Scripts

- `Tabs`
- `Select`
- dialog
- `LogConsole`
- dense metadata cluster

현재 반영:

- `Layout` → `AppShell`
- `Users`, `Backends`, `Permissions`, `Analytics`, `DetailLogs`, `Scripts` 에서 공통 패턴 사용
- Storybook preview 에서 동일한 `client/src/ui/styles.css` 를 로드

## 실행

```bash
pnpm --filter client storybook
pnpm --filter client build-storybook
```

## 원칙

- 앱 코드에서 `@kobalte/core` primitive를 직접 사용하지 않는다.
- 새 스타일은 가능하면 Storybook에서 먼저 검토하고, 이후 라우트에 반영한다.
- 대용량 표는 pagination 우선을 기본으로 한다.
- 로그 콘솔은 1차에서 읽기 중심으로 유지하고, streaming append는 후속 확장으로 둔다.

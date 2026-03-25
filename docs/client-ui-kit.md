# Client UI Kit Workbench

`client`의 새 UI kit은 실제 라우트와 분리된 공통 레이어로 구성한다. 목적은 기존 인라인 스타일을 바로 교체하는 것이 아니라, 먼저 Storybook에서 조밀한 운영 콘솔 스타일을 검토하고 안정화한 뒤 앱으로 이식하는 것이다.

## 구성

- `client/src/ui/styles.css`
  - 전역 semantic token, density, light/dark theme, 공통 primitive class
- `client/src/ui/primitives`
  - `@kobalte/core` wrapper와 공통 스타일 계약
- `client/src/ui/patterns`
  - `DataGrid`, `LogConsole`, `CommandBar`, `FieldRow`, `StatusBadge`
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

## 실행

```bash
pnpm --filter client storybook
pnpm --filter client build-storybook
```

## 원칙

- 앱 코드에서 `@kobalte/core` primitive를 직접 사용하지 않는다.
- 새 스타일은 Storybook에서 먼저 검토하고, 이후 라우트에 연결한다.
- 대용량 표는 pagination 우선을 기본으로 한다.
- 로그 콘솔은 1차에서 읽기 중심으로 유지하고, streaming append는 후속 확장으로 둔다.

# Analytics

현재 관리자 Analytics 화면은 표 중심 조회가 아니라 운영 지표를 빠르게 훑을 수 있는 D3 기반 시계열 대시보드로 구성된다.

## UI

- 경로: `/dashboard/analytics`
- 공통 필터: 기간(`7`, `30`, `90`일), backend 선택
- 상단 요약: requests, tokens, 평균 응답 시간, errors
- 주요 패널
  - Daily Volume: 일별 requests + tokens
  - Backend Reliability: success rate + error count
  - Backend Response Time: backend별 평균 응답 시간
  - Model Request Trends: 상위 모델 요청 추이
  - Response Length Distribution: `completion_tokens` histogram
  - Daily Response Length Spread: `completion_tokens` box plot

## API

- `GET /admin/analytics/daily-totals`
- `GET /admin/analytics/backend-quality`
- `GET /admin/analytics/model-trends`
- `GET /admin/analytics/response-length-histogram`
- `GET /admin/analytics/response-length-box-plot`

## 집계 규칙

- 모델 추이의 모델 키는 `response_model -> routed_model -> request_model -> unknown` 순서로 결정한다.
- response length 계열 시각화는 `completion_tokens` 값이 있는 요청만 집계한다.
- response length 계열 시각화는 긴 꼬리 분포를 읽기 쉽도록 로그 계열 스케일을 사용한다.
- 상세 요청 단위의 latency/body 확인은 계속 `DetailLogs` 화면에서 담당한다.

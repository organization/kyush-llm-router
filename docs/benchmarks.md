# Benchmarks

`server/benchmarks` 는 라우터를 거치지 않는 direct 요청과 라우터를 통과하는 route 요청의 응답 시간과 처리량을 비교하는 CLI 벤치마크 도구다.

엔트리 포인트는 [server/benchmarks/index.ts](/C:/Users/user/Sync/Workspace/kyush-llm-router/server/benchmarks/index.ts) 이고, 루트에서 `pnpm run bench`, 서버 패키지에서 `pnpm run bench` 로 실행할 수 있다.

## What It Measures

- `Small Payload`: 짧은 `POST /v1/chat/completions`
- `Large Payload`: 긴 메시지 목록이 포함된 `POST /v1/chat/completions`
- `Models Endpoint`: `GET /v1/models`
- `Real Backend`: `--backend real` 일 때만 추가되는 실제 OpenAI 호환 백엔드용 `POST /v1/chat/completions`

각 시나리오마다 direct, route 두 경로를 모두 실행하고 아래 지표를 계산한다.

- 평균 응답 시간
- 최소/최대 응답 시간
- p50, p95, p99
- 성공/실패 수
- 처리량(req/s)
- route 대비 direct 오버헤드(%)

## Commands

루트에서 실행:

```bash
pnpm run bench
```

서버 패키지에서 직접 실행:

```bash
cd server
pnpm run bench
```

기본값은 아래와 같다.

- 동시 요청 수: `10`
- 총 요청 수: `100`
- 워밍업 요청 수: `5`
- 백엔드 타입: `mock`

## CLI Options

```bash
pnpm run bench -- --concurrent 20 --requests 200 --warmup 10
pnpm run bench -- --backend real --backend-url https://api.example.com/v1 --backend-key YOUR_KEY
pnpm run bench -- --output ./benchmark-results.json
```

지원 옵션:

- `-c, --concurrent <number>`: 동시 요청 수
- `-r, --requests <number>`: 전체 요청 수
- `-w, --warmup <number>`: 워밍업 요청 수
- `-b, --backend <mock|real>`: 대상 백엔드 타입
- `-u, --backend-url <url>`: 실제 백엔드 URL. `real` 모드에서 필수
- `-k, --backend-key <key>`: 실제 백엔드 API 키. direct 호출과 라우터의 백엔드 인증에 사용
- `-o, --output <file>`: 결과를 JSON으로 저장

`real` 모드에서는 `--backend-url` 이 반드시 필요하다. URL 끝의 `/v1` 과 trailing slash 는 내부에서 제거한 뒤 엔드포인트를 다시 붙인다.

## Modes

### Mock Backend

`mock` 모드는 테스트용 mock 서버와 라우터 서버를 둘 다 띄운다.

- mock 백엔드: 동적 포트
- 라우터: `http://localhost:3099`
- DB에 `benchmark-backend`, `benchmark-user` 를 준비
- 사용자와 백엔드 사이 권한을 자동 생성

실행 예시:

```bash
pnpm run bench -- --backend mock
```

### Real Backend

`real` 모드는 direct 요청은 실제 OpenAI 호환 API로 보내고, route 요청은 로컬 라우터를 통해 같은 백엔드로 보낸다.

- 라우터: `http://localhost:3099`
- DB에 `real-backend`, `benchmark-user` 를 준비
- 사용자의 백엔드 접근 권한을 자동 생성
- `Real Backend` 시나리오의 모델명은 `REAL_MODEL` 환경 변수를 우선 사용하고, 없으면 `default-model` 을 사용

실행 예시:

```bash
REAL_MODEL=gpt-4o-mini pnpm run bench -- --backend real --backend-url https://api.openai.com/v1 --backend-key $OPENAI_API_KEY
```

PowerShell 예시:

```powershell
$env:REAL_MODEL="gpt-4o-mini"
pnpm run bench -- --backend real --backend-url https://api.openai.com/v1 --backend-key $env:OPENAI_API_KEY
```

## Execution Flow

벤치마크 실행 시 내부 동작은 대략 아래 순서다.

1. 라우터 서버를 `3099` 포트로 기동한다.
2. `mock` 모드면 mock 백엔드를 추가로 띄운다.
3. 벤치마크용 사용자, 백엔드, 권한을 DB에 생성 또는 갱신한다.
4. 각 시나리오에 대해 warmup 요청을 먼저 보낸다.
5. 같은 payload 로 direct 요청과 route 요청을 각각 실행한다.
6. 결과를 집계해 표 형태로 출력하고, `--output` 이 있으면 JSON으로 저장한다.
7. 프로세스 종료 전에 mock 서버와 라우터 서버를 닫는다.

## Output

콘솔에는 시나리오별로 `Direct`, `Route` 두 행이 출력된다.

- `Success`: 성공 수 / 전체 요청 수
- `Avg`, `Min`, `Max`, `P50`, `P95`, `P99`: 밀리초 단위 응답 시간
- `Errors`: 실패한 요청 수
- `Req/s`: 성공 요청 기준 처리량
- `Overhead`: `(route.avg - direct.avg) / direct.avg * 100`

JSON 출력 예시:

```json
{
  "timestamp": "2025-01-01T00:00:00.000Z",
  "results": [
    {
      "scenario": "Small Payload",
      "mode": "direct",
      "totalRequests": 100,
      "successfulRequests": 100,
      "avgResponseTime": 12.34,
      "minResponseTime": 10,
      "maxResponseTime": 20,
      "p50ResponseTime": 12,
      "p95ResponseTime": 18,
      "p99ResponseTime": 20,
      "errors": 0,
      "throughput": 83.33,
      "totalDuration": 1200
    }
  ]
}
```

## Notes And Caveats

- 이 도구는 DB 레코드를 일시적으로 사용한다. `benchmark-user`, `benchmark-backend`, `real-backend` 가 없으면 생성하고, 있으면 재사용하거나 갱신한다.
- 서버 소켓은 정리하지만 벤치마크용 사용자/백엔드 레코드는 종료 시 삭제하지 않는다.
- 요청 타임아웃은 요청당 30초다.
- 통계의 `totalDuration` 은 전체 테스트 벽시계 시간이 아니라 성공 요청 중 최대 응답 시간으로 계산된다. 따라서 `Req/s` 는 절대적인 부하테스트 처리량보다는 상대 비교 지표로 보는 편이 맞다.
- `GET /v1/models` 시나리오는 인증과 라우팅 오버헤드를 보기 좋지만, 실제 모델 추론 비용은 포함하지 않는다.
- `real` 모드 결과는 외부 API 상태, 네트워크 지연, rate limit 영향까지 포함한다.

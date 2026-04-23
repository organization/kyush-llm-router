# Model Routing

모델 카탈로그와 rewrite 규칙을 이용해 `/v1/chat/completions` 와 `/v1/models` 의 동작을 결정하는 방식.

## Runtime Flow

`POST /v1/chat/completions`

1. 사용자 API 키 인증
2. 사용자가 접근 가능한 backend id 목록 로드
3. 접근 가능한 활성 백엔드 중 아직 메모리 카탈로그가 초기화되지 않은 백엔드만 `/v1/models` 로 lazy fetch
4. 요청 `model` 에 대해 전역 `model_rewrites` 체인을 끝까지 평가
5. 최종 모델을 서빙하는 허용 가능한 활성 백엔드만 후보로 선택
6. 후보 중 1개를 랜덤 선택 후 업스트림으로 포워딩

`GET /v1/models`

1. 사용자 API 키 인증
2. 접근 가능한 활성 백엔드의 메모리 카탈로그를 확인
3. native backend 모델과 rewrite `source_model` alias를 같은 체인 해석기로 평가
4. 최종 모델 후보가 있는 requestable 모델 ID 합집합을 반환

## Caching Rules

- 메모리 캐시는 요청 라우팅의 단일 소스다
- `backend_models` 테이블은 관리자 조회와 오프라인 확인용 스냅샷이다
- 비활성 백엔드는 어떤 트리거에서도 `/v1/models` 조회를 시도하지 않는다
- 캐시 갱신 트리거는 아래와 같다
  - 서버 시작 시 활성 백엔드 초기화
  - 첫 요청 시 아직 초기화되지 않은 활성 백엔드 lazy fetch
  - 요청 실패 후 사용된 활성 백엔드 재동기화 시도
  - 관리자 백엔드 수정 후 강제 refresh
- 관리자 수정 기반 refresh 를 제외한 나머지 갱신은 최소 refresh 간격을 따른다

## Rewrite Rules

전역 rewrite 규칙은 `model_rewrites` 테이블에 저장된다.

| Mode | Condition | Result |
|------|-----------|--------|
| `force=true` | 항상 | `source_model` 을 `target_model` 로 치환하고 다음 규칙을 계속 평가 |
| `force=false` | 현재 모델 후보가 없을 때만 | `target_model` 을 fallback 으로 사용하고 다음 규칙을 계속 평가 |

해석 기준:
- “현재 모델 후보가 있다”는 것은 사용자가 접근 가능하고 활성 상태이며, 메모리 카탈로그상 해당 모델을 서빙하는 백엔드가 하나 이상 있다는 뜻이다
- 현재 모델 후보가 있으면 fallback 규칙은 무시되고 체인 평가가 멈춘다
- force 규칙은 현재 모델 후보 존재 여부와 관계없이 target으로 이동한다
- 최종 모델 후보가 없으면 라우터는 포워딩하지 않고 모델 미지원 오류를 반환한다
- 활성 rewrite 그래프에 cycle이 생기는 관리자 생성/수정은 거부된다
- 직접 DB 조작 등으로 runtime cycle이 발견되면 라우터는 설정 오류를 반환한다
- 체인 평가는 요청별 allowed backend set과 candidate memo를 사용해 반복 DB 조회를 피한다

예시:
`AutoModelTranslate -(Force)-> Qwen3.5 -(Force)-> Qwen/Qwen3.5-397B-A17B-FP8 -(Fallback)-> Gemma4 -(Force)-> cyankiwi/gemma-4-26B-A4B-it-AWQ-4bit`

위 예시에서 `Qwen/Qwen3.5-397B-A17B-FP8` 후보가 있으면 fallback이 적용되지 않고 그 모델로 라우팅된다. 후보가 없으면 `Gemma4`로 이동한 뒤 force 규칙을 이어서 적용한다.

## Admin Surface

- `/admin/backends/:id/models`: 백엔드별 DB 스냅샷 + 메모리 캐시 상태
- `/admin/backends/:id/models/refresh`: 활성 백엔드 강제 refresh
- `/admin/models/cache`: 전체 메모리 카탈로그 상태
- `/admin/model-rewrites`: 전역 rewrite 규칙 CRUD

관리자 UI:
- `/dashboard/backends`: 백엔드별 캐시 상태, 모델 수, 수동 refresh, 모델 목록 확인
- `/dashboard/models`: 전체 카탈로그와 rewrite 규칙 관리

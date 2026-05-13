# Script Engine

isolated-vm 기반 JavaScript 샌드박스에서 요청/응답을 조작하는 미들웨어 시스템.

## Script Types

| Type | Target | Description |
|------|--------|-------------|
| `per-user` | target_user_id | 특정 사용자의 모든 요청에 적용 |
| `per-backend` | target_backend_id | 특정 백엔드로 가는 모든 요청에 적용 |
| `per-user-backend` | target_user_id + target_backend_id | 특정 사용자-백엔드 조합에 적용 |

## Hooks

### onRequest

백엔드 포워딩 전에 실행. context를 수정하여 요청을 변조할 수 있다.

### onResponse

백엔드 응답 수신 후 실행. 현재 구현에서는 응답 컨텍스트를 검사하거나 로그/부가 처리를 수행하는 용도로 실행되며, 훅이 반환한 변경 내용이 최종 HTTP 응답에 다시 반영되지는 않는다.

참고: `reasoning` 을 `reasoning_content` 로 복제하는 OpenAI-compatible 호환 처리는 script hook이 아니라 사용자별 라우터 내장 옵션 `copy_reasoning_to_reasoning_content` 로 수행한다.

## Script Context

스크립트에서 접근 가능한 데이터:

```typescript
interface ScriptContextData {
  user: { id, name, email }
  backend: { id, name, base_url }
  request: { method, path, headers, body, isStream }
  response?: { status, headers, body, isStream }  // onResponse에서만
}
```

참고:
- `request.body`, `response.body`는 직렬화 가능한 값이며 보통 JSON 객체로 전달된다.
- 스크립트가 body를 수정하면 라우터가 업스트림 전송 전에 최종 body를 기준으로 직렬화하고 `content-length`를 다시 계산한다.
- `response` 필드는 실제 프록시 요청의 `onResponse` 단계에서 채워진다. `/admin/scripts/:id/test` 는 훅 존재 여부와 실행 가능성 확인용에 가깝다.

## Example

```javascript
export async function onRequest(context) {
  // 요청 헤더 추가
  context.request.headers['X-Custom-Header'] = 'value';
  return context;
}

export async function onResponse(context) {
  // 응답 로깅
  console.log(`Status: ${context.response.status}`);
  return context;
}
```

## Execution Environment

- **Runtime**: isolated-vm (V8 isolate)
- **Timeout**: 5초
- **Memory**: 50MB per isolate
- **Console**: logger에 바인딩됨
- 관련 코드: `server/src/services/ScriptEngine.ts`, `server/src/services/ScriptExecutor.ts`

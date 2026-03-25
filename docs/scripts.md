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

백엔드 응답 수신 후 실행. context를 수정하여 응답을 변조할 수 있다.

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

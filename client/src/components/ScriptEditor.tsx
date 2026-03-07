import { MonacoEditor } from 'solid-monaco';
import { createSignal, onMount } from 'solid-js';

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
  readonly?: boolean;
}

export function ScriptEditor(props: ScriptEditorProps) {
  const defaultCode = `// User-defined middleware script
// Available functions: onRequest, onResponse

/**
 * Called before the request is forwarded to the backend
 * @param ctx - Script context with user, backend, and request information
 * @returns Modified context
 */
export async function onRequest(ctx) {
  // Example: Add custom header
  // ctx.request.headers['X-Custom-Header'] = 'value';
  
  // Example: Log request
  // console.log('Request:', ctx.request.method, ctx.request.path);
  
  return ctx;
}

/**
 * Called after receiving response from the backend
 * @param ctx - Script context with response information
 * @returns Modified context
 */
export async function onResponse(ctx) {
  // Example: Log response
  // console.log('Response status:', ctx.response?.status);
  
  // Example: Handle streaming responses
  // if (ctx.response?.isStream && ctx.onChunk) {
  //   const originalOnChunk = ctx.onChunk;
  //   ctx.onChunk = (chunk) => {
  //     console.log('Stream chunk:', chunk);
  //     originalOnChunk(chunk);
  //   };
  // }
  
  return ctx;
}
`;

  const [editorValue, setEditorValue] = createSignal(props.value || defaultCode);

  onMount(() => {
    if (props.value) {
      setEditorValue(props.value);
    }
  });

  const handleChange = (value: string) => {
    setEditorValue(value);
    props.onChange(value);
  };

  return (
    <div style={{ height: '600px', width: '100%' }}>
      <MonacoEditor
        language="typescript"
        value={editorValue()}
        onChange={handleChange}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: 'on',
          automaticLayout: true,
          scrollBeyondLastLine: false,
          padding: { top: 16, bottom: 16 },
        }}
      />
    </div>
  );
}

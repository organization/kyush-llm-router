import { Dynamic } from 'solid-js/web';
import { createSignal, lazy, onCleanup, onMount, Suspense } from 'solid-js';

const THEME_STORAGE_KEY = 'kyush-theme';
const MonacoEditor = lazy(() =>
  import('solid-monaco').then((module) => ({ default: module.MonacoEditor })),
);

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
  readonly?: boolean;
  path?: string;
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

  // Example: Edit body
  // if (typeof ctx.request.body === 'object') {
  //  if (typeof ctx.request.body['chat_template_kwargs'] !== 'object') {
  //    ctx.request.body['chat_template_kwargs'] = {};
  //  }
  
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

  const [editorTheme, setEditorTheme] = createSignal<'vs' | 'vs-dark'>(
    'vs-dark',
  );

  onMount(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const syncTheme = () => {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      const explicitTheme = root.dataset.theme;
      const preferredTheme =
        storedTheme === 'light' || storedTheme === 'dark'
          ? storedTheme
          : explicitTheme;
      const isDark = preferredTheme
        ? preferredTheme === 'dark'
        : mediaQuery.matches;
      setEditorTheme(isDark ? 'vs-dark' : 'vs');
    };

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    mediaQuery.addEventListener('change', syncTheme);
    syncTheme();

    onCleanup(() => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', syncTheme);
    });
  });

  return (
    <div class="script-editor">
      <Suspense
        fallback={
          <div aria-live="polite" class="script-editor__loading" role="status">
            <div class="script-editor__skeleton script-editor__skeleton--toolbar" />
            <div class="script-editor__skeleton script-editor__skeleton--line" />
            <div class="script-editor__skeleton script-editor__skeleton--line script-editor__skeleton--short" />
            <div class="script-editor__skeleton script-editor__skeleton--line" />
            <div class="script-editor__skeleton script-editor__skeleton--line script-editor__skeleton--medium" />
            <p class="script-editor__loading-copy">Loading editor runtime...</p>
          </div>
        }
      >
        <Dynamic
          component={MonacoEditor}
          language="typescript"
          onChange={(value: string) => props.onChange(value)}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: 'on',
            automaticLayout: true,
            readOnly: props.readonly,
            scrollBeyondLastLine: false,
            padding: { top: 16, bottom: 16 },
          }}
          path={props.path}
          theme={editorTheme()}
          value={props.value || defaultCode}
        />
      </Suspense>
    </div>
  );
}

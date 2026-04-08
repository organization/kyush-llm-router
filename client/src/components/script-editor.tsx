import { createSignal, lazy, onCleanup, onMount, Suspense } from 'solid-js';
import { Dynamic } from 'solid-js/web';

const THEME_STORAGE_KEY = 'kyush-theme';

const MonacoEditor = lazy(async () => {
  const module = await import('solid-monaco');
  return { default: module.MonacoEditor };
});

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
  readonly?: boolean;
  path?: string;
}

const DEFAULT_CODE = `// User-defined middleware script
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
  //   ctx.request.body['chat_template_kwargs'] ??= {};
  // }

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

  return ctx;
}
`;

type EditorTheme = 'vs' | 'vs-dark';

function readThemePreference(): EditorTheme {
  const root = document.documentElement;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  const explicit = root.dataset.theme;
  const preferred = stored === 'light' || stored === 'dark' ? stored : explicit;
  const isDark = preferred
    ? preferred === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;
  return isDark ? 'vs-dark' : 'vs';
}

/**
 * Tracks the user's preferred Monaco theme. Watches three sources of truth:
 *   1. `localStorage[kyush-theme]` (explicit user choice)
 *   2. `<html data-theme="…">` (set by the app shell)
 *   3. `prefers-color-scheme` media query (system fallback)
 *
 * Both the MutationObserver and the media-query listener are wired up in
 * `onMount` (so they're guaranteed to run only on the client) and torn down
 * via the matching `onCleanup` registered in the same effect — that
 * registration is owned by the surrounding component scope, so it always
 * fires on unmount.
 */
function createEditorThemeSignal() {
  const [theme, setTheme] = createSignal<EditorTheme>('vs-dark');

  onMount(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const sync = () => setTheme(readThemePreference());

    const observer = new MutationObserver(sync);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    mediaQuery.addEventListener('change', sync);
    sync();

    onCleanup(() => {
      // Both subscriptions are paired with their teardown in the same closure
      // so it's impossible to add one without removing the other.
      observer.disconnect();
      mediaQuery.removeEventListener('change', sync);
    });
  });

  return theme;
}

function ScriptEditor(props: ScriptEditorProps) {
  const editorTheme = createEditorThemeSignal();

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
          onChange={props.onChange}
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
          value={props.value || DEFAULT_CODE}
        />
      </Suspense>
    </div>
  );
}

export default ScriptEditor;

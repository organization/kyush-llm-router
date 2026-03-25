import { createMemo, createResource, createSignal, Show, type Component } from 'solid-js';
import { api } from '../api/client';
import { Layout } from '../components/Layout';
import { ScriptEditor } from '../components/ScriptEditor';
import { Play, Plus, Power, PowerOff, RefreshCw, RotateCcw, Save, Trash2 } from 'lucide-solid';
import type { ScriptType, UserScript } from '../types';
import {
  Alert,
  Button,
  Checkbox,
  CommandBar,
  CommandBarGroup,
  ConfirmDialog,
  DataGrid,
  EmptyState,
  IconButton,
  MetaCluster,
  PageHeader,
  Panel,
  Select,
  StatusBadge,
  SummaryStrip,
  Tabs,
  TextField,
} from '../ui';

type NoticeTone = 'success' | 'warning' | 'danger' | 'info';

interface ScriptFormState {
  id?: number;
  name: string;
  script_type: ScriptType;
  target_user_id: string;
  target_backend_id: string;
  script_code: string;
  is_active: boolean;
}

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

const emptyForm = (): ScriptFormState => ({
  name: '',
  script_type: 'per-user-backend',
  target_user_id: '',
  target_backend_id: '',
  script_code: defaultCode,
  is_active: true,
});

const scriptTypeLabels: Record<ScriptType, string> = {
  'per-user-backend': 'Per User + Backend',
  'per-backend': 'Per Backend',
  'per-user': 'Per User',
};

export const Scripts: Component = () => {
  const [scripts, { refetch: refetchScripts }] = createResource(() => api.scripts.getAll());
  const [users, { refetch: refetchUsers }] = createResource(() => api.users.getAll());
  const [backends, { refetch: refetchBackends }] = createResource(() => api.backends.getAll());
  const [form, setForm] = createSignal<ScriptFormState>(emptyForm());
  const [selectedScriptId, setSelectedScriptId] = createSignal<number | null>(null);
  const [pendingDeleteScript, setPendingDeleteScript] = createSignal<UserScript | null>(null);
  const [confirmOpen, setConfirmOpen] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [notice, setNotice] = createSignal<{ tone: NoticeTone; message: string } | null>(null);
  const [testResult, setTestResult] = createSignal<{ success: boolean; error?: string; executionTime?: number } | null>(null);
  const [testing, setTesting] = createSignal(false);

  const userOptions = createMemo(() => (users() ?? []).map((user) => ({ value: String(user.id), label: user.name })));
  const backendOptions = createMemo(() => (backends() ?? []).map((backend) => ({ value: String(backend.id), label: backend.name })));

  const activeCount = createMemo(() => (scripts() ?? []).filter((script) => script.is_active).length);
  const selectedScript = createMemo(() => (scripts() ?? []).find((script) => script.id === selectedScriptId()) ?? null);

  const syncForm = (script?: UserScript | null) => {
    if (!script) {
      setSelectedScriptId(null);
      setForm(emptyForm());
      setTestResult(null);
      return;
    }

    setSelectedScriptId(script.id);
    setForm({
      id: script.id,
      name: script.name,
      script_type: script.script_type,
      target_user_id: script.target_user_id ? String(script.target_user_id) : '',
      target_backend_id: script.target_backend_id ? String(script.target_backend_id) : '',
      script_code: script.script_code,
      is_active: script.is_active,
    });
    setTestResult(null);
  };

  const getTargetLabel = (script: Pick<UserScript, 'script_type' | 'target_user_id' | 'target_backend_id'>) => {
    const user = (users() ?? []).find((item) => item.id === script.target_user_id);
    const backend = (backends() ?? []).find((item) => item.id === script.target_backend_id);

    if (script.script_type === 'per-user-backend') {
      return {
        primary: `${user?.name ?? 'Unknown user'} + ${backend?.name ?? 'Unknown backend'}`,
        secondary: `${script.target_user_id ?? '-'} / ${script.target_backend_id ?? '-'}`,
      };
    }

    if (script.script_type === 'per-user') {
      return {
        primary: user?.name ?? 'Unknown user',
        secondary: `User ${script.target_user_id ?? '-'}`,
      };
    }

    return {
      primary: backend?.name ?? 'Unknown backend',
      secondary: `Backend ${script.target_backend_id ?? '-'}`,
    };
  };

  const validateForm = () => {
    const current = form();
    if (!current.name.trim()) return 'Script name is required.';
    if (!current.script_code.trim()) return 'Script code is required.';
    if (current.script_type === 'per-user-backend' && (!current.target_user_id || !current.target_backend_id)) {
      return 'Select both a target user and backend.';
    }
    if (current.script_type === 'per-user' && !current.target_user_id) {
      return 'Select a target user.';
    }
    if (current.script_type === 'per-backend' && !current.target_backend_id) {
      return 'Select a target backend.';
    }
    return null;
  };

  const saveScript = async () => {
    const error = validateForm();
    if (error) {
      setNotice({ tone: 'danger', message: error });
      return;
    }

    const current = form();
    const payload = {
      name: current.name.trim(),
      script_type: current.script_type,
      target_user_id: current.target_user_id ? Number(current.target_user_id) : null,
      target_backend_id: current.target_backend_id ? Number(current.target_backend_id) : null,
      script_code: current.script_code,
      is_active: current.is_active,
    };

    setSubmitting(true);
    try {
      if (current.id) {
        const updated = await api.scripts.update(current.id, payload);
        setNotice({ tone: 'success', message: 'Script updated.' });
        syncForm(updated);
      } else {
        const created = await api.scripts.create(payload);
        setNotice({ tone: 'success', message: 'Script created.' });
        syncForm(created);
      }
      await refetchScripts();
      await refetchUsers();
      await refetchBackends();
    } catch (saveError) {
      setNotice({ tone: 'danger', message: saveError instanceof Error ? saveError.message : 'Script save failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (script: UserScript) => {
    try {
      if (script.is_active) {
        await api.scripts.deactivate(script.id);
      } else {
        await api.scripts.activate(script.id);
      }
      setNotice({ tone: 'success', message: `${script.name} ${script.is_active ? 'deactivated' : 'activated'}.` });
      await refetchScripts();
      if (selectedScriptId() === script.id) {
        syncForm({ ...script, is_active: !script.is_active });
      }
    } catch (error) {
      setNotice({ tone: 'danger', message: error instanceof Error ? error.message : 'Status update failed.' });
    }
  };

  const requestDelete = (script: UserScript) => {
    setPendingDeleteScript(script);
    setConfirmOpen(true);
  };

  const deleteScript = async () => {
    const script = pendingDeleteScript();
    if (!script) return;

    setSubmitting(true);
    try {
      await api.scripts.delete(script.id);
      setNotice({ tone: 'success', message: `${script.name} deleted.` });
      setConfirmOpen(false);
      setPendingDeleteScript(null);
      if (selectedScriptId() === script.id) {
        syncForm(null);
      }
      await refetchScripts();
    } catch (error) {
      setNotice({ tone: 'danger', message: error instanceof Error ? error.message : 'Script deletion failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  const runTest = async () => {
    const current = selectedScript();
    if (!current) {
      setNotice({ tone: 'warning', message: 'Save the script before running a test.' });
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.scripts.test(current.id, {
        user: users()?.[0] || undefined,
        backend: backends()?.[0] || undefined,
        request: {
          method: 'POST',
          path: '/v1/chat/completions',
          headers: { 'Content-Type': 'application/json' },
          body: { model: 'test', messages: [{ role: 'user', content: 'test' }] },
          isStream: false,
        },
      });
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Layout>
      <div class="ui-app-page">
        <PageHeader
          title="Scripts"
          description="Create and maintain request and response middleware with compact editing, metadata, and test feedback."
        />

        <SummaryStrip
          items={[
            { label: 'Total Scripts', value: scripts()?.length ?? 0, hint: 'All stored middleware entries' },
            { label: 'Active', value: activeCount(), hint: 'Currently applied during routing' },
            { label: 'Users', value: users()?.length ?? 0, hint: 'Available test context identities' },
          ]}
        />

        <Show when={notice()}>
          {(currentNotice) => (
            <Alert tone={currentNotice().tone === 'danger' ? 'danger' : currentNotice().tone === 'warning' ? 'warning' : currentNotice().tone === 'success' ? 'success' : 'info'}>
              {currentNotice().message}
            </Alert>
          )}
        </Show>

        <CommandBar>
          <CommandBarGroup>
            <StatusBadge tone="info">{scripts.loading ? 'Syncing' : 'Ready'}</StatusBadge>
            <StatusBadge tone="success">{`${activeCount()} active`}</StatusBadge>
          </CommandBarGroup>
        </CommandBar>

        <div class="ui-split-panel">
          <Panel
            title="Script registry"
            description="Select a script to edit, test, or change activation state."
            actions={
              <IconButton icon={<RefreshCw />} label="Refresh" onClick={() => void refetchScripts()} />
            }
            bodyClass="ui-stack ui-stack--tight"
          >
            <Show
              when={!scripts.loading || (scripts()?.length ?? 0) > 0}
              fallback={<EmptyState title="Loading scripts" description="Reading middleware definitions and target mappings." />}
            >
              <Show
                when={(scripts()?.length ?? 0) > 0}
                fallback={
                  <EmptyState
                    title="No scripts yet"
                    description="Create your first middleware script to intercept requests or responses."
                    action={
                      <IconButton variant="primary" icon={<Plus />} label="Create Script" onClick={() => syncForm(null)} />
                    }
                  />
                }
              >
                <DataGrid
                  rows={scripts() ?? []}
                  columns={[
                    {
                      id: 'name',
                      header: 'Name',
                      cell: (script) => <span>{script.name}</span>,
                    },
                    {
                      id: 'type',
                      header: 'Type',
                      cell: (script) => <StatusBadge tone="info">{scriptTypeLabels[script.script_type]}</StatusBadge>,
                    },
                    {
                      id: 'target',
                      header: 'Target',
                      cell: (script) => {
                        const target = getTargetLabel(script);
                        return (
                          <div class="script-target">
                            <p class="script-target__primary">{target.primary}</p>
                            <p class="script-target__secondary">{target.secondary}</p>
                          </div>
                        );
                      },
                    },
                    {
                      id: 'status',
                      header: 'Status',
                      cell: (script) => <StatusBadge tone={script.is_active ? 'success' : 'warning'}>{script.is_active ? 'Active' : 'Inactive'}</StatusBadge>,
                    },
                  ]}
                  getRowKey={(script) => script.id}
                  loading={scripts.loading}
                  onRowClick={(script) => syncForm(script)}
                  rowActions={(script) => (
                    <div class="ui-row-actions">
                      <IconButton
                        icon={script.is_active ? <PowerOff /> : <Power />}
                        label={script.is_active ? 'Disable' : 'Enable'}
                        onClick={() => void toggleActive(script)}
                      />
                      <IconButton variant="danger" icon={<Trash2 />} label="Delete" onClick={() => requestDelete(script)} />
                    </div>
                  )}
                />
              </Show>
            </Show>
          </Panel>

          <Panel
            title={form().id ? `Editing ${form().name}` : 'New script draft'}
            description="Configure middleware scripts, run validation tests before applying changes."
            actions={
              <div class="ui-chip-group">
                <StatusBadge tone={form().is_active ? 'success' : 'warning'}>{form().is_active ? 'Active' : 'Draft'}</StatusBadge>
                <IconButton
                  variant="primary"
                  icon={<Save />}
                  label={form().id ? 'Save Script' : 'Create Script'}
                  onClick={() => void saveScript()}
                  disabled={submitting()}
                />
                <IconButton icon={<Plus />} label="New Script" onClick={() => syncForm(null)} />
                <IconButton icon={<RotateCcw />} label="Reset" onClick={() => syncForm(selectedScript())} />
              </div>
            }
            bodyClass="ui-stack"
          >
            <div class="ui-form__section">
              <TextField label="Script name" value={form().name} onInput={(event) => setForm((current) => ({ ...current, name: event.currentTarget.value }))} />

              <Select
                label="Scope"
                value={form().script_type}
                onChange={(value) => setForm((current) => ({ ...current, script_type: value as ScriptType, target_user_id: '', target_backend_id: '' }))}
                options={[
                  { value: 'per-user-backend', label: scriptTypeLabels['per-user-backend'] },
                  { value: 'per-user', label: scriptTypeLabels['per-user'] },
                  { value: 'per-backend', label: scriptTypeLabels['per-backend'] },
                ]}
              />

              <Show when={form().script_type !== 'per-backend'}>
                <Select
                  label="Target user"
                  value={form().target_user_id}
                  onChange={(value) => setForm((current) => ({ ...current, target_user_id: value }))}
                  options={userOptions()}
                  placeholder="Select user"
                />
              </Show>

              <Show when={form().script_type !== 'per-user'}>
                <Select
                  label="Target backend"
                  value={form().target_backend_id}
                  onChange={(value) => setForm((current) => ({ ...current, target_backend_id: value }))}
                  options={backendOptions()}
                  placeholder="Select backend"
                />
              </Show>

              <Checkbox
                label="Script is active"
                description="Inactive scripts remain editable but are skipped during routing."
                checked={form().is_active}
                onChange={(checked) => setForm((current) => ({ ...current, is_active: checked }))}
              />
            </div>

            <MetaCluster
              items={[
                { key: 'Mode', value: form().id ? 'Saved script' : 'Unsaved draft' },
                { key: 'User context', value: form().target_user_id || 'Not assigned' },
                { key: 'Backend context', value: form().target_backend_id || 'Not assigned' },
              ]}
            />

            <Tabs.Root defaultValue="editor">
              <Tabs.List aria-label="Script workspace">
                <Tabs.Trigger value="editor">Editor</Tabs.Trigger>
                <Tabs.Trigger value="test">Test</Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="editor">
                <ScriptEditor
                  value={form().script_code}
                  path={form().id ? `inmemory://model/scripts/${form().id}.ts` : 'inmemory://model/scripts/draft.ts'}
                  onChange={(value) => setForm((current) => ({ ...current, script_code: value }))}
                />
              </Tabs.Content>
              <Tabs.Content value="test">
                <div class="ui-stack">
                  <p class="ui-copy">The test runner uses the first available user/backend as sample context and a mock chat completion request.</p>
                  <div class="ui-row-actions">
                    <IconButton variant="primary" icon={<Play />} label={testing() ? 'Running...' : 'Run Test'} onClick={() => void runTest()} disabled={testing()} />
                  </div>
                  <Show
                    when={testResult()}
                    fallback={<EmptyState title="No test run yet" description="Save or select a script, then run the built-in test harness to inspect the result." />}
                  >
                    {(result) => (
                      <Alert tone={result().success ? 'success' : 'danger'} title={result().success ? 'Test passed' : 'Test failed'}>
                        {result().error ?? `Execution time: ${result().executionTime ?? 0}ms`}
                      </Alert>
                    )}
                  </Show>
                </div>
              </Tabs.Content>
            </Tabs.Root>
          </Panel>
        </div>

        <ConfirmDialog
          open={confirmOpen()}
          onOpenChange={setConfirmOpen}
          title="Delete script"
          description="This permanently removes the middleware definition and its current target binding."
          confirmLabel="Delete Script"
          tone="danger"
          busy={submitting()}
          details={
            <Show when={pendingDeleteScript()}>
              {(script) => (
                <MetaCluster
                  items={[
                    { key: 'Name', value: script().name },
                    { key: 'Type', value: scriptTypeLabels[script().script_type] },
                    { key: 'Target', value: getTargetLabel(script()).primary },
                  ]}
                />
              )}
            </Show>
          }
          onConfirm={() => void deleteScript()}
        />
      </div>
    </Layout>
  );
};

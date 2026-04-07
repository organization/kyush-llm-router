import {
  createMemo,
  createResource,
  createSignal,
  Show,
  type Component,
} from 'solid-js';
import Pencil from 'lucide-solid/icons/pencil';
import Plus from 'lucide-solid/icons/plus';
import Trash2 from 'lucide-solid/icons/trash-2';

import { api } from '../api/client';
import { Layout } from '../components/Layout';

import {
  Alert,
  Button,
  Checkbox,
  ConfirmDialog,
  DataGrid,
  EmptyState,
  FormDialog,
  IconButton,
  PageHeader,
  Panel,
  StatusBadge,
  SummaryStrip,
  TextField,
} from '../ui';

import type { ModelRewriteRule } from '../types';

interface RewriteFormState {
  source_model: string;
  target_model: string;
  is_active: boolean;
  force: boolean;
  note: string;
}

const emptyForm = (): RewriteFormState => ({
  source_model: '',
  target_model: '',
  is_active: true,
  force: false,
  note: '',
});

const Models: Component = () => {
  const [overview, { refetch: refetchOverview }] = createResource(() =>
    api.modelCache.getOverview(),
  );
  const [backends] = createResource(() => api.backends.getAll());
  const [rules, { refetch: refetchRules }] = createResource(() =>
    api.modelRewrites.getAll(),
  );
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [confirmOpen, setConfirmOpen] = createSignal(false);
  const [editingRule, setEditingRule] = createSignal<ModelRewriteRule | null>(
    null,
  );
  const [pendingDeleteRule, setPendingDeleteRule] =
    createSignal<ModelRewriteRule | null>(null);
  const [form, setForm] = createSignal<RewriteFormState>(emptyForm());
  const [submitting, setSubmitting] = createSignal(false);
  const [notice, setNotice] = createSignal<{
    tone: 'success' | 'danger';
    message: string;
  } | null>(null);
  const backendNameById = createMemo(() => {
    const names = new Map<number, string>();
    for (const backend of backends() ?? []) {
      names.set(backend.id, backend.name);
    }
    return names;
  });

  const getBackendName = (backendId: number) =>
    backendNameById().get(backendId) ?? `Backend ${backendId}`;
  const modelCatalogRows = createMemo(() =>
    (overview()?.models ?? []).map((entry) => ({
      ...entry,
      backend_names: entry.backend_ids
        .map((backendId) => getBackendName(backendId))
        .join(', '),
    })),
  );

  const openCreateDialog = () => {
    setEditingRule(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEditDialog = (rule: ModelRewriteRule) => {
    setEditingRule(rule);
    setForm({
      source_model: rule.source_model,
      target_model: rule.target_model,
      is_active: rule.is_active,
      force: rule.force,
      note: rule.note ?? '',
    });
    setDialogOpen(true);
  };

  const saveRule = async (event: Event) => {
    event.preventDefault();
    const current = form();
    if (!current.source_model.trim() || !current.target_model.trim()) {
      setNotice({
        tone: 'danger',
        message: 'Source and target model are required.',
      });
      return;
    }

    setSubmitting(true);
    try {
      if (editingRule()) {
        await api.modelRewrites.update(editingRule()!.id, {
          source_model: current.source_model.trim(),
          target_model: current.target_model.trim(),
          is_active: current.is_active,
          force: current.force,
          note: current.note.trim() || undefined,
        });
        setNotice({ tone: 'success', message: 'Model rule updated.' });
      } else {
        await api.modelRewrites.create({
          source_model: current.source_model.trim(),
          target_model: current.target_model.trim(),
          is_active: current.is_active,
          force: current.force,
          note: current.note.trim() || undefined,
        });
        setNotice({ tone: 'success', message: 'Model rule created.' });
      }
      setDialogOpen(false);
      setEditingRule(null);
      setForm(emptyForm());
      await Promise.all([refetchRules(), refetchOverview()]);
    } catch (error) {
      setNotice({
        tone: 'danger',
        message:
          error instanceof Error ? error.message : 'Model rule save failed.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteRule = async () => {
    const current = pendingDeleteRule();
    if (!current) return;

    setSubmitting(true);
    try {
      await api.modelRewrites.delete(current.id);
      setNotice({
        tone: 'success',
        message: `${current.source_model} removed.`,
      });
      setConfirmOpen(false);
      setPendingDeleteRule(null);
      await Promise.all([refetchRules(), refetchOverview()]);
    } catch (error) {
      setNotice({
        tone: 'danger',
        message:
          error instanceof Error
            ? error.message
            : 'Model rule deletion failed.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div class="ui-app-page">
        <PageHeader
          actions={
            <Button
              onClick={() =>
                void Promise.all([refetchOverview(), refetchRules()])
              }
            >
              Refresh
            </Button>
          }
          description="Inspect cached backend model catalogs and manage global model rewrite rules."
          title="Models"
        />

        <SummaryStrip
          items={[
            {
              label: 'Catalog Models',
              value: overview()?.models.length ?? 0,
              hint: 'Unique models across active backends',
            },
            {
              label: 'Tracked Backends',
              value: overview()?.backends.length ?? 0,
              hint: 'Memory cache status by backend',
            },
            {
              label: 'Rewrite Rules',
              value: rules()?.length ?? 0,
              hint: 'Global source -> target mappings',
            },
          ]}
        />

        <Show when={notice()}>
          {(currentNotice) => (
            <Alert tone={currentNotice().tone}>{currentNotice().message}</Alert>
          )}
        </Show>

        <div class="ui-section-grid">
          <Panel
            description="Memory-backed backend cache state used by request routing and `/v1/models`."
            title="Backend Cache Status"
          >
            <Show
              fallback={
                <EmptyState
                  description="Backend model states appear here after the server has seen active backends."
                  title="No backend cache yet"
                />
              }
              when={(overview()?.backends.length ?? 0) > 0}
            >
              <DataGrid
                columns={[
                  {
                    id: 'backend_id',
                    header: 'Backend',
                    class: 'models__catalog-column',
                    cell: (item) => (
                      <span title={getBackendName(item.backend_id)}>
                        {getBackendName(item.backend_id)}
                      </span>
                    ),
                  },
                  {
                    id: 'state',
                    header: 'State',
                    cell: (item) => (
                      <StatusBadge
                        tone={
                          item.state === 'ready'
                            ? 'success'
                            : item.state === 'error'
                              ? 'danger'
                              : item.state === 'inactive'
                                ? 'neutral'
                                : 'warning'
                        }
                      >
                        {item.state}
                      </StatusBadge>
                    ),
                  },
                  {
                    id: 'model_count',
                    header: 'Models',
                    cell: (item) => <span>{item.model_count}</span>,
                  },
                  {
                    id: 'last_synced_at',
                    header: 'Last Sync',
                    cell: (item) => (
                      <span>
                        {item.last_synced_at
                          ? new Date(item.last_synced_at).toLocaleString()
                          : '-'}
                      </span>
                    ),
                  },
                  {
                    id: 'last_error',
                    header: 'Last Error',
                    cell: (item) => (
                      <span title={item.last_error ?? '-'}>
                        {item.last_error ?? '-'}
                      </span>
                    ),
                  },
                ]}
                getRowKey={(item) => item.backend_id}
                loading={overview.loading}
                rows={overview()?.backends ?? []}
              />
            </Show>
          </Panel>

          <Panel
            description="Unique models and the backend names currently advertising each one."
            title="Model Catalog"
          >
            <Show
              fallback={
                <EmptyState
                  description="Model catalog entries appear here after backend model snapshots are available."
                  title="No cached models yet"
                />
              }
              when={modelCatalogRows().length > 0}
            >
              <DataGrid
                columns={[
                  {
                    id: 'model_id',
                    header: 'Model',
                    class: 'models__catalog-column',
                    cell: (item) => (
                      <span title={item.model_id}>{item.model_id}</span>
                    ),
                  },
                  {
                    id: 'backend_names',
                    header: 'Backends',
                    class: 'models__catalog-column',
                    cell: (item) => (
                      <span title={item.backend_names}>
                        {item.backend_names}
                      </span>
                    ),
                  },
                  {
                    id: 'backend_count',
                    header: 'Count',
                    width: '64px',
                    mono: true,
                    cell: (item) => <span>{item.backend_ids.length}</span>,
                  },
                ]}
                getRowKey={(item) => item.model_id}
                loading={overview.loading}
                rows={modelCatalogRows()}
              />
            </Show>
          </Panel>
        </div>

        <Panel
          actions={
            <IconButton
              icon={<Plus />}
              label="Add Rule"
              onClick={openCreateDialog}
              variant="primary"
            />
          }
          description="Force rules always rewrite. Fallback rules rewrite only when the original model has no usable backend."
          title="Model Rewrite Rules"
        >
          <div class="ui-stack ui-stack--tight">
            <Show
              fallback={
                <EmptyState
                  description="Requests currently route using the original model name."
                  title="No rewrite rules"
                />
              }
              when={(rules()?.length ?? 0) > 0}
            >
              <DataGrid
                columns={[
                  {
                    id: 'source_model',
                    header: 'Source',
                    cell: (rule) => <span>{rule.source_model}</span>,
                  },
                  {
                    id: 'target_model',
                    header: 'Target',
                    cell: (rule) => <span>{rule.target_model}</span>,
                  },
                  {
                    id: 'mode',
                    header: 'Mode',
                    cell: (rule) => (
                      <StatusBadge tone={rule.force ? 'warning' : 'neutral'}>
                        {rule.force ? 'Force' : 'Fallback'}
                      </StatusBadge>
                    ),
                  },
                  {
                    id: 'is_active',
                    header: 'Status',
                    cell: (rule) => (
                      <StatusBadge
                        tone={rule.is_active ? 'success' : 'warning'}
                      >
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </StatusBadge>
                    ),
                  },
                  {
                    id: 'note',
                    header: 'Note',
                    cell: (rule) => (
                      <span title={rule.note ?? '-'}>{rule.note ?? '-'}</span>
                    ),
                  },
                ]}
                getRowKey={(rule) => rule.id}
                loading={rules.loading}
                rowActions={(rule) => (
                  <div class="ui-row-actions">
                    <IconButton
                      icon={<Pencil />}
                      label="Edit"
                      onClick={() => openEditDialog(rule)}
                    />
                    <IconButton
                      icon={<Trash2 />}
                      label="Delete"
                      onClick={() => {
                        setPendingDeleteRule(rule);
                        setConfirmOpen(true);
                      }}
                      variant="danger"
                    />
                  </div>
                )}
                rows={rules() ?? []}
              />
            </Show>
          </div>
        </Panel>

        <FormDialog
          description="Choose whether the target model should always replace the source, or only act as a fallback when the source is unavailable."
          footer={
            <>
              <Button
                disabled={submitting()}
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={submitting()}
                form="model-rule-form"
                type="submit"
                variant="primary"
              >
                {editingRule() ? 'Save Changes' : 'Create Rule'}
              </Button>
            </>
          }
          onOpenChange={setDialogOpen}
          open={dialogOpen()}
          title={editingRule() ? 'Edit Model Rule' : 'Add Model Rule'}
        >
          <form
            class="ui-form"
            id="model-rule-form"
            onSubmit={(event) => void saveRule(event)}
          >
            <TextField
              label="Source Model"
              onInput={(event) =>
                setForm((current) => ({
                  ...current,
                  source_model: event.currentTarget.value,
                }))
              }
              value={form().source_model}
            />
            <TextField
              label="Target Model"
              onInput={(event) =>
                setForm((current) => ({
                  ...current,
                  target_model: event.currentTarget.value,
                }))
              }
              value={form().target_model}
            />
            <TextField
              label="Note"
              onInput={(event) =>
                setForm((current) => ({
                  ...current,
                  note: event.currentTarget.value,
                }))
              }
              value={form().note}
            />
            <Checkbox
              checked={form().force}
              description="When enabled, requests always route to the target model. When disabled, the target model is only used as a fallback."
              label="Always force rewrite"
              onChange={(checked) =>
                setForm((current) => ({ ...current, force: checked }))
              }
            />
            <Checkbox
              checked={form().is_active}
              description="Inactive rules stay stored but do not affect request routing."
              label="Rule is active"
              onChange={(checked) =>
                setForm((current) => ({ ...current, is_active: checked }))
              }
            />
          </form>
        </FormDialog>

        <ConfirmDialog
          busy={submitting()}
          confirmLabel="Delete Rule"
          description="Removing the rule stops rewriting requests that target this source model."
          onConfirm={() => void deleteRule()}
          onOpenChange={setConfirmOpen}
          open={confirmOpen()}
          title="Delete rewrite rule"
          tone="danger"
        />
      </div>
    </Layout>
  );
};

export default Models;

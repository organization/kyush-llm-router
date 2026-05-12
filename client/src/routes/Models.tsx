import { createMemo, createResource, createSignal, Show, type Component } from 'solid-js';
import Pencil from 'lucide-solid/icons/pencil';
import Plus from 'lucide-solid/icons/plus';
import Trash2 from 'lucide-solid/icons/trash-2';
import { api } from '../api/client';
import { Layout } from '../components/Layout';
import type { ModelRewriteRule } from '../types';
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

export const Models: Component = () => {
  const [overview, { refetch: refetchOverview }] = createResource(() => api.modelCache.getOverview());
  const [backends] = createResource(() => api.backends.getAll());
  const [rules, { refetch: refetchRules }] = createResource(() => api.modelRewrites.getAll());
  const currentOverview = createMemo(() => overview.state === 'ready' || overview.state === 'refreshing' ? overview.latest : undefined);
  const currentBackends = createMemo(() => backends.state === 'ready' || backends.state === 'refreshing' ? backends.latest : undefined);
  const currentRules = createMemo(() => rules.state === 'ready' || rules.state === 'refreshing' ? rules.latest : undefined);
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [confirmOpen, setConfirmOpen] = createSignal(false);
  const [editingRule, setEditingRule] = createSignal<ModelRewriteRule | null>(null);
  const [pendingDeleteRule, setPendingDeleteRule] = createSignal<ModelRewriteRule | null>(null);
  const [form, setForm] = createSignal<RewriteFormState>(emptyForm());
  const [submitting, setSubmitting] = createSignal(false);
  const [notice, setNotice] = createSignal<{ tone: 'success' | 'danger'; message: string } | null>(null);
  const backendNameById = createMemo(() => {
    const names = new Map<number, string>();
    for (const backend of currentBackends() ?? []) {
      names.set(backend.id, backend.name);
    }
    return names;
  });

  const getBackendName = (backendId: number) => backendNameById().get(backendId) ?? `Backend ${backendId}`;
  const modelCatalogRows = createMemo(() =>
    (currentOverview()?.models ?? []).map((entry) => ({
      ...entry,
      backend_names: entry.backend_ids.map((backendId) => getBackendName(backendId)).join(', '),
    }))
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
      setNotice({ tone: 'danger', message: 'Source and target model are required.' });
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
      setNotice({ tone: 'danger', message: error instanceof Error ? error.message : 'Model rule save failed.' });
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
      setNotice({ tone: 'success', message: `${current.source_model} removed.` });
      setConfirmOpen(false);
      setPendingDeleteRule(null);
      await Promise.all([refetchRules(), refetchOverview()]);
    } catch (error) {
      setNotice({ tone: 'danger', message: error instanceof Error ? error.message : 'Model rule deletion failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div class="ui-app-page">
        <PageHeader
          title="Models"
          description="Inspect cached backend model catalogs and manage chained global model rewrite rules."
          actions={<Button onClick={() => void Promise.all([refetchOverview(), refetchRules()])}>Refresh</Button>}
        />

        <SummaryStrip
          items={[
            { label: 'Catalog Models', value: currentOverview()?.models.length ?? 0, hint: 'Unique models across active backends' },
            { label: 'Tracked Backends', value: currentOverview()?.backends.length ?? 0, hint: 'Memory cache status by backend' },
            { label: 'Rewrite Rules', value: currentRules()?.length ?? 0, hint: 'Global source -> target mappings' },
          ]}
        />

        <Show when={notice()}>
          {(currentNotice) => <Alert tone={currentNotice().tone}>{currentNotice().message}</Alert>}
        </Show>

        <div class="ui-section-grid">
          <Panel title="Backend Cache Status" description="Memory-backed backend cache state used by request routing and `/v1/models`.">
            <Show
              when={(currentOverview()?.backends.length ?? 0) > 0 || overview.loading}
              fallback={<EmptyState title="No backend cache yet" description="Backend model states appear here after the server has seen active backends." />}
            >
              <DataGrid
                rows={currentOverview()?.backends ?? []}
                columns={[
                  {
                    id: 'backend_id',
                    header: 'Backend',
                    class: 'models__catalog-column',
                    cell: (item) => <span title={getBackendName(item.backend_id)}>{getBackendName(item.backend_id)}</span>,
                  },
                  { id: 'state', header: 'State', cell: (item) => <StatusBadge tone={item.state === 'ready' ? 'success' : item.state === 'error' ? 'danger' : item.state === 'inactive' ? 'neutral' : 'warning'}>{item.state}</StatusBadge> },
                  { id: 'model_count', header: 'Models', cell: (item) => <span>{item.model_count}</span> },
                  { id: 'last_synced_at', header: 'Last Sync', cell: (item) => <span>{item.last_synced_at ? new Date(item.last_synced_at).toLocaleString() : '-'}</span> },
                  { id: 'last_error', header: 'Last Error', cell: (item) => <span title={item.last_error ?? '-'}>{item.last_error ?? '-'}</span> },
                ]}
                getRowKey={(item) => item.backend_id}
                loading={overview.loading && (currentOverview()?.backends.length ?? 0) === 0}
              />
            </Show>
          </Panel>

          <Panel title="Model Catalog" description="Unique models and the backend names currently advertising each one.">
            <Show
              when={modelCatalogRows().length > 0 || overview.loading}
              fallback={<EmptyState title="No cached models yet" description="Model catalog entries appear here after backend model snapshots are available." />}
            >
              <DataGrid
                rows={modelCatalogRows()}
                columns={[
                  {
                    id: 'model_id',
                    header: 'Model',
                    class: 'models__catalog-column',
                    cell: (item) => <span title={item.model_id}>{item.model_id}</span>,
                  },
                  {
                    id: 'backend_names',
                    header: 'Backends',
                    class: 'models__catalog-column',
                    cell: (item) => <span title={item.backend_names}>{item.backend_names}</span>,
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
                loading={overview.loading && modelCatalogRows().length === 0}
              />
            </Show>
          </Panel>
        </div>

        <Panel
          title="Model Rewrite Rules"
          description="Force rules always rewrite and continue through the chain. Fallback rules continue only when the current model has no usable backend."
          actions={<IconButton variant="primary" icon={<Plus />} label="Add Rule" onClick={openCreateDialog} />}
        >
          <div class="ui-stack ui-stack--tight">
            <Show
              when={(currentRules()?.length ?? 0) > 0 || rules.loading}
              fallback={<EmptyState title="No rewrite rules" description="Requests currently route using the original model name." />}
            >
              <DataGrid
                rows={currentRules() ?? []}
                columns={[
                  { id: 'source_model', header: 'Source', cell: (rule) => <span>{rule.source_model}</span> },
                  { id: 'target_model', header: 'Target', cell: (rule) => <span>{rule.target_model}</span> },
                  { id: 'mode', header: 'Mode', cell: (rule) => <StatusBadge tone={rule.force ? 'warning' : 'neutral'}>{rule.force ? 'Force' : 'Fallback'}</StatusBadge> },
                  { id: 'is_active', header: 'Status', cell: (rule) => <StatusBadge tone={rule.is_active ? 'success' : 'warning'}>{rule.is_active ? 'Active' : 'Inactive'}</StatusBadge> },
                  { id: 'note', header: 'Note', cell: (rule) => <span title={rule.note ?? '-'}>{rule.note ?? '-'}</span> },
                ]}
                getRowKey={(rule) => rule.id}
                loading={rules.loading && (currentRules()?.length ?? 0) === 0}
                rowActions={(rule) => (
                  <div class="ui-row-actions">
                    <IconButton icon={<Pencil />} label="Edit" onClick={() => openEditDialog(rule)} />
                    <IconButton
                      variant="danger"
                      icon={<Trash2 />}
                      label="Delete"
                      onClick={() => {
                        setPendingDeleteRule(rule);
                        setConfirmOpen(true);
                      }}
                    />
                  </div>
                )}
              />
            </Show>
          </div>
        </Panel>

        <FormDialog
          open={dialogOpen()}
          onOpenChange={setDialogOpen}
          title={editingRule() ? 'Edit Model Rule' : 'Add Model Rule'}
          description="Choose whether the target model should always replace the source, or only continue the chain when the current model is unavailable."
          footer={
            <>
              <Button onClick={() => setDialogOpen(false)} disabled={submitting()}>Cancel</Button>
              <Button type="submit" form="model-rule-form" variant="primary" disabled={submitting()}>
                {editingRule() ? 'Save Changes' : 'Create Rule'}
              </Button>
            </>
          }
        >
          <form id="model-rule-form" class="ui-form" onSubmit={(event) => void saveRule(event)}>
            <TextField label="Source Model" value={form().source_model} onInput={(event) => setForm((current) => ({ ...current, source_model: event.currentTarget.value }))} />
            <TextField label="Target Model" value={form().target_model} onInput={(event) => setForm((current) => ({ ...current, target_model: event.currentTarget.value }))} />
            <TextField label="Note" value={form().note} onInput={(event) => setForm((current) => ({ ...current, note: event.currentTarget.value }))} />
            <Checkbox
              label="Always force rewrite"
              description="When enabled, requests always continue to the target model. When disabled, the target is used only if the current model has no backend."
              checked={form().force}
              onChange={(checked) => setForm((current) => ({ ...current, force: checked }))}
            />
            <Checkbox
              label="Rule is active"
              description="Inactive rules stay stored but do not affect request routing."
              checked={form().is_active}
              onChange={(checked) => setForm((current) => ({ ...current, is_active: checked }))}
            />
          </form>
        </FormDialog>

        <ConfirmDialog
          open={confirmOpen()}
          onOpenChange={setConfirmOpen}
          title="Delete rewrite rule"
          description="Removing the rule stops rewriting requests that target this source model."
          confirmLabel="Delete Rule"
          tone="danger"
          busy={submitting()}
          onConfirm={() => void deleteRule()}
        />
      </div>
    </Layout>
  );
};

import { createResource, createSignal, For, Show, type Component } from 'solid-js';
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
  const [rules, { refetch: refetchRules }] = createResource(() => api.modelRewrites.getAll());
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [confirmOpen, setConfirmOpen] = createSignal(false);
  const [editingRule, setEditingRule] = createSignal<ModelRewriteRule | null>(null);
  const [pendingDeleteRule, setPendingDeleteRule] = createSignal<ModelRewriteRule | null>(null);
  const [form, setForm] = createSignal<RewriteFormState>(emptyForm());
  const [submitting, setSubmitting] = createSignal(false);
  const [notice, setNotice] = createSignal<{ tone: 'success' | 'danger'; message: string } | null>(null);

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
          description="Inspect cached backend model catalogs and manage global model rewrite rules."
          actions={<Button onClick={() => void Promise.all([refetchOverview(), refetchRules()])}>Refresh</Button>}
        />

        <SummaryStrip
          items={[
            { label: 'Catalog Models', value: overview()?.models.length ?? 0, hint: 'Unique models across active backends' },
            { label: 'Tracked Backends', value: overview()?.backends.length ?? 0, hint: 'Memory cache status by backend' },
            { label: 'Rewrite Rules', value: rules()?.length ?? 0, hint: 'Global source -> target mappings' },
          ]}
        />

        <Show when={notice()}>
          {(currentNotice) => <Alert tone={currentNotice().tone}>{currentNotice().message}</Alert>}
        </Show>

        <Panel title="Model Cache Overview" description="Memory-backed catalog state used by request routing and `/v1/models`.">
          <Show
            when={(overview()?.backends.length ?? 0) > 0}
            fallback={<EmptyState title="No backend cache yet" description="Backend model states appear here after the server has seen active backends." />}
          >
            <DataGrid
              rows={overview()?.backends ?? []}
              columns={[
                { id: 'backend_id', header: 'Backend', mono: true, cell: (item) => <span>{item.backend_id}</span> },
                { id: 'state', header: 'State', cell: (item) => <StatusBadge tone={item.state === 'ready' ? 'success' : item.state === 'error' ? 'danger' : item.state === 'inactive' ? 'neutral' : 'warning'}>{item.state}</StatusBadge> },
                { id: 'model_count', header: 'Models', cell: (item) => <span>{item.model_count}</span> },
                { id: 'last_synced_at', header: 'Last Sync', cell: (item) => <span>{item.last_synced_at ? new Date(item.last_synced_at).toLocaleString() : '-'}</span> },
                { id: 'last_error', header: 'Last Error', cell: (item) => <span title={item.last_error ?? '-'}>{item.last_error ?? '-'}</span> },
              ]}
              getRowKey={(item) => item.backend_id}
              loading={overview.loading}
            />
            <Show when={(overview()?.models.length ?? 0) > 0}>
              <div class="ui-chip-row">
                <For each={overview()?.models ?? []}>
                  {(entry) => <StatusBadge tone="neutral">{`${entry.model_id} (${entry.backend_ids.length})`}</StatusBadge>}
                </For>
              </div>
            </Show>
          </Show>
        </Panel>

        <Panel
          title="Model Rewrite Rules"
          description="Force rules always rewrite. Fallback rules rewrite only when the original model has no usable backend."
        >
          <div class="ui-stack ui-stack--tight">
            <div class="ui-row-actions">
              <IconButton variant="primary" icon={<Plus />} label="Add Rule" onClick={openCreateDialog} />
            </div>
            <Show
              when={(rules()?.length ?? 0) > 0}
              fallback={<EmptyState title="No rewrite rules" description="Requests currently route using the original model name." />}
            >
              <DataGrid
                rows={rules() ?? []}
                columns={[
                  { id: 'source_model', header: 'Source', cell: (rule) => <span>{rule.source_model}</span> },
                  { id: 'target_model', header: 'Target', cell: (rule) => <span>{rule.target_model}</span> },
                  { id: 'mode', header: 'Mode', cell: (rule) => <StatusBadge tone={rule.force ? 'warning' : 'neutral'}>{rule.force ? 'Force' : 'Fallback'}</StatusBadge> },
                  { id: 'is_active', header: 'Status', cell: (rule) => <StatusBadge tone={rule.is_active ? 'success' : 'warning'}>{rule.is_active ? 'Active' : 'Inactive'}</StatusBadge> },
                  { id: 'note', header: 'Note', cell: (rule) => <span title={rule.note ?? '-'}>{rule.note ?? '-'}</span> },
                ]}
                getRowKey={(rule) => rule.id}
                loading={rules.loading}
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
          description="Choose whether the target model should always replace the source, or only act as a fallback when the source is unavailable."
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
              description="When enabled, requests always route to the target model. When disabled, the target model is only used as a fallback."
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

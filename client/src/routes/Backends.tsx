import { createResource, createSignal, Show, type Component } from 'solid-js';
import { api } from '../api/client';
import { Layout } from '../components/Layout';
import type { Backend } from '../types';
import {
  Alert,
  Button,
  Checkbox,
  ConfirmDialog,
  DataGrid,
  EmptyState,
  FormDialog,
  PageHeader,
  Panel,
  StatusBadge,
  TextField,
} from '../ui';

interface BackendFormState {
  name: string;
  base_url: string;
  api_key: string;
  is_active: boolean;
}

const emptyForm = (): BackendFormState => ({
  name: '',
  base_url: '',
  api_key: '',
  is_active: true,
});

export const Backends: Component = () => {
  const [backends, { refetch }] = createResource(() => api.backends.getAll());
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [confirmOpen, setConfirmOpen] = createSignal(false);
  const [editingBackend, setEditingBackend] = createSignal<Backend | null>(null);
  const [pendingDeleteBackend, setPendingDeleteBackend] = createSignal<Backend | null>(null);
  const [form, setForm] = createSignal<BackendFormState>(emptyForm());
  const [submitting, setSubmitting] = createSignal(false);
  const [notice, setNotice] = createSignal<{ tone: 'success' | 'danger'; message: string } | null>(null);

  const openCreateDialog = () => {
    setEditingBackend(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEditDialog = (backend: Backend) => {
    setEditingBackend(backend);
    setForm({
      name: backend.name,
      base_url: backend.base_url,
      api_key: backend.api_key ?? '',
      is_active: backend.is_active,
    });
    setDialogOpen(true);
  };

  const saveBackend = async (event: Event) => {
    event.preventDefault();
    const current = form();

    if (!current.name.trim() || !current.base_url.trim()) {
      setNotice({ tone: 'danger', message: 'Name and base URL are required.' });
      return;
    }

    setSubmitting(true);
    try {
      if (editingBackend()) {
        await api.backends.update(editingBackend()!.id, {
          name: current.name.trim(),
          base_url: current.base_url.trim(),
          api_key: current.api_key.trim() || undefined,
          is_active: current.is_active,
        });
        setNotice({ tone: 'success', message: 'Backend updated.' });
      } else {
        await api.backends.create({
          name: current.name.trim(),
          base_url: current.base_url.trim(),
          api_key: current.api_key.trim() || undefined,
        });
        setNotice({ tone: 'success', message: 'Backend created.' });
      }
      setDialogOpen(false);
      setEditingBackend(null);
      setForm(emptyForm());
      await refetch();
    } catch (error) {
      setNotice({ tone: 'danger', message: error instanceof Error ? error.message : 'Backend save failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  const requestDelete = (backend: Backend) => {
    setPendingDeleteBackend(backend);
    setConfirmOpen(true);
  };

  const deleteBackend = async () => {
    const backend = pendingDeleteBackend();
    if (!backend) return;

    setSubmitting(true);
    try {
      await api.backends.delete(backend.id);
      setNotice({ tone: 'success', message: `${backend.name} deleted.` });
      setConfirmOpen(false);
      setPendingDeleteBackend(null);
      await refetch();
    } catch (error) {
      setNotice({ tone: 'danger', message: error instanceof Error ? error.message : 'Backend deletion failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div class="ui-app-page">
        <PageHeader
          title="Backends"
          description="Register upstream LLM targets, connection URLs, and activation state for routing."
          actions={<Button variant="primary" onClick={openCreateDialog}>Add Backend</Button>}
        />

        <Show when={notice()}>
          {(currentNotice) => <Alert tone={currentNotice().tone}>{currentNotice().message}</Alert>}
        </Show>

        <Panel title="Backend catalog" description="Operational list with overflow-safe URL presentation and compact actions.">
          <Show
            when={!backends.loading || (backends()?.length ?? 0) > 0}
            fallback={<EmptyState title="Loading backends" description="Reading upstream routing targets from the admin API." />}
          >
            <Show
              when={(backends()?.length ?? 0) > 0}
              fallback={<EmptyState title="No backends yet" description="Add a backend before granting permissions or routing requests." action={<Button variant="primary" onClick={openCreateDialog}>Add Backend</Button>} />}
            >
              <DataGrid
                rows={backends() ?? []}
                columns={[
                  { id: 'id', header: 'ID', mono: true, cell: (backend) => <span>{backend.id}</span> },
                  { id: 'name', header: 'Name', cell: (backend) => <span>{backend.name}</span> },
                  {
                    id: 'base_url',
                    header: 'Base URL',
                    class: 'ui-text-mono',
                    cell: (backend) => <span title={backend.base_url}>{backend.base_url}</span>,
                  },
                  {
                    id: 'status',
                    header: 'Status',
                    cell: (backend) => <StatusBadge tone={backend.is_active ? 'success' : 'warning'}>{backend.is_active ? 'Active' : 'Inactive'}</StatusBadge>,
                  },
                ]}
                getRowKey={(backend) => backend.id}
                loading={backends.loading}
                rowActions={(backend) => (
                  <div class="ui-row-actions">
                    <Button onClick={() => openEditDialog(backend)}>Edit</Button>
                    <Button variant="danger" onClick={() => requestDelete(backend)}>Delete</Button>
                  </div>
                )}
              />
            </Show>
          </Show>
        </Panel>

        <FormDialog
          open={dialogOpen()}
          onOpenChange={setDialogOpen}
          title={editingBackend() ? 'Edit Backend' : 'Add Backend'}
          description="Compact backend form with URL and optional credential fields."
          footer={
            <>
              <Button onClick={() => setDialogOpen(false)} disabled={submitting()}>Cancel</Button>
              <Button type="submit" form="backend-form" variant="primary" disabled={submitting()}>
                {editingBackend() ? 'Save Changes' : 'Create Backend'}
              </Button>
            </>
          }
        >
          <form id="backend-form" class="ui-form" onSubmit={(event) => void saveBackend(event)}>
            <TextField label="Name" value={form().name} onInput={(event) => setForm((current) => ({ ...current, name: event.currentTarget.value }))} />
            <TextField
              label="Base URL"
              value={form().base_url}
              placeholder="https://api.openai.com/v1"
              onInput={(event) => setForm((current) => ({ ...current, base_url: event.currentTarget.value }))}
            />
            <TextField
              label="API Key"
              value={form().api_key}
              placeholder="Optional upstream API key"
              onInput={(event) => setForm((current) => ({ ...current, api_key: event.currentTarget.value }))}
            />
            <Show when={editingBackend()}>
              <Checkbox
                label="Backend is active"
                description="Inactive backends stay configured but are not selected for routing."
                checked={form().is_active}
                onChange={(checked) => setForm((current) => ({ ...current, is_active: checked }))}
              />
            </Show>
          </form>
        </FormDialog>

        <ConfirmDialog
          open={confirmOpen()}
          onOpenChange={setConfirmOpen}
          title="Delete backend"
          description="Deleting a backend removes it from routing and any dependent permission mapping."
          confirmLabel="Delete Backend"
          tone="danger"
          busy={submitting()}
          onConfirm={() => void deleteBackend()}
        />
      </div>
    </Layout>
  );
};

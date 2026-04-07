import {
  For,
  createResource,
  createSignal,
  Show,
  type Component,
} from 'solid-js';
import Pencil from 'lucide-solid/icons/pencil';
import Plus from 'lucide-solid/icons/plus';
import RefreshCw from 'lucide-solid/icons/refresh-cw';
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
  TextField,
} from '../ui';

import type { Backend, BackendModelsResponse } from '../types';

interface BackendFormState {
  name: string;
  base_url: string;
  api_key: string;
  is_active: boolean;
  detail_logging: boolean;
}

const emptyForm = (): BackendFormState => ({
  name: '',
  base_url: '',
  api_key: '',
  is_active: true,
  detail_logging: false,
});

export const Backends: Component = () => {
  const [backends, { refetch }] = createResource(() => api.backends.getAll());
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [confirmOpen, setConfirmOpen] = createSignal(false);
  const [editingBackend, setEditingBackend] = createSignal<Backend | null>(
    null,
  );
  const [pendingDeleteBackend, setPendingDeleteBackend] =
    createSignal<Backend | null>(null);
  const [form, setForm] = createSignal<BackendFormState>(emptyForm());
  const [submitting, setSubmitting] = createSignal(false);
  const [notice, setNotice] = createSignal<{
    tone: 'success' | 'danger';
    message: string;
  } | null>(null);
  const [expandedBackendId, setExpandedBackendId] = createSignal<number | null>(
    null,
  );
  const [backendModels, setBackendModels] = createSignal<
    Record<number, BackendModelsResponse>
  >({});

  const modelStateTone = (
    backend: Backend,
  ): 'success' | 'warning' | 'danger' | 'neutral' => {
    switch (backend.model_cache_state) {
      case 'ready':
        return 'success';
      case 'error':
        return 'danger';
      case 'inactive':
        return 'neutral';
      default:
        return 'warning';
    }
  };

  const modelStateLabel = (backend: Backend): string => {
    switch (backend.model_cache_state) {
      case 'ready':
        return 'Cached';
      case 'error':
        return 'Error';
      case 'inactive':
        return 'Skipped';
      default:
        return 'Pending';
    }
  };

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
      detail_logging: backend.detail_logging,
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
          detail_logging: current.detail_logging,
        });
        setNotice({ tone: 'success', message: 'Backend updated.' });
      } else {
        await api.backends.create({
          name: current.name.trim(),
          base_url: current.base_url.trim(),
          api_key: current.api_key.trim() || undefined,
          detail_logging: current.detail_logging,
        });
        setNotice({ tone: 'success', message: 'Backend created.' });
      }
      setDialogOpen(false);
      setEditingBackend(null);
      setForm(emptyForm());
      await refetch();
    } catch (error) {
      setNotice({
        tone: 'danger',
        message:
          error instanceof Error ? error.message : 'Backend save failed.',
      });
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
      setNotice({
        tone: 'danger',
        message:
          error instanceof Error ? error.message : 'Backend deletion failed.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDetails = async (backend: Backend) => {
    const isClosing = expandedBackendId() === backend.id;
    setExpandedBackendId(isClosing ? null : backend.id);
    if (isClosing || backendModels()[backend.id]) {
      return;
    }

    try {
      const detail = await api.backends.getModels(backend.id);
      setBackendModels((current) => ({ ...current, [backend.id]: detail }));
    } catch (error) {
      setNotice({
        tone: 'danger',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to load backend models.',
      });
    }
  };

  const refreshModels = async (backend: Backend) => {
    if (!backend.is_active) return;

    setSubmitting(true);
    try {
      const detail = await api.backends.refreshModels(backend.id);
      setBackendModels((current) => ({ ...current, [backend.id]: detail }));
      setNotice({
        tone: 'success',
        message: `${backend.name} model cache refreshed.`,
      });
      await refetch();
    } catch (error) {
      setNotice({
        tone: 'danger',
        message:
          error instanceof Error ? error.message : 'Model refresh failed.',
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
            <IconButton
              icon={<Plus />}
              label="Add Backend"
              onClick={openCreateDialog}
              variant="primary"
            />
          }
          description="Register upstream LLM targets, connection URLs, and activation state for routing."
          title="Backends"
        />

        <Show when={notice()}>
          {(currentNotice) => (
            <Alert tone={currentNotice().tone}>{currentNotice().message}</Alert>
          )}
        </Show>

        <Panel
          description="Operational list with overflow-safe URL presentation and compact actions."
          title="Backend catalog"
        >
          <Show
            fallback={
              <EmptyState
                description="Reading upstream routing targets from the admin API."
                title="Loading backends"
              />
            }
            when={!backends.loading || (backends()?.length ?? 0) > 0}
          >
            <Show
              fallback={
                <EmptyState
                  action={
                    <IconButton
                      icon={<Plus />}
                      label="Add Backend"
                      onClick={openCreateDialog}
                      variant="primary"
                    />
                  }
                  description="Add a backend before granting permissions or routing requests."
                  title="No backends yet"
                />
              }
              when={(backends()?.length ?? 0) > 0}
            >
              <DataGrid
                columns={[
                  {
                    id: 'id',
                    header: 'ID',
                    mono: true,
                    cell: (backend) => <span>{backend.id}</span>,
                  },
                  {
                    id: 'name',
                    header: 'Name',
                    cell: (backend) => <span>{backend.name}</span>,
                  },
                  {
                    id: 'base_url',
                    header: 'Base URL',
                    class: 'ui-text-mono',
                    cell: (backend) => (
                      <span title={backend.base_url}>{backend.base_url}</span>
                    ),
                  },
                  {
                    id: 'detail_logging',
                    header: 'Detail Log',
                    cell: (backend) => (
                      <StatusBadge
                        tone={backend.detail_logging ? 'warning' : 'neutral'}
                      >
                        {backend.detail_logging ? 'On' : 'Off'}
                      </StatusBadge>
                    ),
                  },
                  {
                    id: 'model_cache',
                    header: 'Model Cache',
                    cell: (backend) => (
                      <StatusBadge tone={modelStateTone(backend)}>
                        {modelStateLabel(backend)}
                      </StatusBadge>
                    ),
                  },
                  {
                    id: 'model_count',
                    header: 'Models',
                    cell: (backend) => (
                      <span>{backend.cached_model_count ?? 0}</span>
                    ),
                  },
                  {
                    id: 'status',
                    header: 'Status',
                    cell: (backend) => (
                      <StatusBadge
                        tone={backend.is_active ? 'success' : 'warning'}
                      >
                        {backend.is_active ? 'Active' : 'Inactive'}
                      </StatusBadge>
                    ),
                  },
                ]}
                getRowKey={(backend) => backend.id}
                loading={backends.loading}
                rowActions={(backend) => (
                  <div class="ui-row-actions">
                    <IconButton
                      disabled={!backend.is_active || submitting()}
                      icon={<RefreshCw />}
                      label="Refresh Models"
                      onClick={() => void refreshModels(backend)}
                    />
                    <IconButton
                      icon={<Pencil />}
                      label="Edit"
                      onClick={() => openEditDialog(backend)}
                    />
                    <Button onClick={() => void toggleDetails(backend)}>
                      {expandedBackendId() === backend.id
                        ? 'Hide Models'
                        : 'View Models'}
                    </Button>
                    <IconButton
                      icon={<Trash2 />}
                      label="Delete"
                      onClick={() => requestDelete(backend)}
                      variant="danger"
                    />
                  </div>
                )}
                rows={backends() ?? []}
              />
              <Show when={expandedBackendId()}>
                {(backendId) => {
                  const detail = () => backendModels()[backendId()];
                  return (
                    <Panel
                      description={
                        detail()?.cache.state === 'inactive'
                          ? 'Inactive backends skip model fetches and only keep the last DB snapshot.'
                          : 'Live cache state and last persisted model snapshot.'
                      }
                      title={`Backend ${backendId()} Models`}
                    >
                      <div class="ui-stack ui-stack--tight">
                        <Show
                          fallback={
                            <EmptyState
                              description="Reading cached model information for this backend."
                              title="Loading models"
                            />
                          }
                          when={detail()}
                        >
                          <Alert
                            tone={
                              detail().cache.last_error ? 'danger' : 'success'
                            }
                          >
                            {detail().cache.last_error
                              ? `Last error: ${detail().cache.last_error}`
                              : `State: ${detail().cache.state}, models: ${detail().cache.model_count}, last sync: ${detail().cache.last_synced_at ?? 'never'}`}
                          </Alert>
                          <Show
                            fallback={
                              <EmptyState
                                description="This backend has not published any models yet or the last refresh failed."
                                title="No cached models"
                              />
                            }
                            when={detail().models.length > 0}
                          >
                            <div class="ui-chip-row">
                              <For each={detail().models}>
                                {(modelId) => (
                                  <StatusBadge tone="neutral">
                                    {modelId}
                                  </StatusBadge>
                                )}
                              </For>
                            </div>
                          </Show>
                        </Show>
                      </div>
                    </Panel>
                  );
                }}
              </Show>
            </Show>
          </Show>
        </Panel>

        <FormDialog
          description="Compact backend form with URL and optional credential fields."
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
                form="backend-form"
                type="submit"
                variant="primary"
              >
                {editingBackend() ? 'Save Changes' : 'Create Backend'}
              </Button>
            </>
          }
          onOpenChange={setDialogOpen}
          open={dialogOpen()}
          title={editingBackend() ? 'Edit Backend' : 'Add Backend'}
        >
          <form
            class="ui-form"
            id="backend-form"
            onSubmit={(event) => void saveBackend(event)}
          >
            <TextField
              label="Name"
              onInput={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.currentTarget.value,
                }))
              }
              value={form().name}
            />
            <TextField
              label="Base URL"
              onInput={(event) =>
                setForm((current) => ({
                  ...current,
                  base_url: event.currentTarget.value,
                }))
              }
              placeholder="https://api.openai.com/v1"
              value={form().base_url}
            />
            <TextField
              label="API Key"
              onInput={(event) =>
                setForm((current) => ({
                  ...current,
                  api_key: event.currentTarget.value,
                }))
              }
              placeholder="Optional upstream API key"
              value={form().api_key}
            />
            <Show when={editingBackend()}>
              <Checkbox
                checked={form().is_active}
                description="Inactive backends stay configured but are not selected for routing."
                label="Backend is active"
                onChange={(checked) =>
                  setForm((current) => ({ ...current, is_active: checked }))
                }
              />
            </Show>
            <Checkbox
              checked={form().detail_logging}
              description="When enabled, proxied request and response headers/bodies are stored for this backend."
              label="Enable detailed logging"
              onChange={(checked) =>
                setForm((current) => ({ ...current, detail_logging: checked }))
              }
            />
          </form>
        </FormDialog>

        <ConfirmDialog
          busy={submitting()}
          confirmLabel="Delete Backend"
          description="Deleting a backend removes it from routing and any dependent permission mapping."
          onConfirm={() => void deleteBackend()}
          onOpenChange={setConfirmOpen}
          open={confirmOpen()}
          title="Delete backend"
          tone="danger"
        />
      </div>
    </Layout>
  );
};

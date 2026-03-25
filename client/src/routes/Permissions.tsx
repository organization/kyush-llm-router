import { createMemo, createResource, createSignal, Show, type Component } from 'solid-js';
import { Plus, ShieldMinus } from 'lucide-solid';
import { api } from '../api/client';
import { Layout } from '../components/Layout';
import {
  Alert,
  Button,
  ConfirmDialog,
  DataGrid,
  EmptyState,
  FormDialog,
  IconButton,
  MetaCluster,
  PageHeader,
  Panel,
  Select,
  StatusBadge,
} from '../ui';

export const Permissions: Component = () => {
  const [users] = createResource(() => api.users.getAll());
  const [backends] = createResource(() => api.backends.getAll());
  const [permissions, { refetch }] = createResource(() => api.permissions.getAll());
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [confirmOpen, setConfirmOpen] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [form, setForm] = createSignal({ user_id: '', backend_id: '' });
  const [notice, setNotice] = createSignal<{ tone: 'success' | 'danger'; message: string } | null>(null);
  const [pendingDelete, setPendingDelete] = createSignal<{ user_id: number; backend_id: number } | null>(null);

  const userOptions = createMemo(() => (users() ?? []).map((user) => ({ value: String(user.id), label: user.name })));
  const backendOptions = createMemo(() => (backends() ?? []).map((backend) => ({ value: String(backend.id), label: backend.name })));

  const createPermission = async (event: Event) => {
    event.preventDefault();
    if (!form().user_id || !form().backend_id) {
      setNotice({ tone: 'danger', message: 'Select both a user and a backend.' });
      return;
    }

    setSubmitting(true);
    try {
      await api.permissions.create({ user_id: Number(form().user_id), backend_id: Number(form().backend_id) });
      setNotice({ tone: 'success', message: 'Permission granted.' });
      setForm({ user_id: '', backend_id: '' });
      setDialogOpen(false);
      await refetch();
    } catch (error) {
      setNotice({ tone: 'danger', message: error instanceof Error ? error.message : 'Permission grant failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  const revokePermission = async () => {
    const current = pendingDelete();
    if (!current) return;

    setSubmitting(true);
    try {
      await api.permissions.delete(current.user_id, current.backend_id);
      setNotice({ tone: 'success', message: 'Permission revoked.' });
      setConfirmOpen(false);
      setPendingDelete(null);
      await refetch();
    } catch (error) {
      setNotice({ tone: 'danger', message: error instanceof Error ? error.message : 'Permission revoke failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div class="ui-app-page">
        <PageHeader
          title="Permissions"
          description="Control which users may route requests to which backends."
          actions={<IconButton variant="primary" icon={<Plus />} label="Grant Permission" onClick={() => setDialogOpen(true)} />}
        />

        <Show when={notice()}>
          {(currentNotice) => <Alert tone={currentNotice().tone}>{currentNotice().message}</Alert>}
        </Show>

        <Panel title="Permission matrix" description="User-to-backend assignments used by the router authorization layer.">
          <Show
            when={!(permissions.loading || users.loading || backends.loading) || (permissions()?.length ?? 0) > 0}
            fallback={<EmptyState title="Loading permissions" description="Reading users, backends, and assignment records." />}
          >
            <Show
              when={(permissions()?.length ?? 0) > 0}
              fallback={
                <EmptyState
                  title="No permissions yet"
                  description="Grant a user access to a backend to allow routing."
                  action={<IconButton variant="primary" icon={<Plus />} label="Grant Permission" onClick={() => setDialogOpen(true)} />}
                />
              }
            >
              <DataGrid
                rows={permissions() ?? []}
                columns={[
                  {
                    id: 'user',
                    header: 'User',
                    cell: (permission) => <span>{users()?.find((user) => user.id === permission.user_id)?.name ?? `User #${permission.user_id}`}</span>,
                  },
                  {
                    id: 'backend',
                    header: 'Backend',
                    cell: (permission) => <span>{backends()?.find((backend) => backend.id === permission.backend_id)?.name ?? `Backend #${permission.backend_id}`}</span>,
                  },
                  {
                    id: 'created_at',
                    header: 'Created',
                    cell: (permission) => <span>{new Date(permission.created_at).toLocaleString()}</span>,
                  },
                  {
                    id: 'status',
                    header: 'Status',
                    cell: () => <StatusBadge tone="success">Assigned</StatusBadge>,
                  },
                ]}
                getRowKey={(permission) => `${permission.user_id}-${permission.backend_id}`}
                loading={permissions.loading || users.loading || backends.loading}
                rowActions={(permission) => (
                  <IconButton
                    variant="danger"
                    icon={<ShieldMinus />}
                    label="Revoke"
                    onClick={() => {
                      setPendingDelete({ user_id: permission.user_id, backend_id: permission.backend_id });
                      setConfirmOpen(true);
                    }}
                  />
                )}
              />
            </Show>
          </Show>
        </Panel>

        <FormDialog
          open={dialogOpen()}
          onOpenChange={setDialogOpen}
          title="Grant Permission"
          description="Bind one user to one backend using the compact assignment dialog."
          footer={
            <>
              <Button onClick={() => setDialogOpen(false)} disabled={submitting()}>Cancel</Button>
              <Button type="submit" form="permission-form" variant="primary" disabled={submitting()}>Grant</Button>
            </>
          }
          class="ui-dialog__content--compact"
        >
          <form id="permission-form" class="ui-form" onSubmit={(event) => void createPermission(event)}>
            <Select label="User" value={form().user_id} onChange={(value) => setForm((current) => ({ ...current, user_id: value }))} options={userOptions()} placeholder="Select user" />
            <Select
              label="Backend"
              value={form().backend_id}
              onChange={(value) => setForm((current) => ({ ...current, backend_id: value }))}
              options={backendOptions()}
              placeholder="Select backend"
            />
          </form>
        </FormDialog>

        <ConfirmDialog
          open={confirmOpen()}
          onOpenChange={setConfirmOpen}
          title="Revoke permission"
          description="This removes the routing relationship between the selected user and backend."
          confirmLabel="Revoke"
          tone="danger"
          busy={submitting()}
          details={
            <Show when={pendingDelete()}>
              {(current) => (
                <MetaCluster
                  items={[
                    { key: 'User', value: users()?.find((user) => user.id === current().user_id)?.name ?? String(current().user_id) },
                    { key: 'Backend', value: backends()?.find((backend) => backend.id === current().backend_id)?.name ?? String(current().backend_id) },
                  ]}
                />
              )}
            </Show>
          }
          onConfirm={() => void revokePermission()}
        />
      </div>
    </Layout>
  );
};

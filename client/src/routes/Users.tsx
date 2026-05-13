import { createEffect, createMemo, createResource, createSignal, Show, type Component } from 'solid-js';
import Copy from 'lucide-solid/icons/copy';
import Ellipsis from 'lucide-solid/icons/ellipsis';
import KeyRound from 'lucide-solid/icons/key-round';
import Pencil from 'lucide-solid/icons/pencil';
import Plus from 'lucide-solid/icons/plus';
import ShieldMinus from 'lucide-solid/icons/shield-minus';
import Trash2 from 'lucide-solid/icons/trash-2';
import { api } from '../api/client';
import { Layout } from '../components/Layout';
import type { User } from '../types';
import {
  Alert,
  Button,
  Checkbox,
  CommandBar,
  CommandBarGroup,
  CommandBarHint,
  ConfirmDialog,
  DataGrid,
  DropdownMenu,
  EmptyState,
  FormDialog,
  IconButton,
  MetaCluster,
  PageHeader,
  Panel,
  Select,
  StatusBadge,
  TextField,
} from '../ui';

type NoticeTone = 'success' | 'warning' | 'danger' | 'info';

interface UserFormState {
  name: string;
  email: string;
  api_key: string;
  is_active: boolean;
  detail_logging: boolean;
  copy_reasoning_to_reasoning_content: boolean;
}

const emptyForm = (): UserFormState => ({
  name: '',
  email: '',
  api_key: '',
  is_active: true,
  detail_logging: false,
  copy_reasoning_to_reasoning_content: false,
});

const maskApiKey = (apiKey: string) => `${apiKey.slice(0, 5)}...`;

export const Users: Component = () => {
  const [users, { refetch: refetchUsers }] = createResource(() => api.users.getAll());
  const [backends] = createResource(() => api.backends.getAll());
  const [permissions, { refetch: refetchPermissions }] = createResource(() => api.permissions.getAll());
  const currentUsers = createMemo(() => users.state === 'ready' || users.state === 'refreshing' ? users.latest : undefined);
  const currentBackends = createMemo(() => backends.state === 'ready' || backends.state === 'refreshing' ? backends.latest : undefined);
  const currentPermissions = createMemo(() => permissions.state === 'ready' || permissions.state === 'refreshing' ? permissions.latest : undefined);
  const [query, setQuery] = createSignal('');
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [userDeleteConfirmOpen, setUserDeleteConfirmOpen] = createSignal(false);
  const [permissionDialogOpen, setPermissionDialogOpen] = createSignal(false);
  const [permissionConfirmOpen, setPermissionConfirmOpen] = createSignal(false);
  const [editingUser, setEditingUser] = createSignal<User | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = createSignal<User | null>(null);
  const [selectedUserId, setSelectedUserId] = createSignal<number | null>(null);
  const [pendingDeletePermission, setPendingDeletePermission] = createSignal<{ user_id: number; backend_id: number } | null>(null);
  const [permissionBackendId, setPermissionBackendId] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const [notice, setNotice] = createSignal<{ tone: NoticeTone; message: string } | null>(null);
  const [form, setForm] = createSignal<UserFormState>(emptyForm());

  const filteredUsers = createMemo(() => {
    const value = query().trim().toLowerCase();
    const list = currentUsers() ?? [];
    if (!value) return list;
    return list.filter((user) => {
      const haystack = [user.name, user.email ?? '', user.api_key].join(' ').toLowerCase();
      return haystack.includes(value);
    });
  });

  const activeCount = createMemo(() => (currentUsers() ?? []).filter((user) => user.is_active).length);
  const selectedUser = createMemo(() => (currentUsers() ?? []).find((user) => user.id === selectedUserId()) ?? null);
  const permissionsForSelectedUser = createMemo(() => {
    const currentUserId = selectedUserId();
    if (!currentUserId) return [];
    return (currentPermissions() ?? []).filter((permission) => permission.user_id === currentUserId);
  });
  const assignedBackendIds = createMemo(() => new Set(permissionsForSelectedUser().map((permission) => permission.backend_id)));
  const availableBackendOptions = createMemo(() =>
    (currentBackends() ?? [])
      .filter((backend) => !assignedBackendIds().has(backend.id))
      .map((backend) => ({ value: String(backend.id), label: backend.name }))
  );
  const backendNameById = createMemo(() => {
    const names = new Map<number, string>();
    for (const backend of currentBackends() ?? []) {
      names.set(backend.id, backend.name);
    }
    return names;
  });

  createEffect(() => {
    const list = currentUsers() ?? [];
    const currentSelectedUserId = selectedUserId();

    if (list.length === 0) {
      if (currentSelectedUserId !== null) {
        setSelectedUserId(null);
      }
      return;
    }

    if (currentSelectedUserId === null || !list.some((user) => user.id === currentSelectedUserId)) {
      setSelectedUserId(list[0].id);
    }
  });

  const openCreateDialog = () => {
    setEditingUser(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email ?? '',
      api_key: user.api_key,
      is_active: user.is_active,
      detail_logging: user.detail_logging,
      copy_reasoning_to_reasoning_content: user.copy_reasoning_to_reasoning_content,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (event: Event) => {
    event.preventDefault();

    const current = form();
    if (!current.name.trim()) {
      setNotice({ tone: 'danger', message: 'Name is required.' });
      return;
    }

    setSubmitting(true);
    try {
      if (editingUser()) {
        await api.users.update(editingUser()!.id, {
          name: current.name.trim(),
          email: current.email.trim() || undefined,
          api_key: current.api_key.trim() || undefined,
          is_active: current.is_active,
          detail_logging: current.detail_logging,
          copy_reasoning_to_reasoning_content: current.copy_reasoning_to_reasoning_content,
        });
        setNotice({ tone: 'success', message: 'User updated.' });
      } else {
        await api.users.create({
          name: current.name.trim(),
          email: current.email.trim() || undefined,
          api_key: current.api_key.trim() || undefined,
          detail_logging: current.detail_logging,
          copy_reasoning_to_reasoning_content: current.copy_reasoning_to_reasoning_content,
        });
        setNotice({ tone: 'success', message: 'User created.' });
      }

      setDialogOpen(false);
      setForm(emptyForm());
      setEditingUser(null);
      await refetchUsers();
    } catch (error) {
      setNotice({ tone: 'danger', message: error instanceof Error ? error.message : 'User save failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegenerateApiKey = async (user: User) => {
    try {
      await api.users.regenerateApiKey(user.id);
      setNotice({ tone: 'success', message: `API key regenerated for ${user.name}.` });
      await refetchUsers();
    } catch (error) {
      setNotice({ tone: 'danger', message: error instanceof Error ? error.message : 'API key regeneration failed.' });
    }
  };

  const handleCopyApiKey = async (apiKey: string) => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setNotice({ tone: 'success', message: 'API key copied to clipboard.' });
    } catch (error) {
      setNotice({ tone: 'danger', message: error instanceof Error ? error.message : 'Clipboard copy failed.' });
    }
  };

  const requestDelete = (user: User) => {
    setPendingDeleteUser(user);
    setUserDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    const user = pendingDeleteUser();
    if (!user) return;

    setSubmitting(true);
    try {
      await api.users.delete(user.id);
      setNotice({ tone: 'success', message: `User ${user.name} deleted.` });
      setUserDeleteConfirmOpen(false);
      setPendingDeleteUser(null);
      await Promise.all([refetchUsers(), refetchPermissions()]);
    } catch (error) {
      setNotice({ tone: 'danger', message: error instanceof Error ? error.message : 'User deletion failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  const openPermissionDialog = () => {
    setPermissionBackendId('');
    setPermissionDialogOpen(true);
  };

  const createPermission = async (event: Event) => {
    event.preventDefault();
    const user = selectedUser();

    if (!user) {
      setNotice({ tone: 'warning', message: 'Select a user before granting backend access.' });
      return;
    }

    if (!permissionBackendId()) {
      setNotice({ tone: 'danger', message: 'Select a backend to grant access.' });
      return;
    }

    setSubmitting(true);
    try {
      await api.permissions.create({ user_id: user.id, backend_id: Number(permissionBackendId()) });
      setNotice({ tone: 'success', message: `Backend access granted to ${user.name}.` });
      setPermissionBackendId('');
      setPermissionDialogOpen(false);
      await refetchPermissions();
    } catch (error) {
      setNotice({ tone: 'danger', message: error instanceof Error ? error.message : 'Permission grant failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  const requestPermissionDelete = (backendId: number) => {
    const user = selectedUser();
    if (!user) return;

    setPendingDeletePermission({ user_id: user.id, backend_id: backendId });
    setPermissionConfirmOpen(true);
  };

  const revokePermission = async () => {
    const current = pendingDeletePermission();
    if (!current) return;

    setSubmitting(true);
    try {
      await api.permissions.delete(current.user_id, current.backend_id);
      setNotice({ tone: 'success', message: 'Backend access revoked.' });
      setPermissionConfirmOpen(false);
      setPendingDeletePermission(null);
      await refetchPermissions();
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
          title="Users"
          description="Manage API identities, lifecycle state, and operational access for the router."
          actions={<IconButton variant="primary" icon={<Plus />} label="Add User" onClick={openCreateDialog} />}
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
            <TextField label="Search users" value={query()} onInput={(event) => setQuery(event.currentTarget.value)} />
          </CommandBarGroup>
          <CommandBarGroup>
            <StatusBadge tone="success">{`${activeCount()} active`}</StatusBadge>
            <CommandBarHint>
              <span class="ui-kbd">/</span> search
            </CommandBarHint>
          </CommandBarGroup>
        </CommandBar>

        <div class="ui-section-grid">
          <Panel
            title="User registry"
            description="Dense operational view with API key overflow handling and row-level actions."
            bodyClass="ui-stack ui-stack--tight"
          >
            <Show
              when={!users.loading || filteredUsers().length > 0}
              fallback={<EmptyState title="Loading users" description="Fetching identities and access state from the admin API." />}
            >
              <Show
                when={filteredUsers().length > 0 || users.loading}
                fallback={
                  <EmptyState
                    title="No users yet"
                    description="Create the first user to issue an API key and start routing traffic."
                    action={<IconButton variant="primary" icon={<Plus />} label="Add User" onClick={openCreateDialog} />}
                  />
                }
              >
                <DataGrid
                  rows={filteredUsers()}
                  columns={[
                    {
                      id: 'id',
                      header: 'ID',
                      mono: true,
                      cell: (user) => <span>{user.id}</span>,
                    },
                    {
                      id: 'name',
                      header: 'Name',
                      cell: (user) => <span>{user.name}</span>,
                    },
                    {
                      id: 'email',
                      header: 'Email',
                      truncate: true,
                      cell: (user) => <span title={user.email ?? '-'}>{user.email || '-'}</span>,
                    },
                    {
                      id: 'api_key',
                      header: 'API Key',
                      class: 'ui-text-mono',
                      cell: (user) => (
                        <div class="api-key-cell">
                          <span class="api-key-cell__value" title="Hidden by default">
                            {maskApiKey(user.api_key)}
                          </span>
                          <IconButton icon={<Copy />} label="Copy" onClick={() => void handleCopyApiKey(user.api_key)} />
                        </div>
                      ),
                    },
                    {
                      id: 'detail_logging',
                      header: 'Detail Log',
                      cell: (user) => <StatusBadge tone={user.detail_logging ? 'warning' : 'neutral'}>{user.detail_logging ? 'On' : 'Off'}</StatusBadge>,
                    },
                    {
                      id: 'reasoning_compat',
                      header: 'Reasoning Compat',
                      cell: (user) => <StatusBadge tone={user.copy_reasoning_to_reasoning_content ? 'success' : 'neutral'}>{user.copy_reasoning_to_reasoning_content ? 'On' : 'Off'}</StatusBadge>,
                    },
                    {
                      id: 'status',
                      header: 'Status',
                      cell: (user) => <StatusBadge tone={user.is_active ? 'success' : 'danger'}>{user.is_active ? 'Active' : 'Inactive'}</StatusBadge>,
                    },
                  ]}
                  getRowKey={(user) => user.id}
                  loading={users.loading && filteredUsers().length === 0}
                  emptyMessage="No users match the current search."
                  onRowClick={(user) => setSelectedUserId(user.id)}
                  rowActions={(user) => (
                    <div class="ui-row-actions">
                      <IconButton icon={<KeyRound />} label="Regenerate" onClick={() => void handleRegenerateApiKey(user)} />
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger as={Button} class="ui-button--icon" aria-label="More actions">
                          <span class="ui-button__icon" aria-hidden="true">
                            <Ellipsis />
                          </span>
                          <span class="ui-button__label">More</span>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content>
                            <DropdownMenu.Item onSelect={() => openEditDialog(user)}>
                              <Pencil />
                              Edit
                            </DropdownMenu.Item>
                            <DropdownMenu.Item onSelect={() => requestDelete(user)}>
                              <Trash2 />
                              Delete
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </div>
                  )}
                />
              </Show>
            </Show>
          </Panel>

          <Panel
            title={selectedUser() ? `${selectedUser()!.name} Access` : 'User Access'}
            description="Grant or revoke backend access for the currently selected user."
            actions={<IconButton variant="primary" icon={<Plus />} label="Grant Backend" onClick={openPermissionDialog} disabled={!selectedUser() || availableBackendOptions().length === 0} />}
            bodyClass="ui-stack ui-stack--tight"
          >
            <Show
              when={selectedUser()}
              fallback={<EmptyState title="No user selected" description="Select a user from the registry to manage backend access." />}
            >
              {(user) => (
                <>
                  <MetaCluster
                    items={[
                      { key: 'User', value: user().name },
                      { key: 'Email', value: user().email ?? '-' },
                      { key: 'Assigned backends', value: String(permissionsForSelectedUser().length) },
                    ]}
                  />
                  <Show
                    when={!permissions.loading || permissionsForSelectedUser().length > 0}
                    fallback={<EmptyState title="Loading access" description="Reading backend assignments for the selected user." />}
                  >
                    <Show
                      when={permissionsForSelectedUser().length > 0}
                      fallback={
                        <EmptyState
                          title="No backend access yet"
                          description="Grant this user access to a backend to allow routing."
                          action={<IconButton variant="primary" icon={<Plus />} label="Grant Backend" onClick={openPermissionDialog} disabled={availableBackendOptions().length === 0} />}
                        />
                      }
                    >
                      <DataGrid
                        rows={permissionsForSelectedUser()}
                        columns={[
                          {
                            id: 'backend',
                            header: 'Backend',
                            cell: (permission) => <span title={backendNameById().get(permission.backend_id) ?? `Backend #${permission.backend_id}`}>{backendNameById().get(permission.backend_id) ?? `Backend #${permission.backend_id}`}</span>,
                          },
                          {
                            id: 'created_at',
                            header: 'Granted',
                            cell: (permission) => <span>{new Date(permission.created_at).toLocaleString()}</span>,
                          },
                          {
                            id: 'status',
                            header: 'Status',
                            cell: () => <StatusBadge tone="success">Assigned</StatusBadge>,
                          },
                        ]}
                        getRowKey={(permission) => `${permission.user_id}-${permission.backend_id}`}
                        loading={(permissions.loading || backends.loading) && permissionsForSelectedUser().length === 0}
                        rowActions={(permission) => (
                          <IconButton
                            variant="danger"
                            icon={<ShieldMinus />}
                            label="Revoke"
                            onClick={() => requestPermissionDelete(permission.backend_id)}
                          />
                        )}
                      />
                    </Show>
                  </Show>
                  <Show when={availableBackendOptions().length === 0 && permissionsForSelectedUser().length > 0}>
                    <Alert tone="info">All available backends are already assigned to this user.</Alert>
                  </Show>
                </>
              )}
            </Show>
          </Panel>
        </div>

        <FormDialog
          open={dialogOpen()}
          onOpenChange={setDialogOpen}
          title={editingUser() ? 'Edit User' : 'Add User'}
          description="Compact form dialog for user identity and lifecycle status."
          footer={
            <>
              <Button onClick={() => setDialogOpen(false)} disabled={submitting()}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" form="user-form" disabled={submitting()}>
                {editingUser() ? 'Save Changes' : 'Create User'}
              </Button>
            </>
          }
          class="ui-dialog__content--compact"
        >
          <form id="user-form" class="ui-form" onSubmit={(event) => void handleSubmit(event)}>
            <TextField label="Name" value={form().name} onInput={(event) => setForm((current) => ({ ...current, name: event.currentTarget.value }))} />
            <TextField
              label="Email"
              value={form().email}
              placeholder="ops@example.com"
              onInput={(event) => setForm((current) => ({ ...current, email: event.currentTarget.value }))}
            />
            <TextField
              label="API Key"
              value={form().api_key}
              placeholder="Leave blank to auto-generate"
              description={
                editingUser()
                  ? 'Set a replacement key for migrations or leave blank to keep the current key.'
                  : 'Optional. Paste a legacy key to preserve it during migration, or leave blank to auto-generate.'
              }
              onInput={(event) => setForm((current) => ({ ...current, api_key: event.currentTarget.value }))}
            />
            <Show when={editingUser()}>
              <Checkbox
                label="User is active"
                description="Inactive users keep their record but cannot route traffic."
                checked={form().is_active}
                onChange={(checked) => setForm((current) => ({ ...current, is_active: checked }))}
              />
            </Show>
            <Checkbox
              label="Enable detailed logging"
              description="When enabled, proxied request and response headers/bodies are stored for this user."
              checked={form().detail_logging}
              onChange={(checked) => setForm((current) => ({ ...current, detail_logging: checked }))}
            />
            <Checkbox
              label="Copy reasoning to reasoning_content"
              description="Enable for clients that only display thinking from reasoning_content."
              checked={form().copy_reasoning_to_reasoning_content}
              onChange={(checked) => setForm((current) => ({ ...current, copy_reasoning_to_reasoning_content: checked }))}
            />
          </form>
        </FormDialog>

        <ConfirmDialog
          open={userDeleteConfirmOpen()}
          onOpenChange={setUserDeleteConfirmOpen}
          title="Delete user"
          description="This removes the user record and invalidates the current API key."
          confirmLabel="Delete User"
          tone="danger"
          busy={submitting()}
          details={
            <Show when={pendingDeleteUser()}>
              {(user) => (
                <div class="meta-cluster">
                  <span class="meta-key">Name</span>
                  <span class="meta-value">{user().name}</span>
                  <span class="meta-key">API Key</span>
                  <span class="meta-value">Hidden by default</span>
                </div>
              )}
            </Show>
          }
          onConfirm={() => void handleDelete()}
        />

        <FormDialog
          open={permissionDialogOpen()}
          onOpenChange={setPermissionDialogOpen}
          title={selectedUser() ? `Grant Backend to ${selectedUser()!.name}` : 'Grant Backend'}
          description="Assign backend access for the selected user."
          footer={
            <>
              <Button onClick={() => setPermissionDialogOpen(false)} disabled={submitting()}>
                Cancel
              </Button>
              <Button type="submit" form="user-permission-form" variant="primary" disabled={submitting() || !selectedUser() || availableBackendOptions().length === 0}>
                Grant
              </Button>
            </>
          }
          class="ui-dialog__content--compact"
        >
          <form id="user-permission-form" class="ui-form" onSubmit={(event) => void createPermission(event)}>
            <Show
              when={selectedUser()}
              fallback={<Alert tone="warning">Select a user before granting backend access.</Alert>}
            >
              <MetaCluster items={[{ key: 'User', value: selectedUser()!.name }]} />
            </Show>
            <Select
              label="Backend"
              value={permissionBackendId()}
              onChange={setPermissionBackendId}
              options={availableBackendOptions()}
              placeholder={availableBackendOptions().length > 0 ? 'Select backend' : 'No unassigned backends'}
            />
          </form>
        </FormDialog>

        <ConfirmDialog
          open={permissionConfirmOpen()}
          onOpenChange={setPermissionConfirmOpen}
          title="Revoke backend access"
          description="This removes the routing relationship between the selected user and backend."
          confirmLabel="Revoke"
          tone="danger"
          busy={submitting()}
          details={
            <Show when={pendingDeletePermission()}>
              {(current) => (
                <MetaCluster
                  items={[
                    { key: 'User', value: selectedUser()?.name ?? String(current().user_id) },
                    { key: 'Backend', value: backendNameById().get(current().backend_id) ?? String(current().backend_id) },
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

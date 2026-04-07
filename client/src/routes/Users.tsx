import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  Show,
  type Component,
} from 'solid-js';
import Copy from 'lucide-solid/icons/copy';
import Ellipsis from 'lucide-solid/icons/ellipsis';
import KeyRound from 'lucide-solid/icons/key-round';
import Pencil from 'lucide-solid/icons/pencil';
import Plus from 'lucide-solid/icons/plus';
import ShieldMinus from 'lucide-solid/icons/shield-minus';
import Trash2 from 'lucide-solid/icons/trash-2';

import { api } from '../api/client';
import { Layout } from '../components/Layout';

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

import type { User } from '../types';

type NoticeTone = 'success' | 'warning' | 'danger' | 'info';

interface UserFormState {
  name: string;
  email: string;
  api_key: string;
  is_active: boolean;
  detail_logging: boolean;
}

const emptyForm = (): UserFormState => ({
  name: '',
  email: '',
  api_key: '',
  is_active: true,
  detail_logging: false,
});

const maskApiKey = (apiKey: string) => `${apiKey.slice(0, 5)}...`;

export const Users: Component = () => {
  const [users, { refetch: refetchUsers }] = createResource(() =>
    api.users.getAll(),
  );
  const [backends] = createResource(() => api.backends.getAll());
  const [permissions, { refetch: refetchPermissions }] = createResource(() =>
    api.permissions.getAll(),
  );
  const [query, setQuery] = createSignal('');
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [userDeleteConfirmOpen, setUserDeleteConfirmOpen] = createSignal(false);
  const [permissionDialogOpen, setPermissionDialogOpen] = createSignal(false);
  const [permissionConfirmOpen, setPermissionConfirmOpen] = createSignal(false);
  const [editingUser, setEditingUser] = createSignal<User | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = createSignal<User | null>(
    null,
  );
  const [selectedUserId, setSelectedUserId] = createSignal<number | null>(null);
  const [pendingDeletePermission, setPendingDeletePermission] = createSignal<{
    user_id: number;
    backend_id: number;
  } | null>(null);
  const [permissionBackendId, setPermissionBackendId] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const [notice, setNotice] = createSignal<{
    tone: NoticeTone;
    message: string;
  } | null>(null);
  const [form, setForm] = createSignal<UserFormState>(emptyForm());

  const filteredUsers = createMemo(() => {
    const value = query().trim().toLowerCase();
    const list = users() ?? [];
    if (!value) return list;
    return list.filter((user) => {
      const haystack = [user.name, user.email ?? '', user.api_key]
        .join(' ')
        .toLowerCase();
      return haystack.includes(value);
    });
  });

  const activeCount = createMemo(
    () => (users() ?? []).filter((user) => user.is_active).length,
  );
  const selectedUser = createMemo(
    () => (users() ?? []).find((user) => user.id === selectedUserId()) ?? null,
  );
  const permissionsForSelectedUser = createMemo(() => {
    const currentUserId = selectedUserId();
    if (!currentUserId) return [];
    return (permissions() ?? []).filter(
      (permission) => permission.user_id === currentUserId,
    );
  });
  const assignedBackendIds = createMemo(
    () =>
      new Set(
        permissionsForSelectedUser().map((permission) => permission.backend_id),
      ),
  );
  const availableBackendOptions = createMemo(() =>
    (backends() ?? [])
      .filter((backend) => !assignedBackendIds().has(backend.id))
      .map((backend) => ({ value: String(backend.id), label: backend.name })),
  );
  const backendNameById = createMemo(() => {
    const names = new Map<number, string>();
    for (const backend of backends() ?? []) {
      names.set(backend.id, backend.name);
    }
    return names;
  });

  createEffect(() => {
    const list = users() ?? [];
    const currentSelectedUserId = selectedUserId();

    if (list.length === 0) {
      if (currentSelectedUserId !== null) {
        setSelectedUserId(null);
      }
      return;
    }

    if (
      currentSelectedUserId === null ||
      !list.some((user) => user.id === currentSelectedUserId)
    ) {
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
        });
        setNotice({ tone: 'success', message: 'User updated.' });
      } else {
        await api.users.create({
          name: current.name.trim(),
          email: current.email.trim() || undefined,
          api_key: current.api_key.trim() || undefined,
          detail_logging: current.detail_logging,
        });
        setNotice({ tone: 'success', message: 'User created.' });
      }

      setDialogOpen(false);
      setForm(emptyForm());
      setEditingUser(null);
      await refetchUsers();
    } catch (error) {
      setNotice({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'User save failed.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegenerateApiKey = async (user: User) => {
    try {
      await api.users.regenerateApiKey(user.id);
      setNotice({
        tone: 'success',
        message: `API key regenerated for ${user.name}.`,
      });
      await refetchUsers();
    } catch (error) {
      setNotice({
        tone: 'danger',
        message:
          error instanceof Error
            ? error.message
            : 'API key regeneration failed.',
      });
    }
  };

  const handleCopyApiKey = async (apiKey: string) => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setNotice({ tone: 'success', message: 'API key copied to clipboard.' });
    } catch (error) {
      setNotice({
        tone: 'danger',
        message:
          error instanceof Error ? error.message : 'Clipboard copy failed.',
      });
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
      setNotice({
        tone: 'danger',
        message:
          error instanceof Error ? error.message : 'User deletion failed.',
      });
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
      setNotice({
        tone: 'warning',
        message: 'Select a user before granting backend access.',
      });
      return;
    }

    if (!permissionBackendId()) {
      setNotice({
        tone: 'danger',
        message: 'Select a backend to grant access.',
      });
      return;
    }

    setSubmitting(true);
    try {
      await api.permissions.create({
        user_id: user.id,
        backend_id: Number(permissionBackendId()),
      });
      setNotice({
        tone: 'success',
        message: `Backend access granted to ${user.name}.`,
      });
      setPermissionBackendId('');
      setPermissionDialogOpen(false);
      await refetchPermissions();
    } catch (error) {
      setNotice({
        tone: 'danger',
        message:
          error instanceof Error ? error.message : 'Permission grant failed.',
      });
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
      setNotice({
        tone: 'danger',
        message:
          error instanceof Error ? error.message : 'Permission revoke failed.',
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
              label="Add User"
              onClick={openCreateDialog}
              variant="primary"
            />
          }
          description="Manage API identities, lifecycle state, and operational access for the router."
          title="Users"
        />

        <Show when={notice()}>
          {(currentNotice) => (
            <Alert
              tone={
                currentNotice().tone === 'danger'
                  ? 'danger'
                  : currentNotice().tone === 'warning'
                    ? 'warning'
                    : currentNotice().tone === 'success'
                      ? 'success'
                      : 'info'
              }
            >
              {currentNotice().message}
            </Alert>
          )}
        </Show>

        <CommandBar>
          <CommandBarGroup>
            <TextField
              label="Search users"
              onInput={(event) => setQuery(event.currentTarget.value)}
              value={query()}
            />
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
            bodyClass="ui-stack ui-stack--tight"
            description="Dense operational view with API key overflow handling and row-level actions."
            title="User registry"
          >
            <Show
              fallback={
                <EmptyState
                  description="Fetching identities and access state from the admin API."
                  title="Loading users"
                />
              }
              when={!users.loading || filteredUsers().length > 0}
            >
              <Show
                fallback={
                  <EmptyState
                    action={
                      <IconButton
                        icon={<Plus />}
                        label="Add User"
                        onClick={openCreateDialog}
                        variant="primary"
                      />
                    }
                    description="Create the first user to issue an API key and start routing traffic."
                    title="No users yet"
                  />
                }
                when={filteredUsers().length > 0 || users.loading}
              >
                <DataGrid
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
                      cell: (user) => (
                        <span title={user.email ?? '-'}>
                          {user.email || '-'}
                        </span>
                      ),
                    },
                    {
                      id: 'api_key',
                      header: 'API Key',
                      class: 'ui-text-mono',
                      cell: (user) => (
                        <div class="api-key-cell">
                          <span
                            class="api-key-cell__value"
                            title="Hidden by default"
                          >
                            {maskApiKey(user.api_key)}
                          </span>
                          <IconButton
                            icon={<Copy />}
                            label="Copy"
                            onClick={() => void handleCopyApiKey(user.api_key)}
                          />
                        </div>
                      ),
                    },
                    {
                      id: 'detail_logging',
                      header: 'Detail Log',
                      cell: (user) => (
                        <StatusBadge
                          tone={user.detail_logging ? 'warning' : 'neutral'}
                        >
                          {user.detail_logging ? 'On' : 'Off'}
                        </StatusBadge>
                      ),
                    },
                    {
                      id: 'status',
                      header: 'Status',
                      cell: (user) => (
                        <StatusBadge
                          tone={user.is_active ? 'success' : 'danger'}
                        >
                          {user.is_active ? 'Active' : 'Inactive'}
                        </StatusBadge>
                      ),
                    },
                  ]}
                  emptyMessage="No users match the current search."
                  getRowKey={(user) => user.id}
                  loading={users.loading}
                  onRowClick={(user) => setSelectedUserId(user.id)}
                  rowActions={(user) => (
                    <div class="ui-row-actions">
                      <IconButton
                        icon={<KeyRound />}
                        label="Regenerate"
                        onClick={() => void handleRegenerateApiKey(user)}
                      />
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger
                          aria-label="More actions"
                          as={Button}
                          class="ui-button--icon"
                        >
                          <span aria-hidden="true" class="ui-button__icon">
                            <Ellipsis />
                          </span>
                          <span class="ui-button__label">More</span>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content>
                            <DropdownMenu.Item
                              onSelect={() => openEditDialog(user)}
                            >
                              <Pencil />
                              Edit
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                              onSelect={() => requestDelete(user)}
                            >
                              <Trash2 />
                              Delete
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </div>
                  )}
                  rows={filteredUsers()}
                />
              </Show>
            </Show>
          </Panel>

          <Panel
            actions={
              <IconButton
                disabled={
                  !selectedUser() || availableBackendOptions().length === 0
                }
                icon={<Plus />}
                label="Grant Backend"
                onClick={openPermissionDialog}
                variant="primary"
              />
            }
            bodyClass="ui-stack ui-stack--tight"
            description="Grant or revoke backend access for the currently selected user."
            title={
              selectedUser() ? `${selectedUser()!.name} Access` : 'User Access'
            }
          >
            <Show
              fallback={
                <EmptyState
                  description="Select a user from the registry to manage backend access."
                  title="No user selected"
                />
              }
              when={selectedUser()}
            >
              {(user) => (
                <>
                  <MetaCluster
                    items={[
                      { key: 'User', value: user().name },
                      { key: 'Email', value: user().email ?? '-' },
                      {
                        key: 'Assigned backends',
                        value: String(permissionsForSelectedUser().length),
                      },
                    ]}
                  />
                  <Show
                    fallback={
                      <EmptyState
                        description="Reading backend assignments for the selected user."
                        title="Loading access"
                      />
                    }
                    when={
                      !permissions.loading ||
                      permissionsForSelectedUser().length > 0
                    }
                  >
                    <Show
                      fallback={
                        <EmptyState
                          action={
                            <IconButton
                              disabled={availableBackendOptions().length === 0}
                              icon={<Plus />}
                              label="Grant Backend"
                              onClick={openPermissionDialog}
                              variant="primary"
                            />
                          }
                          description="Grant this user access to a backend to allow routing."
                          title="No backend access yet"
                        />
                      }
                      when={permissionsForSelectedUser().length > 0}
                    >
                      <DataGrid
                        columns={[
                          {
                            id: 'backend',
                            header: 'Backend',
                            cell: (permission) => (
                              <span
                                title={
                                  backendNameById().get(
                                    permission.backend_id,
                                  ) ?? `Backend #${permission.backend_id}`
                                }
                              >
                                {backendNameById().get(permission.backend_id) ??
                                  `Backend #${permission.backend_id}`}
                              </span>
                            ),
                          },
                          {
                            id: 'created_at',
                            header: 'Granted',
                            cell: (permission) => (
                              <span>
                                {new Date(
                                  permission.created_at,
                                ).toLocaleString()}
                              </span>
                            ),
                          },
                          {
                            id: 'status',
                            header: 'Status',
                            cell: () => (
                              <StatusBadge tone="success">Assigned</StatusBadge>
                            ),
                          },
                        ]}
                        getRowKey={(permission) =>
                          `${permission.user_id}-${permission.backend_id}`
                        }
                        loading={permissions.loading || backends.loading}
                        rowActions={(permission) => (
                          <IconButton
                            icon={<ShieldMinus />}
                            label="Revoke"
                            onClick={() =>
                              requestPermissionDelete(permission.backend_id)
                            }
                            variant="danger"
                          />
                        )}
                        rows={permissionsForSelectedUser()}
                      />
                    </Show>
                  </Show>
                  <Show
                    when={
                      availableBackendOptions().length === 0 &&
                      permissionsForSelectedUser().length > 0
                    }
                  >
                    <Alert tone="info">
                      All available backends are already assigned to this user.
                    </Alert>
                  </Show>
                </>
              )}
            </Show>
          </Panel>
        </div>

        <FormDialog
          class="ui-dialog__content--compact"
          description="Compact form dialog for user identity and lifecycle status."
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
                form="user-form"
                type="submit"
                variant="primary"
              >
                {editingUser() ? 'Save Changes' : 'Create User'}
              </Button>
            </>
          }
          onOpenChange={setDialogOpen}
          open={dialogOpen()}
          title={editingUser() ? 'Edit User' : 'Add User'}
        >
          <form
            class="ui-form"
            id="user-form"
            onSubmit={(event) => void handleSubmit(event)}
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
              label="Email"
              onInput={(event) =>
                setForm((current) => ({
                  ...current,
                  email: event.currentTarget.value,
                }))
              }
              placeholder="ops@example.com"
              value={form().email}
            />
            <TextField
              description={
                editingUser()
                  ? 'Set a replacement key for migrations or leave blank to keep the current key.'
                  : 'Optional. Paste a legacy key to preserve it during migration, or leave blank to auto-generate.'
              }
              label="API Key"
              onInput={(event) =>
                setForm((current) => ({
                  ...current,
                  api_key: event.currentTarget.value,
                }))
              }
              placeholder="Leave blank to auto-generate"
              value={form().api_key}
            />
            <Show when={editingUser()}>
              <Checkbox
                checked={form().is_active}
                description="Inactive users keep their record but cannot route traffic."
                label="User is active"
                onChange={(checked) =>
                  setForm((current) => ({ ...current, is_active: checked }))
                }
              />
            </Show>
            <Checkbox
              checked={form().detail_logging}
              description="When enabled, proxied request and response headers/bodies are stored for this user."
              label="Enable detailed logging"
              onChange={(checked) =>
                setForm((current) => ({ ...current, detail_logging: checked }))
              }
            />
          </form>
        </FormDialog>

        <ConfirmDialog
          busy={submitting()}
          confirmLabel="Delete User"
          description="This removes the user record and invalidates the current API key."
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
          onOpenChange={setUserDeleteConfirmOpen}
          open={userDeleteConfirmOpen()}
          title="Delete user"
          tone="danger"
        />

        <FormDialog
          class="ui-dialog__content--compact"
          description="Assign backend access for the selected user."
          footer={
            <>
              <Button
                disabled={submitting()}
                onClick={() => setPermissionDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={
                  submitting() ||
                  !selectedUser() ||
                  availableBackendOptions().length === 0
                }
                form="user-permission-form"
                type="submit"
                variant="primary"
              >
                Grant
              </Button>
            </>
          }
          onOpenChange={setPermissionDialogOpen}
          open={permissionDialogOpen()}
          title={
            selectedUser()
              ? `Grant Backend to ${selectedUser()!.name}`
              : 'Grant Backend'
          }
        >
          <form
            class="ui-form"
            id="user-permission-form"
            onSubmit={(event) => void createPermission(event)}
          >
            <Show
              fallback={
                <Alert tone="warning">
                  Select a user before granting backend access.
                </Alert>
              }
              when={selectedUser()}
            >
              <MetaCluster
                items={[{ key: 'User', value: selectedUser()!.name }]}
              />
            </Show>
            <Select
              label="Backend"
              onChange={setPermissionBackendId}
              options={availableBackendOptions()}
              placeholder={
                availableBackendOptions().length > 0
                  ? 'Select backend'
                  : 'No unassigned backends'
              }
              value={permissionBackendId()}
            />
          </form>
        </FormDialog>

        <ConfirmDialog
          busy={submitting()}
          confirmLabel="Revoke"
          description="This removes the routing relationship between the selected user and backend."
          details={
            <Show when={pendingDeletePermission()}>
              {(current) => (
                <MetaCluster
                  items={[
                    {
                      key: 'User',
                      value: selectedUser()?.name ?? String(current().user_id),
                    },
                    {
                      key: 'Backend',
                      value:
                        backendNameById().get(current().backend_id) ??
                        String(current().backend_id),
                    },
                  ]}
                />
              )}
            </Show>
          }
          onConfirm={() => void revokePermission()}
          onOpenChange={setPermissionConfirmOpen}
          open={permissionConfirmOpen()}
          title="Revoke backend access"
          tone="danger"
        />
      </div>
    </Layout>
  );
};

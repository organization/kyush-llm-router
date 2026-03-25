import { createMemo, createResource, createSignal, For, Show, type Component } from 'solid-js';
import { Copy, KeyRound, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-solid';
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
  PageHeader,
  Panel,
  StatusBadge,
  TextField,
} from '../ui';

type NoticeTone = 'success' | 'warning' | 'danger' | 'info';

interface UserFormState {
  name: string;
  email: string;
  is_active: boolean;
}

const emptyForm = (): UserFormState => ({
  name: '',
  email: '',
  is_active: true,
});

const maskApiKey = (apiKey: string) => `${apiKey.slice(0, 5)}...`;

export const Users: Component = () => {
  const [users, { refetch }] = createResource(() => api.users.getAll());
  const [query, setQuery] = createSignal('');
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [confirmOpen, setConfirmOpen] = createSignal(false);
  const [editingUser, setEditingUser] = createSignal<User | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = createSignal<User | null>(null);
  const [submitting, setSubmitting] = createSignal(false);
  const [notice, setNotice] = createSignal<{ tone: NoticeTone; message: string } | null>(null);
  const [form, setForm] = createSignal<UserFormState>(emptyForm());

  const filteredUsers = createMemo(() => {
    const value = query().trim().toLowerCase();
    const list = users() ?? [];
    if (!value) return list;
    return list.filter((user) => {
      const haystack = [user.name, user.email ?? '', user.api_key].join(' ').toLowerCase();
      return haystack.includes(value);
    });
  });

  const activeCount = createMemo(() => (users() ?? []).filter((user) => user.is_active).length);

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
      is_active: user.is_active,
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
          is_active: current.is_active,
        });
        setNotice({ tone: 'success', message: 'User updated.' });
      } else {
        await api.users.create({
          name: current.name.trim(),
          email: current.email.trim() || undefined,
        });
        setNotice({ tone: 'success', message: 'User created.' });
      }

      setDialogOpen(false);
      setForm(emptyForm());
      setEditingUser(null);
      await refetch();
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
      await refetch();
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
    setConfirmOpen(true);
  };

  const handleDelete = async () => {
    const user = pendingDeleteUser();
    if (!user) return;

    setSubmitting(true);
    try {
      await api.users.delete(user.id);
      setNotice({ tone: 'success', message: `User ${user.name} deleted.` });
      setConfirmOpen(false);
      setPendingDeleteUser(null);
      await refetch();
    } catch (error) {
      setNotice({ tone: 'danger', message: error instanceof Error ? error.message : 'User deletion failed.' });
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
                    id: 'status',
                    header: 'Status',
                    cell: (user) => <StatusBadge tone={user.is_active ? 'success' : 'danger'}>{user.is_active ? 'Active' : 'Inactive'}</StatusBadge>,
                  },
                ]}
                getRowKey={(user) => user.id}
                loading={users.loading}
                emptyMessage="No users match the current search."
                rowActions={(user) => (
                  <div class="ui-row-actions">
                    <IconButton icon={<KeyRound />} label="Regenerate" onClick={() => void handleRegenerateApiKey(user)} />
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger as={Button} class="ui-button--icon" aria-label="More actions">
                        <span class="ui-button__icon" aria-hidden="true">
                          <MoreHorizontal />
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
            <Show when={editingUser()}>
              <Checkbox
                label="User is active"
                description="Inactive users keep their record but cannot route traffic."
                checked={form().is_active}
                onChange={(checked) => setForm((current) => ({ ...current, is_active: checked }))}
              />
            </Show>
          </form>
        </FormDialog>

        <ConfirmDialog
          open={confirmOpen()}
          onOpenChange={setConfirmOpen}
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
      </div>
    </Layout>
  );
};

import { createSignal } from 'solid-js';

import {
  Alert,
  AppShell,
  Button,
  CommandBar,
  CommandBarGroup,
  DataGrid,
  EmptyState,
  MetaCluster,
  PageHeader,
  Panel,
  Select,
  StatusBadge,
  SummaryStrip,
  Tabs,
  TextField,
  type DataGridColumn,
} from '../index';

type UserRow = {
  id: number;
  name: string;
  email: string;
  apiKey: string;
  status: 'Active' | 'Inactive';
};

const userRows: UserRow[] = [
  {
    id: 12,
    name: 'ops-admin',
    email: 'ops@example.com',
    apiKey: 'sk-router-00012-abcdefghijklmnopqrstuvwx',
    status: 'Active',
  },
  {
    id: 13,
    name: 'batch-worker',
    email: 'jobs@example.com',
    apiKey: 'sk-router-00013-zyxwvutsrqponmlkjihgfedc',
    status: 'Inactive',
  },
];

const userColumns: DataGridColumn<UserRow>[] = [
  { id: 'id', header: 'ID', mono: true, cell: (row) => row.id },
  { id: 'name', header: 'Name', cell: (row) => row.name },
  {
    id: 'email',
    header: 'Email',
    truncate: true,
    cell: (row) => <span title={row.email}>{row.email}</span>,
  },
  {
    id: 'apiKey',
    header: 'API Key',
    mono: true,
    cell: (row) => (
      <div class="api-key-cell">
        <span class="api-key-cell__value" title={row.apiKey}>
          {row.apiKey}
        </span>
        <Button>Copy</Button>
      </div>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    cell: (row) => (
      <StatusBadge tone={row.status === 'Active' ? 'success' : 'warning'}>
        {row.status}
      </StatusBadge>
    ),
  },
];

export default {
  title: 'UI/App Migration',
  tags: ['autodocs'],
};

export const PageShell = {
  render: () => (
    <AppShell>
      <div class="ui-app-page">
        <PageHeader
          actions={<Button variant="primary">Add User</Button>}
          description="Shared page shell with command header and compact panel structure."
          title="Users"
        />
        <SummaryStrip
          items={[
            { label: 'Users', value: 24, hint: 'Provisioned identities' },
            { label: 'Active', value: 18, hint: 'Available for routing' },
            { label: 'Backends', value: 6, hint: 'Permission targets' },
          ]}
        />
        <Panel
          description="This is the default panel surface used by route screens."
          title="Primary panel"
        >
          <p class="ui-copy">
            Panels, headers, and summary strips now come from the same UI layer
            that powers the real app routes.
          </p>
        </Panel>
      </div>
    </AppShell>
  ),
};

export const UsersTable = {
  render: () => (
    <div class="ui-workbench ui-stack">
      <PageHeader
        actions={<Button variant="primary">Add User</Button>}
        description="Dense table pattern with overflow-safe API key handling."
        title="Users"
      />
      <CommandBar>
        <CommandBarGroup>
          <TextField label="Search users" value="ops" />
        </CommandBarGroup>
        <CommandBarGroup>
          <StatusBadge tone="success">18 active</StatusBadge>
        </CommandBarGroup>
      </CommandBar>
      <Panel description="Route-ready table composition." title="User registry">
        <DataGrid
          columns={userColumns}
          getRowKey={(row) => row.id}
          rows={userRows}
        />
      </Panel>
    </div>
  ),
};

export const ScriptsWorkspace = {
  render: () => {
    const [scope, setScope] = createSignal('per-user-backend');

    return (
      <div class="ui-workbench ui-stack">
        <PageHeader
          actions={<Button variant="primary">Create Script</Button>}
          description="Split workspace pattern with dense form controls and a test tab."
          title="Scripts"
        />
        <div class="ui-split-panel">
          <Panel
            description="Left-side selection list."
            title="Script registry"
          >
            <DataGrid
              columns={[
                { id: 'name', header: 'Name', cell: (row) => row.name },
                { id: 'target', header: 'Target', cell: (row) => row.target },
                {
                  id: 'status',
                  header: 'Status',
                  cell: (row) => (
                    <StatusBadge
                      tone={row.status === 'Active' ? 'success' : 'warning'}
                    >
                      {row.status}
                    </StatusBadge>
                  ),
                },
              ]}
              getRowKey={(row) => row.id}
              rows={[
                {
                  id: 1,
                  name: 'OpenAI request guard',
                  target: 'ops-admin + OpenAI',
                  status: 'Active',
                },
                {
                  id: 2,
                  name: 'Anthropic response logger',
                  target: 'Anthropic',
                  status: 'Inactive',
                },
              ]}
            />
          </Panel>
          <Panel
            description="Right-side editor panel."
            title="Editing OpenAI request guard"
          >
            <div class="ui-stack">
              <TextField label="Script name" value="OpenAI request guard" />
              <Select
                label="Scope"
                onChange={setScope}
                options={[
                  { value: 'per-user-backend', label: 'Per User + Backend' },
                  { value: 'per-user', label: 'Per User' },
                  { value: 'per-backend', label: 'Per Backend' },
                ]}
                value={scope()}
              />
              <MetaCluster
                items={[
                  { key: 'Mode', value: 'Saved script' },
                  { key: 'User context', value: 'ops-admin' },
                  { key: 'Backend context', value: 'OpenAI Primary' },
                ]}
              />
              <Tabs.Root defaultValue="editor">
                <Tabs.List aria-label="Script workspace">
                  <Tabs.Trigger value="editor">Editor</Tabs.Trigger>
                  <Tabs.Trigger value="test">Test</Tabs.Trigger>
                </Tabs.List>
                <Tabs.Content value="editor">
                  <Panel
                    description="Monaco editor mounts inside the real route."
                    title="Code editor"
                  >
                    <pre class="ui-copy ui-text-mono">
                      {
                        'export async function onRequest(ctx) {\n  return ctx;\n}'
                      }
                    </pre>
                  </Panel>
                </Tabs.Content>
                <Tabs.Content value="test">
                  <Alert title="Test passed" tone="success">
                    Execution time: 12ms
                  </Alert>
                </Tabs.Content>
              </Tabs.Root>
            </div>
          </Panel>
        </div>
      </div>
    );
  },
};

export const States = {
  render: () => (
    <div class="ui-workbench ui-stack">
      <Panel title="Empty State">
        <EmptyState
          action={<Button variant="primary">Add User</Button>}
          description="Create the first user to issue an API key and start routing traffic."
          title="No users yet"
        />
      </Panel>
      <Panel title="Loading and Error">
        <div class="ui-stack">
          <Alert title="Loading" tone="info">
            Fetching identities and access state from the admin API.
          </Alert>
          <Alert title="Failed to load" tone="danger">
            Request failed while refreshing analytics snapshots.
          </Alert>
        </div>
      </Panel>
    </div>
  ),
};

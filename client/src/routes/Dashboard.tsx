import { createResource, type Component } from 'solid-js';
import { api } from '../api/client';
import { Layout } from '../components/Layout';
import { Button, DataGrid, EmptyState, PageHeader, Panel, StatusBadge, SummaryStrip } from '../ui';

export const Dashboard: Component = () => {
  const [data, { refetch }] = createResource(async () => ({
    users: await api.users.getAll(),
    backends: await api.backends.getAll(),
    recentRequests: await api.analytics.getRequests(10),
  }));

  return (
    <Layout>
      <div class="ui-app-page">
        <PageHeader
          title="Dashboard"
          description="Compact operational overview of registered identities, active backends, and recent traffic."
          actions={<Button onClick={() => void refetch()}>Refresh</Button>}
        />

        <SummaryStrip
          items={[
            { label: 'Total Users', value: data()?.users.length ?? 0, hint: 'Provisioned API identities' },
            { label: 'Active Backends', value: data()?.backends.filter((backend) => backend.is_active).length ?? 0, hint: 'Routable upstream targets' },
            { label: 'Recent Requests', value: data()?.recentRequests.length ?? 0, hint: 'Loaded in the current overview' },
          ]}
        />

        <Panel title="Recent Requests" description="Latest request activity across the router with status and model context.">
          <DataGrid
            rows={data()?.recentRequests ?? []}
            columns={[
              { id: 'user_id', header: 'User', mono: true, cell: (request) => <span>{request.user_id}</span> },
              { id: 'backend_id', header: 'Backend', mono: true, cell: (request) => <span>{request.backend_id}</span> },
              { id: 'model', header: 'Model', truncate: true, cell: (request) => <span title={request.request_model ?? '-'}>{request.request_model || '-'}</span> },
              {
                id: 'status',
                header: 'Status',
                cell: (request) => <StatusBadge tone={request.status_code >= 400 ? 'danger' : 'success'}>{String(request.status_code)}</StatusBadge>,
              },
              { id: 'time', header: 'Time', cell: (request) => <span>{new Date(request.created_at).toLocaleString()}</span> },
            ]}
            getRowKey={(request) => request.id}
            loading={data.loading}
            emptyMessage="No recent requests yet."
          />
          {!data.loading && (data()?.recentRequests.length ?? 0) === 0 && (
            <EmptyState title="No requests yet" description="Traffic will appear here once authenticated users send requests through the router." />
          )}
        </Panel>
      </div>
    </Layout>
  );
};

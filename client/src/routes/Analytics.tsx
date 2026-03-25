import { createResource, type Component } from 'solid-js';
import { api } from '../api/client';
import { Layout } from '../components/Layout';
import { DataGrid, EmptyState, MetaCluster, PageHeader, Panel, StatusBadge, SummaryStrip } from '../ui';

export const Analytics: Component = () => {
  const [requests] = createResource(() => api.analytics.getRequests({ limit: 50 }));
  const [usage] = createResource(() => api.analytics.getUsage(undefined, undefined, 7));
  const [metrics] = createResource(() => api.analytics.getMetrics(undefined, 7));

  const requestRows = () => requests() ?? [];
  const usageRows = () => usage() ?? [];
  const metricRows = () => metrics() ?? [];

  return (
    <Layout>
      <div class="ui-app-page">
        <PageHeader
          title="Analytics"
          description="Panel-based operational analytics for request logs, usage totals, and backend performance."
        />

        <SummaryStrip
          items={[
            { label: 'Recent Requests', value: requestRows().length, hint: 'Loaded log rows' },
            { label: 'Usage Windows', value: usageRows().length, hint: 'Daily aggregates for the last 7 days' },
            { label: 'Metric Windows', value: metricRows().length, hint: 'Backend performance snapshots' },
          ]}
        />

        <div class="ui-section-grid">
          <Panel title="Recent Requests" description="Latest request outcomes and token volume.">
            <DataGrid
              rows={requestRows()}
              columns={[
                { id: 'user', header: 'User', mono: true, cell: (row) => <span>{row.user_id}</span> },
                { id: 'tokens', header: 'Tokens', mono: true, cell: (row) => <span>{row.total_tokens || 0}</span> },
                {
                  id: 'status',
                  header: 'Status',
                  cell: (row) => <StatusBadge tone={row.status_code >= 400 ? 'danger' : 'success'}>{String(row.status_code)}</StatusBadge>,
                },
                {
                  id: 'detail',
                  header: 'Detail',
                  cell: (row) => <StatusBadge tone={row.detail_logged ? 'warning' : 'neutral'}>{row.detail_logged ? 'Verbose' : 'Meta'}</StatusBadge>,
                },
              ]}
              getRowKey={(row) => row.id}
              loading={requests.loading}
              emptyMessage="No request analytics available."
            />
          </Panel>

          <Panel title="Usage Stats" description="Daily request and token totals for the last 7 days.">
            <DataGrid
              rows={usageRows()}
              columns={[
                { id: 'date', header: 'Date', cell: (row) => <span>{row.date}</span> },
                { id: 'requests', header: 'Requests', mono: true, cell: (row) => <span>{row.total_requests}</span> },
                { id: 'tokens', header: 'Tokens', mono: true, cell: (row) => <span>{row.total_tokens}</span> },
              ]}
              getRowKey={(row) => `${row.user_id}-${row.backend_id}-${row.date}`}
              loading={usage.loading}
              emptyMessage="No usage data available."
            />
          </Panel>
        </div>

        <Panel title="Backend Metrics" description="Response quality and performance windows per backend.">
          <MetaCluster
            items={[
              { key: 'Window', value: 'Last 7 days' },
              { key: 'Grouping', value: 'Per backend / per date' },
            ]}
          />
          <DataGrid
            rows={metricRows()}
            columns={[
              { id: 'date', header: 'Date', cell: (row) => <span>{row.date}</span> },
              { id: 'backend', header: 'Backend', mono: true, cell: (row) => <span>{row.backend_id}</span> },
              { id: 'requests', header: 'Requests', mono: true, cell: (row) => <span>{row.total_requests}</span> },
              { id: 'latency', header: 'Avg Response', mono: true, cell: (row) => <span>{row.avg_response_time_ms?.toFixed(1) || 0}ms</span> },
              {
                id: 'success_rate',
                header: 'Success Rate',
                cell: (row) => (
                  <StatusBadge tone={row.success_rate >= 0.95 ? 'success' : row.success_rate >= 0.8 ? 'warning' : 'danger'}>
                    {`${(row.success_rate * 100).toFixed(1)}%`}
                  </StatusBadge>
                ),
              },
            ]}
            getRowKey={(row) => `${row.backend_id}-${row.date}`}
            loading={metrics.loading}
            emptyMessage="No backend metrics available."
          />
          {!metrics.loading && metricRows().length === 0 && (
            <EmptyState title="No metrics yet" description="Backend performance data will appear after requests have been logged." />
          )}
        </Panel>
      </div>
    </Layout>
  );
};

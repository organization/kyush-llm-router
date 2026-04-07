import RefreshCcw from 'lucide-solid/icons/refresh-ccw';
import {
  Show,
  createMemo,
  createResource,
  createSignal,
  type Component,
  For,
} from 'solid-js';

import { api } from '../api/client';
import { Layout } from '../components/Layout';
import {
  ChartLegend,
  ComboChart,
  CommandBar,
  CommandBarGroup,
  EmptyState,
  MetaCluster,
  PageHeader,
  Panel,
  Select,
  SummaryStrip,
  TimeSeriesChart,
} from '../ui';

const dayOptions = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

const palette = [
  '#2357d8',
  '#1f7a45',
  '#c05621',
  '#8b5cf6',
  '#0f766e',
  '#b42318',
];
const formatInteger = new Intl.NumberFormat('en-US');

type DashboardChartRow = { date: string } & Record<
  string,
  string | number | null
>;

export const Dashboard: Component = () => {
  const [days, setDays] = createSignal('30');
  const [hiddenTrafficSeries, setHiddenTrafficSeries] = createSignal<
    Set<string>
  >(new Set());
  const [hiddenLatencySeries, setHiddenLatencySeries] = createSignal<
    Set<string>
  >(new Set());
  const [hiddenModelSeries, setHiddenModelSeries] = createSignal<Set<string>>(
    new Set(),
  );

  const windowDays = createMemo(() => Number(days()));
  const [summary, { refetch }] = createResource(windowDays, (value) =>
    api.dashboard.getSummary(value),
  );
  const [backends] = createResource(() => api.backends.getAll());

  const backendNameById = createMemo(() => {
    const entries = new Map<number, string>();
    for (const backend of backends() ?? []) {
      entries.set(backend.id, backend.name);
    }
    return entries;
  });

  const trafficRows = createMemo(() =>
    (summary()?.series.daily_totals ?? []).map((row) => ({
      date: row.date,
      requests: row.total_requests,
      tokens: row.total_tokens,
    })),
  );

  const reliabilityRows = createMemo(() => {
    const grouped = new Map<string, { requests: number; errors: number }>();
    for (const row of summary()?.series.backend_quality ?? []) {
      const entry = grouped.get(row.date) ?? { requests: 0, errors: 0 };
      entry.requests += row.total_requests;
      entry.errors += row.error_count;
      grouped.set(row.date, entry);
    }

    return Array.from(grouped.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([date, value]) => ({
        date,
        lineValue:
          value.requests === 0
            ? 0
            : ((value.requests - value.errors) / value.requests) * 100,
        barValue: value.errors,
      }));
  });

  const latencyRows = createMemo(() => {
    const grouped = new Map<string, DashboardChartRow>();
    for (const row of summary()?.series.backend_quality ?? []) {
      const entry: DashboardChartRow = grouped.get(row.date) ?? {
        date: row.date,
      };
      entry[`backend_${row.backend_id}`] = row.avg_response_time_ms;
      grouped.set(row.date, entry);
    }
    return Array.from(grouped.values()).sort((left, right) =>
      left.date.localeCompare(right.date),
    );
  });

  const latencySeries = createMemo(() => {
    const ids = Array.from(
      new Set(
        (summary()?.series.backend_quality ?? []).map((row) => row.backend_id),
      ),
    ).sort((left, right) => left - right);
    return ids.map((backendId, index) => ({
      key: `backend_${backendId}`,
      label: backendNameById().get(backendId) ?? `Backend ${backendId}`,
      color: palette[index % palette.length],
    }));
  });

  const modelRows = createMemo(() => {
    const grouped = new Map<string, DashboardChartRow>();
    for (const row of summary()?.series.model_trends ?? []) {
      const entry: DashboardChartRow = grouped.get(row.date) ?? {
        date: row.date,
      };
      entry[`model_${row.model}`] = row.request_count;
      grouped.set(row.date, entry);
    }
    return Array.from(grouped.values()).sort((left, right) =>
      left.date.localeCompare(right.date),
    );
  });

  const modelSeries = createMemo(() => {
    const models = Array.from(
      new Set((summary()?.series.model_trends ?? []).map((row) => row.model)),
    );
    return models.map((model, index) => ({
      key: `model_${model}`,
      label: model,
      color: palette[index % palette.length],
    }));
  });

  const summaryItems = createMemo(() => {
    const payload = summary();
    const latestTraffic =
      payload?.series.daily_totals[payload.series.daily_totals.length - 1];

    return [
      {
        label: 'Active Users',
        value: payload?.overview.active_users ?? 0,
        hint: `${payload?.overview.total_users ?? 0} total identities`,
      },
      {
        label: 'Active Backends',
        value: payload?.overview.active_backends ?? 0,
        hint: `${payload?.overview.total_backends ?? 0} configured upstreams`,
      },
      {
        label: 'Live Scripts',
        value: payload?.overview.active_scripts ?? 0,
        hint: `${payload?.overview.total_scripts ?? 0} total middleware rules`,
      },
      {
        label: 'Latest Volume',
        value: latestTraffic
          ? formatInteger.format(latestTraffic.total_requests)
          : '0',
        hint: latestTraffic
          ? `${latestTraffic.date} request count`
          : 'No traffic in window',
      },
    ];
  });

  const cacheStateItems = createMemo(() => {
    const counts = summary()?.health.cache_state_counts;
    if (!counts) return [];
    return [
      { key: 'Ready', value: String(counts.ready) },
      { key: 'Uninitialized', value: String(counts.uninitialized) },
      { key: 'Error', value: String(counts.error) },
      { key: 'Inactive', value: String(counts.inactive) },
    ];
  });

  const scriptItems = createMemo(() => {
    const payload = summary();
    if (!payload) return [];

    return [
      {
        key: 'Per User',
        value: `${payload.scripts.active_by_type['per-user']} active / ${payload.scripts.total_by_type['per-user']} total`,
      },
      {
        key: 'Per Backend',
        value: `${payload.scripts.active_by_type['per-backend']} active / ${payload.scripts.total_by_type['per-backend']} total`,
      },
      {
        key: 'Scoped',
        value: `${payload.scripts.active_by_type['per-user-backend']} active / ${payload.scripts.total_by_type['per-user-backend']} total`,
      },
    ];
  });

  const accessItems = createMemo(() => {
    const payload = summary();
    if (!payload) return [];

    return [
      {
        key: 'Assignments',
        value: formatInteger.format(payload.access.permission_assignments),
      },
      {
        key: 'No Backend Access',
        value: String(payload.access.users_without_permissions),
      },
      {
        key: 'User Detail Logs',
        value: String(payload.logging.users_with_detail_logging),
      },
      {
        key: 'Backend Detail Logs',
        value: String(payload.logging.backends_with_detail_logging),
      },
    ];
  });

  const toggleHiddenKey = (
    setter: (
      value: Set<string> | ((current: Set<string>) => Set<string>),
    ) => void,
    key: string,
  ) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <Layout>
      <div class="ui-app-page">
        <PageHeader
          actions={
            <button
              class="ui-button"
              onClick={() => void refetch()}
              type="button"
            >
              <RefreshCcw />
              Refresh
            </button>
          }
          description="Operations cockpit for router health, traffic shape, and the configuration context behind current behavior."
          title="Dashboard"
        />

        <CommandBar class="analytics__filters">
          <CommandBarGroup>
            <Select
              label="Window"
              onChange={setDays}
              options={dayOptions}
              value={days()}
            />
          </CommandBarGroup>
        </CommandBar>

        <SummaryStrip items={summaryItems()} />

        <Show
          fallback={
            <Panel
              description={
                summary.error instanceof Error
                  ? summary.error.message
                  : 'Failed to load dashboard summary.'
              }
              title="Dashboard unavailable"
            >
              <EmptyState
                description="Refresh the page or verify the admin API is available."
                title="Failed to load summary"
              />
            </Panel>
          }
          when={!summary.error}
        >
          <div class="ui-section-grid">
            <Panel
              actions={
                <ChartLegend
                  items={[
                    { key: 'requests', label: 'Requests', color: '#2357d8' },
                    { key: 'tokens', label: 'Tokens', color: '#1f7a45' },
                  ]}
                  mutedKeys={hiddenTrafficSeries()}
                  onToggle={(key) =>
                    toggleHiddenKey(setHiddenTrafficSeries, key)
                  }
                />
              }
              description="Daily request and token totals for the selected window."
              title="Traffic Volume"
            >
              <TimeSeriesChart
                data={trafficRows()}
                formatLeftValue={(value) =>
                  formatInteger.format(Math.round(value))
                }
                formatRightValue={(value) =>
                  new Intl.NumberFormat('en-US', {
                    notation: 'compact',
                    maximumFractionDigits: 1,
                  }).format(value)
                }
                hiddenKeys={hiddenTrafficSeries()}
                onToggleLegend={(key) =>
                  toggleHiddenKey(setHiddenTrafficSeries, key)
                }
                series={[
                  { key: 'requests', label: 'Requests', color: '#2357d8' },
                  {
                    key: 'tokens',
                    label: 'Tokens',
                    color: '#1f7a45',
                    axis: 'right',
                  },
                ]}
                showLegend={false}
                tooltipTitle="Traffic volume"
                yLeftLabel="Requests"
                yRightLabel="Tokens"
              />
            </Panel>

            <Panel
              actions={
                <ChartLegend
                  items={[
                    { key: 'line', label: 'Success Rate', color: '#2357d8' },
                    { key: 'bar', label: 'Errors', color: '#b42318' },
                  ]}
                />
              }
              description="Success rate and absolute error count across all visible traffic."
              title="Reliability Snapshot"
            >
              <ComboChart
                barColor="#b42318"
                barLabel="Errors"
                data={reliabilityRows()}
                lineColor="#2357d8"
                lineLabel="Success Rate"
                showLegend={false}
              />
            </Panel>
          </div>

          <div class="ui-section-grid">
            <Panel
              actions={
                <ChartLegend
                  items={latencySeries()}
                  mutedKeys={hiddenLatencySeries()}
                  onToggle={(key) =>
                    toggleHiddenKey(setHiddenLatencySeries, key)
                  }
                />
              }
              description="Average response time by backend with per-series toggles."
              title="Backend Latency"
            >
              <TimeSeriesChart
                data={latencyRows()}
                formatLeftValue={(value) => `${value.toFixed(0)}ms`}
                hiddenKeys={hiddenLatencySeries()}
                onToggleLegend={(key) =>
                  toggleHiddenKey(setHiddenLatencySeries, key)
                }
                series={latencySeries()}
                showLegend={false}
                tooltipTitle="Backend latency"
                yLeftLabel="Milliseconds"
              />
            </Panel>

            <Panel
              actions={
                <ChartLegend
                  items={modelSeries()}
                  mutedKeys={hiddenModelSeries()}
                  onToggle={(key) => toggleHiddenKey(setHiddenModelSeries, key)}
                />
              }
              description="Top models by request volume across the current window."
              title="Model Activity"
            >
              <TimeSeriesChart
                data={modelRows()}
                formatLeftValue={(value) => `${Math.round(value)}`}
                hiddenKeys={hiddenModelSeries()}
                onToggleLegend={(key) =>
                  toggleHiddenKey(setHiddenModelSeries, key)
                }
                series={modelSeries()}
                showLegend={false}
                tooltipTitle="Model activity"
                yLeftLabel="Requests"
              />
            </Panel>
          </div>

          <div class="ui-section-grid dashboard__context-grid">
            <Panel
              description="Cache readiness, liveness, and sync drift indicators for current backends."
              title="Backend Health"
            >
              <MetaCluster items={cacheStateItems()} />
              <Show
                fallback={
                  <EmptyState
                    description="All active backends synced within the freshness window."
                    title="No stale backend syncs"
                  />
                }
                when={(summary()?.health.stale_backends.length ?? 0) > 0}
              >
                <div class="dashboard__status-list">
                  {
                    <For each={summary()?.health.stale_backends}>
                      {(backend) => (
                        <div class="dashboard__status-item">
                          <div>
                            <strong>{backend.name}</strong>
                            <p>
                              Last sync:{' '}
                              {backend.last_synced_at
                                ? new Date(
                                    backend.last_synced_at,
                                  ).toLocaleString()
                                : 'Never'}
                            </p>
                          </div>
                          <span>{backend.state}</span>
                        </div>
                      )}
                    </For>
                  }
                </div>
              </Show>
            </Panel>

            <Panel
              description="Active middleware footprint and target distribution."
              title="Script Runtime"
            >
              <MetaCluster items={scriptItems()} />
              <div class="dashboard__note">
                Active scripts shape request and response behavior before
                traffic reaches the upstream backend.
              </div>
            </Panel>

            <Panel
              description="Identity and logging posture behind current routing activity."
              title="Access Context"
            >
              <MetaCluster items={accessItems()} />
            </Panel>
          </div>
        </Show>
      </div>
    </Layout>
  );
};

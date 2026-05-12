import RefreshCw from 'lucide-solid/icons/refresh-cw';
import { Show, createEffect, createMemo, createResource, createSignal, onCleanup, type Component } from 'solid-js';
import { api } from '../api/client';
import { Layout } from '../components/Layout';
import { formatDurationMs } from '../ui/lib/format';
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
  Switch,
  TimeSeriesChart,
} from '../ui';

const dayOptions = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

const palette = ['#2357d8', '#1f7a45', '#c05621', '#8b5cf6', '#0f766e', '#b42318'];
const formatInteger = new Intl.NumberFormat('en-US');

type DashboardChartRow = { date: string } & Record<string, string | number | null>;

export const Dashboard: Component = () => {
  const [days, setDays] = createSignal('30');
  const [hiddenTrafficSeries, setHiddenTrafficSeries] = createSignal<Set<string>>(new Set());
  const [hiddenLatencySeries, setHiddenLatencySeries] = createSignal<Set<string>>(new Set());
  const [hiddenModelSeries, setHiddenModelSeries] = createSignal<Set<string>>(new Set());
  const [isAutoRefresh, setIsAutoRefresh] = createSignal(false);
  const [refreshInterval, setRefreshInterval] = createSignal('10');
  const [refreshKey, setRefreshKey] = createSignal(0);
  const [trafficVolumeScale, setTrafficVolumeScale] = createSignal<'linear' | 'log'>('linear');

  const windowDays = createMemo(() => Number(days()));
  const summarySource = createMemo(() => ({ days: windowDays(), key: refreshKey() }));
  const [summary] = createResource(summarySource, (value) => api.dashboard.getSummary(value.days));
  const [backends] = createResource(() => api.backends.getAll());
  const currentSummary = createMemo(() => summary.latest ?? summary());

  createEffect(() => {
    if (!isAutoRefresh()) return;
    const ms = Number(refreshInterval()) * 1000;
    const id = setInterval(() => setRefreshKey((k) => k + 1), ms);
    onCleanup(() => clearInterval(id));
  });

  const backendNameById = createMemo(() => {
    const entries = new Map<number, string>();
    for (const backend of backends() ?? []) {
      entries.set(backend.id, backend.name);
    }
    return entries;
  });

  const trafficRows = createMemo(() =>
    (currentSummary()?.series.daily_totals ?? []).map((row) => ({
      date: row.date,
      requests: row.total_requests,
      tokens: row.total_tokens,
    }))
  );

  const reliabilityRows = createMemo(() => {
    const grouped = new Map<string, { requests: number; errors: number }>();
    for (const row of currentSummary()?.series.backend_quality ?? []) {
      const entry = grouped.get(row.date) ?? { requests: 0, errors: 0 };
      entry.requests += row.total_requests;
      entry.errors += row.error_count;
      grouped.set(row.date, entry);
    }

    return Array.from(grouped.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([date, value]) => ({
        date,
        lineValue: value.requests === 0 ? 0 : ((value.requests - value.errors) / value.requests) * 100,
        barValue: value.errors,
      }));
  });

  const latencyRows = createMemo(() => {
    const grouped = new Map<string, DashboardChartRow>();
    for (const row of currentSummary()?.series.backend_quality ?? []) {
      const entry: DashboardChartRow = grouped.get(row.date) ?? { date: row.date };
      entry[`backend_${row.backend_id}`] = row.avg_response_time_ms;
      grouped.set(row.date, entry);
    }
    return Array.from(grouped.values()).sort((left, right) => left.date.localeCompare(right.date));
  });

  const latencySeries = createMemo(() => {
    const ids = Array.from(new Set((currentSummary()?.series.backend_quality ?? []).map((row) => row.backend_id))).sort((left, right) => left - right);
    return ids.map((backendId, index) => ({
      key: `backend_${backendId}`,
      label: backendNameById().get(backendId) ?? `Backend ${backendId}`,
      color: palette[index % palette.length],
    }));
  });

  const modelRows = createMemo(() => {
    const grouped = new Map<string, DashboardChartRow>();
    for (const row of currentSummary()?.series.model_trends ?? []) {
      const entry: DashboardChartRow = grouped.get(row.date) ?? { date: row.date };
      entry[`model_${row.model}`] = row.request_count;
      grouped.set(row.date, entry);
    }
    return Array.from(grouped.values()).sort((left, right) => left.date.localeCompare(right.date));
  });

  const modelSeries = createMemo(() => {
    const models = Array.from(new Set((currentSummary()?.series.model_trends ?? []).map((row) => row.model)));
    return models.map((model, index) => ({
      key: `model_${model}`,
      label: model,
      color: palette[index % palette.length],
    }));
  });

  const summaryItems = createMemo(() => {
    const payload = currentSummary();
    const latestTraffic = payload?.series.daily_totals[payload.series.daily_totals.length - 1];

    return [
      { label: 'Active Users', value: payload?.overview.active_users ?? 0, hint: `${payload?.overview.total_users ?? 0} total identities` },
      { label: 'Active Backends', value: payload?.overview.active_backends ?? 0, hint: `${payload?.overview.total_backends ?? 0} configured upstreams` },
      { label: 'Live Scripts', value: payload?.overview.active_scripts ?? 0, hint: `${payload?.overview.total_scripts ?? 0} total middleware rules` },
      { label: 'Latest Volume', value: latestTraffic ? formatInteger.format(latestTraffic.total_requests) : '0', hint: latestTraffic ? `${latestTraffic.date} request count` : 'No traffic in window' },
    ];
  });

  const cacheStateItems = createMemo(() => {
    const counts = currentSummary()?.health.cache_state_counts;
    if (!counts) return [];
    return [
      { key: 'Ready', value: String(counts.ready) },
      { key: 'Uninitialized', value: String(counts.uninitialized) },
      { key: 'Error', value: String(counts.error) },
      { key: 'Inactive', value: String(counts.inactive) },
    ];
  });

  const scriptItems = createMemo(() => {
    const payload = currentSummary();
    if (!payload) return [];

    return [
      { key: 'Per User', value: `${payload.scripts.active_by_type['per-user']} active / ${payload.scripts.total_by_type['per-user']} total` },
      { key: 'Per Backend', value: `${payload.scripts.active_by_type['per-backend']} active / ${payload.scripts.total_by_type['per-backend']} total` },
      { key: 'Scoped', value: `${payload.scripts.active_by_type['per-user-backend']} active / ${payload.scripts.total_by_type['per-user-backend']} total` },
    ];
  });

  const accessItems = createMemo(() => {
    const payload = currentSummary();
    if (!payload) return [];

    return [
      { key: 'Assignments', value: formatInteger.format(payload.access.permission_assignments) },
      { key: 'No Backend Access', value: String(payload.access.users_without_permissions) },
      { key: 'User Detail Logs', value: String(payload.logging.users_with_detail_logging) },
      { key: 'Backend Detail Logs', value: String(payload.logging.backends_with_detail_logging) },
    ];
  });

  const toggleHiddenKey = (
    setter: (value: Set<string> | ((current: Set<string>) => Set<string>)) => void,
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
          title="Dashboard"
          description="Operations cockpit for router health, traffic shape, and the configuration context behind current behavior."
        />

        <CommandBar class="analytics__filters">
          <CommandBarGroup>
            <Select label="Window" value={days()} options={dayOptions} onChange={setDays} />
          </CommandBarGroup>
          <CommandBarGroup>
            <Switch
              label="Auto refresh"
              checked={isAutoRefresh()}
              onChange={setIsAutoRefresh}
            />
            <Select
              label="Refresh Interval"
              value={refreshInterval()}
              options={[
                { value: '5', label: 'Every 5s' },
                { value: '10', label: 'Every 10s' },
                { value: '30', label: 'Every 30s' },
                { value: '60', label: 'Every 60s' },
                { value: '600', label: 'Every 10m' },
              ]}
              onChange={setRefreshInterval}
            />
            <div class="ui-divider--vertical" />
            <button
              class="ui-button dashboard__refresh-button"
              classList={{ 'ui-button--loading': summary.loading }}
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              disabled={summary.loading}
              aria-busy={summary.loading}
            >
              <RefreshCw />
              {summary.loading ? 'Refreshing' : 'Refresh'}
            </button>
          </CommandBarGroup>
        </CommandBar>

        <SummaryStrip items={summaryItems()} />

        <Show when={!summary.error} fallback={<Panel title="Dashboard unavailable" description={summary.error instanceof Error ? summary.error.message : 'Failed to load dashboard summary.'}><EmptyState title="Failed to load summary" description="Refresh the page or verify the admin API is available." /></Panel>}>
          <div class="ui-section-grid">
            <Panel
              title="Traffic Volume"
              description="Daily request and token totals for the selected window."
              actions={
                <div style="display: flex; align-items: center; gap: 16px;">
                  <ChartLegend
                    items={[
                      { key: 'requests', label: 'Requests', color: '#2357d8' },
                      { key: 'tokens', label: 'Tokens', color: '#1f7a45' },
                    ]}
                    mutedKeys={hiddenTrafficSeries()}
                    onToggle={(key) => toggleHiddenKey(setHiddenTrafficSeries, key)}
                  />
                  <Select
                    label="Scale"
                    value={trafficVolumeScale()}
                    options={[
                      { value: 'linear', label: 'Linear' },
                      { value: 'log', label: 'Log' },
                    ]}
                    onChange={setTrafficVolumeScale}
                  />
                </div>
              }
            >
              <TimeSeriesChart
                data={trafficRows()}
                series={[
                  { key: 'requests', label: 'Requests', color: '#2357d8' },
                  { key: 'tokens', label: 'Tokens', color: '#1f7a45', axis: 'right' },
                ]}
                showLegend={false}
                hiddenKeys={hiddenTrafficSeries()}
                onToggleLegend={(key) => toggleHiddenKey(setHiddenTrafficSeries, key)}
                yLeftLabel="Requests"
                yRightLabel="Tokens"
                formatLeftValue={(value) => formatInteger.format(Math.round(value))}
                formatRightValue={(value) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}
                tooltipTitle="Traffic volume"
                yScaleType={trafficVolumeScale()}
              />
            </Panel>

            <Panel
              title="Reliability Snapshot"
              description="Success rate and absolute error count across all visible traffic."
              actions={<ChartLegend items={[{ key: 'line', label: 'Success Rate', color: '#2357d8' }, { key: 'bar', label: 'Errors', color: '#b42318' }]} />}
            >
              <ComboChart
                data={reliabilityRows()}
                lineLabel="Success Rate"
                barLabel="Errors"
                lineColor="#2357d8"
                barColor="#b42318"
                showLegend={false}
              />
            </Panel>
          </div>

          <div class="ui-section-grid">
            <Panel
              title="Backend Latency"
              description="Average response time by backend with per-series toggles."
              actions={<ChartLegend items={latencySeries()} mutedKeys={hiddenLatencySeries()} onToggle={(key) => toggleHiddenKey(setHiddenLatencySeries, key)} />}
            >
              <TimeSeriesChart
                data={latencyRows()}
                series={latencySeries()}
                showLegend={false}
                hiddenKeys={hiddenLatencySeries()}
                onToggleLegend={(key) => toggleHiddenKey(setHiddenLatencySeries, key)}
                yLeftLabel="Latency"
                formatLeftValue={formatDurationMs}
                tooltipTitle="Backend latency"
              />
            </Panel>

            <Panel
              title="Model Activity"
              description="Top models by request volume across the current window."
              actions={<ChartLegend items={modelSeries()} mutedKeys={hiddenModelSeries()} onToggle={(key) => toggleHiddenKey(setHiddenModelSeries, key)} />}
            >
              <TimeSeriesChart
                data={modelRows()}
                series={modelSeries()}
                showLegend={false}
                hiddenKeys={hiddenModelSeries()}
                onToggleLegend={(key) => toggleHiddenKey(setHiddenModelSeries, key)}
                yLeftLabel="Requests"
                formatLeftValue={(value) => `${Math.round(value)}`}
                tooltipTitle="Model activity"
              />
            </Panel>
          </div>

          <div class="ui-section-grid dashboard__context-grid">
            <Panel title="Backend Health" description="Cache readiness, liveness, and sync drift indicators for current backends.">
              <MetaCluster items={cacheStateItems()} />
              <Show
                when={(currentSummary()?.health.stale_backends.length ?? 0) > 0}
                fallback={<EmptyState title="No stale backend syncs" description="All active backends synced within the freshness window." />}
              >
                <div class="dashboard__status-list">
                  {currentSummary()?.health.stale_backends.map((backend) => (
                    <div class="dashboard__status-item">
                      <div>
                        <strong>{backend.name}</strong>
                        <p>Last sync: {backend.last_synced_at ? new Date(backend.last_synced_at).toLocaleString() : 'Never'}</p>
                      </div>
                      <span>{backend.state}</span>
                    </div>
                  ))}
                </div>
              </Show>
            </Panel>

            <Panel title="Script Runtime" description="Active middleware footprint and target distribution.">
              <MetaCluster items={scriptItems()} />
              <div class="dashboard__note">
                Active scripts shape request and response behavior before traffic reaches the upstream backend.
              </div>
            </Panel>

            <Panel title="Access Context" description="Identity and logging posture behind current routing activity.">
              <MetaCluster items={accessItems()} />
            </Panel>
          </div>
        </Show>
      </div>
    </Layout>
  );
};

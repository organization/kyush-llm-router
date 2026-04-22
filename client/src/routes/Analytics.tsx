import { Show, createMemo, createResource, createSignal, type Component } from 'solid-js';
import { api } from '../api/client';
import { Layout } from '../components/Layout';
import { formatDurationMs } from '../ui/lib/format';
import {
  BoxPlotChart,
  ChartLegend,
  ComboChart,
  CommandBar,
  CommandBarGroup,
  HistogramChart,
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

const palette = ['#2357d8', '#1f7a45', '#c05621', '#8b5cf6', '#0f766e', '#b42318', '#7c3aed', '#0b7285'];
type AnalyticsChartRow = { date: string } & Record<string, string | number | null>;
const formatInteger = new Intl.NumberFormat('en-US');

export const Analytics: Component = () => {
  const [days, setDays] = createSignal('30');
  const [backendFilter, setBackendFilter] = createSignal('all');
  const [hiddenDailySeries, setHiddenDailySeries] = createSignal<Set<string>>(new Set());
  const [hiddenResponseSeries, setHiddenResponseSeries] = createSignal<Set<string>>(new Set());
  const [hiddenModelSeries, setHiddenModelSeries] = createSignal<Set<string>>(new Set());

  const filters = createMemo(() => ({
    days: Number(days()),
    backendId: backendFilter() === 'all' ? undefined : Number(backendFilter()),
  }));

  const [backends] = createResource(() => api.backends.getAll());
  const [dailyTotals] = createResource(filters, (params) => api.analytics.getDailyTotals(params.backendId, params.days));
  const [backendQuality] = createResource(filters, (params) => api.analytics.getBackendQuality(params.backendId, params.days));
  const [modelTrends] = createResource(filters, (params) => api.analytics.getModelTrends({ backendId: params.backendId, days: params.days, limit: 8 }));
  const [histogram] = createResource(filters, (params) => api.analytics.getResponseLengthHistogram({ backendId: params.backendId, days: params.days, bins: 20 }));
  const [boxPlot] = createResource(filters, (params) => api.analytics.getResponseLengthBoxPlot(params.backendId, params.days));

  const backendOptions = createMemo(() => [
    { value: 'all', label: 'All Backends' },
    ...((backends() ?? []).map((backend) => ({
      value: String(backend.id),
      label: backend.name,
    }))),
  ]);

  const backendNameById = createMemo(() => {
    const entries = new Map<number, string>();
    for (const backend of backends() ?? []) {
      entries.set(backend.id, backend.name);
    }
    return entries;
  });

  const dailyVolumeRows = createMemo(() =>
    (dailyTotals() ?? []).map((row) => ({
      date: row.date,
      requests: row.total_requests,
      tokens: row.total_tokens,
    }))
  );

  const responseTimeRows = createMemo(() => {
    const grouped = new Map<string, AnalyticsChartRow>();
    for (const row of backendQuality() ?? []) {
      const entry: AnalyticsChartRow = grouped.get(row.date) ?? { date: row.date };
      entry[`backend_${row.backend_id}`] = row.avg_response_time_ms;
      grouped.set(row.date, entry);
    }
    return Array.from(grouped.values()).sort((left, right) => left.date.localeCompare(right.date));
  });

  const responseTimeSeries = createMemo(() => {
    const ids = Array.from(new Set((backendQuality() ?? []).map((row) => row.backend_id))).sort((left, right) => left - right);
    return ids.map((backendId, index) => ({
      key: `backend_${backendId}`,
      label: backendNameById().get(backendId) ?? `Backend ${backendId}`,
      color: palette[index % palette.length],
    }));
  });

  const reliabilityRows = createMemo(() => {
    const grouped = new Map<string, { requests: number; errors: number }>();
    for (const row of backendQuality() ?? []) {
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

  const modelTrendRows = createMemo(() => {
    const grouped = new Map<string, AnalyticsChartRow>();
    for (const row of modelTrends() ?? []) {
      const entry: AnalyticsChartRow = grouped.get(row.date) ?? { date: row.date };
      entry[`model_${row.model}`] = row.request_count;
      grouped.set(row.date, entry);
    }
    return Array.from(grouped.values()).sort((left, right) => left.date.localeCompare(right.date));
  });

  const modelTrendSeries = createMemo(() => {
    const models = Array.from(new Set((modelTrends() ?? []).map((row) => row.model)));
    return models.map((model, index) => ({
      key: `model_${model}`,
      label: model,
      color: palette[index % palette.length],
    }));
  });

  const summaryItems = createMemo(() => {
    const totals = (dailyTotals() ?? []).reduce(
      (acc, row) => {
        acc.requests += row.total_requests;
        acc.tokens += row.total_tokens;
        return acc;
      },
      { requests: 0, tokens: 0 }
    );
    const qualityRows = backendQuality() ?? [];
    const avgLatency =
      qualityRows.length === 0 ? 0 : qualityRows.reduce((sum, row) => sum + row.avg_response_time_ms, 0) / qualityRows.length;
    const errorCount = qualityRows.reduce((sum, row) => sum + row.error_count, 0);

    return [
      { label: 'Requests', value: formatInteger.format(totals.requests), hint: `Last ${days()} days` },
      { label: 'Tokens', value: formatInteger.format(totals.tokens), hint: `Selected ${days()}-day window total` },
      { label: 'Avg Response', value: formatDurationMs(avgLatency), hint: 'Across visible backend series' },
      { label: 'Errors', value: formatInteger.format(errorCount), hint: 'Absolute backend error count' },
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
          title="Analytics"
          description="Operational analytics with D3-driven time series, reliability, and response-length distributions."
        />

        <CommandBar class="analytics__filters">
          <CommandBarGroup>
            <Select label="Window" value={days()} options={dayOptions} onChange={setDays} />
            <Select label="Backend" value={backendFilter()} options={backendOptions()} onChange={setBackendFilter} />
          </CommandBarGroup>
        </CommandBar>

        <SummaryStrip items={summaryItems()} />

        <div class="ui-section-grid">
          <Panel
            title="Daily Volume"
            description="Daily request and token totals on shared time axis."
            actions={
              <ChartLegend
                items={[
                  { key: 'requests', label: 'Requests', color: '#2357d8' },
                  { key: 'tokens', label: 'Tokens', color: '#1f7a45' },
                ]}
                mutedKeys={hiddenDailySeries()}
                onToggle={(key) => toggleHiddenKey(setHiddenDailySeries, key)}
              />
            }
          >
            <TimeSeriesChart
              data={dailyVolumeRows()}
              series={[
                { key: 'requests', label: 'Requests', color: '#2357d8' },
                { key: 'tokens', label: 'Tokens', color: '#1f7a45', axis: 'right' },
              ]}
              showLegend={false}
              hiddenKeys={hiddenDailySeries()}
              onToggleLegend={(key) => toggleHiddenKey(setHiddenDailySeries, key)}
              yLeftLabel="Requests"
              yRightLabel="Tokens"
              formatLeftValue={(value) => new Intl.NumberFormat('en-US').format(Math.round(value))}
              formatRightValue={(value) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}
              tooltipTitle="Daily request and token totals"
            />
          </Panel>

          <Panel
            title="Backend Reliability"
            description="Success rate and absolute error count per day."
            actions={
              <ChartLegend
                items={[
                  { key: 'line', label: 'Success Rate', color: '#2357d8' },
                  { key: 'bar', label: 'Errors', color: '#b42318' },
                ]}
              />
            }
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
            title="Backend Response Time"
            description="Average response time by backend with toggleable backend series."
            actions={
              <ChartLegend
                items={responseTimeSeries()}
                mutedKeys={hiddenResponseSeries()}
                onToggle={(key) => toggleHiddenKey(setHiddenResponseSeries, key)}
              />
            }
          >
            <TimeSeriesChart
              data={responseTimeRows()}
              series={responseTimeSeries()}
              showLegend={false}
              hiddenKeys={hiddenResponseSeries()}
              onToggleLegend={(key) => toggleHiddenKey(setHiddenResponseSeries, key)}
              yLeftLabel="Response time"
              formatLeftValue={formatDurationMs}
              tooltipTitle="Average backend response time"
            />
          </Panel>

          <Panel
            title="Model Request Trends"
            description="Top routed/response models by request volume over time."
            actions={
              <ChartLegend
                items={modelTrendSeries()}
                mutedKeys={hiddenModelSeries()}
                onToggle={(key) => toggleHiddenKey(setHiddenModelSeries, key)}
              />
            }
          >
            <TimeSeriesChart
              data={modelTrendRows()}
              series={modelTrendSeries()}
              showLegend={false}
              hiddenKeys={hiddenModelSeries()}
              onToggleLegend={(key) => toggleHiddenKey(setHiddenModelSeries, key)}
              yLeftLabel="Requests"
              formatLeftValue={(value) => `${Math.round(value)}`}
              tooltipTitle="Model request trend"
            />
          </Panel>
        </div>

        <div class="ui-section-grid analytics__grid--spread-wide">
          <Panel title="Response Length Distribution" description="Histogram of completion token lengths across the selected window.">
            <MetaCluster
              items={[
                { key: 'Metric', value: 'completion_tokens' },
                { key: 'Scale', value: 'Log' },
              ]}
            />
            <HistogramChart data={histogram() ?? []} />
          </Panel>

          <Panel title="Daily Response Length Spread" description="Completion token box plot by day using min / q1 / median / q3 / max summary.">
            <MetaCluster
              items={[
                { key: 'Scale', value: 'Log' },
                { key: 'Outliers', value: 'Hidden in this view' },
              ]}
            />
            <BoxPlotChart data={boxPlot() ?? []} />
          </Panel>
        </div>
      </div>
    </Layout>
  );
};

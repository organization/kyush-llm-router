import { createMemo, createResource, createSignal, Show, type Component } from 'solid-js';
import RefreshCcw from 'lucide-solid/icons/refresh-ccw';
import { api } from '../api/client';
import { Layout } from '../components/Layout';
import type { RequestLog } from '../types';
import { Button, CommandBar, CommandBarGroup, ConversationTimeline, DataGrid, EmptyState, MetaCluster, PageHeader, Panel, Select, StatusBadge, SummaryStrip, Tabs, TextField, hasRenderableConversation } from '../ui';

interface FilterState {
  month: string;
  date: string;
  q: string;
  userId: string;
  backendId: string;
  endpoint: string;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const emptyFilters = (): FilterState => ({
  month: '',
  date: '',
  q: '',
  userId: '',
  backendId: '',
  endpoint: '',
});

function extractAssistantPreview(responseBody?: string): string {
  if (!responseBody) return '-';

  try {
    const parsed = JSON.parse(responseBody) as {
      choices?: Array<{
        message?: {
          content?: unknown;
        };
      }>;
    };
    const content = parsed.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return '-';

    const normalized = content
      .replace(/\r/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    if (!normalized) return '-';
    return normalized.length > 50 ? `${normalized.slice(0, 50)}...` : normalized;
  } catch {
    return '-';
  }
}

function prettyPrint(value?: string): string {
  if (!value) return '';

  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export const DetailLogs: Component = () => {
  const [filters, setFilters] = createSignal<FilterState>(emptyFilters());
  const [page, setPage] = createSignal(1);
  const [pageSize, setPageSize] = createSignal(25);
  const [selectedLogId, setSelectedLogId] = createSignal<number | null>(null);

  const [users] = createResource(() => api.users.getAll());
  const [backends] = createResource(() => api.backends.getAll());
  const [logs, { refetch }] = createResource(
    () => ({
      ...filters(),
      page: page(),
      pageSize: pageSize(),
    }),
    async (params) =>
      api.analytics.getRequests({
        limit: params.pageSize,
        offset: (params.page - 1) * params.pageSize,
        month: params.month || undefined,
        date: params.date || undefined,
        q: params.q || undefined,
        userId: params.userId ? Number(params.userId) : undefined,
        backendId: params.backendId ? Number(params.backendId) : undefined,
        endpoint: params.endpoint || undefined,
      })
  );

  const requestPage = createMemo(() => logs());
  const requestRows = createMemo(() => requestPage()?.rows ?? []);
  const totalRows = createMemo(() => requestPage()?.total ?? 0);
  const pageCount = createMemo(() => Math.max(1, Math.ceil(totalRows() / pageSize())));
  const rangeStart = createMemo(() => (totalRows() === 0 ? 0 : (page() - 1) * pageSize() + 1));
  const rangeEnd = createMemo(() => Math.min(totalRows(), page() * pageSize()));
  const assistantPreviewById = createMemo(() => {
    const previews = new Map<number, string>();
    for (const row of requestRows()) {
      previews.set(row.id, extractAssistantPreview(row.response_body));
    }
    return previews;
  });
  const selectedLog = createMemo<RequestLog | undefined>(() => requestRows().find((row) => row.id === selectedLogId()));
  const selectedLogHasConversation = createMemo(() =>
    selectedLog() ? hasRenderableConversation(selectedLog()!.request_body, selectedLog()!.response_body) : false
  );

  const userOptions = createMemo(() => [
    { value: '', label: 'All users' },
    ...((users() ?? []).map((user) => ({ value: String(user.id), label: `${user.id} - ${user.name}` }))),
  ]);

  const backendOptions = createMemo(() => [
    { value: '', label: 'All backends' },
    ...((backends() ?? []).map((backend) => ({ value: String(backend.id), label: `${backend.id} - ${backend.name}` }))),
  ]);

  const endpointOptions = [
    { value: '', label: 'All endpoints' },
    { value: '/v1/chat/completions', label: '/v1/chat/completions' },
  ];

  const resetFilters = () => {
    setFilters(emptyFilters());
    setPage(1);
  };

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  return (
    <Layout>
      <div class="ui-app-page">
        <PageHeader
          title="Detail Logs"
          description="Inspect verbose request logs with monthly filters, text search, and full request/response payload views."
          actions={<Button onClick={() => void refetch()}><RefreshCcw />Refresh</Button>}
        />

        <SummaryStrip
          items={[
            { label: 'Total Matches', value: totalRows(), hint: totalRows() > 0 ? `${rangeStart()}-${rangeEnd()} on page ${page()}` : `Page ${page()} of ${pageCount()}` },
            { label: 'Rows Loaded', value: requestRows().length, hint: `${pageSize()} per page` },
            { label: 'Verbose Rows', value: requestRows().filter((row) => row.detail_logged).length, hint: 'Current page' },
            { label: 'Selected Log', value: selectedLog()?.id ?? '-', hint: selectedLog() ? 'Focused inspector row' : 'No selection' },
          ]}
        />

        <CommandBar>
          <CommandBarGroup>
            <TextField
              label="Search"
              value={filters().q}
              placeholder="Search body, headers, models, errors"
              onInput={(event) => updateFilter('q', event.currentTarget.value)}
            />
            <TextField
              label="Month"
              value={filters().month}
              placeholder="YYYY-MM"
              onInput={(event) => updateFilter('month', event.currentTarget.value)}
            />
            <TextField
              label="Date"
              value={filters().date}
              placeholder="YYYY-MM-DD"
              onInput={(event) => updateFilter('date', event.currentTarget.value)}
            />
          </CommandBarGroup>
          <CommandBarGroup>
            <Select label="User" value={filters().userId} options={userOptions()} onChange={(value) => updateFilter('userId', value)} />
            <Select label="Backend" value={filters().backendId} options={backendOptions()} onChange={(value) => updateFilter('backendId', value)} />
            <Select label="Endpoint" value={filters().endpoint} options={endpointOptions} onChange={(value) => updateFilter('endpoint', value)} />
            <Button onClick={resetFilters}>Reset</Button>
          </CommandBarGroup>
        </CommandBar>

        <div class="ui-section-grid">
          <Panel title="Log Results" description="Monthly request log rows. Select one to inspect full payload snapshots.">
            <DataGrid
              tableLayout="fixed"
              rows={requestRows()}
              columns={[
                { id: 'id', header: 'ID', width: '48px', mono: true, cell: (row) => <span>{row.id}</span> },
                { id: 'created_at', header: 'UTC Time', width: '148px', cell: (row) => <span>{new Date(row.created_at).toLocaleString()}</span> },
                { id: 'user_id', header: 'User', width: '40px', mono: true, cell: (row) => <span>{row.user_id}</span> },
                { id: 'backend_id', header: 'Backend', width: '56px', mono: true, cell: (row) => <span>{row.backend_id}</span> },
                { id: 'request_model', header: 'Model', width: '120px', truncate: true, cell: (row) => <span title={row.request_model ?? '-'}>{row.request_model || '-'}</span> },
                {
                  id: 'assistant_preview',
                  header: 'Assistant',
                  class: 'detail-logs__assistant-column',
                  cell: (row) => {
                    const preview = assistantPreviewById().get(row.id) ?? '-';
                    return <span title={preview}>{preview}</span>;
                  },
                },
                {
                  id: 'status_code',
                  header: 'Status',
                  width: '48px',
                  cell: (row) => <StatusBadge tone={row.status_code >= 400 ? 'danger' : 'success'}>{String(row.status_code)}</StatusBadge>,
                },
                {
                  id: 'detail_logged',
                  header: 'Detail',
                  width: '68px',
                  cell: (row) => <StatusBadge tone={row.detail_logged ? 'warning' : 'neutral'}>{row.detail_logged ? 'Verbose' : 'Meta'}</StatusBadge>,
                },
              ]}
              getRowKey={(row) => row.id}
              loading={logs.loading}
              emptyMessage="No detailed logs matched the current filters."
              onRowClick={(row) => setSelectedLogId(row.id)}
              pagination={{
                page: page(),
                pageSize: pageSize(),
                total: totalRows(),
                onPageChange: (nextPage) => setPage(nextPage),
                onPageSizeChange: (nextPageSize) => {
                  setPageSize(nextPageSize);
                  setPage(1);
                },
                pageSizeOptions: PAGE_SIZE_OPTIONS,
              }}
            />
            {!logs.loading && requestRows().length === 0 && (
              <EmptyState title="No logs found" description="Try a different month, date, or search term." />
            )}
          </Panel>

          <Panel title="Selected Log" description="Expanded metadata and serialized request/response snapshots for the active row.">
            <Show
              when={selectedLog()}
              fallback={<EmptyState title="No log selected" description="Select a row from the log table to inspect the request and response snapshots." />}
            >
              {(log) => (
                <div class="ui-stack">
                  <MetaCluster
                    items={[
                      { key: 'ID', value: String(log().id) },
                      { key: 'Local Date', value: log().local_date },
                      { key: 'User', value: String(log().user_id) },
                      { key: 'Backend', value: String(log().backend_id) },
                      { key: 'Endpoint', value: log().endpoint },
                      { key: 'Status', value: String(log().status_code) },
                      { key: 'Latency', value: `${log().response_time_ms ?? 0}ms` },
                      { key: 'Verbose', value: log().detail_logged ? 'Yes' : 'No' },
                    ]}
                  />

                  <Show when={log().error_message}>
                    <TextField label="Error" value={log().error_message ?? ''} multiline />
                  </Show>

                  <Tabs.Root defaultValue={selectedLogHasConversation() ? 'conversation' : 'request'}>
                    <Tabs.List aria-label="Detail log inspector">
                      <Show when={selectedLogHasConversation()}>
                        <Tabs.Trigger value="conversation">Conversation</Tabs.Trigger>
                      </Show>
                      <Tabs.Trigger value="request">Request</Tabs.Trigger>
                      <Tabs.Trigger value="response">Response</Tabs.Trigger>
                      <Tabs.Trigger value="raw">Raw</Tabs.Trigger>
                    </Tabs.List>

                    <Show when={selectedLogHasConversation()}>
                      <Tabs.Content value="conversation">
                        <ConversationTimeline
                          requestBody={log().request_body}
                          responseBody={log().response_body}
                        />
                      </Tabs.Content>
                    </Show>

                    <Tabs.Content value="request">
                      <div class="ui-stack">
                        <TextField label="Request Headers" value={prettyPrint(log().request_headers)} multiline />
                        <TextField label="Request Body" value={prettyPrint(log().request_body)} multiline />
                      </div>
                    </Tabs.Content>

                    <Tabs.Content value="response">
                      <div class="ui-stack">
                        <TextField label="Response Headers" value={prettyPrint(log().response_headers)} multiline />
                        <TextField label="Response Body" value={prettyPrint(log().response_body)} multiline />
                      </div>
                    </Tabs.Content>

                    <Tabs.Content value="raw">
                      <div class="ui-stack">
                        <TextField
                          label="Raw Log JSON"
                          value={JSON.stringify(log(), null, 2)}
                          multiline
                        />
                      </div>
                    </Tabs.Content>
                  </Tabs.Root>
                </div>
              )}
            </Show>
          </Panel>
        </div>
      </div>
    </Layout>
  );
};

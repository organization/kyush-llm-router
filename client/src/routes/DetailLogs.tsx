import {
  createMemo,
  createResource,
  createSignal,
  Show,
  type Component,
} from 'solid-js';
import RefreshCcw from 'lucide-solid/icons/refresh-ccw';

import { api } from '../api/client';
import { Layout } from '../components/Layout';

import {
  Button,
  CommandBar,
  CommandBarGroup,
  ConversationTimeline,
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
  hasRenderableConversation,
} from '../ui';

import type { RequestLog } from '../types';

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

    const normalized = content.replace(/\r/g, '').replace(/\n+/g, ' ').trim();

    if (!normalized) return '-';
    return normalized.length > 50
      ? `${normalized.slice(0, 50)}...`
      : normalized;
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
      }),
  );

  const requestPage = createMemo(() => logs());
  const requestRows = createMemo(() => requestPage()?.rows ?? []);
  const totalRows = createMemo(() => requestPage()?.total ?? 0);
  const pageCount = createMemo(() =>
    Math.max(1, Math.ceil(totalRows() / pageSize())),
  );
  const rangeStart = createMemo(() =>
    totalRows() === 0 ? 0 : (page() - 1) * pageSize() + 1,
  );
  const rangeEnd = createMemo(() => Math.min(totalRows(), page() * pageSize()));
  const sourceScope = createMemo(() => {
    const currentFilters = filters();
    if (currentFilters.date.trim()) {
      return {
        value: currentFilters.date.trim(),
        hint: 'Single day request log database',
      };
    }

    if (currentFilters.month.trim()) {
      return {
        value: currentFilters.month.trim(),
        hint: 'Specific month request log database',
      };
    }

    return {
      value: 'Latest months',
      hint: 'Sequential monthly fallback search',
    };
  });
  const activeFilterCount = createMemo(() => {
    const currentFilters = filters();
    return [
      currentFilters.q,
      currentFilters.userId,
      currentFilters.backendId,
      currentFilters.endpoint,
    ].filter((value) => value.trim().length > 0).length;
  });
  const activeFilterHint = createMemo(() => {
    const currentFilters = filters();
    const labels = [
      currentFilters.q.trim() ? 'Search' : null,
      currentFilters.userId.trim() ? 'User' : null,
      currentFilters.backendId.trim() ? 'Backend' : null,
      currentFilters.endpoint.trim() ? 'Endpoint' : null,
    ].filter((value): value is string => Boolean(value));

    return labels.length > 0
      ? labels.join(' + ')
      : 'No search/user/backend/endpoint filters';
  });
  const pageWindow = createMemo(() => {
    if (totalRows() === 0) {
      return '0 of 0';
    }

    return `${rangeStart()}-${rangeEnd()} of ${totalRows()}`;
  });
  const assistantPreviewById = createMemo(() => {
    const previews = new Map<number, string>();
    for (const row of requestRows()) {
      previews.set(row.id, extractAssistantPreview(row.response_body));
    }
    return previews;
  });
  const selectedLog = createMemo<RequestLog | undefined>(() =>
    requestRows().find((row) => row.id === selectedLogId()),
  );
  const selectedLogHasConversation = createMemo(() =>
    selectedLog()
      ? hasRenderableConversation(
          selectedLog()!.request_body,
          selectedLog()!.response_body,
        )
      : false,
  );

  const userOptions = createMemo(() => [
    { value: '', label: 'All users' },
    ...(users() ?? []).map((user) => ({
      value: String(user.id),
      label: `${user.id} - ${user.name}`,
    })),
  ]);

  const backendOptions = createMemo(() => [
    { value: '', label: 'All backends' },
    ...(backends() ?? []).map((backend) => ({
      value: String(backend.id),
      label: `${backend.id} - ${backend.name}`,
    })),
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
          actions={
            <Button onClick={() => void refetch()}>
              <RefreshCcw />
              Refresh
            </Button>
          }
          description="Inspect verbose request logs with monthly filters, text search, and full request/response payload views."
          title="Detail Logs"
        />

        <SummaryStrip
          items={[
            {
              label: 'Source Scope',
              value: sourceScope().value,
              hint: sourceScope().hint,
            },
            {
              label: 'Active Filters',
              value: activeFilterCount(),
              hint: activeFilterHint(),
            },
            {
              label: 'Page Window',
              value: pageWindow(),
              hint: `Page ${page()} of ${pageCount()} - ${pageSize()} per page`,
            },
          ]}
        />

        <CommandBar>
          <CommandBarGroup>
            <TextField
              label="Search"
              onInput={(event) => updateFilter('q', event.currentTarget.value)}
              placeholder="Search body, headers, models, errors"
              value={filters().q}
            />
            <TextField
              label="Month"
              onInput={(event) =>
                updateFilter('month', event.currentTarget.value)
              }
              placeholder="YYYY-MM"
              value={filters().month}
            />
            <TextField
              label="Date"
              onInput={(event) =>
                updateFilter('date', event.currentTarget.value)
              }
              placeholder="YYYY-MM-DD"
              value={filters().date}
            />
          </CommandBarGroup>
          <CommandBarGroup>
            <Select
              label="User"
              onChange={(value) => updateFilter('userId', value)}
              options={userOptions()}
              value={filters().userId}
            />
            <Select
              label="Backend"
              onChange={(value) => updateFilter('backendId', value)}
              options={backendOptions()}
              value={filters().backendId}
            />
            <Select
              label="Endpoint"
              onChange={(value) => updateFilter('endpoint', value)}
              options={endpointOptions}
              value={filters().endpoint}
            />
            <Button onClick={resetFilters}>Reset</Button>
          </CommandBarGroup>
        </CommandBar>

        <div class="ui-section-grid">
          <Panel
            description="Monthly request log rows. Select one to inspect full payload snapshots."
            title="Log Results"
          >
            <DataGrid
              columns={[
                {
                  id: 'id',
                  header: 'ID',
                  width: '48px',
                  mono: true,
                  cell: (row) => <span>{row.id}</span>,
                },
                {
                  id: 'created_at',
                  header: 'UTC Time',
                  width: '148px',
                  cell: (row) => (
                    <span>{new Date(row.created_at).toLocaleString()}</span>
                  ),
                },
                {
                  id: 'user_id',
                  header: 'User',
                  width: '40px',
                  mono: true,
                  cell: (row) => <span>{row.user_id}</span>,
                },
                {
                  id: 'backend_id',
                  header: 'Backend',
                  width: '56px',
                  mono: true,
                  cell: (row) => <span>{row.backend_id}</span>,
                },
                {
                  id: 'request_model',
                  header: 'Model',
                  width: '120px',
                  truncate: true,
                  cell: (row) => (
                    <span title={row.request_model ?? '-'}>
                      {row.request_model || '-'}
                    </span>
                  ),
                },
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
                  cell: (row) => (
                    <StatusBadge
                      tone={row.status_code >= 400 ? 'danger' : 'success'}
                    >
                      {String(row.status_code)}
                    </StatusBadge>
                  ),
                },
                {
                  id: 'detail_logged',
                  header: 'Detail',
                  width: '68px',
                  cell: (row) => (
                    <StatusBadge
                      tone={row.detail_logged ? 'warning' : 'neutral'}
                    >
                      {row.detail_logged ? 'Verbose' : 'Meta'}
                    </StatusBadge>
                  ),
                },
              ]}
              emptyMessage="No detailed logs matched the current filters."
              getRowKey={(row) => row.id}
              loading={logs.loading}
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
              rows={requestRows()}
              tableLayout="fixed"
            />
            {!logs.loading && requestRows().length === 0 && (
              <EmptyState
                description="Try a different month, date, or search term."
                title="No logs found"
              />
            )}
          </Panel>

          <Panel
            description="Expanded metadata and serialized request/response snapshots for the active row."
            title="Selected Log"
          >
            <Show
              fallback={
                <EmptyState
                  description="Select a row from the log table to inspect the request and response snapshots."
                  title="No log selected"
                />
              }
              when={selectedLog()}
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
                      {
                        key: 'Latency',
                        value: `${log().response_time_ms ?? 0}ms`,
                      },
                      {
                        key: 'Verbose',
                        value: log().detail_logged ? 'Yes' : 'No',
                      },
                    ]}
                  />

                  <Show when={log().error_message}>
                    <TextField
                      label="Error"
                      multiline
                      value={log().error_message ?? ''}
                    />
                  </Show>

                  <Tabs.Root
                    defaultValue={
                      selectedLogHasConversation() ? 'conversation' : 'request'
                    }
                  >
                    <Tabs.List aria-label="Detail log inspector">
                      <Show when={selectedLogHasConversation()}>
                        <Tabs.Trigger value="conversation">
                          Conversation
                        </Tabs.Trigger>
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
                        <TextField
                          label="Request Headers"
                          multiline
                          value={prettyPrint(log().request_headers)}
                        />
                        <TextField
                          label="Request Body"
                          multiline
                          value={prettyPrint(log().request_body)}
                        />
                      </div>
                    </Tabs.Content>

                    <Tabs.Content value="response">
                      <div class="ui-stack">
                        <TextField
                          label="Response Headers"
                          multiline
                          value={prettyPrint(log().response_headers)}
                        />
                        <TextField
                          label="Response Body"
                          multiline
                          value={prettyPrint(log().response_body)}
                        />
                      </div>
                    </Tabs.Content>

                    <Tabs.Content value="raw">
                      <div class="ui-stack">
                        <TextField
                          label="Raw Log JSON"
                          multiline
                          value={JSON.stringify(log(), null, 2)}
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

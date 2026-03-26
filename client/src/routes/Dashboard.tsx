import { createResource, createSignal, Show, type Component } from 'solid-js';
import { api } from '../api/client';
import { Layout } from '../components/Layout';
import { useAuth } from '../auth';
import { Alert, Button, DataGrid, EmptyState, PageHeader, Panel, StatusBadge, SummaryStrip, TextField } from '../ui';

export const Dashboard: Component = () => {
  const auth = useAuth();
  const [data, { refetch }] = createResource(async () => ({
    users: await api.users.getAll(),
    backends: await api.backends.getAll(),
    recentRequests: await api.analytics.getRequests({ limit: 10 }),
  }));
  const [tokens, { refetch: refetchTokens }] = createResource(() => api.auth.getTokens());
  const [tokenName, setTokenName] = createSignal('');
  const [lastIssuedToken, setLastIssuedToken] = createSignal<string | null>(null);
  const [tokenError, setTokenError] = createSignal<string | null>(null);

  const createToken = async () => {
    try {
      const response = await api.auth.createToken(tokenName().trim() || `${auth.session()?.principal?.displayName ?? 'admin'} token`);
      setLastIssuedToken(response.token);
      setTokenName('');
      setTokenError(null);
      await refetchTokens();
    } catch (error) {
      setTokenError(error instanceof Error ? error.message : 'Failed to create admin token.');
    }
  };

  const deleteToken = async (tokenId: number) => {
    try {
      await api.auth.deleteToken(tokenId);
      await refetchTokens();
    } catch (error) {
      setTokenError(error instanceof Error ? error.message : 'Failed to revoke admin token.');
    }
  };

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
            { label: 'Recent Requests', value: data()?.recentRequests.rows.length ?? 0, hint: 'Latest traffic snapshot in this overview' },
          ]}
        />

        <Panel title="Recent Requests" description="Latest request activity across the router with status and model context.">
          <DataGrid
            rows={data()?.recentRequests.rows ?? []}
            columns={[
              { id: 'user_id', header: 'User', mono: true, cell: (request) => <span>{request.user_id}</span> },
              { id: 'backend_id', header: 'Backend', mono: true, cell: (request) => <span>{request.backend_id}</span> },
              { id: 'model', header: 'Model', truncate: true, cell: (request) => <span title={request.request_model ?? '-'}>{request.request_model || '-'}</span> },
              {
                id: 'status',
                header: 'Status',
                cell: (request) => <StatusBadge tone={request.status_code >= 400 ? 'danger' : 'success'}>{String(request.status_code)}</StatusBadge>,
              },
              {
                id: 'detail_logged',
                header: 'Detail',
                cell: (request) => <StatusBadge tone={request.detail_logged ? 'warning' : 'neutral'}>{request.detail_logged ? 'Verbose' : 'Meta'}</StatusBadge>,
              },
              { id: 'time', header: 'Time', cell: (request) => <span>{new Date(request.created_at).toLocaleString()}</span> },
            ]}
            getRowKey={(request) => request.id}
            loading={data.loading}
            emptyMessage="No recent requests yet."
          />
          {!data.loading && (data()?.recentRequests.rows.length ?? 0) === 0 && (
            <EmptyState title="No requests yet" description="Traffic will appear here once authenticated users send requests through the router." />
          )}
        </Panel>

        <Panel title="Admin API Tokens" description="Issue service tokens for automation without exposing the browser session.">
          <div class="ui-stack ui-stack--tight">
            <Show when={tokenError()}>
              {(message) => <Alert tone="danger">{message()}</Alert>}
            </Show>
            <Show when={lastIssuedToken()}>
              {(token) => <Alert tone="success">Copy this token now: {token()}</Alert>}
            </Show>
            <div class="ui-form">
              <TextField
                label="Token Name"
                value={tokenName()}
                placeholder="e.g. CI deploy automation"
                onInput={(event) => setTokenName(event.currentTarget.value)}
              />
              <Button onClick={() => void createToken()}>Create Admin Token</Button>
            </div>
            <DataGrid
              rows={tokens() ?? []}
              columns={[
                { id: 'name', header: 'Name', cell: (token) => <span>{token.name}</span> },
                { id: 'provider', header: 'Provider', cell: (token) => <StatusBadge tone="neutral">{token.provider}</StatusBadge> },
                { id: 'prefix', header: 'Prefix', mono: true, cell: (token) => <span>{token.token_prefix}</span> },
                { id: 'expires_at', header: 'Expires', cell: (token) => <span>{new Date(token.expires_at).toLocaleString()}</span> },
                { id: 'last_used_at', header: 'Last Used', cell: (token) => <span>{token.last_used_at ? new Date(token.last_used_at).toLocaleString() : '-'}</span> },
              ]}
              getRowKey={(token) => token.id}
              loading={tokens.loading}
              emptyMessage="No admin tokens issued yet."
              rowActions={(token) => (
                <Button variant="danger" onClick={() => void deleteToken(token.id)}>
                  Revoke
                </Button>
              )}
            />
          </div>
        </Panel>
      </div>
    </Layout>
  );
};

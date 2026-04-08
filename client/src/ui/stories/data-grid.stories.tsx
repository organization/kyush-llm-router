import { createSignal } from 'solid-js';

import {
  Button,
  CommandBar,
  CommandBarGroup,
  CommandBarHint,
  DataGrid,
  StatusBadge,
  type DataGridColumn,
} from '../index';

type GridRow = {
  id: number;
  name: string;
  backend: string;
  apiKey: string;
  status: 'Active' | 'Inactive';
  updatedAt: string;
};

const rows: GridRow[] = Array.from({ length: 120 }, (_, index) => ({
  id: index + 1,
  name: `ops-user-${String(index + 1).padStart(3, '0')}`,
  backend: index % 2 === 0 ? 'OpenAI Primary' : 'Anthropic Failover',
  apiKey: `sk-router-${String(index + 1).padStart(3, '0')}-abcdefghijklmnopqrstuvwx`,
  status: index % 3 === 0 ? 'Inactive' : 'Active',
  updatedAt: `2026-03-${String((index % 28) + 1).padStart(2, '0')} 12:${String(index % 60).padStart(2, '0')}`,
}));

const columns: DataGridColumn<GridRow>[] = [
  {
    id: 'id',
    header: 'ID',
    width: '72px',
    mono: true,
    cell: (row) => row.id,
  },
  {
    id: 'name',
    header: 'Name',
    cell: (row) => row.name,
  },
  {
    id: 'backend',
    header: 'Backend',
    cell: (row) => row.backend,
  },
  {
    id: 'apiKey',
    header: 'API Key',
    truncate: true,
    mono: true,
    cell: (row) => row.apiKey,
  },
  {
    id: 'status',
    header: 'Status',
    cell: (row) => (
      <StatusBadge tone={row.status === 'Active' ? 'success' : 'danger'}>
        {row.status}
      </StatusBadge>
    ),
  },
  {
    id: 'updatedAt',
    header: 'Updated',
    mono: true,
    cell: (row) => row.updatedAt,
  },
];

export default {
  title: 'UI/Patterns/DataGrid',
  tags: ['autodocs'],
};

export const Paged = {
  render: () => {
    const [page, setPage] = createSignal(1);
    const [pageSize, setPageSize] = createSignal(10);
    const [selectedKeys, setSelectedKeys] = createSignal(
      new Set<string | number>([1, 3]),
    );

    const pagedRows = () => {
      const start = (page() - 1) * pageSize();
      return rows.slice(start, start + pageSize());
    };

    return (
      <div class="ui-workbench ui-stack">
        <div>
          <h1 class="ui-title">DataGrid</h1>
          <p class="ui-subtitle">
            Pagination-first dense table for users, backends, analytics, and
            scripts.
          </p>
        </div>

        <CommandBar>
          <CommandBarGroup>
            <Button variant="primary">Add User</Button>
            <Button>Refresh</Button>
          </CommandBarGroup>
          <CommandBarGroup>
            <CommandBarHint>
              Search <span class="ui-kbd">/</span>
            </CommandBarHint>
          </CommandBarGroup>
        </CommandBar>

        <DataGrid
          columns={columns}
          getRowKey={(row) => row.id}
          onToggleRowSelection={(row, nextSelected) => {
            const next = new Set(selectedKeys());
            if (nextSelected) next.add(row.id);
            else next.delete(row.id);
            setSelectedKeys(next);
          }}
          pagination={{
            page: page(),
            pageSize: pageSize(),
            total: rows.length,
            onPageChange: setPage,
            onPageSizeChange: (nextSize) => {
              setPage(1);
              setPageSize(nextSize);
            },
            pageSizeOptions: [10, 20, 50],
          }}
          rowActions={(row) => (
            <div class="ui-cluster">
              <Button>Edit</Button>
              <Button variant="danger">Disable</Button>
            </div>
          )}
          rows={pagedRows()}
          selectedKeys={selectedKeys()}
          stickyHeader
        />
      </div>
    );
  },
};

export const States = {
  render: () => (
    <div class="ui-workbench ui-stack">
      <div class="ui-stack">
        <h1 class="ui-title">Grid States</h1>
        <DataGrid
          columns={columns}
          emptyMessage="No data."
          getRowKey={(row) => row.id}
          loading
          rows={[]}
        />
        <DataGrid
          columns={columns}
          error="Failed to fetch rows from analytics database."
          getRowKey={(row) => row.id}
          rows={[]}
        />
        <DataGrid
          columns={columns}
          emptyMessage="No matching rows for this filter set."
          getRowKey={(row) => row.id}
          rows={[]}
        />
      </div>
    </div>
  ),
};

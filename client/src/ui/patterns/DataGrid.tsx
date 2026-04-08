import { For, Match, Show, Switch } from 'solid-js';

import { cn } from '../lib/cn';

import type { JSX } from 'solid-js';

export type DataMode = 'paged' | 'infinite';
export type DataDensity = 'dense' | 'regular';

export interface DataGridColumn<T> {
  id: string;
  header: string;
  class?: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  truncate?: boolean;
  mono?: boolean;
  cell: (row: T) => JSX.Element;
}

export interface DataGridPagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export interface DataGridProps<T> {
  rows: T[];
  columns: DataGridColumn<T>[];
  getRowKey: (row: T) => string | number;
  mode?: DataMode;
  density?: DataDensity;
  tableLayout?: 'auto' | 'fixed';
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  stickyHeader?: boolean;
  pagination?: DataGridPagination;
  rowActions?: (row: T) => JSX.Element;
  renderExpanded?: (row: T) => JSX.Element;
  onRowClick?: (row: T) => void;
  selectedKeys?: Set<string | number>;
  onToggleRowSelection?: (row: T, nextSelected: boolean) => void;
}

type PaginationToken = number | 'ellipsis';

function buildPaginationTokens(
  currentPage: number,
  totalPages: number,
): PaginationToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage]);
  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    if (page > 1 && page < totalPages) {
      pages.add(page);
    }
  }

  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }

  if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }

  const sortedPages = Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);

  const tokens: PaginationToken[] = [];
  for (const page of sortedPages) {
    const previous = tokens[tokens.length - 1];
    if (typeof previous === 'number' && page - previous > 1) {
      tokens.push('ellipsis');
    }
    tokens.push(page);
  }

  return tokens;
}

export function DataGrid<T>(props: DataGridProps<T>) {
  const pageCount = () => {
    if (!props.pagination) return 1;
    return Math.max(
      1,
      Math.ceil(props.pagination.total / props.pagination.pageSize),
    );
  };
  const paginationTokens = () => {
    if (!props.pagination) return [] as PaginationToken[];
    return buildPaginationTokens(props.pagination.page, pageCount());
  };

  return (
    <div
      class={cn(
        'ui-data-grid',
        props.density === 'regular' && 'ui-data-grid--regular',
      )}
    >
      <div class="ui-data-grid__shell">
        <table
          class="ui-data-grid__table"
          style={{ 'table-layout': props.tableLayout ?? 'auto' }}
        >
          <thead>
            <tr>
              <Show when={props.onToggleRowSelection}>
                <th style={{ width: '36px' }}>Sel</th>
              </Show>
              <For each={props.columns}>
                {(column) => (
                  <th
                    class={column.class}
                    style={{
                      'width': column.width,
                      'text-align': column.align ?? 'left',
                      'position':
                        props.stickyHeader === false ? 'static' : 'sticky',
                    }}
                  >
                    {column.header}
                  </th>
                )}
              </For>
              <Show when={props.rowActions}>
                <th style={{ width: '1%' }}>Actions</th>
              </Show>
            </tr>
          </thead>
          <tbody>
            <Switch>
              <Match when={props.loading}>
                <tr>
                  <td
                    class="ui-data-grid__status"
                    colSpan={
                      props.columns.length +
                      (props.rowActions ? 1 : 0) +
                      (props.onToggleRowSelection ? 1 : 0)
                    }
                  >
                    Loading rows...
                  </td>
                </tr>
              </Match>
              <Match when={props.error}>
                <tr>
                  <td
                    class="ui-data-grid__status"
                    colSpan={
                      props.columns.length +
                      (props.rowActions ? 1 : 0) +
                      (props.onToggleRowSelection ? 1 : 0)
                    }
                  >
                    {props.error}
                  </td>
                </tr>
              </Match>
              <Match when={props.rows.length === 0}>
                <tr>
                  <td
                    class="ui-data-grid__status"
                    colSpan={
                      props.columns.length +
                      (props.rowActions ? 1 : 0) +
                      (props.onToggleRowSelection ? 1 : 0)
                    }
                  >
                    {props.emptyMessage ?? 'No rows to display.'}
                  </td>
                </tr>
              </Match>
              <Match when={props.rows.length > 0}>
                <For each={props.rows}>
                  {(row) => {
                    const key = () => props.getRowKey(row);
                    const isSelected = () =>
                      props.selectedKeys?.has(key()) ?? false;

                    return (
                      <>
                        <tr
                          class={cn(
                            'ui-data-grid__row',
                            props.onRowClick && 'ui-data-grid__row--clickable',
                          )}
                          onClick={() => props.onRowClick?.(row)}
                        >
                          <Show when={props.onToggleRowSelection}>
                            <td>
                              <input
                                checked={isSelected()}
                                onChange={(event) =>
                                  props.onToggleRowSelection?.(
                                    row,
                                    event.currentTarget.checked,
                                  )
                                }
                                onClick={(event) => event.stopPropagation()}
                                type="checkbox"
                              />
                            </td>
                          </Show>
                          <For each={props.columns}>
                            {(column) => (
                              <td
                                class={cn(
                                  column.class,
                                  column.truncate && 'ui-data-grid__truncate',
                                  column.mono && 'ui-data-grid__cell--mono',
                                )}
                                style={{ 'text-align': column.align ?? 'left' }}
                                title={
                                  column.truncate
                                    ? String(props.getRowKey(row))
                                    : undefined
                                }
                              >
                                {column.cell(row)}
                              </td>
                            )}
                          </For>
                          <Show when={props.rowActions}>
                            <td>{props.rowActions?.(row)}</td>
                          </Show>
                        </tr>
                        <Show when={props.renderExpanded}>
                          <tr>
                            <td
                              colSpan={
                                props.columns.length +
                                (props.rowActions ? 1 : 0) +
                                (props.onToggleRowSelection ? 1 : 0)
                              }
                            >
                              {props.renderExpanded?.(row)}
                            </td>
                          </tr>
                        </Show>
                      </>
                    );
                  }}
                </For>
              </Match>
            </Switch>
          </tbody>
        </table>
      </div>

      <Show when={props.pagination && props.mode !== 'infinite'}>
        <div class="ui-pagination">
          <div class="ui-pagination__cluster">
            <span>
              Page {props.pagination!.page} / {pageCount()}
            </span>
            <span>
              {props.pagination!.total} rows, {props.pagination!.pageSize} per
              page
            </span>
          </div>
          <div class="ui-pagination__cluster">
            <Show
              when={
                props.pagination!.onPageSizeChange &&
                props.pagination!.pageSizeOptions?.length
              }
            >
              <label class="ui-cluster">
                <span>Page size</span>
                <select
                  class="ui-input"
                  onChange={(event) =>
                    props.pagination!.onPageSizeChange?.(
                      Number(event.currentTarget.value),
                    )
                  }
                  value={String(props.pagination!.pageSize)}
                >
                  <For each={props.pagination!.pageSizeOptions}>
                    {(option) => <option value={option}>{option}</option>}
                  </For>
                </select>
              </label>
            </Show>
            <button
              aria-label="Previous page"
              class="ui-pagination__button"
              disabled={props.pagination!.page <= 1}
              onClick={() =>
                props.pagination!.onPageChange(
                  Math.max(1, props.pagination!.page - 1),
                )
              }
            >
              &lt;
            </button>
            <For each={paginationTokens()}>
              {(token) =>
                token === 'ellipsis' ? (
                  <span aria-hidden="true" class="ui-pagination__ellipsis">
                    ...
                  </span>
                ) : (
                  <button
                    aria-current={
                      props.pagination!.page === token ? 'page' : undefined
                    }
                    class={cn(
                      'ui-pagination__button',
                      props.pagination!.page === token &&
                        'ui-pagination__button--active',
                    )}
                    onClick={() => props.pagination!.onPageChange(token)}
                  >
                    {token}
                  </button>
                )
              }
            </For>
            <button
              aria-label="Next page"
              class="ui-pagination__button"
              disabled={props.pagination!.page >= pageCount()}
              onClick={() =>
                props.pagination!.onPageChange(
                  Math.min(pageCount(), props.pagination!.page + 1),
                )
              }
            >
              &gt;
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}

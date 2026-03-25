import { For, Match, Show, Switch } from 'solid-js';
import type { JSX } from 'solid-js';
import { cn } from '../lib/cn';

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

export function DataGrid<T>(props: DataGridProps<T>) {
  const pageCount = () => {
    if (!props.pagination) return 1;
    return Math.max(1, Math.ceil(props.pagination.total / props.pagination.pageSize));
  };

  return (
    <div class={cn('ui-data-grid', props.density === 'regular' && 'ui-data-grid--regular')}>
      <div class="ui-data-grid__shell">
        <table class="ui-data-grid__table">
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
                      width: column.width,
                      'text-align': column.align ?? 'left',
                      position: props.stickyHeader === false ? 'static' : 'sticky',
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
                  <td class="ui-data-grid__status" colSpan={props.columns.length + (props.rowActions ? 1 : 0) + (props.onToggleRowSelection ? 1 : 0)}>
                    Loading rows...
                  </td>
                </tr>
              </Match>
              <Match when={props.error}>
                <tr>
                  <td class="ui-data-grid__status" colSpan={props.columns.length + (props.rowActions ? 1 : 0) + (props.onToggleRowSelection ? 1 : 0)}>
                    {props.error}
                  </td>
                </tr>
              </Match>
              <Match when={props.rows.length === 0}>
                <tr>
                  <td class="ui-data-grid__status" colSpan={props.columns.length + (props.rowActions ? 1 : 0) + (props.onToggleRowSelection ? 1 : 0)}>
                    {props.emptyMessage ?? 'No rows to display.'}
                  </td>
                </tr>
              </Match>
              <Match when={props.rows.length > 0}>
                <For each={props.rows}>
                  {(row) => {
                    const key = () => props.getRowKey(row);
                    const isSelected = () => props.selectedKeys?.has(key()) ?? false;

                    return (
                      <>
                        <tr
                          class={cn('ui-data-grid__row', props.onRowClick && 'ui-data-grid__row--clickable')}
                          onClick={() => props.onRowClick?.(row)}
                        >
                          <Show when={props.onToggleRowSelection}>
                            <td>
                              <input
                                type="checkbox"
                                checked={isSelected()}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => props.onToggleRowSelection?.(row, event.currentTarget.checked)}
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
                                title={column.truncate ? String(props.getRowKey(row)) : undefined}
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
                            <td colSpan={props.columns.length + (props.rowActions ? 1 : 0) + (props.onToggleRowSelection ? 1 : 0)}>
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
              {props.pagination!.total} rows, {props.pagination!.pageSize} per page
            </span>
          </div>
          <div class="ui-pagination__cluster">
            <Show when={props.pagination!.onPageSizeChange && props.pagination!.pageSizeOptions?.length}>
              <label class="ui-cluster">
                <span>Page size</span>
                <select
                  class="ui-input"
                  value={String(props.pagination!.pageSize)}
                  onChange={(event) => props.pagination!.onPageSizeChange?.(Number(event.currentTarget.value))}
                >
                  <For each={props.pagination!.pageSizeOptions}>
                    {(option) => <option value={option}>{option}</option>}
                  </For>
                </select>
              </label>
            </Show>
            <button
              class="ui-pagination__button"
              disabled={props.pagination!.page <= 1}
              onClick={() => props.pagination!.onPageChange(Math.max(1, props.pagination!.page - 1))}
            >
              Prev
            </button>
            <button
              class="ui-pagination__button"
              disabled={props.pagination!.page >= pageCount()}
              onClick={() => props.pagination!.onPageChange(Math.min(pageCount(), props.pagination!.page + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}

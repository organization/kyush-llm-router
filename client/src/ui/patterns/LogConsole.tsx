import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';

import { StatusBadge, type StatusTone } from './StatusBadge';

import { Button } from '../primitives/Button';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

export interface LogEntry {
  id: string | number;
  timestamp?: string;
  level?: LogLevel;
  message: string;
  context?: string;
}

interface LogConsoleProps {
  entries: LogEntry[];
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  follow?: boolean;
  wrapLines?: boolean;
  showTimestamp?: boolean;
  showLevel?: boolean;
  levelFilter?: LogLevel[];
  onLevelFilterChange?: (levels: LogLevel[]) => void;
  onCopyLine?: (entry: LogEntry) => void;
  onCopyAll?: () => void;
  onClear?: () => void;
}

const levelTones: Record<LogLevel, StatusTone> = {
  debug: 'neutral',
  info: 'info',
  warn: 'warning',
  error: 'danger',
  success: 'success',
};

const allLevels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'success'];

export function LogConsole(props: LogConsoleProps) {
  let surfaceRef: HTMLDivElement | undefined;
  const [internalLevels, setInternalLevels] = createSignal<LogLevel[]>(
    props.levelFilter ?? allLevels,
  );

  const activeLevels = createMemo(() => props.levelFilter ?? internalLevels());

  createEffect(() => {
    if (props.follow && surfaceRef) {
      surfaceRef.scrollTop = surfaceRef.scrollHeight;
    }
  });

  const visibleEntries = createMemo(() =>
    props.entries.filter(
      (entry) => !entry.level || activeLevels().includes(entry.level),
    ),
  );

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const toggleLevel = (level: LogLevel) => {
    const next = activeLevels().includes(level)
      ? activeLevels().filter((item) => item !== level)
      : [...activeLevels(), level];

    if (props.onLevelFilterChange) {
      props.onLevelFilterChange(next);
      return;
    }

    setInternalLevels(next);
  };

  return (
    <div class="ui-log-console">
      <div class="ui-log-console__toolbar">
        <div class="ui-cluster">
          <For each={allLevels}>
            {(level) => (
              <button
                class="ui-pagination__button"
                onClick={() => toggleLevel(level)}
              >
                <StatusBadge tone={levelTones[level]}>{level}</StatusBadge>
              </button>
            )}
          </For>
        </div>
        <div class="ui-cluster">
          <Show when={props.onClear}>
            <Button onClick={props.onClear}>Clear</Button>
          </Show>
          <Button
            onClick={async () => {
              props.onCopyAll?.();
              await copyText(
                visibleEntries()
                  .map((entry) => entry.message)
                  .join('\n'),
              );
            }}
          >
            Copy all
          </Button>
        </div>
      </div>

      <div class="ui-log-console__surface" ref={surfaceRef}>
        <Show when={props.loading}>
          <div>Loading logs...</div>
        </Show>
        <Show when={!props.loading && props.error}>
          <div>{props.error}</div>
        </Show>
        <Show
          when={!props.loading && !props.error && visibleEntries().length === 0}
        >
          <div>{props.emptyMessage ?? 'No log entries.'}</div>
        </Show>
        <For each={visibleEntries()}>
          {(entry, index) => (
            <div class="ui-log-console__line" tabindex={0}>
              <span class="ui-log-console__line-number">
                {String(index() + 1).padStart(3, '0')}
              </span>
              <Show when={props.showTimestamp !== false}>
                <span class="ui-log-console__timestamp">
                  {entry.timestamp ?? '--:--:--'}
                </span>
              </Show>
              <Show when={props.showLevel !== false}>
                <StatusBadge
                  tone={entry.level ? levelTones[entry.level] : 'neutral'}
                >
                  {entry.level ?? 'info'}
                </StatusBadge>
              </Show>
              <div
                class={
                  props.wrapLines === false
                    ? 'ui-log-console__message ui-log-console__message--nowrap'
                    : 'ui-log-console__message'
                }
              >
                <Show when={entry.context}>
                  <span style={{ color: 'var(--color-text-soft)' }}>
                    {entry.context}{' '}
                  </span>
                </Show>
                {entry.message}
              </div>
              <button
                class="ui-log-console__copy ui-log-console__copy-button"
                onClick={async () => {
                  props.onCopyLine?.(entry);
                  await copyText(entry.message);
                }}
              >
                Copy
              </button>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

import { createSignal } from 'solid-js';
import { Button, LogConsole, type LogEntry } from '../index';

const entries: LogEntry[] = [
  {
    id: 1,
    timestamp: '12:01:11',
    level: 'info',
    context: '[router]',
    message: 'Accepted request for user #14 and routed to OpenAI Primary.',
  },
  {
    id: 2,
    timestamp: '12:01:12',
    level: 'debug',
    context: '[script:onRequest]',
    message: 'Injected X-Custom-Header and normalized model alias.',
  },
  {
    id: 3,
    timestamp: '12:01:13',
    level: 'warn',
    context: '[analytics]',
    message: 'Response time exceeded 1200ms threshold for backend #2.',
  },
  {
    id: 4,
    timestamp: '12:01:14',
    level: 'error',
    context: '[backend]',
    message:
      'POST /v1/chat/completions returned 502 from upstream. body={"error":{"message":"gateway timeout","type":"upstream_error"}}',
  },
  {
    id: 5,
    timestamp: '12:01:15',
    level: 'success',
    context: '[script:test]',
    message: 'Sample script test completed without runtime errors.',
  },
];

export default {
  title: 'UI/Patterns/LogConsole',
  tags: ['autodocs'],
};

export const Default = {
  render: () => {
    const [follow, setFollow] = createSignal(true);
    const [wrapLines, setWrapLines] = createSignal(true);
    const [localEntries, setLocalEntries] = createSignal(entries);

    return (
      <div class="ui-workbench ui-stack">
        <div class="ui-cluster">
          <Button onClick={() => setFollow((value) => !value)}>{follow() ? 'Follow: on' : 'Follow: off'}</Button>
          <Button onClick={() => setWrapLines((value) => !value)}>{wrapLines() ? 'Wrap: on' : 'Wrap: off'}</Button>
          <Button
            onClick={() =>
              setLocalEntries((current) => [
                ...current,
                {
                  id: current.length + 1,
                  timestamp: '12:02:00',
                  level: 'info',
                  context: '[tail]',
                  message: `Appended log line ${current.length + 1} for follow-mode verification.`,
                },
              ])
            }
          >
            Append line
          </Button>
        </div>

        <LogConsole
          entries={localEntries()}
          follow={follow()}
          wrapLines={wrapLines()}
          emptyMessage="No logs yet."
          onClear={() => setLocalEntries([])}
        />
      </div>
    );
  },
};

export const States = {
  render: () => (
    <div class="ui-workbench ui-stack">
      <LogConsole entries={[]} loading />
      <LogConsole entries={[]} error="Failed to fetch script test logs." />
      <LogConsole entries={[]} emptyMessage="No console output yet." />
    </div>
  ),
};

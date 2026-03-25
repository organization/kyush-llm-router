import { For, Show, createMemo } from 'solid-js';
import { MetaCluster } from './MetaCluster';
import { StatusBadge, type StatusTone } from './StatusBadge';

type KnownChatRole = 'system' | 'user' | 'assistant';

interface ParsedMessage {
  role: string;
  content: string;
  metadata?: Array<{ key: string; value: string }>;
}

interface ConversationTimelineProps {
  requestBody?: unknown;
  responseBody?: unknown;
  emptyMessage?: string;
}

function normalizePayload(value: unknown): Record<string, unknown> | null {
  if (!value) return null;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  return typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function normalizeMessages(payload: Record<string, unknown> | null): ParsedMessage[] {
  const messages = payload?.messages;
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      role: typeof item.role === 'string' ? item.role : 'unknown',
      content: typeof item.content === 'string' ? item.content : JSON.stringify(item.content ?? ''),
    }));
}

function normalizeAssistantMessages(payload: Record<string, unknown> | null): ParsedMessage[] {
  const choices = payload?.choices;
  if (!Array.isArray(choices)) return [];

  const messages: Array<ParsedMessage | null> = choices.map((choice) => {
      if (!choice || typeof choice !== 'object') return null;
      const message = (choice as Record<string, unknown>).message;
      if (!message || typeof message !== 'object') return null;

      const content = typeof (message as Record<string, unknown>).content === 'string'
        ? String((message as Record<string, unknown>).content)
        : JSON.stringify((message as Record<string, unknown>).content ?? '');
      const metadata = [
        (message as Record<string, unknown>).reasoning_content !== undefined
          ? {
              key: 'Reasoning',
              value:
                typeof (message as Record<string, unknown>).reasoning_content === 'string'
                  ? String((message as Record<string, unknown>).reasoning_content)
                  : JSON.stringify((message as Record<string, unknown>).reasoning_content),
            }
          : null,
        (message as Record<string, unknown>).tool_calls !== undefined
          ? {
              key: 'Tool Calls',
              value: JSON.stringify((message as Record<string, unknown>).tool_calls),
            }
          : null,
        (choice as Record<string, unknown>).finish_reason !== undefined
          ? { key: 'Finish', value: String((choice as Record<string, unknown>).finish_reason) }
          : null,
        (choice as Record<string, unknown>).matched_stop !== undefined
          ? { key: 'Matched Stop', value: String((choice as Record<string, unknown>).matched_stop) }
          : null,
        (choice as Record<string, unknown>).logprobs !== undefined
          ? { key: 'Logprobs', value: JSON.stringify((choice as Record<string, unknown>).logprobs) }
          : null,
      ].filter((item): item is { key: string; value: string } => Boolean(item));

      return {
        role: 'assistant' as const,
        content,
        metadata,
      };
    });

  return messages.filter((message): message is ParsedMessage => message !== null);
}

export function hasRenderableConversation(requestBody?: unknown, responseBody?: unknown): boolean {
  const requestMessages = normalizeMessages(normalizePayload(requestBody));
  const responseMessages = normalizeAssistantMessages(normalizePayload(responseBody));
  return requestMessages.length > 0 || responseMessages.length > 0;
}

const roleTone: Record<KnownChatRole, StatusTone> = {
  system: 'info',
  user: 'warning',
  assistant: 'success',
};

function getRoleTone(role: string): StatusTone {
  if (role === 'system' || role === 'user' || role === 'assistant') {
    return roleTone[role];
  }
  return 'neutral';
}

function getRoleClass(role: string): string {
  if (role === 'system' || role === 'user' || role === 'assistant') {
    return `ui-conversation__turn--${role}`;
  }
  return 'ui-conversation__turn--unknown';
}

export function ConversationTimeline(props: ConversationTimelineProps) {
  const parsedRequest = createMemo(() => normalizePayload(props.requestBody));
  const parsedResponse = createMemo(() => normalizePayload(props.responseBody));

  const requestMessages = createMemo(() => normalizeMessages(parsedRequest()));
  const responseMessages = createMemo(() => normalizeAssistantMessages(parsedResponse()));
  const messages = createMemo(() => [...requestMessages(), ...responseMessages()]);

  const summaryItems = createMemo(() => {
    const request = parsedRequest();
    const response = parsedResponse();
    const usage = response?.usage && typeof response.usage === 'object' ? response.usage as Record<string, unknown> : null;

    return [
      typeof request?.model === 'string' ? { key: 'Model', value: request.model } : null,
      request?.temperature !== undefined ? { key: 'Temp', value: String(request.temperature) } : null,
      typeof response?.created === 'number' ? { key: 'Created', value: String(response.created) } : null,
      usage?.prompt_tokens !== undefined ? { key: 'Prompt', value: String(usage.prompt_tokens) } : null,
      usage?.completion_tokens !== undefined ? { key: 'Completion', value: String(usage.completion_tokens) } : null,
      usage?.total_tokens !== undefined ? { key: 'Total', value: String(usage.total_tokens) } : null,
    ].filter((item): item is { key: string; value: string } => Boolean(item));
  });

  return (
    <div class="ui-conversation">
      <Show when={summaryItems().length > 0}>
        <MetaCluster items={summaryItems()} />
      </Show>

      <Show
        when={messages().length > 0}
        fallback={<div class="ui-conversation__empty">{props.emptyMessage ?? 'No parsed conversation available for this log.'}</div>}
      >
        <div class="ui-conversation__list">
          <For each={messages()}>
            {(message, index) => (
              <article class={`ui-conversation__turn ${getRoleClass(message.role)}`}>
                <header class="ui-conversation__turn-header">
                  <StatusBadge tone={getRoleTone(message.role)}>{message.role}</StatusBadge>
                  <span class="ui-conversation__turn-index">Turn {index() + 1}</span>
                </header>
                <div class="ui-conversation__bubble">
                  <pre class="ui-conversation__content">{message.content}</pre>
                  <Show when={message.metadata && message.metadata.length > 0}>
                    <div class="ui-conversation__meta">
                      <MetaCluster items={message.metadata!} />
                    </div>
                  </Show>
                </div>
              </article>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

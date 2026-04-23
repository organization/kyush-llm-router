import { For, Show, createMemo } from 'solid-js';
import { MetaCluster } from './MetaCluster';
import { StatusBadge, type StatusTone } from './StatusBadge';

type KnownChatRole = 'system' | 'user' | 'assistant';
const COMPACT_CHAT_STREAM_FORMAT = 'kyush.chat_stream.compact.v1';
const RAW_CHAT_STREAM_FORMAT = 'kyush.chat_stream.raw.v1';

interface ParsedMessage {
  role: string;
  content: string;
  reasoning?: string;
  toolCalls?: string;
  metadata?: Array<{ key: string; value: string }>;
}

interface ConversationTimelineProps {
  requestBody?: unknown;
  responseBody?: unknown;
  emptyMessage?: string;
}

interface ParsedStreamResponse {
  messages: ParsedMessage[];
  model?: string;
  created?: number;
  usage?: Record<string, unknown>;
}

interface StreamChoiceState {
  index: number;
  role?: string;
  content: string[];
  reasoning: string[];
  toolCalls: Map<number, StreamToolCallState>;
  finishReason?: string;
  stopReason?: string;
}

interface StreamToolCallState {
  index: number;
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
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

function normalizeCompactStreamResponse(payload: Record<string, unknown> | null): ParsedStreamResponse | null {
  const compactPayload = payload?.format === RAW_CHAT_STREAM_FORMAT && isRecord(payload.compact)
    ? payload.compact
    : payload;

  if (compactPayload?.format !== COMPACT_CHAT_STREAM_FORMAT) return null;

  const rawChoices = compactPayload.choices;
  const messages = Array.isArray(rawChoices)
    ? rawChoices
        .filter((choice): choice is Record<string, unknown> => isRecord(choice))
        .map((choice) => {
          const metadata = [
            choice.finish_reason !== undefined && choice.finish_reason !== null
              ? { key: 'Finish', value: String(choice.finish_reason) }
              : null,
            choice.stop_reason !== undefined && choice.stop_reason !== null
              ? { key: 'Stop Reason', value: String(choice.stop_reason) }
              : null,
            choice.matched_stop !== undefined && choice.matched_stop !== null
              ? { key: 'Matched Stop', value: String(choice.matched_stop) }
              : null,
          ].filter((item): item is { key: string; value: string } => Boolean(item));

          return {
            role: typeof choice.role === 'string' ? choice.role : 'assistant',
            content: stringifyValue(choice.content),
            reasoning: stringifyValue(choice.reasoning).trim() || undefined,
            toolCalls: choice.tool_calls !== undefined ? prettyJson(choice.tool_calls) : undefined,
            metadata,
          };
        })
        .filter((message) => message.content || message.reasoning || message.toolCalls || (message.metadata?.length ?? 0) > 0)
    : [];

  return {
    messages,
    model: typeof compactPayload.model === 'string' ? compactPayload.model : undefined,
    created: typeof compactPayload.created === 'number' ? compactPayload.created : undefined,
    usage: isRecord(compactPayload.usage) ? compactPayload.usage : undefined,
  };
}

function normalizeMessages(payload: Record<string, unknown> | null): ParsedMessage[] {
  const messages = payload?.messages;
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      role: typeof item.role === 'string' ? item.role : 'unknown',
      content: stringifyValue(item.content),
    }));
}

function normalizeAssistantMessages(payload: Record<string, unknown> | null): ParsedMessage[] {
  const choices = payload?.choices;
  if (!Array.isArray(choices)) return [];

  const messages: Array<ParsedMessage | null> = choices.map((choice) => {
      if (!choice || typeof choice !== 'object') return null;
      const message = (choice as Record<string, unknown>).message;
      if (!message || typeof message !== 'object') return null;

      const messageRecord = message as Record<string, unknown>;
      const content = stringifyValue(messageRecord.content);
      const reasoning = stringifyValue(messageRecord.reasoning_content ?? messageRecord.reasoning).trim();
      const toolCalls = messageRecord.tool_calls !== undefined ? prettyJson(messageRecord.tool_calls) : undefined;
      const metadata = [
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
        reasoning: reasoning || undefined,
        toolCalls,
        metadata,
      };
    });

  return messages.filter((message): message is ParsedMessage => message !== null);
}

function extractSseJsonPayloads(value: string): Record<string, unknown>[] {
  const payloads: Record<string, unknown>[] = [];
  const lines = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let dataLines: string[] = [];

  const flush = () => {
    if (dataLines.length === 0) return;
    const data = dataLines.join('\n');
    dataLines = [];

    if (data.trim() === '[DONE]') return;

    try {
      const parsed = JSON.parse(data);
      if (isRecord(parsed)) payloads.push(parsed);
    } catch {
      // Ignore non-JSON SSE data frames.
    }
  };

  for (const line of lines) {
    if (line === '') {
      flush();
      continue;
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^ /, ''));
    }
  }

  flush();
  return payloads;
}

function mergeToolCall(target: StreamToolCallState, chunk: Record<string, unknown>): void {
  if (typeof chunk.id === 'string') target.id = chunk.id;
  if (typeof chunk.type === 'string') target.type = chunk.type;

  const functionChunk = chunk.function;
  if (!isRecord(functionChunk)) return;

  target.function = target.function ?? {};
  if (typeof functionChunk.name === 'string') {
    target.function.name = `${target.function.name ?? ''}${functionChunk.name}`;
  }
  if (typeof functionChunk.arguments === 'string') {
    target.function.arguments = `${target.function.arguments ?? ''}${functionChunk.arguments}`;
  }
}

function parseStreamResponse(value: unknown): ParsedStreamResponse | null {
  if (typeof value !== 'string' || !value.includes('data:')) return null;

  const payloads = extractSseJsonPayloads(value);
  if (payloads.length === 0) return null;

  const choices = new Map<number, StreamChoiceState>();
  let model: string | undefined;
  let created: number | undefined;
  let usage: Record<string, unknown> | undefined;

  const getChoice = (index: number) => {
    const existing = choices.get(index);
    if (existing) return existing;

    const createdChoice: StreamChoiceState = {
      index,
      content: [],
      reasoning: [],
      toolCalls: new Map(),
    };
    choices.set(index, createdChoice);
    return createdChoice;
  };

  for (const payload of payloads) {
    if (typeof payload.model === 'string' && !model) model = payload.model;
    if (typeof payload.created === 'number' && created === undefined) created = payload.created;
    if (isRecord(payload.usage)) usage = payload.usage;

    if (!Array.isArray(payload.choices)) continue;

    for (const rawChoice of payload.choices) {
      if (!isRecord(rawChoice)) continue;

      const index = typeof rawChoice.index === 'number' ? rawChoice.index : 0;
      const choice = getChoice(index);
      const delta = rawChoice.delta;

      if (isRecord(delta)) {
        if (typeof delta.role === 'string') choice.role = delta.role;
        if (typeof delta.content === 'string') choice.content.push(delta.content);
        if (typeof delta.reasoning === 'string') choice.reasoning.push(delta.reasoning);
        if (typeof delta.reasoning_content === 'string') choice.reasoning.push(delta.reasoning_content);

        if (Array.isArray(delta.tool_calls)) {
          for (const rawToolCall of delta.tool_calls) {
            if (!isRecord(rawToolCall)) continue;
            const toolIndex = typeof rawToolCall.index === 'number' ? rawToolCall.index : choice.toolCalls.size;
            const existing = choice.toolCalls.get(toolIndex) ?? { index: toolIndex };
            mergeToolCall(existing, rawToolCall);
            choice.toolCalls.set(toolIndex, existing);
          }
        }
      }

      if (rawChoice.finish_reason !== undefined && rawChoice.finish_reason !== null) {
        choice.finishReason = String(rawChoice.finish_reason);
      }
      if (rawChoice.stop_reason !== undefined && rawChoice.stop_reason !== null) {
        choice.stopReason = String(rawChoice.stop_reason);
      }
    }
  }

  const messages = [...choices.values()]
    .sort((left, right) => left.index - right.index)
    .map((choice) => {
      const toolCalls = [...choice.toolCalls.values()].sort((left, right) => left.index - right.index);
      const metadata = [
        choice.finishReason ? { key: 'Finish', value: choice.finishReason } : null,
        choice.stopReason ? { key: 'Stop Reason', value: choice.stopReason } : null,
      ].filter((item): item is { key: string; value: string } => Boolean(item));

      return {
        role: choice.role ?? 'assistant',
        content: choice.content.join(''),
        reasoning: choice.reasoning.join('') || undefined,
        toolCalls: toolCalls.length > 0 ? prettyJson(toolCalls) : undefined,
        metadata,
      };
    })
    .filter((message) => message.content || message.reasoning || message.toolCalls || (message.metadata?.length ?? 0) > 0);

  return {
    messages,
    model,
    created,
    usage,
  };
}

function getAssistantMessages(responseBody?: unknown): ParsedMessage[] {
  const payload = normalizePayload(responseBody);
  const compactStream = normalizeCompactStreamResponse(payload);
  if (compactStream) return compactStream.messages;

  const stream = parseStreamResponse(responseBody);
  if (stream) return stream.messages;
  return normalizeAssistantMessages(payload);
}

export function extractAssistantConversationPreview(responseBody?: unknown): string {
  const assistantMessage = getAssistantMessages(responseBody).find((message) => (
    message.content.trim() || message.reasoning?.trim() || message.toolCalls?.trim()
  ));

  if (!assistantMessage) return '-';

  const source = assistantMessage.content.trim()
    ? assistantMessage.content
    : assistantMessage.reasoning
      ? `Thinking: ${assistantMessage.reasoning}`
      : `Tool Calls: ${assistantMessage.toolCalls ?? ''}`;
  const normalized = source
    .replace(/\r/g, '')
    .replace(/\n+/g, ' ')
    .trim();

  if (!normalized) return '-';
  return normalized.length > 50 ? `${normalized.slice(0, 50)}...` : normalized;
}

export function hasRenderableConversation(requestBody?: unknown, responseBody?: unknown): boolean {
  const requestMessages = normalizeMessages(normalizePayload(requestBody));
  const responseMessages = getAssistantMessages(responseBody);
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
  const parsedCompactStreamResponse = createMemo(() => normalizeCompactStreamResponse(parsedResponse()));
  const parsedStreamResponse = createMemo(() => parseStreamResponse(props.responseBody));

  const requestMessages = createMemo(() => normalizeMessages(parsedRequest()));
  const responseMessages = createMemo(() => parsedCompactStreamResponse()?.messages ?? parsedStreamResponse()?.messages ?? normalizeAssistantMessages(parsedResponse()));
  const messages = createMemo(() => [...requestMessages(), ...responseMessages()]);

  const summaryItems = createMemo(() => {
    const request = parsedRequest();
    const response = parsedResponse();
    const stream = parsedCompactStreamResponse() ?? parsedStreamResponse();
    const usage = response?.usage && typeof response.usage === 'object' ? response.usage as Record<string, unknown> : null;
    const responseUsage = usage ?? stream?.usage ?? null;

    return [
      typeof request?.model === 'string' ? { key: 'Model', value: request.model } : null,
      request?.temperature !== undefined ? { key: 'Temp', value: String(request.temperature) } : null,
      typeof stream?.model === 'string' && stream.model !== request?.model ? { key: 'Response Model', value: stream.model } : null,
      typeof response?.created === 'number' ? { key: 'Created', value: String(response.created) } : null,
      typeof stream?.created === 'number' ? { key: 'Created', value: String(stream.created) } : null,
      responseUsage?.prompt_tokens !== undefined ? { key: 'Prompt', value: String(responseUsage.prompt_tokens) } : null,
      responseUsage?.completion_tokens !== undefined ? { key: 'Completion', value: String(responseUsage.completion_tokens) } : null,
      responseUsage?.total_tokens !== undefined ? { key: 'Total', value: String(responseUsage.total_tokens) } : null,
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
                  <Show when={message.reasoning}>
                    <section class="ui-conversation__block ui-conversation__block--reasoning">
                      <div class="ui-conversation__block-label">Thinking</div>
                      <pre class="ui-conversation__content">{message.reasoning}</pre>
                    </section>
                  </Show>
                  <Show when={message.content.trim().length > 0 || (!message.reasoning && !message.toolCalls)}>
                    <section class="ui-conversation__block">
                      <Show when={message.reasoning}>
                        <div class="ui-conversation__block-label">Response</div>
                      </Show>
                      <pre class="ui-conversation__content">{message.content}</pre>
                    </section>
                  </Show>
                  <Show when={message.toolCalls}>
                    <section class="ui-conversation__block ui-conversation__block--tool-calls">
                      <div class="ui-conversation__block-label">Tool Calls</div>
                      <pre class="ui-conversation__content">{message.toolCalls}</pre>
                    </section>
                  </Show>
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

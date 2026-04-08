import {
  LooseChatCompletionRequestSchema,
  LooseChatCompletionResponseSchema,
} from '@kyush/shared';
import { For, Show, type Component } from 'solid-js';

import { MetaCluster } from './MetaCluster';
import { StatusBadge, type StatusTone } from './StatusBadge';

/* ────────────────────────────────────────────────────────────────────────────
 * Types
 * ────────────────────────────────────────────────────────────────────────── */

type KnownChatRole = 'system' | 'user' | 'assistant';

interface MetaItem {
  key: string;
  value: string;
}

interface ParsedMessage {
  role: string;
  content: string;
  metadata?: MetaItem[];
}

interface ConversationTimelineProps {
  requestBody?: unknown;
  responseBody?: unknown;
  emptyMessage?: string;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Parsing helpers
 * ────────────────────────────────────────────────────────────────────────── */

function parseJsonLike(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}

function stringifyContent(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function parseRequest(body: unknown) {
  const raw = parseJsonLike(body);
  if (raw == null) return null;
  const result = LooseChatCompletionRequestSchema.safeParse(raw);
  return result.success ? result.data : null;
}

function parseResponse(body: unknown) {
  const raw = parseJsonLike(body);
  if (raw == null) return null;
  const result = LooseChatCompletionResponseSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/**
 * Lift the user/system/assistant messages out of an OpenAI-shaped request body.
 * Returns an empty array when nothing parsable is present.
 */
function extractRequestMessages(
  request: ReturnType<typeof parseRequest>,
): ParsedMessage[] {
  if (!request?.messages) return [];
  return request.messages.map((message) => ({
    role: typeof message.role === 'string' ? message.role : 'unknown',
    content: stringifyContent(message.content),
  }));
}

/**
 * Lift the assistant turns out of an OpenAI-shaped response body, including the
 * extra metadata fields (reasoning, tool calls, finish_reason, etc.) that show
 * up in chat completion choices.
 */
function extractResponseMessages(
  response: ReturnType<typeof parseResponse>,
): ParsedMessage[] {
  if (!response?.choices) return [];

  return response.choices
    .map((choice): ParsedMessage | null => {
      const message = choice.message;
      if (!message) return null;

      const metadata: MetaItem[] = [];
      if (message.reasoning_content !== undefined) {
        metadata.push({
          key: 'Reasoning',
          value: stringifyContent(message.reasoning_content),
        });
      }
      if (message.tool_calls !== undefined) {
        metadata.push({
          key: 'Tool Calls',
          value: stringifyContent(message.tool_calls),
        });
      }
      if (choice.finish_reason !== undefined) {
        metadata.push({
          key: 'Finish',
          value: String(choice.finish_reason),
        });
      }
      if (choice.matched_stop !== undefined) {
        metadata.push({
          key: 'Matched Stop',
          value: String(choice.matched_stop),
        });
      }
      if (choice.logprobs !== undefined) {
        metadata.push({
          key: 'Logprobs',
          value: stringifyContent(choice.logprobs),
        });
      }

      return {
        role: 'assistant',
        content: stringifyContent(message.content),
        metadata: metadata.length > 0 ? metadata : undefined,
      };
    })
    .filter((message): message is ParsedMessage => message !== null);
}

function buildSummaryItems(
  request: ReturnType<typeof parseRequest>,
  response: ReturnType<typeof parseResponse>,
): MetaItem[] {
  const items: MetaItem[] = [];

  if (typeof request?.model === 'string') {
    items.push({ key: 'Model', value: request.model });
  }
  if (request?.temperature !== undefined) {
    items.push({ key: 'Temp', value: String(request.temperature) });
  }
  if (typeof response?.created === 'number') {
    items.push({ key: 'Created', value: String(response.created) });
  }

  const usage = response?.usage;
  if (usage) {
    if (usage.prompt_tokens !== undefined) {
      items.push({ key: 'Prompt', value: String(usage.prompt_tokens) });
    }
    if (usage.completion_tokens !== undefined) {
      items.push({ key: 'Completion', value: String(usage.completion_tokens) });
    }
    if (usage.total_tokens !== undefined) {
      items.push({ key: 'Total', value: String(usage.total_tokens) });
    }
  }

  return items;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Public helpers + component
 * ────────────────────────────────────────────────────────────────────────── */

const ROLE_TONES: Record<KnownChatRole, StatusTone> = {
  system: 'info',
  user: 'warning',
  assistant: 'success',
};

function isKnownRole(role: string): role is KnownChatRole {
  return role === 'system' || role === 'user' || role === 'assistant';
}

const getRoleTone = (role: string): StatusTone =>
  isKnownRole(role) ? ROLE_TONES[role] : 'neutral';

const getRoleClass = (role: string): string =>
  isKnownRole(role)
    ? `ui-conversation__turn--${role}`
    : 'ui-conversation__turn--unknown';

export function hasRenderableConversation(
  requestBody?: unknown,
  responseBody?: unknown,
): boolean {
  const requestMessages = extractRequestMessages(parseRequest(requestBody));
  const responseMessages = extractResponseMessages(parseResponse(responseBody));
  return requestMessages.length > 0 || responseMessages.length > 0;
}

export const ConversationTimeline: Component<ConversationTimelineProps> = (
  props,
) => {
  // Inline derivations — Solid's reactive prop reads make extra createMemo
  // wrappers unnecessary for cheap shape transforms like these.
  const request = () => parseRequest(props.requestBody);
  const response = () => parseResponse(props.responseBody);
  const messages = () => [
    ...extractRequestMessages(request()),
    ...extractResponseMessages(response()),
  ];
  const summaryItems = () => buildSummaryItems(request(), response());

  return (
    <div class="ui-conversation">
      <Show when={summaryItems().length > 0}>
        <MetaCluster items={summaryItems()} />
      </Show>

      <Show
        fallback={
          <div class="ui-conversation__empty">
            {props.emptyMessage ??
              'No parsed conversation available for this log.'}
          </div>
        }
        when={messages().length > 0}
      >
        <div class="ui-conversation__list">
          <For each={messages()}>
            {(message, index) => (
              <article
                class={`ui-conversation__turn ${getRoleClass(message.role)}`}
              >
                <header class="ui-conversation__turn-header">
                  <StatusBadge tone={getRoleTone(message.role)}>
                    {message.role}
                  </StatusBadge>
                  <span class="ui-conversation__turn-index">
                    Turn {index() + 1}
                  </span>
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
};

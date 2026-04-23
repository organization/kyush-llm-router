import { DetailStreamLogMode } from '../config/stream-logging';

export const COMPACT_CHAT_STREAM_FORMAT = 'kyush.chat_stream.compact.v1';
export const RAW_CHAT_STREAM_FORMAT = 'kyush.chat_stream.raw.v1';

type UsageSnapshot = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type CompactToolCall = {
  index: number;
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
};

type CompactChoice = {
  index: number;
  role?: string;
  reasoning?: string;
  content?: string;
  tool_calls?: CompactToolCall[];
  finish_reason?: string;
  stop_reason?: string;
  matched_stop?: string;
};

type CompactChatStreamLog = {
  format: typeof COMPACT_CHAT_STREAM_FORMAT;
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices: CompactChoice[];
  usage?: UsageSnapshot;
  stream: {
    network_chunk_count: number;
    data_frame_count: number;
    done: boolean;
  };
};

type RawChatStreamLog = {
  format: typeof RAW_CHAT_STREAM_FORMAT;
  compact: CompactChatStreamLog;
  raw_sse: string;
};

type ChoiceState = {
  index: number;
  role?: string;
  reasoning: string[];
  content: string[];
  toolCalls: Map<number, CompactToolCall>;
  finishReason?: string;
  stopReason?: string;
  matchedStop?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeToolCall(target: CompactToolCall, chunk: Record<string, unknown>): void {
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

function getUsage(value: unknown): UsageSnapshot | undefined {
  if (!isRecord(value)) return undefined;

  return {
    prompt_tokens: typeof value.prompt_tokens === 'number' ? value.prompt_tokens : undefined,
    completion_tokens: typeof value.completion_tokens === 'number' ? value.completion_tokens : undefined,
    total_tokens: typeof value.total_tokens === 'number' ? value.total_tokens : undefined,
  };
}

export class ChatStreamLogAccumulator {
  private id: string | undefined;
  private object: string | undefined;
  private created: number | undefined;
  private model: string | undefined;
  private usage: UsageSnapshot | undefined;
  private networkChunkCount = 0;
  private dataFrameCount = 0;
  private done = false;
  private buffer = '';
  private rawChunks: string[] = [];
  private choices = new Map<number, ChoiceState>();

  constructor(private readonly collectRaw: boolean) {}

  append(text: string, countNetworkChunk = true): void {
    if (countNetworkChunk) {
      this.networkChunkCount += 1;
    }

    if (this.collectRaw) {
      this.rawChunks.push(text);
    }

    this.buffer = `${this.buffer}${text}`.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    while (true) {
      const delimiterIndex = this.buffer.indexOf('\n\n');
      if (delimiterIndex < 0) break;

      const eventText = this.buffer.slice(0, delimiterIndex);
      this.buffer = this.buffer.slice(delimiterIndex + 2);
      this.processEvent(eventText);
    }
  }

  flush(): void {
    const remaining = this.buffer.trim();
    if (!remaining) {
      this.buffer = '';
      return;
    }

    this.processEvent(this.buffer);
    this.buffer = '';
  }

  getResponseModel(): string | undefined {
    return this.model;
  }

  getUsage(): UsageSnapshot | undefined {
    return this.usage;
  }

  toLogBody(mode: DetailStreamLogMode): string | CompactChatStreamLog | RawChatStreamLog | undefined {
    this.flush();

    if (mode === 'off') {
      return undefined;
    }

    if (mode === 'raw') {
      return this.rawChunks.join('');
    }

    const compact = this.toCompactLog();
    if (mode === 'both') {
      return {
        format: RAW_CHAT_STREAM_FORMAT,
        compact,
        raw_sse: this.rawChunks.join(''),
      };
    }

    return compact;
  }

  private getChoice(index: number): ChoiceState {
    const existing = this.choices.get(index);
    if (existing) return existing;

    const created: ChoiceState = {
      index,
      reasoning: [],
      content: [],
      toolCalls: new Map(),
    };
    this.choices.set(index, created);
    return created;
  }

  private processEvent(eventText: string): void {
    const dataLines = eventText
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''));

    if (dataLines.length === 0) return;

    const data = dataLines.join('\n');
    if (data.trim() === '[DONE]') {
      this.done = true;
      return;
    }

    this.dataFrameCount += 1;

    try {
      const parsed = JSON.parse(data);
      if (isRecord(parsed)) {
        this.processPayload(parsed);
      }
    } catch {
      // Non-JSON data frames are forwarded to clients, but not represented in compact logs.
    }
  }

  private processPayload(payload: Record<string, unknown>): void {
    if (typeof payload.id === 'string' && !this.id) this.id = payload.id;
    if (typeof payload.object === 'string' && !this.object) this.object = payload.object;
    if (typeof payload.created === 'number' && this.created === undefined) this.created = payload.created;
    if (typeof payload.model === 'string' && !this.model) this.model = payload.model;

    const usage = getUsage(payload.usage);
    if (usage) this.usage = usage;

    if (!Array.isArray(payload.choices)) return;

    for (const rawChoice of payload.choices) {
      if (!isRecord(rawChoice)) continue;

      const index = typeof rawChoice.index === 'number' ? rawChoice.index : 0;
      const choice = this.getChoice(index);
      const delta = rawChoice.delta;

      if (isRecord(delta)) {
        if (typeof delta.role === 'string') choice.role = delta.role;
        if (typeof delta.reasoning === 'string') choice.reasoning.push(delta.reasoning);
        if (typeof delta.reasoning_content === 'string') choice.reasoning.push(delta.reasoning_content);
        if (typeof delta.content === 'string') choice.content.push(delta.content);

        if (Array.isArray(delta.tool_calls)) {
          for (const rawToolCall of delta.tool_calls) {
            if (!isRecord(rawToolCall)) continue;
            const toolIndex = typeof rawToolCall.index === 'number' ? rawToolCall.index : choice.toolCalls.size;
            const toolCall = choice.toolCalls.get(toolIndex) ?? { index: toolIndex };
            mergeToolCall(toolCall, rawToolCall);
            choice.toolCalls.set(toolIndex, toolCall);
          }
        }
      }

      if (rawChoice.finish_reason !== undefined && rawChoice.finish_reason !== null) {
        choice.finishReason = String(rawChoice.finish_reason);
      }
      if (rawChoice.stop_reason !== undefined && rawChoice.stop_reason !== null) {
        choice.stopReason = String(rawChoice.stop_reason);
      }
      if (rawChoice.matched_stop !== undefined && rawChoice.matched_stop !== null) {
        choice.matchedStop = String(rawChoice.matched_stop);
      }
    }
  }

  private toCompactLog(): CompactChatStreamLog {
    const choices = [...this.choices.values()]
      .sort((left, right) => left.index - right.index)
      .map((choice) => {
        const compactChoice: CompactChoice = {
          index: choice.index,
        };
        const reasoning = choice.reasoning.join('');
        const content = choice.content.join('');
        const toolCalls = [...choice.toolCalls.values()].sort((left, right) => left.index - right.index);

        if (choice.role) compactChoice.role = choice.role;
        if (reasoning) compactChoice.reasoning = reasoning;
        if (content) compactChoice.content = content;
        if (toolCalls.length > 0) compactChoice.tool_calls = toolCalls;
        if (choice.finishReason) compactChoice.finish_reason = choice.finishReason;
        if (choice.stopReason) compactChoice.stop_reason = choice.stopReason;
        if (choice.matchedStop) compactChoice.matched_stop = choice.matchedStop;

        return compactChoice;
      });

    return {
      format: COMPACT_CHAT_STREAM_FORMAT,
      id: this.id,
      object: this.object,
      created: this.created,
      model: this.model,
      choices,
      usage: this.usage,
      stream: {
        network_chunk_count: this.networkChunkCount,
        data_frame_count: this.dataFrameCount,
        done: this.done,
      },
    };
  }
}

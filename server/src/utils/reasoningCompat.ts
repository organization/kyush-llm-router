function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function copyReasoningField(target: Record<string, unknown>): boolean {
  if (typeof target.reasoning !== 'string' || target.reasoning_content !== undefined) {
    return false;
  }

  target.reasoning_content = target.reasoning;
  return true;
}

export function copyReasoningToReasoningContentInChatCompletion(payload: unknown, stream: boolean): unknown {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    return payload;
  }

  for (const choice of payload.choices) {
    if (!isRecord(choice)) continue;

    const target = stream ? choice.delta : choice.message;
    if (isRecord(target)) {
      copyReasoningField(target);
    }
  }

  return payload;
}

export class ReasoningCompatSseTransformer {
  private buffer = '';

  append(text: string): string {
    this.buffer = `${this.buffer}${text}`.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const transformedEvents: string[] = [];

    while (true) {
      const delimiterIndex = this.buffer.indexOf('\n\n');
      if (delimiterIndex < 0) break;

      const eventText = this.buffer.slice(0, delimiterIndex);
      this.buffer = this.buffer.slice(delimiterIndex + 2);
      transformedEvents.push(this.transformEvent(eventText));
    }

    return transformedEvents.join('');
  }

  flush(): string {
    if (!this.buffer) {
      return '';
    }

    const remaining = this.buffer;
    this.buffer = '';
    return remaining;
  }

  private transformEvent(eventText: string): string {
    const lines = eventText.split('\n');
    const dataLines = lines
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''));

    if (dataLines.length === 0) {
      return `${eventText}\n\n`;
    }

    const data = dataLines.join('\n');
    if (data.trim() === '[DONE]') {
      return `${eventText}\n\n`;
    }

    try {
      const parsed = JSON.parse(data);
      const before = JSON.stringify(parsed);
      copyReasoningToReasoningContentInChatCompletion(parsed, true);
      const after = JSON.stringify(parsed);

      if (before === after) {
        return `${eventText}\n\n`;
      }

      const nonDataLines = lines.filter((line) => !line.startsWith('data:'));
      return `${[...nonDataLines, `data: ${after}`].join('\n')}\n\n`;
    } catch {
      return `${eventText}\n\n`;
    }
  }
}

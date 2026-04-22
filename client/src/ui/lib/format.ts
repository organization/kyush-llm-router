const durationFormatters = {
  seconds: new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }),
  minutes: new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }),
};

export function formatDurationMs(value: number): string {
  if (!Number.isFinite(value)) {
    return '0ms';
  }

  const absoluteValue = Math.abs(value);
  if (absoluteValue < 1000) {
    return `${Math.round(value)}ms`;
  }

  if (absoluteValue < 60_000) {
    return `${durationFormatters.seconds.format(value / 1000)}s`;
  }

  return `${durationFormatters.minutes.format(value / 60_000)}m`;
}

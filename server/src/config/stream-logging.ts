export type DetailStreamLogMode = 'compact' | 'raw' | 'both' | 'off';

export function getDetailStreamLogMode(): DetailStreamLogMode {
  const value = process.env.DETAIL_STREAM_LOG_MODE?.trim().toLowerCase();

  if (value === 'compact' || value === 'raw' || value === 'both' || value === 'off') {
    return value;
  }

  return 'compact';
}

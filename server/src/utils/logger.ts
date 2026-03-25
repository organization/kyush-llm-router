import { getUtcTimestamp } from './time';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

export function log(level: 'log' | 'debug' | 'info' | 'warn' | 'error', message: string, meta?: unknown): void {
  const timestamp = getUtcTimestamp();
  const levelColor = {
    log: colors.blue,
    debug: colors.gray,
    info: colors.green,
    warn: colors.yellow,
    error: colors.red,
  }[level];

  const prefix = `[${timestamp}] ${levelColor}[${level.toUpperCase()}]${colors.reset}`;
  console.log(prefix, message);

  if (meta) {
    console.log(meta);
  }
}

export const logger = {
  log: (message: string, meta?: unknown) => log('log', message, meta),
  debug: (message: string, meta?: unknown) => log('debug', message, meta),
  info: (message: string, meta?: unknown) => log('info', message, meta),
  warn: (message: string, meta?: unknown) => log('warn', message, meta),
  error: (message: string, meta?: unknown) => log('error', message, meta),
};

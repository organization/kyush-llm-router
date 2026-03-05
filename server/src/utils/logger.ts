const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

export function log(level: 'info' | 'warn' | 'error' | 'debug', message: string, meta?: unknown): void {
  const timestamp = new Date().toISOString();
  const levelColor = {
    info: colors.green,
    warn: colors.yellow,
    error: colors.red,
    debug: colors.gray,
  }[level];

  const prefix = `[${timestamp}] ${levelColor}[${level.toUpperCase()}]${colors.reset}`;
  console.log(prefix, message);

  if (meta) {
    console.log(meta);
  }
}

export const logger = {
  info: (message: string, meta?: unknown) => log('info', message, meta),
  warn: (message: string, meta?: unknown) => log('warn', message, meta),
  error: (message: string, meta?: unknown) => log('error', message, meta),
  debug: (message: string, meta?: unknown) => log('debug', message, meta),
};

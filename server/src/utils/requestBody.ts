import express, { ErrorRequestHandler, RequestHandler } from 'express';
import { logger } from './logger';

export const JSON_BODY_LIMIT = '30mb';

interface BodyParserError extends Error {
  type?: string;
  status?: number;
  statusCode?: number;
  limit?: number;
  length?: number;
  expected?: number;
  received?: number;
}

function parseContentLength(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function firstNumber(...values: Array<number | undefined>): number | undefined {
  return values.find((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

export function formatByteSize(bytes: number | undefined): string {
  if (bytes === undefined) return 'unknown';
  if (bytes < 1024) return `${bytes} B`;

  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]} (${bytes} B)`;
}

export function createJsonBodyParser(limit: string = JSON_BODY_LIMIT): RequestHandler {
  return express.json({ limit });
}

export const requestBodyErrorHandler: ErrorRequestHandler = (err: BodyParserError, req, res, next) => {
  const status = err.status ?? err.statusCode;
  const isPayloadTooLarge = err.type === 'entity.too.large' || status === 413;
  const isBodyParserClientError = typeof err.type === 'string' && status !== undefined && status >= 400 && status < 500;

  if (isPayloadTooLarge) {
    const contentLengthBytes = parseContentLength(req.get('content-length'));
    const payloadBytes = firstNumber(err.length, err.received, err.expected, contentLengthBytes);
    const limitBytes = firstNumber(err.limit);

    logger.warn(
      `Request body too large: ${req.method} ${req.originalUrl || req.url} ` +
      `payload=${formatByteSize(payloadBytes)} limit=${formatByteSize(limitBytes)} ` +
      `content-length=${formatByteSize(contentLengthBytes)}`,
      {
        content_length_bytes: contentLengthBytes,
        payload_size_bytes: payloadBytes,
        parser_limit_bytes: limitBytes,
        parser_error_type: err.type,
      }
    );

    res.status(413).json({
      error: 'Request body too large',
      payload_size_bytes: payloadBytes,
      limit_bytes: limitBytes,
    });
    return;
  }

  if (isBodyParserClientError) {
    logger.warn(`Invalid request body: ${req.method} ${req.originalUrl || req.url} (${err.type})`);
    res.status(status).json({ error: err.message || 'Invalid request body' });
    return;
  }

  next(err);
};

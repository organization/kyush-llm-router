import { listRequestLogMonths, getRequestLogsDb } from '../config/request-logs-db';
import { RequestLog, RequestLogPage } from '../../../shared/types';
import { getLocalDateKey, getLocalMonthKey, getMonthKeyFromDateString, getUtcTimestamp } from '../utils/time';

export interface RequestLogInsert {
  user_id: number;
  backend_id: number;
  endpoint: string;
  request_model?: string;
  response_model?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  status_code: number;
  response_time_ms?: number;
  error_message?: string;
  detail_logged?: boolean;
  local_date?: string;
  request_headers?: unknown;
  request_body?: unknown;
  response_headers?: unknown;
  response_body?: unknown;
  created_at?: string;
}

export interface RequestLogQuery {
  month?: string;
  date?: string;
  limit?: number;
  offset?: number;
  q?: string;
  userId?: number;
  backendId?: number;
  endpoint?: string;
  detailLogged?: boolean;
}

function clampLimit(limit: number | undefined): number {
  if (!limit || Number.isNaN(limit)) return 100;
  return Math.max(1, Math.min(limit, 100));
}

function normalizeRequestLog(row: any): RequestLog {
  row.detail_logged = !!row.detail_logged;
  return row as RequestLog;
}

function buildWhereClause(query: RequestLogQuery): { whereClause: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (query.date) {
    clauses.push('local_date = ?');
    params.push(query.date);
  }
  if (query.userId) {
    clauses.push('user_id = ?');
    params.push(query.userId);
  }
  if (query.backendId) {
    clauses.push('backend_id = ?');
    params.push(query.backendId);
  }
  if (query.endpoint) {
    clauses.push('endpoint = ?');
    params.push(query.endpoint);
  }
  if (query.detailLogged !== undefined) {
    clauses.push('detail_logged = ?');
    params.push(query.detailLogged ? 1 : 0);
  }
  if (query.q) {
    const like = `%${query.q}%`;
    clauses.push(`(
      endpoint LIKE ?
      OR COALESCE(request_model, '') LIKE ?
      OR COALESCE(response_model, '') LIKE ?
      OR COALESCE(error_message, '') LIKE ?
      OR COALESCE(request_headers, '') LIKE ?
      OR COALESCE(request_body, '') LIKE ?
      OR COALESCE(response_headers, '') LIKE ?
      OR COALESCE(response_body, '') LIKE ?
    )`);
    params.push(like, like, like, like, like, like, like, like);
  }

  return {
    whereClause: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

function getMonthRowCount(monthKey: string, whereClause: string, params: unknown[]): number {
  const db = getRequestLogsDb(monthKey);
  const matchedInMonth = db.prepare(`
    SELECT COUNT(*) as count FROM request_logs
    ${whereClause}
  `).get(...params) as { count: number };

  return matchedInMonth.count;
}

function getMonthRows(monthKey: string, whereClause: string, params: unknown[], limit: number, offset: number): RequestLog[] {
  const db = getRequestLogsDb(monthKey);
  return db.prepare(`
    SELECT * FROM request_logs
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset).map(normalizeRequestLog);
}

function getQueryMonth(query: RequestLogQuery): string {
  if (query.date) {
    return getMonthKeyFromDateString(query.date);
  }
  if (query.month) {
    return query.month;
  }

  const months = listRequestLogMonths();
  return months[0] || getLocalMonthKey();
}

function stringifySnapshot(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export class RequestLogService {
  static logRequest(logData: RequestLogInsert): void {
    const createdAt = logData.created_at || getUtcTimestamp();
    const localDate = logData.local_date || getLocalDateKey();
    const monthKey = getMonthKeyFromDateString(localDate);
    const detailLogged = logData.detail_logged ?? false;
    const db = getRequestLogsDb(monthKey);

    db.prepare(`
      INSERT INTO request_logs (
        user_id, backend_id, endpoint, request_model, response_model,
        prompt_tokens, completion_tokens, total_tokens,
        status_code, response_time_ms, error_message, detail_logged,
        local_date, request_headers, request_body, response_headers, response_body, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      logData.user_id,
      logData.backend_id,
      logData.endpoint,
      logData.request_model || null,
      logData.response_model || null,
      logData.prompt_tokens || null,
      logData.completion_tokens || null,
      logData.total_tokens || null,
      logData.status_code,
      logData.response_time_ms || null,
      logData.error_message || null,
      detailLogged ? 1 : 0,
      localDate,
      stringifySnapshot(logData.request_headers),
      stringifySnapshot(logData.request_body),
      stringifySnapshot(logData.response_headers),
      stringifySnapshot(logData.response_body),
      createdAt
    );
  }

  static getRequestLogs(query: RequestLogQuery = {}): RequestLogPage {
    const limit = clampLimit(query.limit);
    let offset = Math.max(0, query.offset || 0);
    const { whereClause, params } = buildWhereClause(query);

    if (query.month || query.date) {
      const monthKey = getQueryMonth(query);
      const total = getMonthRowCount(monthKey, whereClause, params);
      const rows = offset >= total ? [] : getMonthRows(monthKey, whereClause, params, limit, offset);

      return {
        rows,
        total,
        limit,
        offset,
      };
    }

    const months = listRequestLogMonths();
    const originalOffset = offset;
    const results: RequestLog[] = [];
    let total = 0;

    for (const month of months) {
      const matchedInMonth = getMonthRowCount(month, whereClause, params);
      total += matchedInMonth;

      if (matchedInMonth === 0) {
        continue;
      }

      if (matchedInMonth <= offset) {
        offset -= matchedInMonth;
        continue;
      }

      if (results.length < limit) {
        const remaining = limit - results.length;
        const rows = getMonthRows(month, whereClause, params, remaining, offset);
        results.push(...rows);
        offset = 0;
      }
    }

    return {
      rows: results,
      total,
      limit,
      offset: originalOffset,
    };
  }
}

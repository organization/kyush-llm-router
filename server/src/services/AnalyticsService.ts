import { getAnalyticsDb } from '../config/analytics-db';
import { RequestLog } from '../../../shared/types';

export class AnalyticsService {
  static logRequest(logData: Omit<RequestLog, 'id' | 'created_at'>): void {
    try {
      const db = getAnalyticsDb();
      const stmt = db.prepare(`
        INSERT INTO request_logs (
          user_id, backend_id, endpoint, request_model, response_model,
          prompt_tokens, completion_tokens, total_tokens,
          status_code, response_time_ms, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
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
        logData.error_message || null
      );

      this.updateUsageStats(logData.user_id, logData.backend_id, logData.total_tokens || 0);
      this.updateBackendMetrics(logData.backend_id, logData);
    } catch (error) {
      console.error('Failed to log analytics:', error);
    }
  }

  private static updateUsageStats(userId: number, backendId: number, tokens: number): void {
    const db = getAnalyticsDb();
    const today = new Date().toISOString().split('T')[0];

    const upsertStmt = db.prepare(`
      INSERT INTO usage_stats (user_id, backend_id, date, total_requests, total_tokens)
      VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(user_id, backend_id, date)
      DO UPDATE SET
        total_requests = total_requests + 1,
        total_tokens = total_tokens + ?
    `);

    upsertStmt.run(userId, backendId, today, tokens, tokens);
  }

  private static updateBackendMetrics(backendId: number, logData: Omit<RequestLog, 'id' | 'created_at'>): void {
    const db = getAnalyticsDb();
    const today = new Date().toISOString().split('T')[0];
    const isSuccess = logData.status_code >= 200 && logData.status_code < 300;

    const existing = db.prepare(
      'SELECT * FROM backend_metrics WHERE backend_id = ? AND date = ?'
    ).get(backendId, today) as {
      total_requests: number;
      total_tokens: number;
      avg_response_time_ms: number;
      error_count: number;
    } | undefined;

    if (existing) {
      const newTotalRequests = existing.total_requests + 1;
      const newTotalTokens = existing.total_tokens + (logData.total_tokens || 0);
      const newErrorCount = existing.error_count + (isSuccess ? 0 : 1);
      const newAvgResponseTime = logData.response_time_ms
        ? (existing.avg_response_time_ms * existing.total_requests + logData.response_time_ms) / newTotalRequests
        : existing.avg_response_time_ms;
      const newSuccessRate = (newTotalRequests - newErrorCount) / newTotalRequests;

      db.prepare(`
        UPDATE backend_metrics SET
          total_requests = ?,
          total_tokens = ?,
          avg_response_time_ms = ?,
          error_count = ?,
          success_rate = ?
        WHERE backend_id = ? AND date = ?
      `).run(newTotalRequests, newTotalTokens, newAvgResponseTime, newErrorCount, newSuccessRate, backendId, today);
    } else {
      db.prepare(`
        INSERT INTO backend_metrics (
          backend_id, date, total_requests, total_tokens,
          avg_response_time_ms, error_count, success_rate
        ) VALUES (?, ?, 1, ?, ?, ?, ?)
      `).run(
        backendId,
        today,
        logData.total_tokens || 0,
        logData.response_time_ms || 0,
        isSuccess ? 0 : 1,
        isSuccess ? 1.0 : 0.0
      );
    }
  }

  static getRequestLogs(limit: number = 100, offset: number = 0): RequestLog[] {
    const db = getAnalyticsDb();
    return db.prepare(`
      SELECT * FROM request_logs ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(limit, offset) as RequestLog[];
  }

  static getUsageStats(userId?: number, backendId?: number, days: number = 30): unknown[] {
    const db = getAnalyticsDb();
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let query = `
      SELECT * FROM usage_stats 
      WHERE date >= ? AND date <= ?
    `;
    const params: unknown[] = [startDate, endDate];

    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    if (backendId) {
      query += ' AND backend_id = ?';
      params.push(backendId);
    }

    query += ' ORDER BY date DESC, user_id, backend_id';

    return db.prepare(query).all(...params);
  }

  static getBackendMetrics(backendId?: number, days: number = 30): unknown[] {
    const db = getAnalyticsDb();
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let query = `
      SELECT * FROM backend_metrics 
      WHERE date >= ? AND date <= ?
    `;
    const params: unknown[] = [startDate, endDate];

    if (backendId) {
      query += ' AND backend_id = ?';
      params.push(backendId);
    }

    query += ' ORDER BY date DESC';

    return db.prepare(query).all(...params);
  }
}

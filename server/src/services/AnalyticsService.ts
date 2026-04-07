import {
  type RequestLogInsert,
  type RequestLogQuery,
  RequestLogService,
} from './RequestLogService';

import { ModelCatalogService } from './ModelCatalogService';

import { getAnalyticsDb } from '../config/analytics-db';

import { getLocalDateKey, getUtcTimestamp } from '../utils/time';
import {
  getRequestLogsDb,
  listRequestLogMonths,
} from '../config/request-logs-db';
import { UserModel } from '../models/User';
import { PermissionModel } from '../models/Permission';
import { ScriptModel } from '../models/Script';

import type {
  DashboardSummaryResponse,
  RequestLogPage,
  ScriptType,
} from '../../../shared/types';

type AnalyticsLogInput = RequestLogInsert;
type RequestLogFilter = {
  backendId?: number;
  startDate: string;
  endDate: string;
};

type DailyTotalsRow = {
  date: string;
  total_requests: number;
  total_tokens: number;
};

type RequestLogRangeRow = {
  local_date: string;
  backend_id: number;
  request_model: string | null;
  routed_model: string | null;
  response_model: string | null;
  completion_tokens: number | null;
};

function getDateRange(days: number): { startDate: string; endDate: string } {
  const normalizedDays = Math.max(1, days);
  const endDate = getLocalDateKey();
  const startDate = getLocalDateKey(
    new Date(Date.now() - (normalizedDays - 1) * 24 * 60 * 60 * 1000),
  );
  return { startDate, endDate };
}

function buildRequestLogRangeWhere(filter: RequestLogFilter): {
  whereClause: string;
  params: unknown[];
} {
  const clauses = ['local_date >= ?', 'local_date <= ?'];
  const params: unknown[] = [filter.startDate, filter.endDate];

  if (filter.backendId) {
    clauses.push('backend_id = ?');
    params.push(filter.backendId);
  }

  return {
    whereClause: `WHERE ${clauses.join(' AND ')}`,
    params,
  };
}

function getRequestLogMonthsForRange(
  startDate: string,
  endDate: string,
): string[] {
  const startMonth = startDate.slice(0, 7);
  const endMonth = endDate.slice(0, 7);
  return listRequestLogMonths().filter(
    (month) => month >= startMonth && month <= endMonth,
  );
}

function groupByDate(rows: DailyTotalsRow[]): DailyTotalsRow[] {
  const grouped = new Map<string, DailyTotalsRow>();
  for (const row of rows) {
    const existing = grouped.get(row.date);
    if (existing) {
      existing.total_requests += row.total_requests;
      existing.total_tokens += row.total_tokens;
    } else {
      grouped.set(row.date, { ...row });
    }
  }

  return Array.from(grouped.values()).sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

function calculateQuantile(sortedValues: number[], ratio: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];

  const index = (sortedValues.length - 1) * ratio;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);

  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex];
  }

  const weight = index - lowerIndex;
  return (
    sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight
  );
}

function createScriptTypeCounts(): Record<ScriptType, number> {
  return {
    'per-user-backend': 0,
    'per-backend': 0,
    'per-user': 0,
  };
}

export class AnalyticsService {
  static logRequest(logData: AnalyticsLogInput): void {
    try {
      RequestLogService.logRequest(logData);

      if (logData.backend_id > 0) {
        this.updateUsageStats(
          logData.user_id,
          logData.backend_id,
          logData.total_tokens || 0,
        );
        this.updateBackendMetrics(logData.backend_id, logData);
      }
    } catch (error) {
      console.error('Failed to log analytics:', error);
    }
  }

  private static updateUsageStats(
    userId: number,
    backendId: number,
    tokens: number,
  ): void {
    const db = getAnalyticsDb();
    const today = getLocalDateKey();

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

  private static updateBackendMetrics(
    backendId: number,
    logData: AnalyticsLogInput,
  ): void {
    const db = getAnalyticsDb();
    const today = getLocalDateKey();
    const isSuccess = logData.status_code >= 200 && logData.status_code < 300;

    const existing = db
      .prepare(
        'SELECT * FROM backend_metrics WHERE backend_id = ? AND date = ?',
      )
      .get(backendId, today) as
      | {
          total_requests: number;
          total_tokens: number;
          avg_response_time_ms: number;
          error_count: number;
        }
      | undefined;

    if (existing) {
      const newTotalRequests = existing.total_requests + 1;
      const newTotalTokens =
        existing.total_tokens + (logData.total_tokens || 0);
      const newErrorCount = existing.error_count + (isSuccess ? 0 : 1);
      const newAvgResponseTime = logData.response_time_ms
        ? (existing.avg_response_time_ms * existing.total_requests +
            logData.response_time_ms) /
          newTotalRequests
        : existing.avg_response_time_ms;
      const newSuccessRate =
        (newTotalRequests - newErrorCount) / newTotalRequests;

      db.prepare(
        `
        UPDATE backend_metrics SET
          total_requests = ?,
          total_tokens = ?,
          avg_response_time_ms = ?,
          error_count = ?,
          success_rate = ?
        WHERE backend_id = ? AND date = ?
      `,
      ).run(
        newTotalRequests,
        newTotalTokens,
        newAvgResponseTime,
        newErrorCount,
        newSuccessRate,
        backendId,
        today,
      );
    } else {
      db.prepare(
        `
        INSERT INTO backend_metrics (
          backend_id, date, total_requests, total_tokens,
          avg_response_time_ms, error_count, success_rate
        ) VALUES (?, ?, 1, ?, ?, ?, ?)
      `,
      ).run(
        backendId,
        today,
        logData.total_tokens || 0,
        logData.response_time_ms || 0,
        isSuccess ? 0 : 1,
        isSuccess ? 1.0 : 0.0,
      );
    }
  }

  static getRequestLogs(query: RequestLogQuery = {}): RequestLogPage {
    return RequestLogService.getRequestLogs(query);
  }

  static getUsageStats(
    userId?: number,
    backendId?: number,
    days: number = 30,
  ): unknown[] {
    const db = getAnalyticsDb();
    const endDate = getLocalDateKey();
    const startDate = getLocalDateKey(
      new Date(Date.now() - days * 24 * 60 * 60 * 1000),
    );

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
    const { startDate, endDate } = getDateRange(days);

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

  static getDailyTotals(
    backendId?: number,
    days: number = 30,
  ): DailyTotalsRow[] {
    const db = getAnalyticsDb();
    const { startDate, endDate } = getDateRange(days);

    if (backendId) {
      return db
        .prepare(
          `
        SELECT date, SUM(total_requests) as total_requests, SUM(total_tokens) as total_tokens
        FROM usage_stats
        WHERE date >= ? AND date <= ? AND backend_id = ?
        GROUP BY date
        ORDER BY date ASC
      `,
        )
        .all(startDate, endDate, backendId) as DailyTotalsRow[];
    }

    return db
      .prepare(
        `
      SELECT date, SUM(total_requests) as total_requests, SUM(total_tokens) as total_tokens
      FROM usage_stats
      WHERE date >= ? AND date <= ?
      GROUP BY date
      ORDER BY date ASC
    `,
      )
      .all(startDate, endDate) as DailyTotalsRow[];
  }

  static getBackendQuality(backendId?: number, days: number = 30): unknown[] {
    const db = getAnalyticsDb();
    const { startDate, endDate } = getDateRange(days);

    let query = `
      SELECT backend_id, date, total_requests, total_tokens, avg_response_time_ms, error_count, success_rate
      FROM backend_metrics
      WHERE date >= ? AND date <= ?
    `;
    const params: unknown[] = [startDate, endDate];

    if (backendId) {
      query += ' AND backend_id = ?';
      params.push(backendId);
    }

    query += ' ORDER BY date ASC, backend_id ASC';

    return db.prepare(query).all(...params);
  }

  private static collectRequestLogRangeRows(
    filter: RequestLogFilter,
  ): RequestLogRangeRow[] {
    const { whereClause, params } = buildRequestLogRangeWhere(filter);
    const rows: RequestLogRangeRow[] = [];

    for (const month of getRequestLogMonthsForRange(
      filter.startDate,
      filter.endDate,
    )) {
      const db = getRequestLogsDb(month);
      const monthRows = db
        .prepare(
          `
        SELECT local_date, backend_id, request_model, routed_model, response_model, completion_tokens
        FROM request_logs
        ${whereClause}
      `,
        )
        .all(...params) as RequestLogRangeRow[];
      rows.push(...monthRows);
    }

    return rows;
  }

  static getModelTrends(
    backendId?: number,
    days: number = 30,
    limit: number = 8,
  ): unknown[] {
    const { startDate, endDate } = getDateRange(days);
    const rows = this.collectRequestLogRangeRows({
      backendId,
      startDate,
      endDate,
    });
    const countsByModel = new Map<string, number>();
    const countsByDateAndModel = new Map<string, number>();

    for (const row of rows) {
      const model =
        row.response_model ||
        row.routed_model ||
        row.request_model ||
        'unknown';
      countsByModel.set(model, (countsByModel.get(model) ?? 0) + 1);
      const key = `${row.local_date}::${model}`;
      countsByDateAndModel.set(key, (countsByDateAndModel.get(key) ?? 0) + 1);
    }

    const topModels = Array.from(countsByModel.entries())
      .sort(
        (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
      )
      .slice(0, Math.max(1, limit))
      .map(([model]) => model);

    const result: Array<{
      date: string;
      model: string;
      request_count: number;
    }> = [];
    const seenDates = new Set(rows.map((row) => row.local_date));

    for (const date of Array.from(seenDates).sort((left, right) =>
      left.localeCompare(right),
    )) {
      for (const model of topModels) {
        result.push({
          date,
          model,
          request_count: countsByDateAndModel.get(`${date}::${model}`) ?? 0,
        });
      }
    }

    return result;
  }

  static getResponseLengthHistogram(
    backendId?: number,
    days: number = 30,
    bins: number = 20,
  ): unknown[] {
    const { startDate, endDate } = getDateRange(days);
    const values = this.collectRequestLogRangeRows({
      backendId,
      startDate,
      endDate,
    })
      .map((row) => row.completion_tokens)
      .filter(
        (value): value is number =>
          typeof value === 'number' && Number.isFinite(value) && value >= 0,
      );

    if (values.length === 0) {
      return [];
    }

    const safeBinCount = Math.max(1, bins);
    const min = Math.min(...values);
    const max = Math.max(...values);

    if (min === max) {
      return [{ bin_start: min, bin_end: max, count: values.length }];
    }

    const width = (max - min) / safeBinCount;
    const histogram = Array.from({ length: safeBinCount }, (_, index) => ({
      bin_start: min + width * index,
      bin_end: index === safeBinCount - 1 ? max : min + width * (index + 1),
      count: 0,
    }));

    for (const value of values) {
      const index = Math.min(
        safeBinCount - 1,
        Math.floor((value - min) / width),
      );
      histogram[index].count += 1;
    }

    return histogram;
  }

  static getResponseLengthBoxPlot(
    backendId?: number,
    days: number = 30,
  ): unknown[] {
    const { startDate, endDate } = getDateRange(days);
    const rows = this.collectRequestLogRangeRows({
      backendId,
      startDate,
      endDate,
    });
    const valuesByDate = new Map<string, number[]>();

    for (const row of rows) {
      if (
        typeof row.completion_tokens !== 'number' ||
        !Number.isFinite(row.completion_tokens) ||
        row.completion_tokens < 0
      ) {
        continue;
      }

      const values = valuesByDate.get(row.local_date) ?? [];
      values.push(row.completion_tokens);
      valuesByDate.set(row.local_date, values);
    }

    return Array.from(valuesByDate.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([date, values]) => {
        const sortedValues = [...values].sort((left, right) => left - right);
        return {
          date,
          min: sortedValues[0],
          q1: calculateQuantile(sortedValues, 0.25),
          median: calculateQuantile(sortedValues, 0.5),
          q3: calculateQuantile(sortedValues, 0.75),
          max: sortedValues[sortedValues.length - 1],
          count: sortedValues.length,
        };
      });
  }

  static getDashboardSummary(days: number = 30): DashboardSummaryResponse {
    const normalizedDays = Math.max(1, days);
    const users = UserModel.findAll();
    const backends = ModelCatalogService.getBackendsWithSummary();
    const permissions = PermissionModel.findAll();
    const scripts = ScriptModel.findAll();
    const cacheOverview = ModelCatalogService.getCacheOverview();
    const now = getUtcTimestamp();
    const staleThresholdMs = 24 * 60 * 60 * 1000;
    const permissionsByUserId = new Set(
      permissions.map((permission) => permission.user_id),
    );
    const totalByType = createScriptTypeCounts();
    const activeByType = createScriptTypeCounts();

    for (const script of scripts) {
      totalByType[script.script_type] += 1;
      if (script.is_active) {
        activeByType[script.script_type] += 1;
      }
    }

    const cacheStateCounts = cacheOverview.backends.reduce(
      (acc, backend) => {
        acc[backend.state] += 1;
        return acc;
      },
      {
        ready: 0,
        uninitialized: 0,
        error: 0,
        inactive: 0,
      },
    );

    const staleBackends = backends
      .filter((backend) => {
        if (!backend.is_active || !backend.last_model_sync_at) {
          return false;
        }
        const lastSyncedAt = Date.parse(backend.last_model_sync_at);
        return (
          Number.isFinite(lastSyncedAt) &&
          Date.now() - lastSyncedAt > staleThresholdMs
        );
      })
      .map((backend) => ({
        id: backend.id,
        name: backend.name,
        state: backend.model_cache_state ?? 'uninitialized',
        last_synced_at: backend.last_model_sync_at,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));

    return {
      window_days: normalizedDays,
      generated_at: now,
      overview: {
        total_users: users.length,
        active_users: users.filter((user) => user.is_active).length,
        total_backends: backends.length,
        active_backends: backends.filter((backend) => backend.is_active).length,
        total_permissions: permissions.length,
        total_scripts: scripts.length,
        active_scripts: scripts.filter((script) => script.is_active).length,
      },
      health: {
        cache_state_counts: cacheStateCounts,
        stale_backends: staleBackends,
        public_health: {
          status: 'ok',
          timestamp: now,
        },
        admin_health: {
          status: 'ok',
          timestamp: now,
        },
      },
      logging: {
        users_with_detail_logging: users.filter((user) => user.detail_logging)
          .length,
        backends_with_detail_logging: backends.filter(
          (backend) => backend.detail_logging,
        ).length,
      },
      scripts: {
        active_by_type: activeByType,
        total_by_type: totalByType,
      },
      access: {
        permission_assignments: permissions.length,
        users_without_permissions: users.filter(
          (user) => !permissionsByUserId.has(user.id),
        ).length,
      },
      series: {
        daily_totals: this.getDailyTotals(undefined, normalizedDays),
        backend_quality: this.getBackendQuality(
          undefined,
          normalizedDays,
        ) as DashboardSummaryResponse['series']['backend_quality'],
        model_trends: this.getModelTrends(
          undefined,
          normalizedDays,
          6,
        ) as DashboardSummaryResponse['series']['model_trends'],
      },
    };
  }
}

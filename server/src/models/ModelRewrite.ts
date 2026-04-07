import { getDb } from '../config/database.js';
import { getUtcTimestamp } from '../utils/time.js';

import type {
  CreateModelRewriteData,
  ModelRewriteRule,
  UpdateModelRewriteData,
} from '../../../shared/types.js';

function asRule(row: any): ModelRewriteRule {
  row.is_active = !!row.is_active;
  row.force = !!row.force;
  return row as ModelRewriteRule;
}

export class ModelRewriteModel {
  static findAll(): ModelRewriteRule[] {
    return getDb()
      .prepare('SELECT * FROM model_rewrites ORDER BY source_model')
      .all()
      .map(asRule);
  }

  static findById(id: number): ModelRewriteRule | undefined {
    const row = getDb()
      .prepare('SELECT * FROM model_rewrites WHERE id = ?')
      .get(id);
    return row ? asRule(row) : undefined;
  }

  static create(data: CreateModelRewriteData): ModelRewriteRule {
    const timestamp = getUtcTimestamp();
    const result = getDb()
      .prepare(
        `
        INSERT INTO model_rewrites (source_model, target_model, is_active, force, note, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        data.source_model,
        data.target_model,
        data.is_active === false ? 0 : 1,
        data.force ? 1 : 0,
        data.note || null,
        timestamp,
        timestamp,
      );

    return this.findById(result.lastInsertRowid as number)!;
  }

  static update(
    id: number,
    data: UpdateModelRewriteData,
  ): ModelRewriteRule | undefined {
    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.source_model !== undefined) {
      updates.push('source_model = ?');
      values.push(data.source_model);
    }
    if (data.target_model !== undefined) {
      updates.push('target_model = ?');
      values.push(data.target_model);
    }
    if (data.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(data.is_active ? 1 : 0);
    }
    if (data.force !== undefined) {
      updates.push('force = ?');
      values.push(data.force ? 1 : 0);
    }
    if (data.note !== undefined) {
      updates.push('note = ?');
      values.push(data.note || null);
    }
    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push('updated_at = ?');
    values.push(getUtcTimestamp(), id);
    getDb()
      .prepare(`UPDATE model_rewrites SET ${updates.join(', ')} WHERE id = ?`)
      .run(...values);
    return this.findById(id);
  }

  static delete(id: number): boolean {
    const result = getDb()
      .prepare('DELETE FROM model_rewrites WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }
}

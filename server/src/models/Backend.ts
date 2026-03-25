import { getDb } from '../config/database';
import { Backend, CreateBackendData, UpdateBackendData } from '../../../shared/types';
import { getUtcTimestamp } from '../utils/time';

export class BackendModel {
  static asBackend(row: any): Backend {
    row.is_active = !!row.is_active;
    row.detail_logging = !!row.detail_logging;
    return row;
  }

  static mightBeBackend(row: any): Backend | undefined {
    if (!row) return undefined;
    return this.asBackend(row);
  }

  static findAll(): Backend[] {
    return getDb().prepare('SELECT * FROM backends ORDER BY created_at DESC').all().map(this.asBackend);
  }

  static findById(id: number): Backend | undefined {
    return this.mightBeBackend(getDb().prepare('SELECT * FROM backends WHERE id = ?').get(id));
  }

  static findActive(): Backend[] {
    return getDb().prepare('SELECT * FROM backends WHERE is_active = 1 ORDER BY name').all().map(this.asBackend);
  }

  static create(data: CreateBackendData): Backend {
    const timestamp = getUtcTimestamp();
    const detailLogging = data.detail_logging ?? false;
    const stmt = getDb().prepare(
      'INSERT INTO backends (name, base_url, api_key, detail_logging, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(data.name, data.base_url, data.api_key || null, detailLogging ? 1 : 0, timestamp, timestamp);

    return {
      id: result.lastInsertRowid as number,
      name: data.name,
      base_url: data.base_url,
      api_key: data.api_key,
      is_active: true,
      detail_logging: detailLogging,
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  static update(id: number, data: UpdateBackendData): Backend | undefined {
    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.base_url !== undefined) {
      updates.push('base_url = ?');
      values.push(data.base_url);
    }
    if (data.api_key !== undefined) {
      updates.push('api_key = ?');
      values.push(data.api_key);
    }
    if (data.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(data.is_active ? 1 : 0);
    }
    if (data.detail_logging !== undefined) {
      updates.push('detail_logging = ?');
      values.push(data.detail_logging ? 1 : 0);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push('updated_at = ?');
    values.push(getUtcTimestamp());
    values.push(id);

    getDb().prepare(`UPDATE backends SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  static delete(id: number): boolean {
    const result = getDb().prepare('DELETE FROM backends WHERE id = ?').run(id);
    return result.changes > 0;
  }

  static deactivate(id: number): boolean {
    const result = getDb().prepare('UPDATE backends SET is_active = 0, updated_at = ? WHERE id = ?').run(getUtcTimestamp(), id);
    return result.changes > 0;
  }
}

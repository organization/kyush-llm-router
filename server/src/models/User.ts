import { getDb } from '../config/database';
import { User, CreateUserData, UpdateUserData } from '../../../shared/types';
import { generateApiKey } from '../utils/apiKey';
import { getUtcTimestamp } from '../utils/time';

export class UserModel {
  static asUser(row: any): User {
    row.is_active = !!row.is_active;
    row.detail_logging = !!row.detail_logging;
    row.copy_reasoning_to_reasoning_content = !!row.copy_reasoning_to_reasoning_content;
    return row as User;
  }

  static mightBeUser(row: any): User | undefined {
    if (!row) return undefined;
    return this.asUser(row);
  }

  static findAll(): User[] {
    return getDb().prepare('SELECT * FROM users ORDER BY created_at DESC').all().map(this.asUser);
  }

  static findById(id: number): User | undefined {
    return this.mightBeUser(getDb().prepare('SELECT * FROM users WHERE id = ?').get(id));
  }

  static findByApiKey(apiKey: string): User | undefined {
    return this.mightBeUser(getDb().prepare('SELECT * FROM users WHERE api_key = ? AND is_active = 1').get(apiKey));
  }

  static create(data: CreateUserData): User {
    const apiKey = data.api_key ?? generateApiKey();
    const timestamp = getUtcTimestamp();
    const detailLogging = data.detail_logging ?? false;
    const copyReasoning = data.copy_reasoning_to_reasoning_content ?? false;
    const stmt = getDb().prepare(
      'INSERT INTO users (api_key, name, email, detail_logging, copy_reasoning_to_reasoning_content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(apiKey, data.name, data.email || null, detailLogging ? 1 : 0, copyReasoning ? 1 : 0, timestamp, timestamp);
    
    return {
      id: result.lastInsertRowid as number,
      api_key: apiKey,
      name: data.name,
      email: data.email,
      is_active: true,
      detail_logging: detailLogging,
      copy_reasoning_to_reasoning_content: copyReasoning,
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  static update(id: number, data: UpdateUserData): User | undefined {
    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.email !== undefined) {
      updates.push('email = ?');
      values.push(data.email);
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
    if (data.copy_reasoning_to_reasoning_content !== undefined) {
      updates.push('copy_reasoning_to_reasoning_content = ?');
      values.push(data.copy_reasoning_to_reasoning_content ? 1 : 0);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push('updated_at = ?');
    values.push(getUtcTimestamp());
    values.push(id);

    getDb().prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  static delete(id: number): boolean {
    const result = getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
    return result.changes > 0;
  }

  static deactivate(id: number): boolean {
    const result = getDb().prepare('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?').run(getUtcTimestamp(), id);
    return result.changes > 0;
  }

  static regenerateApiKey(id: number): string | null {
    const user = this.findById(id);
    if (!user) return null;

    const newApiKey = generateApiKey();
    getDb().prepare('UPDATE users SET api_key = ?, updated_at = ? WHERE id = ?').run(newApiKey, getUtcTimestamp(), id);
    return newApiKey;
  }
}

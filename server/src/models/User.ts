import db from '../config/database';
import { User, CreateUserData, UpdateUserData } from '../../../shared/types';

export class UserModel {
  static findAll(): User[] {
    return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as User[];
  }

  static findById(id: number): User | undefined {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  }

  static findByApiKey(apiKey: string): User | undefined {
    return db.prepare('SELECT * FROM users WHERE api_key = ? AND is_active = 1').get(apiKey) as User | undefined;
  }

  static create(data: CreateUserData): User {
    const stmt = db.prepare(
      'INSERT INTO users (api_key, name, email) VALUES (?, ?, ?)'
    );
    const result = stmt.run(data.name, data.email || null);
    
    return {
      id: result.lastInsertRowid as number,
      api_key: data.name,
      name: data.name,
      email: data.email,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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
    if (data.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(data.is_active);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  static delete(id: number): boolean {
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return result.changes > 0;
  }

  static deactivate(id: number): boolean {
    const result = db.prepare('UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    return result.changes > 0;
  }

  static regenerateApiKey(id: number): string | null {
    const user = this.findById(id);
    if (!user) return null;

    const newApiKey = `sk-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    db.prepare('UPDATE users SET api_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newApiKey, id);
    return newApiKey;
  }
}

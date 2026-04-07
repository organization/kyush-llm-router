import { getDb } from '../config/database.js';

import { getUtcTimestamp } from '../utils/time.js';

import type {
  UserScript,
  CreateScriptData,
  UpdateScriptData,
} from '../../../shared/types.js';

export class ScriptModel {
  static asUserScript(row: any): UserScript {
    row.is_active = !!row.is_active;
    return row as UserScript;
  }

  static mightBeUserScript(row: any): UserScript | undefined {
    if (!row) return undefined;
    return this.asUserScript(row);
  }

  static findAll(): UserScript[] {
    return getDb()
      .prepare('SELECT * FROM user_scripts ORDER BY created_at DESC')
      .all()
      .map(this.asUserScript);
  }

  static findById(id: number): UserScript | undefined {
    return this.mightBeUserScript(
      getDb().prepare('SELECT * FROM user_scripts WHERE id = ?').get(id),
    );
  }

  static findByName(name: string): UserScript | undefined {
    return this.mightBeUserScript(
      getDb().prepare('SELECT * FROM user_scripts WHERE name = ?').get(name),
    );
  }

  static findByScriptType(scriptType: string): UserScript[] {
    return getDb()
      .prepare(
        'SELECT * FROM user_scripts WHERE script_type = ? ORDER BY created_at DESC',
      )
      .all(scriptType)
      .map(this.asUserScript);
  }

  static findActive(): UserScript[] {
    return getDb()
      .prepare(
        'SELECT * FROM user_scripts WHERE is_active = 1 ORDER BY created_at DESC',
      )
      .all()
      .map(this.asUserScript);
  }

  static create(data: CreateScriptData): UserScript {
    try {
      const timestamp = getUtcTimestamp();
      const stmt = getDb().prepare(
        'INSERT INTO user_scripts (name, script_type, target_user_id, target_backend_id, script_code, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      );
      const isActive = data.is_active ?? true;
      const result = stmt.run(
        data.name,
        data.script_type,
        data.target_user_id ?? null,
        data.target_backend_id ?? null,
        data.script_code,
        isActive ? 1 : 0,
        timestamp,
        timestamp,
      );

      return {
        id: result.lastInsertRowid as number,
        name: data.name,
        script_type: data.script_type,
        target_user_id: data.target_user_id ?? null,
        target_backend_id: data.target_backend_id ?? null,
        script_code: data.script_code,
        is_active: isActive,
        created_at: timestamp,
        updated_at: timestamp,
      };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('UNIQUE constraint failed')
      ) {
        throw new Error('Script name already exists');
      }
      throw error;
    }
  }

  static update(id: number, data: UpdateScriptData): UserScript | undefined {
    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.script_type !== undefined) {
      updates.push('script_type = ?');
      values.push(data.script_type);
    }
    if (data.target_user_id !== undefined) {
      updates.push('target_user_id = ?');
      values.push(data.target_user_id ?? null);
    }
    if (data.target_backend_id !== undefined) {
      updates.push('target_backend_id = ?');
      values.push(data.target_backend_id ?? null);
    }
    if (data.script_code !== undefined) {
      updates.push('script_code = ?');
      values.push(data.script_code);
    }
    if (data.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(data.is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push('updated_at = ?');
    values.push(getUtcTimestamp());
    values.push(id);

    getDb()
      .prepare(`UPDATE user_scripts SET ${updates.join(', ')} WHERE id = ?`)
      .run(...values);
    return this.findById(id);
  }

  static delete(id: number): boolean {
    const result = getDb()
      .prepare('DELETE FROM user_scripts WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }

  static activate(id: number): boolean {
    const result = getDb()
      .prepare(
        'UPDATE user_scripts SET is_active = 1, updated_at = ? WHERE id = ?',
      )
      .run(getUtcTimestamp(), id);
    return result.changes > 0;
  }

  static deactivate(id: number): boolean {
    const result = getDb()
      .prepare(
        'UPDATE user_scripts SET is_active = 0, updated_at = ? WHERE id = ?',
      )
      .run(getUtcTimestamp(), id);
    return result.changes > 0;
  }

  static getMatchingScripts(userId: number, backendId: number): UserScript[] {
    const db = getDb();

    const allScripts = db
      .prepare('SELECT * FROM user_scripts WHERE is_active = 1')
      .all()
      .map(this.asUserScript);

    return allScripts.filter((script) => {
      if (script.script_type === 'per-user-backend') {
        return (
          script.target_user_id === userId &&
          script.target_backend_id === backendId
        );
      } else if (script.script_type === 'per-backend') {
        return script.target_backend_id === backendId;
      } else if (script.script_type === 'per-user') {
        return script.target_user_id === userId;
      }
      return false;
    });
  }

  static getMatchingBackendScripts(backendId: number): UserScript[] {
    const db = getDb();

    const allScripts = db
      .prepare('SELECT * FROM user_scripts WHERE is_active = 1')
      .all()
      .map(this.asUserScript);

    return allScripts.filter((script) => {
      if (script.script_type === 'per-backend') {
        return script.target_backend_id === backendId;
      } else if (script.script_type === 'per-user-backend') {
        return script.target_backend_id === backendId;
      }
      return false;
    });
  }

  static getMatchingUserScripts(userId: number): UserScript[] {
    const db = getDb();

    const allScripts = db
      .prepare('SELECT * FROM user_scripts WHERE is_active = 1')
      .all()
      .map(this.asUserScript);

    return allScripts.filter((script) => {
      if (script.script_type === 'per-user') {
        return script.target_user_id === userId;
      } else if (script.script_type === 'per-user-backend') {
        return script.target_user_id === userId;
      }
      return false;
    });
  }
}

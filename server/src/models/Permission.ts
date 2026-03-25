import { getDb } from '../config/database';
import { Permission, CreatePermissionData } from '../../../shared/types';
import { getUtcTimestamp } from '../utils/time';

export class PermissionModel {
  static findAll(): Permission[] {
    return getDb().prepare('SELECT * FROM permissions ORDER BY created_at DESC').all() as Permission[];
  }

  static findByUserId(userId: number): Permission[] {
    return getDb().prepare('SELECT * FROM permissions WHERE user_id = ? ORDER BY backend_id').all(userId) as Permission[];
  }

  static findByBackendId(backendId: number): Permission[] {
    return getDb().prepare('SELECT * FROM permissions WHERE backend_id = ? ORDER BY user_id').all(backendId) as Permission[];
  }

  static findUserBackendPermissions(userId: number, backendId: number): Permission | undefined {
    return getDb().prepare('SELECT * FROM permissions WHERE user_id = ? AND backend_id = ?').get(userId, backendId) as Permission | undefined;
  }

  static create(data: CreatePermissionData): Permission {
    try {
      const timestamp = getUtcTimestamp();
      const stmt = getDb().prepare(
        'INSERT INTO permissions (user_id, backend_id, created_at) VALUES (?, ?, ?)'
      );
      const result = stmt.run(data.user_id, data.backend_id, timestamp);

      return {
        id: result.lastInsertRowid as number,
        user_id: data.user_id,
        backend_id: data.backend_id,
        created_at: timestamp,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        throw new Error('Permission already exists for this user and backend');
      }
      throw error;
    }
  }

  static delete(user_id: number, backend_id: number): boolean {
    const result = getDb().prepare('DELETE FROM permissions WHERE user_id = ? AND backend_id = ?').run(user_id, backend_id);
    return result.changes > 0;
  }

  static deleteByUserId(userId: number): number {
    const result = getDb().prepare('DELETE FROM permissions WHERE user_id = ?').run(userId);
    return result.changes;
  }

  static deleteByBackendId(backendId: number): number {
    const result = getDb().prepare('DELETE FROM permissions WHERE backend_id = ?').run(backendId);
    return result.changes;
  }

  static getUserBackendIds(userId: number): number[] {
    const rows = getDb().prepare('SELECT backend_id FROM permissions WHERE user_id = ?').all(userId) as { backend_id: number }[];
    return rows.map(row => row.backend_id);
  }
}

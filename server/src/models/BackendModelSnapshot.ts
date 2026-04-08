import { getDb } from '../config/database';
import { getUtcTimestamp } from '../utils/time';

import type { BackendModelSnapshot } from '../../../shared/types';

function asSnapshot(row: any): BackendModelSnapshot {
  return row as BackendModelSnapshot;
}

export class BackendModelSnapshotModel {
  static findByBackendId(backendId: number): BackendModelSnapshot[] {
    return getDb()
      .prepare(
        'SELECT * FROM backend_models WHERE backend_id = ? ORDER BY model_id',
      )
      .all(backendId)
      .map(asSnapshot);
  }

  static replaceForBackend(
    backendId: number,
    models: Array<{ model_id: string; raw_json?: string }>,
    fetchedAt: string,
  ): void {
    const db = getDb();
    const timestamp = getUtcTimestamp();
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM backend_models WHERE backend_id = ?').run(
        backendId,
      );

      const stmt = db.prepare(`
        INSERT INTO backend_models (backend_id, model_id, raw_json, fetched_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const model of models) {
        stmt.run(
          backendId,
          model.model_id,
          model.raw_json || null,
          fetchedAt,
          timestamp,
          timestamp,
        );
      }
    });

    transaction();
  }
}

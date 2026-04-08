import { getDb } from '../config/database';
import { getUtcTimestamp } from '../utils/time';

import type { AdminPrincipal } from '../../../shared/types';

export interface AdminSessionRecord {
  id: number;
  session_token_hash: string;
  provider: 'env' | 'oidc';
  subject: string;
  username?: string;
  email?: string;
  display_name: string;
  csrf_token: string;
  expires_at: string;
  last_used_at?: string;
  revoked_at?: string;
  created_at: string;
  updated_at: string;
}

export class AdminSessionModel {
  static create(data: {
    sessionTokenHash: string;
    principal: AdminPrincipal;
    csrfToken: string;
    expiresAt: string;
  }): AdminSessionRecord {
    const timestamp = getUtcTimestamp();
    const result = getDb()
      .prepare(
        `
      INSERT INTO admin_sessions (
        session_token_hash, provider, subject, username, email, display_name,
        csrf_token, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        data.sessionTokenHash,
        data.principal.provider,
        data.principal.subject,
        data.principal.username ?? null,
        data.principal.email ?? null,
        data.principal.displayName,
        data.csrfToken,
        data.expiresAt,
        timestamp,
        timestamp,
      );

    return this.findById(Number(result.lastInsertRowid))!;
  }

  static findById(id: number): AdminSessionRecord | undefined {
    return this.maybeRow(
      getDb().prepare('SELECT * FROM admin_sessions WHERE id = ?').get(id),
    );
  }

  static findByTokenHash(
    sessionTokenHash: string,
  ): AdminSessionRecord | undefined {
    this.deleteExpired();
    return this.maybeRow(
      getDb()
        .prepare(
          `
        SELECT * FROM admin_sessions
        WHERE session_token_hash = ? AND revoked_at IS NULL AND expires_at > ?
      `,
        )
        .get(sessionTokenHash, getUtcTimestamp()),
    );
  }

  static touch(id: number): void {
    const timestamp = getUtcTimestamp();
    getDb()
      .prepare(
        'UPDATE admin_sessions SET last_used_at = ?, updated_at = ? WHERE id = ?',
      )
      .run(timestamp, timestamp, id);
  }

  static revoke(id: number): void {
    const timestamp = getUtcTimestamp();
    getDb()
      .prepare(
        'UPDATE admin_sessions SET revoked_at = ?, updated_at = ? WHERE id = ? AND revoked_at IS NULL',
      )
      .run(timestamp, timestamp, id);
  }

  static deleteExpired(): void {
    getDb()
      .prepare(
        'DELETE FROM admin_sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL',
      )
      .run(getUtcTimestamp());
  }

  private static maybeRow(row: any): AdminSessionRecord | undefined {
    if (!row) return undefined;
    return row as AdminSessionRecord;
  }
}

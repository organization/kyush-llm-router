import { getDb } from '../config/database';
import { getUtcTimestamp } from '../utils/time';

import type {
  AdminApiTokenSummary,
  AdminPrincipal,
} from '../../../shared/types';

export interface AdminApiTokenRecord extends AdminApiTokenSummary {
  token_hash: string;
}

export class AdminApiTokenModel {
  static create(data: {
    tokenHash: string;
    tokenPrefix: string;
    name: string;
    principal: AdminPrincipal;
    expiresAt: string;
  }): AdminApiTokenRecord {
    const timestamp = getUtcTimestamp();
    const result = getDb()
      .prepare(
        `
      INSERT INTO admin_api_tokens (
        token_hash, name, provider, subject, username, email, display_name, token_prefix,
        expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        data.tokenHash,
        data.name,
        data.principal.provider,
        data.principal.subject,
        data.principal.username ?? null,
        data.principal.email ?? null,
        data.principal.displayName,
        data.tokenPrefix,
        data.expiresAt,
        timestamp,
        timestamp,
      );

    return this.findById(Number(result.lastInsertRowid))!;
  }

  static findById(id: number): AdminApiTokenRecord | undefined {
    return this.maybeRow(
      getDb().prepare('SELECT * FROM admin_api_tokens WHERE id = ?').get(id),
    );
  }

  static findByTokenHash(tokenHash: string): AdminApiTokenRecord | undefined {
    this.deleteExpired();
    return this.maybeRow(
      getDb()
        .prepare(
          `
        SELECT * FROM admin_api_tokens
        WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?
      `,
        )
        .get(tokenHash, getUtcTimestamp()),
    );
  }

  static listBySubject(subject: string): AdminApiTokenSummary[] {
    this.deleteExpired();
    return getDb()
      .prepare(
        `
      SELECT id, name, provider, subject, username, email, display_name, token_prefix,
             expires_at, last_used_at, revoked_at, created_at, updated_at
      FROM admin_api_tokens
      WHERE subject = ? AND revoked_at IS NULL AND expires_at > ?
      ORDER BY created_at DESC
    `,
      )
      .all(subject, getUtcTimestamp()) as AdminApiTokenSummary[];
  }

  static touch(id: number): void {
    const timestamp = getUtcTimestamp();
    getDb()
      .prepare(
        'UPDATE admin_api_tokens SET last_used_at = ?, updated_at = ? WHERE id = ?',
      )
      .run(timestamp, timestamp, id);
  }

  static revoke(id: number): boolean {
    const timestamp = getUtcTimestamp();
    const result = getDb()
      .prepare(
        `
      UPDATE admin_api_tokens
      SET revoked_at = ?, updated_at = ?
      WHERE id = ? AND revoked_at IS NULL
    `,
      )
      .run(timestamp, timestamp, id);
    return result.changes > 0;
  }

  static revokeForSubject(id: number, subject: string): boolean {
    const timestamp = getUtcTimestamp();
    const result = getDb()
      .prepare(
        `
      UPDATE admin_api_tokens
      SET revoked_at = ?, updated_at = ?
      WHERE id = ? AND subject = ? AND revoked_at IS NULL
    `,
      )
      .run(timestamp, timestamp, id, subject);
    return result.changes > 0;
  }

  static deleteExpired(): void {
    getDb()
      .prepare(
        'DELETE FROM admin_api_tokens WHERE expires_at <= ? OR revoked_at IS NOT NULL',
      )
      .run(getUtcTimestamp());
  }

  private static maybeRow(row: any): AdminApiTokenRecord | undefined {
    if (!row) return undefined;
    return row as AdminApiTokenRecord;
  }
}

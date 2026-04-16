/** Secrets store — wraps LocalDb secret record CRUD and provides inventory operations. */

import type { SecretRecord } from '../shared-types';
import type { LocalDb } from '../storage/local-db';

export class SecretsStore {
  constructor(private db: LocalDb) {}

  /** List all secret records for a project. */
  list(projectId: string): SecretRecord[] {
    return this.db.listSecretRecords(projectId);
  }

  /** Get a single secret record by ID. */
  get(id: string): SecretRecord | null {
    return this.db.getSecretRecord(id);
  }

  /** Upsert a secret record (metadata only — no secret values stored). */
  upsert(record: Omit<SecretRecord, 'createdAt' | 'updatedAt'>): SecretRecord {
    const now = new Date().toISOString();
    const full: SecretRecord = {
      ...record,
      createdAt: now,
      updatedAt: now,
    };
    this.db.upsertSecretRecord(full);
    return full;
  }

  /** Delete a secret record by ID. */
  delete(id: string): { success: boolean } {
    this.db.deleteSecretRecord(id);
    return { success: true };
  }

  /** Get secrets missing for a specific environment. */
  getMissingForEnvironment(projectId: string, environmentId: string): SecretRecord[] {
    return this.db.getMissingSecretsForEnvironment(projectId, environmentId);
  }

  /** Get secrets that have changed since last deploy. */
  getChangedSinceLastDeploy(projectId: string): SecretRecord[] {
    return this.db.getChangedSecretsSinceLastDeploy(projectId);
  }

  /** Verify a secret's presence in keytar (does NOT read the value). */
  verify(id: string): { success: boolean; error?: string } {
    return this.db.verifySecret(id);
  }

  /** Get inventory summary counts. */
  getInventorySummary(projectId: string): { total: number; missing: number; verified: number } {
    return this.db.getSecretInventorySummary(projectId);
  }
}

/**
 * SecretsSync — AES-256-GCM encrypted secrets storage in Supabase.
 *
 * Passphrase is held in memory only (never written to disk or Supabase).
 * Each secret value is encrypted independently with its own random salt + IV.
 * PBKDF2 (SHA-256, 100 000 iterations) derives the 256-bit AES key from the
 * passphrase + salt. The Supabase row stores only the ciphertext blob.
 */

import * as crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface EncryptedBlob {
  iv:   string;   // hex
  tag:  string;   // hex (GCM auth tag)
  data: string;   // hex (ciphertext)
  salt: string;   // hex (PBKDF2 salt)
}

export interface PlaintextSecret {
  projectId:      string;
  credentialType: string;
  value:          string;
}

export class SecretsSync {
  private passphrase: string | null = null;

  constructor(
    private supabase: SupabaseClient,
    private userId: string,
  ) {}

  setPassphrase(passphrase: string): void {
    this.passphrase = passphrase;
  }

  hasPassphrase(): boolean {
    return this.passphrase !== null;
  }

  clearPassphrase(): void {
    this.passphrase = null;
  }

  // ── Crypto helpers ──────────────────────────────────────────────────────────

  private deriveKey(passphrase: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(passphrase, salt, 100_000, 32, 'sha256');
  }

  private encrypt(plaintext: string): EncryptedBlob {
    const salt = crypto.randomBytes(32);
    const key  = this.deriveKey(this.passphrase!, salt);
    const iv   = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return {
      salt: salt.toString('hex'),
      iv:   iv.toString('hex'),
      tag:  cipher.getAuthTag().toString('hex'),
      data: encrypted.toString('hex'),
    };
  }

  private decrypt(blob: EncryptedBlob): string {
    const salt = Buffer.from(blob.salt, 'hex');
    const key  = this.deriveKey(this.passphrase!, salt);
    const iv   = Buffer.from(blob.iv,   'hex');
    const tag  = Buffer.from(blob.tag,  'hex');
    const data = Buffer.from(blob.data, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  // ── Sync up (this device → Supabase) ───────────────────────────────────────

  async syncUp(
    secrets: PlaintextSecret[],
  ): Promise<{ success: boolean; uploaded: number; error?: string }> {
    if (!this.passphrase) return { success: false, uploaded: 0, error: 'No passphrase set' };
    if (secrets.length === 0) return { success: true, uploaded: 0 };

    let uploaded = 0;
    for (const s of secrets) {
      const blob = this.encrypt(s.value);
      const { error } = await this.supabase
        .from('encrypted_project_secrets')
        .upsert({
          user_id:          this.userId,
          project_id:       s.projectId,
          credential_type:  s.credentialType,
          encrypted_blob:   JSON.stringify(blob),
          updated_at:       new Date().toISOString(),
        }, { onConflict: 'user_id,project_id,credential_type' });

      if (error) return { success: false, uploaded, error: error.message };
      uploaded++;
    }

    return { success: true, uploaded };
  }

  // ── Sync down (Supabase → this device) ────────────────────────────────────

  async syncDown(): Promise<{ success: boolean; secrets?: PlaintextSecret[]; error?: string }> {
    if (!this.passphrase) return { success: false, error: 'No passphrase set' };

    const { data, error } = await this.supabase
      .from('encrypted_project_secrets')
      .select('project_id, credential_type, encrypted_blob')
      .eq('user_id', this.userId);

    if (error) return { success: false, error: error.message };

    const secrets: PlaintextSecret[] = [];
    for (const row of data ?? []) {
      try {
        const blob: EncryptedBlob = JSON.parse(row.encrypted_blob as string);
        const value = this.decrypt(blob);
        secrets.push({
          projectId:      row.project_id as string,
          credentialType: row.credential_type as string,
          value,
        });
      } catch {
        return { success: false, error: 'Wrong passphrase or corrupted data' };
      }
    }

    return { success: true, secrets };
  }

  // ── Delete all encrypted secrets for a project (e.g. project deleted) ─────

  async deleteProjectSecrets(projectId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await this.supabase
      .from('encrypted_project_secrets')
      .delete()
      .eq('user_id', this.userId)
      .eq('project_id', projectId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  }
}

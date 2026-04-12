/** Handles saving and retrieving handoff documents from Supabase Storage. */

import { createClient } from '@supabase/supabase-js';

export class HandoffStorage {
  private supabase: ReturnType<typeof createClient>;
  private bucketName = 'handoffs';

  constructor(supabaseUrl: string, supabaseAnonKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
  }

  async saveHandoffDoc(
    userId: string,
    projectId: string,
    filename: string,
    content: string
  ): Promise<{ url: string | null; error: string | null }> {
    const storagePath = `${userId}/${projectId}/${filename}`;

    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(storagePath, content, {
        contentType: 'text/markdown',
        upsert: true,
      });

    if (error) {
      return { url: null, error: error.message };
    }

    const { data } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(storagePath);

    return { url: data.publicUrl, error: null };
  }

  async listHandoffs(userId: string, projectId: string): Promise<string[]> {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .list(`${userId}/${projectId}`);

    if (error || !data) return [];
    return data.map(f => f.name);
  }
}

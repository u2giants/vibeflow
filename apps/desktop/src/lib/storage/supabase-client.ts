/** Supabase client factory — reads config from environment or explicit args. */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface SupabaseConfig {
  url: string;
  anonKey: string;
}

let cachedClient: SupabaseClient | null = null;

/**
 * Get or create the Supabase client.
 * In the renderer process, reads from Vite env vars.
 * In the main process, pass config explicitly.
 */
export function getSupabaseClient(config?: SupabaseConfig): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = config?.url ?? '';
  const anonKey = config?.anonKey ?? '';

  if (!url || !anonKey) {
    console.warn('Supabase URL or anon key not configured. Pass config explicitly.');
  }

  cachedClient = createClient(url, anonKey);
  return cachedClient;
}

/** Reset the cached client (useful for sign-out). */
export function resetSupabaseClient(): void {
  cachedClient = null;
}

/**
 * Connection-test IPC handlers: connectionTest:*
 *
 * Each handler takes the relevant credential(s), makes a lightweight API call
 * to verify they work, and returns { success, message }.
 */

import * as https from 'https';
import { ipcMain } from 'electron';

function httpsGet(options: https.RequestOptions): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

function httpsPost(options: https.RequestOptions, payload: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

export function registerConnectionTestHandlers(): void {
  // ── Railway ───────────────────────────────────────────────────────────────
  // GraphQL: POST https://backboard.railway.app/graphql/v2
  // Query: { me { id name } }  — returns 200 with data.me on success, 401 on bad key
  ipcMain.handle(
    'connectionTest:railway',
    async (_event, apiKey: string): Promise<{ success: boolean; message: string }> => {
      if (!apiKey?.trim()) return { success: false, message: 'No API key provided.' };
      const body = JSON.stringify({ query: '{ me { id name } }' });
      try {
        const result = await httpsPost({
          hostname: 'backboard.railway.app',
          path: '/graphql/v2',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey.trim()}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        }, body);

        if (result.status === 200) {
          const json = JSON.parse(result.body) as Record<string, unknown>;
          const me = (json.data as Record<string, unknown> | undefined)?.me as Record<string, unknown> | undefined;
          if (me?.name) return { success: true, message: `Connected as ${String(me.name)}` };
          if (json.errors) {
            const msg = (json.errors as Array<Record<string, unknown>>)[0]?.message ?? 'Unknown error';
            return { success: false, message: `Railway error: ${String(msg)}` };
          }
          return { success: true, message: 'Connected to Railway.' };
        }
        if (result.status === 401) return { success: false, message: 'Invalid API key (401 Unauthorized).' };
        return { success: false, message: `Railway returned HTTP ${result.status}.` };
      } catch (err) {
        return { success: false, message: `Connection failed: ${String(err instanceof Error ? err.message : err)}` };
      }
    },
  );

  // ── Brevo ─────────────────────────────────────────────────────────────────
  // GET https://api.brevo.com/v3/account  — returns 200 with account info on success
  ipcMain.handle(
    'connectionTest:brevo',
    async (_event, apiKey: string): Promise<{ success: boolean; message: string }> => {
      if (!apiKey?.trim()) return { success: false, message: 'No API key provided.' };
      try {
        const result = await httpsGet({
          hostname: 'api.brevo.com',
          path: '/v3/account',
          method: 'GET',
          headers: { 'api-key': apiKey.trim() },
        });

        if (result.status === 200) {
          const json = JSON.parse(result.body) as Record<string, unknown>;
          const email = json.email as string | undefined;
          return { success: true, message: email ? `Connected — account: ${email}` : 'Connected to Brevo.' };
        }
        if (result.status === 401) return { success: false, message: 'Invalid API key (401 Unauthorized).' };
        if (result.status === 403) return { success: false, message: 'Access forbidden — check key permissions (403).' };
        return { success: false, message: `Brevo returned HTTP ${result.status}.` };
      } catch (err) {
        return { success: false, message: `Connection failed: ${String(err instanceof Error ? err.message : err)}` };
      }
    },
  );

  // ── ClawdTalk ─────────────────────────────────────────────────────────────
  // GET https://api.clawdtalk.com/v1/me  — Authorization: Bearer <key>
  ipcMain.handle(
    'connectionTest:clawdtalk',
    async (_event, apiKey: string): Promise<{ success: boolean; message: string }> => {
      if (!apiKey?.trim()) return { success: false, message: 'No API key provided.' };
      try {
        const result = await httpsGet({
          hostname: 'api.clawdtalk.com',
          path: '/v1/me',
          method: 'GET',
          headers: { 'Authorization': `Bearer ${apiKey.trim()}` },
        });

        if (result.status === 200) {
          try {
            const json = JSON.parse(result.body) as Record<string, unknown>;
            const name = (json.name ?? json.username ?? json.email) as string | undefined;
            return { success: true, message: name ? `Connected — ${name}` : 'Connected to ClawdTalk.' };
          } catch {
            return { success: true, message: 'Connected to ClawdTalk.' };
          }
        }
        if (result.status === 401) return { success: false, message: 'Invalid API key (401 Unauthorized).' };
        if (result.status === 403) return { success: false, message: 'Access forbidden — check key permissions (403).' };
        return { success: false, message: `ClawdTalk returned HTTP ${result.status}.` };
      } catch (err) {
        return { success: false, message: `Connection failed: ${String(err instanceof Error ? err.message : err)}` };
      }
    },
  );
}

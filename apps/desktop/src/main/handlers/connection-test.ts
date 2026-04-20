/**
 * Connection-test IPC handlers: connectionTest:*
 *
 * Each handler takes the relevant credential(s), makes a lightweight API call
 * to verify they work, and returns { success, message }.
 */

import * as https from 'https';
import { spawn } from 'child_process';
import { ipcMain } from 'electron';
import { sshService } from './state';

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

  // ── MCP (stdio only) ─────────────────────────────────────────────────────
  // Spawns the server process, sends a JSON-RPC initialize request over stdin,
  // and waits up to 15 s for a valid initialize response on stdout.
  // SSE/HTTP servers cannot be tested here without a URL — they get an info message.
  ipcMain.handle(
    'connectionTest:mcp',
    async (_event, server: { command: string; args: string[]; transport: string; env: Record<string, string> }): Promise<{ success: boolean; message: string }> => {
      if (!server?.command?.trim()) return { success: false, message: 'No command provided.' };

      if (server.transport !== 'stdio') {
        return {
          success: false,
          message: `Cannot auto-test ${server.transport} servers — add the server, then test it from the MCP screen.`,
        };
      }

      return new Promise((resolve) => {
        const env: Record<string, string> = { ...(process.env as Record<string, string>), ...server.env };
        let resolved = false;
        let stdout = '';
        let stderr = '';

        const child = spawn(server.command.trim(), server.args, {
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: process.platform === 'win32',
        });

        const finish = (result: { success: boolean; message: string }) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);
          try { child.kill(); } catch { /* ignore */ }
          resolve(result);
        };

        const timer = setTimeout(() => {
          const hint = stderr.trim() ? ` stderr: ${stderr.trim().slice(0, 120)}` : '';
          finish({ success: false, message: `Timed out (15 s) — server did not respond to initialize.${hint}` });
        }, 15000);

        child.on('error', (err) => {
          finish({ success: false, message: `Failed to start process: ${err.message}` });
        });

        child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

        child.stdout?.on('data', (chunk: Buffer) => {
          stdout += chunk.toString();
          for (const line of stdout.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const msg = JSON.parse(trimmed) as Record<string, unknown>;
              if (msg.id === 1 && msg.result) {
                const result = msg.result as Record<string, unknown>;
                const info = result.serverInfo as Record<string, unknown> | undefined;
                const name = info?.name as string | undefined;
                const proto = result.protocolVersion as string | undefined;
                finish({
                  success: true,
                  message: name
                    ? `Connected — ${name}${proto ? ` (MCP ${proto})` : ''}`
                    : `Connected (MCP ${proto ?? 'unknown'})`,
                });
              } else if (msg.id === 1 && msg.error) {
                const e = msg.error as Record<string, unknown>;
                finish({ success: false, message: `Server error: ${String(e.message ?? 'unknown')}` });
              }
            } catch { /* partial line — keep reading */ }
          }
        });

        child.on('exit', (code) => {
          const hint = stderr.trim() ? `: ${stderr.trim().slice(0, 160)}` : '';
          finish({ success: false, message: `Process exited (code ${code ?? '?'}) before responding${hint}` });
        });

        const initRequest = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'vibeflow', version: '1.0.0' },
          },
        }) + '\n';

        try { child.stdin?.write(initRequest); } catch { /* ignore */ }
      });
    },
  );

  // ── SSH ───────────────────────────────────────────────────────────────────
  // Delegates to the same SshService used by the tooling handler, unified here.
  ipcMain.handle(
    'connectionTest:ssh',
    async (_event, host: { hostname: string; username: string; port?: number; identityFile?: string }): Promise<{ success: boolean; message: string }> => {
      if (!host?.hostname) return { success: false, message: 'No hostname provided.' };
      try {
        const result = await sshService.testConnection({
          name: host.hostname,
          hostname: host.hostname,
          user: host.username,
          port: host.port ?? 22,
          identityFile: host.identityFile ?? null,
        });
        if (result.success) return { success: true, message: `Connected to ${result.host} (${result.latencyMs ?? '?'}ms)` };
        return { success: false, message: result.error ?? 'Connection failed.' };
      } catch (err) {
        return { success: false, message: `Connection failed: ${String(err instanceof Error ? err.message : err)}` };
      }
    },
  );
}

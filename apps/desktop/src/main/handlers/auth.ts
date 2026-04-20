/**
 * Auth IPC handlers: auth:signInWithGitHub, auth:signInWithEmail, auth:signOut, auth:getSession
 */

import { ipcMain, shell } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import * as http from 'http';
import * as url from 'url';
import type { AuthSignInResult } from '../../lib/shared-types';
import { getSupabaseClient, initSyncEngine } from './helpers';
import { container as state } from './state';

export function registerAuthHandlers(): void {
  /**
   * GitHub OAuth via localhost redirect.
   * Starts a temporary HTTP server, opens GitHub OAuth in the system browser,
   * waits for the callback, exchanges the code for a session, and returns it.
   */
  ipcMain.handle(
    'auth:signInWithGitHub',
    async (): Promise<AuthSignInResult> => {
      const client = getSupabaseClient();
      if (!client) {
        return { success: false, error: 'Supabase not configured. Please create a .env file.' };
      }

      const callbackPort = 54321;
      const callbackPath = '/callback';

      // Wait for OAuth callback — returns either a PKCE code or implicit flow tokens
      function waitForOAuthCallback(): Promise<{ type: 'code'; code: string } | { type: 'tokens'; accessToken: string; refreshToken: string } | { type: 'error'; error: string }> {
        return new Promise((resolve, reject) => {
          const server = http.createServer((req, res) => {
            const rawUrl = req.url ?? '/';

            if (rawUrl === callbackPath || rawUrl.startsWith(`${callbackPath}?`)) {
              // Check for PKCE code in query params
              const parsedUrl = url.parse(rawUrl, true);
              const code = parsedUrl.query.code as string | undefined;
              const error = parsedUrl.query.error as string | undefined;

              if (error) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end('<html><body><h2>Sign-in failed</h2><p>You can close this tab and return to VibeFlow.</p></body></html>');
                server.close();
                resolve({ type: 'error', error: `OAuth error: ${error}` });
                return;
              }

              if (code) {
                // PKCE flow — exchange code for session
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end('<html><body><h2>Sign-in successful! You can close this tab and return to VibeFlow.</h2></body></html>');
                server.close();
                resolve({ type: 'code', code });
                return;
              }

              // No code in query params — serve a page that extracts hash fragment and posts it back
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(`<!DOCTYPE html>
<html>
<head><title>VibeFlow Sign-in</title></head>
<body>
<h2>Completing sign-in...</h2>
<script>
  // Extract tokens from hash fragment
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (accessToken) {
    // Send tokens back to the local server
    fetch('/callback-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, refreshToken })
    }).then(() => {
      document.body.innerHTML = '<h2>Sign-in successful! You can close this tab and return to VibeFlow.</h2>';
    }).catch(() => {
      document.body.innerHTML = '<h2>Sign-in failed. Could not send tokens. Please try again.</h2>';
    });
  } else {
    document.body.innerHTML = '<h2>Sign-in failed. No tokens received. Please try again.</h2>';
  }
</script>
</body>
</html>`);
              return;
            }

            if (rawUrl === '/callback-tokens' && req.method === 'POST') {
              // Receive tokens posted from the browser page
              let body = '';
              req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
              req.on('end', () => {
                try {
                  const { accessToken, refreshToken } = JSON.parse(body);
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end('{"ok":true}');
                  server.close();
                  resolve({ type: 'tokens', accessToken, refreshToken });
                } catch {
                  res.writeHead(400);
                  res.end('Bad request');
                  reject(new Error('Failed to parse tokens'));
                }
              });
              return;
            }

            // Unknown path
            res.writeHead(404);
            res.end('Not found');
          });

          server.listen(callbackPort, '127.0.0.1', () => {
            console.log(`[main] OAuth callback server listening on http://127.0.0.1:${callbackPort}`);
          });

          server.on('error', (err) => {
            console.error('[main] OAuth callback server error:', err);
            reject(new Error(`Failed to start callback server: ${err.message}`));
          });

          // Timeout after 5 minutes
          setTimeout(() => {
            server.close();
            reject(new Error('OAuth timeout — no response received within 5 minutes'));
          }, 5 * 60 * 1000);
        });
      }

      // Start the OAuth flow
      const redirectUrl = `http://127.0.0.1:${callbackPort}${callbackPath}`;

      try {
        const { data, error: oauthError } = await client.auth.signInWithOAuth({
          provider: 'github',
          options: {
            redirectTo: redirectUrl,
            skipBrowserRedirect: true,
          },
        });

        if (oauthError) {
          return { success: false, error: oauthError.message };
        }

        if (data?.url) {
          shell.openExternal(data.url);
        } else {
          return { success: false, error: 'No OAuth URL received from Supabase' };
        }

        // Wait for callback result
        const callbackResult = await waitForOAuthCallback();

        if (callbackResult.type === 'error') {
          return { success: false, error: callbackResult.error };
        }

        // Exchange tokens for session
        let sessionData: any;
        let sessionError: any;

        if (callbackResult.type === 'code') {
          // PKCE flow
          const result = await client.auth.exchangeCodeForSession(callbackResult.code);
          sessionData = result.data;
          sessionError = result.error;
        } else {
          // Implicit flow — set session directly
          const result = await client.auth.setSession({
            access_token: callbackResult.accessToken,
            refresh_token: callbackResult.refreshToken ?? '',
          });
          sessionData = result.data;
          sessionError = result.error;
        }

        if (sessionError) {
          return { success: false, error: sessionError.message };
        }

        const result: AuthSignInResult = {
          success: true,
          account: {
            id: sessionData.session?.user?.id ?? '',
            email: sessionData.session?.user?.email ?? '',
            displayName: sessionData.session?.user?.user_metadata?.display_name ?? null,
            createdAt: sessionData.session?.user?.created_at ?? '',
          },
        };

        // Initialize sync engine after successful sign-in
        if (result.success && result.account) {
          try {
            await initSyncEngine(result.account.id);
          } catch (err) {
            console.error('[main] Failed to init sync:', err);
          }
        }

        return result;
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }
  );

  ipcMain.handle(
    'auth:signInWithEmail',
    async (_event: IpcMainInvokeEvent, email: string, password: string): Promise<AuthSignInResult> => {
      const client = getSupabaseClient();
      if (!client) return { success: false, error: 'Supabase not configured.' };
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) return { success: false, error: error.message };
      return { success: true, account: { id: data.user?.id ?? '', email: data.user?.email ?? email, displayName: data.user?.user_metadata?.name ?? null, createdAt: data.user?.created_at ?? new Date().toISOString() } };
    }
  );

  ipcMain.handle('auth:signOut', async (): Promise<void> => {
    // Stop sync engine before signing out to prevent stale session operations
    if (state.syncEngine) {
      state.syncEngine.stop();
      state.syncEngine = null;
      console.log('[main] Sync engine stopped on sign-out');
    }
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
  });

  ipcMain.handle(
    'auth:getSession',
    async (): Promise<{ email: string | null }> => {
      const client = getSupabaseClient();
      if (!client) {
        return { email: null };
      }
      const { data } = await client.auth.getSession();
      return { email: data.session?.user?.email ?? null };
    }
  );
}

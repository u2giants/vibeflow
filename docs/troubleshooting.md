# VibeFlow — Troubleshooting Guide

Last updated: 2026-04-18

This guide covers common issues and how to diagnose and fix them.

---

## App Not Launching

### Symptom: Window never appears

**Check 1: ELECTRON_RUN_AS_NODE environment variable**
```cmd
echo %ELECTRON_RUN_AS_NODE%
```
If this returns `1`, Electron is running as plain Node.js and cannot create windows.

**Fix:**
```cmd
set ELECTRON_RUN_AS_NODE=
```
Or in PowerShell:
```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE
```
Then restart the app.

**Check 2: Electron binary missing**
```cmd
dir node_modules\electron\dist\electron.exe
```
If the file doesn't exist:
```cmd
node node_modules/electron/install.js
```

**Check 3: node_modules/electron/path.txt missing**
This file should contain `electron.exe`. If it's missing:
```cmd
echo electron.exe > node_modules\electron\path.txt
```

### Symptom: App crashes immediately with TypeError

If you see `TypeError: Cannot read properties of undefined (reading 'whenReady')`, this is the `ELECTRON_RUN_AS_NODE` issue. See Check 1 above.

### Symptom: White screen after launch

**Check 1: Vite dev server running?**
The renderer loads from `http://localhost:5173` in development. If the Vite dev server failed to start, you'll see a white screen.

**Fix:** Check the terminal output for Vite errors. Common causes:
- Port 5173 already in use
- Missing dependencies (`pnpm install`)
- TypeScript errors preventing compilation

**Check 2: Preload script error**
Open DevTools (`Ctrl+Shift+I`) and check the Console tab for errors. If the preload script failed, `window.vibeflow` will be undefined and the React app will crash.

**Check 3: .env file missing**
If `.env` doesn't exist in the repo root, the Supabase client won't initialize and the app may show a white screen.

**Fix:** Copy `.env.example` to `.env` and fill in the Supabase URL and anon key.

---

## GitHub OAuth Problems

### Symptom: "Supabase not configured" error

**Cause:** The `.env` file is missing or doesn't contain `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

**Fix:** Create a `.env` file in the repo root:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Symptom: "No auth code received" error

**Cause:** Supabase is returning tokens via implicit flow (hash fragment) instead of PKCE code flow. This was a known bug that was fixed in Sprint 12.

**Check:** Verify the OAuth handler in [`apps/desktop/src/main/index.ts`](../apps/desktop/src/main/index.ts) handles both flows. Look for the `/callback-tokens` endpoint and the HTML page that extracts hash fragments.

### Symptom: Browser opens but never redirects back

**Check 1: Port 54321 available?**
The OAuth callback server runs on port 54321. If another process is using this port, the server can't start.

**Fix:** Kill whatever is using port 54321:
```cmd
netstat -ano | findstr :54321
taskkill /PID <pid> /F
```

**Check 2: Redirect URL configured in Supabase?**
In Supabase Dashboard → Authentication → URL Configuration → Redirect URLs, verify that `http://127.0.0.1:54321/callback` is listed.

### Symptom: Sign-in works but email doesn't appear in top bar

**Check:** Open DevTools (`Ctrl+Shift+I`) → Console. Look for errors related to `auth:getSession`. The session may have expired or the Supabase client may not be initialized.

---

## OpenRouter Key / Model Refresh Issues

### Symptom: "No API key" or empty model list

**Check 1: API key saved?**
Go to Modes screen → OpenRouter API Key section. If the field is empty, enter your key and click Save.

**Check 2: keytar working?**
The API key is stored in Windows Credential Manager via keytar. If keytar fails silently, the key won't persist.

**Verify in Windows:**
1. Open "Credential Manager" from Start menu
2. Click "Windows Credentials"
3. Look for entries starting with `vibeflow`

### Symptom: Model list shows 349+ models

**Cause:** The model list endpoint is using `/api/v1/models` instead of `/api/v1/models/user`.

**Fix:** Verify that [`apps/desktop/src/main/index.ts`](../apps/desktop/src/main/index.ts) uses `https://openrouter.ai/api/v1/models/user` in both the `openrouter:listModels` and `openrouter:testConnection` handlers.

### Symptom: "Failed to load models" error

**Check 1: API key valid?**
Go to https://openrouter.ai/keys and verify your key is active.

**Check 2: Network connectivity?**
The app needs to reach `https://openrouter.ai`. Check if you're behind a proxy or firewall.

**Check 3: Rate limited?**
OpenRouter may rate-limit frequent model list requests. Wait a minute and try again.

### Symptom: Models loaded but "Refresh Models" doesn't update

**Fix:** Click the "Refresh Models" button next to the model picker. It should show "Refreshing..." and then "Loaded N models ✅" in green. If it shows an error in red, check the API key and network.

---

## Database / sql.js Issues

### Symptom: "Local DB not initialized" errors

**Cause:** The sql.js database failed to initialize on startup.

**Check:** Look at the terminal output when the app starts. If you see errors related to `sql.js` or `initSqlJs`, the WASM file may not be loading correctly.

**Fix:** Ensure `sql.js` is installed:
```cmd
cd apps/desktop && pnpm install
```

### Symptom: Data lost after restart

**Cause:** sql.js loads the database into memory and flushes to disk. If the app crashes before a flush, recent changes may be lost.

**Check:** Look for the database file in the Electron user data directory:
```cmd
dir %APPDATA%\vibeflow\
```
(The exact path depends on the app name in `package.json`.)

### Symptom: Database corruption

**Fix:** If the database file is corrupted, delete it and restart the app. The app will create a fresh database and seed default Modes. You will lose all local data (projects, conversations, mode customizations).

```cmd
del %APPDATA%\vibeflow\vibeflow.db
```

**Warning:** This deletes all local data. If sync is enabled in the future, data can be recovered from Supabase.

---

## Sync Showing Offline

### Symptom: Sync indicator always shows 🔴 Offline

As of 2026-04-18, cloud sync is **active** — this is now a real problem, not expected behavior.

**Diagnose:**

**Check 1: .env file present and correct?**
```cmd
type .env
```
Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set. If these are missing, the Supabase client cannot connect.

**Check 2: Network reachable?**
Verify that `https://your-project.supabase.co` is reachable. Check for proxy/firewall blocking HTTPS or WSS connections.

**Check 3: Session still valid?**
Sign out and sign back in. A stale auth session can cause the Supabase client to be in an authenticated-but-disconnected state.

**Check 4: DevTools → Console**
Open DevTools (`Ctrl+Shift+I`) → Console. Look for Supabase client errors or `SyncEngine` initialization errors.

**Check 5: Supabase project status**
Log into the Supabase dashboard and verify the project (ref: `wnbazobqhyhncksjfxvq`) is not paused or over quota.

---

## App Boot Crash: "near `/`: syntax error"

### Symptom: App crashes at startup with a SQLite syntax error mentioning `/`

**Cause:** A SQL string in the codebase contains `//` inside a query (used as a comment), but sql.js parses `//` as a division operator, not a comment.

**Fix:** Find the offending SQL string and change `//` comments to `--` comments.

```
❌  SELECT * FROM projects -- WHERE deleted = 0 // old filter
✅  SELECT * FROM projects -- WHERE deleted = 0 -- old filter
```

See [`docs/idiosyncrasies.md`](idiosyncrasies.md) entry #16 for details.

---

## App Boot Crash: "Attempted to register a second handler for"

### Symptom: App crashes immediately after launch with an error like `Error: Attempted to register a second handler for 'conversations:list'`

**Cause:** A duplicate IPC handler registration. The main process calls `ipcMain.handle()` twice for the same channel. This crashes the app at boot with no recovery.

**Fix:**
1. Search the entire `apps/desktop/src/main/index.ts` file for the duplicated channel name
2. Remove the duplicate registration — keep only one
3. Check git blame or recent commits to identify which change added the duplicate

**Prevention:** Always `grep` for the channel name before adding a new `ipcMain.handle()` call. See [`docs/idiosyncrasies.md`](idiosyncrasies.md) entry #15.

---

## Conversation Lease Error: "new row violates row-level security policy"

### Symptom: Error `new row violates row-level security policy for table "conversation_leases"` in the console

**Cause:** The conversation row doesn't exist in Supabase yet when `acquireLease()` tries to insert a `conversation_leases` row. Supabase RLS requires the FK target to exist AND the user to own it.

**This should not happen in normal use** because `acquireLease()` calls `pushConversation()` first. If you see this error:
1. Check that `SyncEngine.acquireLease()` still has the `pushConversation()` guard at the top — do not remove it
2. If the guard is missing (e.g., after a refactor), add it back

See [`docs/idiosyncrasies.md`](idiosyncrasies.md) entry #11.

---

## Projects List Empty After Sign-In

### Symptom: User signs in successfully but the project list is always empty, even though projects exist in Supabase

**Cause:** `listProjects()` was called with an empty string (`''`) as the user ID instead of the real Supabase user ID. An empty string matches no rows (silently, no error).

**Fix:** Wherever `listProjects()` is called, ensure it receives `session.user.id` — the actual UUID from the Supabase auth session. Never pass an empty string or hardcoded placeholder.

See [`docs/idiosyncrasies.md`](idiosyncrasies.md) entry #17.

---

## Conversations Button Not Responding

### Symptom: Clicking the "Conversations" button in the project panel does nothing

**Cause:** The `handleOpenConversations` handler is missing or not wired in `PanelWorkspace.tsx`. The button renders but has no `onClick` function attached.

**Fix:** Verify that `PanelWorkspace.tsx` has `handleOpenConversations` defined and passed as the `onOpenConversations` prop to the relevant panel component. This was a known bug fixed in the brownfield rebuild.

---

## DevTools Opening Unexpectedly

### Symptom: Chromium DevTools open on every app launch

**Cause:** Someone re-added `mainWindow.webContents.openDevTools()` to the development startup path.

**Fix:** Remove the `openDevTools()` call from [`apps/desktop/src/main/index.ts`](../apps/desktop/src/main/index.ts) in the `app.whenReady()` block. DevTools should only open when manually triggered via `Ctrl+Shift+I`.

### Symptom: DevTools open in production build

**Cause:** The `openDevTools()` call should be guarded by `process.env.NODE_ENV === 'development'` or removed entirely. In production, DevTools should not be accessible.

---

## Blank White Screen

See "App Not Launching → White screen after launch" above.

Additional checks:

**Check: React rendering error**
Open DevTools (`Ctrl+Shift+I`) → Console. Look for React errors like "Cannot read properties of undefined" or "Invalid hook call". These usually indicate a missing prop or a broken component.

**Check: Vite build error**
If running `pnpm dev`, check the terminal for Vite compilation errors. TypeScript errors will prevent the renderer from building.

**Check: electron-vite config**
Verify that [`electron.vite.config.ts`](../apps/desktop/electron.vite.config.ts) exists (not `vite.config.ts`). If renamed, electron-vite won't pick up the config and the build will fail silently.

---

## Layout Issues in Modes Screen

### Symptom: Bottom bar pushed off-screen

**Cause:** Flex children with `min-height: auto` (the CSS default) prevent shrinking, causing overflow.

**Fix:** Ensure these properties are set:
- `index.html`: `html, body, #root { margin: 0; height: 100%; overflow: hidden }`
- Outer wrappers: `height: '100%'` (not `'100vh'`)
- Flex children: `minHeight: 0`
- Scrollable containers: `overflow: 'auto'`

**Files to check:**
- [`apps/desktop/src/renderer/index.html`](../apps/desktop/src/renderer/index.html)
- [`apps/desktop/src/renderer/App.tsx`](../apps/desktop/src/renderer/App.tsx)
- [`apps/desktop/src/renderer/screens/ModesScreen.tsx`](../apps/desktop/src/renderer/screens/ModesScreen.tsx)
- [`apps/desktop/src/renderer/screens/ProjectScreen.tsx`](../apps/desktop/src/renderer/screens/ProjectScreen.tsx)

### Symptom: Large blank gap in the middle of the screen

**Cause:** Default browser margin on `body` combined with `100vh` height causes the content to be taller than the viewport.

**Fix:** Verify the global CSS reset in `index.html` sets `body { margin: 0 }` and all outer wrappers use `height: '100%'` instead of `height: '100vh'`.

---

## Terminal / Git / SSH Failures

### Symptom: Terminal commands fail with "command not found"

**Cause:** The terminal service runs commands via `child_process.spawn()`. If the command is not in the system PATH, it will fail.

**Fix:** Ensure the command (e.g., `git`, `ssh`, `node`, `npm`) is installed and in the system PATH.

### Symptom: Git operations fail

**Check 1: Git installed?**
```cmd
git --version
```

**Check 2: Inside a git repo?**
The git service requires a `repoPath` parameter. Verify the project's local path is a valid git repository.

**Check 3: Git credentials configured?**
For push operations, git needs credentials. Verify with:
```cmd
git config --global credential.helper
```

### Symptom: SSH connection test fails

**Check 1: SSH installed?**
```cmd
ssh -V
```

**Check 2: SSH config exists?**
The SSH service reads from `~/.ssh/config`. If this file doesn't exist, no hosts will be discovered.

**Check 3: SSH key permissions?**
On Windows, SSH key files should not be world-readable. Check permissions in the file properties.

### Symptom: SSH hosts not discovered

**Cause:** The SSH service reads `~/.ssh/config` to discover hosts. If the file doesn't exist or has no `Host` entries, the list will be empty.

**Fix:** Create or edit `~/.ssh/config` with your SSH host entries:
```
Host myserver
  HostName 192.168.1.100
  User admin
  IdentityFile ~/.ssh/id_rsa
```

---

## General Debugging Tips

1. **Always check DevTools Console first** — `Ctrl+Shift+I` → Console tab. Most errors will appear here.
2. **Check the terminal output** — The `pnpm dev` terminal shows main process logs, including IPC handler errors.
3. **Look for `[main]` prefixed logs** — The main process logs important events with `[main]` prefix.
4. **Read idiosyncrasies.md before "fixing" anything** — Many things that look like bugs are intentional. Check [`docs/idiosyncrasies.md`](idiosyncrasies.md) first.
5. **The Modes screen is the most complex layout** — If you're testing layout changes, always verify on the Modes screen.
6. **Sync is now active** — The 🔴 Offline indicator is a real problem since 2026-04-18. See the "Sync Showing Offline" section above to diagnose.

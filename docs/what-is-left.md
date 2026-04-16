# VibeFlow — What Is Left to Do

Last updated: 2026-04-14

All 10 MVP milestones are complete. This document lists remaining work organized by priority.

---

## Critical Fixes (Must Do Before Real Use)

### 1. Fix handoff path for packaged builds
- **What:** The handoff system reads `docs/idiosyncrasies.md` via a relative path (`../../../../docs/idiosyncrasies.md`) that only works in development mode. In a packaged build, this path will not resolve.
- **Where:** [`apps/desktop/src/main/index.ts`](../apps/desktop/src/main/index.ts) — `handoff:generate` and `handoff:getIdiosyncrasies` handlers
- **Fix:** Use `app.isPackaged` to determine the correct path. In dev, use the relative path. In packaged builds, bundle docs into `extraResources` in `electron-builder.yml` or use `app.getAppPath()`.
- **Effort:** Small (1–2 hours)

### 2. Fix .env loading for packaged builds
- **What:** The `.env` file is loaded via `dotenv.config({ path: path.resolve(__dirname, '../../../../.env') })` which only works in development. In packaged builds, environment variables need to come from a different source.
- **Where:** [`apps/desktop/src/main/index.ts`](../apps/desktop/src/main/index.ts) — top of file
- **Fix:** Use `app.isPackaged` to switch between dev path and packaged path. Consider bundling Supabase URL and anon key into the app at build time (they are public values).
- **Effort:** Small (1–2 hours)

### 3. Verify packaged build works
- **What:** Run `electron-builder` and test the resulting installer on a clean Windows machine.
- **Verify:** App launches, sign-in works, all features work, keytar works, sql.js works, auto-updater doesn't crash.
- **Effort:** Medium (half a day including debugging)

---

## Near-Term Improvements (Should Do Soon)

### 4. Re-enable cloud sync
- **What:** Cloud sync is currently disabled. Re-enabling requires multiple steps.
- **Steps:**
  1. Run [`docs/supabase-migration-m4.sql`](supabase-migration-m4.sql) on the Supabase instance to create the `conversations`, `messages`, and `conversation_leases` tables
  2. Verify the Supabase tables match the expected schema
  3. Adapt [`sync-engine.ts`](../apps/desktop/src/lib/sync/sync-engine.ts) to work with the sql.js-based `LocalDb` (the sync engine was written against `better-sqlite3` API patterns)
  4. Re-implement [`initSyncEngine()`](../apps/desktop/src/main/index.ts:94) to actually create and start the SyncEngine
  5. Replace stub sync IPC handlers (lines ~632–646) with real sync calls
  6. Update the `before-quit` handler to call `syncEngine.stop()`
  7. Test with two devices signed into the same account
- **Effort:** Large (1–2 days)

### 5. Enhance Orchestrator intelligence
- **What:** The Orchestrator currently calls OpenRouter directly and streams a response. It does not route tasks to specialist Modes.
- **Steps:**
  1. Add task analysis to the Orchestrator — determine which Mode should handle a request
  2. Implement Mode delegation — Orchestrator sends sub-tasks to specialist Modes
  3. Implement result collection — Orchestrator collects results from Modes and synthesizes a response
  4. Add conversation summarization — auto-summarize when approaching context limits
  5. Add context window management — warn user when conversation is getting long
- **Effort:** Large (2–3 days)

### 6. Add automated tests
- **What:** There are currently no automated tests. The test plan exists ([`docs/test-plan.md`](test-plan.md)) but no tests have been written.
- **Priority tests:**
  1. `local-db.ts` — CRUD operations for projects, modes, conversations, messages
  2. `approval-engine.ts` — Tier classification for all action types
  3. `handoff-generator.ts` — Handoff document and prompt generation
  4. `file-service.ts` — Path traversal protection
- **Effort:** Medium (1 day for core tests)

### 7. Split main/index.ts into domain-specific handler files
- **What:** The main process entry point is 959 lines. It should be split into separate files by domain.
- **Proposed structure:**
  ```
  apps/desktop/src/main/
  ├── index.ts              ← App lifecycle, window creation, handler registration
  ├── handlers/
  │   ├── auth.ts           ← auth:signInWithGitHub, auth:signOut, auth:getSession
  │   ├── projects.ts       ← projects:list, projects:create, etc.
  │   ├── modes.ts          ← modes:list, modes:updateSoul, modes:updateModel
  │   ├── openrouter.ts     ← openrouter:setApiKey, openrouter:listModels, etc.
  │   ├── conversations.ts  ← conversations:list, conversations:create, etc.
  │   ├── sync.ts           ← sync:* handlers
  │   ├── tooling.ts        ← files:*, terminal:*, git:*, ssh:*
  │   ├── devops.ts         ← devops:* handlers
  │   ├── approval.ts       ← approval:* handlers
  │   ├── handoff.ts        ← handoff:* handlers
  │   └── updater.ts        ← updater:* handlers
  ```
- **Effort:** Medium (half a day)

---

## Packaging / Release Tasks

### 8. Test auto-update end-to-end
- **What:** Publish a real GitHub Release with a tagged version, then verify the update flow works.
- **Steps:**
  1. Build and package the app with `electron-builder`
  2. Create a GitHub Release with the packaged artifacts
  3. Install the app from the release
  4. Publish a second release with a higher version number
  5. Verify the app detects the update, shows the banner, downloads, and installs
- **Effort:** Medium (half a day)

### 9. Add manual download fallback
- **What:** If auto-update fails (UAC, antivirus, enterprise policy), the user should see a link to download the latest release manually from GitHub Releases.
- **Where:** [`UpdateBanner.tsx`](../apps/desktop/src/renderer/components/UpdateBanner.tsx)
- **Effort:** Small (1–2 hours)

### 10. Code signing
- **What:** Windows SmartScreen will warn users about unsigned apps. Code signing requires a certificate.
- **Effort:** Medium (requires purchasing a code signing certificate and configuring electron-builder)

---

## Sync Recovery / Re-Enable Plan

This is the detailed plan for re-enabling cloud sync:

### Phase 1: Database Migration
1. Log into the Supabase dashboard for the VibeFlow project
2. Run [`docs/supabase-migration-m4.sql`](supabase-migration-m4.sql) in the SQL editor
3. Verify tables were created: `conversations`, `messages`, `conversation_leases`
4. Run [`docs/supabase-migration-m8.sql`](supabase-migration-m8.sql) to create the `handoffs` storage bucket
5. Verify Row Level Security policies are in place

### Phase 2: Sync Engine Adaptation
1. Review [`sync-engine.ts`](../apps/desktop/src/lib/sync/sync-engine.ts) for any `better-sqlite3`-specific API calls
2. The sync engine uses `LocalDb` methods — verify these all work with the sql.js-based implementation
3. Test `syncAll()`, `pushToSupabase()`, `registerDevice()` individually
4. Test lease acquisition and heartbeat

### Phase 3: Main Process Integration
1. Re-implement `initSyncEngine()` in [`main/index.ts`](../apps/desktop/src/main/index.ts) to actually create the SyncEngine
2. Replace stub sync IPC handlers with real calls to the SyncEngine
3. Update the `before-quit` handler to call `syncEngine.stop()`
4. Wire up `sync:statusChanged` events from the SyncEngine to the renderer

### Phase 4: Testing
1. Test on a single device: sign in, create project, verify data appears in Supabase
2. Test on two devices: sign in on both, create a project on one, verify it appears on the other
3. Test lease/heartbeat: start a conversation on Device A, verify Device B shows read-only
4. Test takeover: disconnect Device A, wait 45 seconds, verify Device B can take over
5. Test offline: disconnect network, make changes, reconnect, verify sync

---

## Future Product Enhancements (Post-MVP)

### 11. MCP server integration
- **What:** Connect to external MCP (Model Context Protocol) servers for additional tools.
- **Where:** `packages/mcp-manager/` (README stub exists)
- **Effort:** Large

### 12. Custom Mode creation
- **What:** Allow users to create entirely new Modes (not just edit built-in ones).
- **Effort:** Medium

### 13. Mode tool permissions
- **What:** Per-Mode configuration of which tools are allowed (currently all Modes have access to all tools).
- **Effort:** Medium

### 14. Conversation summarization
- **What:** Auto-summarize long conversations to stay within context limits.
- **Effort:** Medium

### 15. Multi-provider support
- **What:** Add direct Anthropic, OpenAI, Google providers alongside OpenRouter.
- **Effort:** Medium

### 16. Custom URL scheme for OAuth
- **What:** Replace the localhost HTTP server with a `vibeflow://` custom URL scheme for OAuth callbacks.
- **Effort:** Small-Medium

### 17. Encrypted secret sync
- **What:** Allow users to opt into syncing their API keys across devices with AES-256 encryption.
- **Effort:** Medium

### 18. macOS / Linux support
- **What:** Test and fix any platform-specific issues. keytar works on all platforms. electron-builder supports all platforms.
- **Effort:** Medium-Large

### 19. Project templates
- **What:** Pre-built project templates (e.g., "Next.js app", "Python API") that the Orchestrator can scaffold.
- **Effort:** Medium

### 20. Conversation search
- **What:** Search across all conversations in a project.
- **Effort:** Small-Medium

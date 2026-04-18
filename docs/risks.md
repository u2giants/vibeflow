# VibeFlow — Risks

Last updated: 2026-04-18

This file documents real, current risks to the project. Each risk includes likelihood, impact, current status, and mitigation.

---

## R1 — Two-Device Sync Not Yet Validated in Practice

**Likelihood:** Medium
**Impact:** High
**Status:** ⚠️ Validation Pending

**Description:** Cloud sync was re-enabled on 2026-04-18 (Decision 16). The implementation is complete — the SyncEngine starts, registers the device, pushes conversations to Supabase, and subscribes to Realtime. However, the sync system has never been tested with two real devices signed into the same account. Potential issues:
- Supabase Realtime may have latency or reliability issues for the 15-second heartbeat
- The lease takeover flow may have edge cases
- Conflict resolution (last-write-wins) may behave unexpectedly

**Mitigation:**
- The sync architecture is documented in [`docs/cloud-sync.md`](cloud-sync.md)
- The lease/heartbeat model uses a generous 45-second stale threshold
- Albert confirmed he has a second Windows device for testing
- Two-device validation is listed as a priority item in [`docs/what-is-left.md`](what-is-left.md)

---

## R2 — Local Database Fragility

**Likelihood:** Medium
**Impact:** High
**Status:** ⚠️ Active risk

**Description:** The app uses `sql.js` which loads the entire database into memory and periodically flushes to disk. This means:
- If the app crashes before a flush, recent changes may be lost
- The database file lives in the Electron user data directory — if this directory is deleted or corrupted, all data is lost
- There is no automatic backup mechanism
- `sql.js` is slower than `better-sqlite3` for large datasets because it operates in JavaScript, not native C++

**Mitigation:**
- The database is flushed to disk after every write operation (not just periodically)
- The database file is small for typical usage (projects, conversations, modes)
- A future improvement could add automatic local backups
- When sync is re-enabled, Supabase will serve as a cloud backup

---

## R3 — Packaging / Installer Not Verified by Albert

**Likelihood:** Medium
**Impact:** High
**Status:** ⚠️ Active risk

**Description:** The app has only been tested via `pnpm dev` (development mode). The full packaging pipeline (`electron-builder` → NSIS installer → installed app) has not been tested by Albert on his actual machine. Potential issues:
- `sql.js` WASM file may not be bundled correctly
- keytar native module may not work in packaged builds
- Auto-updater may not work without a real GitHub Release
- File paths (especially the relative path to `docs/idiosyncrasies.md` for handoff) may break in packaged builds
- The `.env` file loading path may not resolve correctly in packaged builds

**Mitigation:**
- `electron-builder.yml` is configured with GitHub Releases publish target
- CI/CD workflows exist (`.github/workflows/release.yml`) for automated builds
- Testing the packaged build is a critical next step
- The `BUILD_METADATA` module has a try/catch fallback for missing generated.ts

---

## R4 — Auto-Update Only Partially Verified

**Likelihood:** Medium
**Impact:** Medium
**Status:** ⚠️ Active risk

**Description:** The auto-updater code exists and is configured for GitHub Releases, but:
- No real GitHub Release has been published yet
- The update flow (check → download → install → restart) has not been tested end-to-end
- `electron-updater` can fail due to Windows UAC, antivirus, or enterprise policies
- The `UpdateBanner.tsx` component exists but has only been tested with mock data

**Mitigation:**
- `autoDownload = false` — user decides when to download (safe default)
- Only runs in packaged builds (`app.isPackaged` check) — won't interfere with development
- Non-fatal error handling — app never crashes on updater failures
- A manual download fallback (link to GitHub Releases) should be added

---

## R5 — Multi-Device Sync Not Proven in Practice

**Likelihood:** Medium
**Impact:** High
**Status:** ⚠️ Active risk (updated reason — sync is now on, but two-device test not done)

**Description:** Sync is now enabled (R1 updated). But the sync engine has never been exercised with two physical devices. Potential issues remain:
- Supabase Realtime latency or reliability for 15-second heartbeat
- Conflict resolution (last-write-wins) behavior under concurrent edits
- Lease takeover edge cases
- New brownfield tables (added in Components 10–22) may not all have push methods wired to Supabase

**Mitigation:**
- The lease/heartbeat model uses a generous 45-second stale threshold (3 missed heartbeats)
- Conflict strategy is documented in [`docs/cloud-sync.md`](cloud-sync.md)
- Albert confirmed he has a second Windows device for testing
- The Supabase project is live and all tables are created

---

## R6 — UI Layout Regressions Risk

**Likelihood:** Medium
**Impact:** Medium
**Status:** ⚠️ Active risk

**Description:** Multiple flex/overflow layout bugs were fixed across Sprints 15–18:
- Nested flex children defaulting to `min-height: auto` causing overflow
- Missing `overflow: hidden` on containers
- Default browser margin on `body` causing `100vh` overflow
- Left sidebar missing `minWidth` constraint

These fixes are fragile — any CSS change to the layout containers could re-introduce the bugs. The fixes are spread across multiple files:
- [`apps/desktop/src/renderer/index.html`](../apps/desktop/src/renderer/index.html) (global CSS reset)
- [`apps/desktop/src/renderer/App.tsx`](../apps/desktop/src/renderer/App.tsx)
- [`apps/desktop/src/renderer/screens/ModesScreen.tsx`](../apps/desktop/src/renderer/screens/ModesScreen.tsx)
- [`apps/desktop/src/renderer/screens/ProjectScreen.tsx`](../apps/desktop/src/renderer/screens/ProjectScreen.tsx)

**Mitigation:**
- The global CSS reset in `index.html` sets `html, body, #root` to `margin: 0; height: 100%; overflow: hidden`
- All outer wrappers use `height: '100%'` instead of `height: '100vh'`
- Key containers have `minHeight: 0` to allow flex shrinking
- Any future layout changes should be tested on the Modes screen (most complex layout)

---

## R7 — Supabase Realtime Reliability for Lease/Heartbeat

**Likelihood:** Medium
**Impact:** High
**Status:** ⚠️ Theoretical (not yet tested)

**Description:** Supabase Realtime Broadcast channels may have latency or reliability issues when used for the 15-second heartbeat that keeps conversation ownership alive. If heartbeats are delayed or dropped, runs may be incorrectly marked as stale.

**Mitigation:**
- Use a generous stale threshold (45 seconds = 3 missed heartbeats)
- Design the stale/recoverable state to be safe and non-destructive
- If Realtime proves unreliable, implement a lightweight Supabase Edge Function for lease management

---

## R8 — OpenRouter API Changes

**Likelihood:** Low
**Impact:** Medium
**Status:** ⚠️ Theoretical

**Description:** OpenRouter may change its API format for model listing, pricing, or metadata. The `/api/v1/models/user` endpoint is not officially documented as prominently as `/api/v1/models`.

**Mitigation:**
- Abstract the OpenRouter client behind a provider interface
- The model picker is a UI feature — a format change is a small fix, not a rewrite
- Monitor OpenRouter changelog for breaking changes

---

## R9 — Self-Maintenance Mode Risk

**Likelihood:** Medium
**Impact:** High
**Status:** ⚠️ Mitigated but real

**Description:** When the IDE is used to work on itself, an AI error could break the IDE's own source files, making it unable to run.

**Mitigation:**
- All changes to IDE source files require human approval (Tier 3)
- Self-maintenance mode is clearly labeled and separated from user project work
- Always have a working git commit to roll back to
- The IDE's own repo should always be in a runnable state before starting self-maintenance work

---

## R10 — Main Process File Size

**Likelihood:** Low
**Impact:** Medium
**Status:** ⚠️ Technical debt (size has grown significantly)

**Description:** [`apps/desktop/src/main/index.ts`](../apps/desktop/src/main/index.ts) is now ~2,441 lines (up from 959 at MVP). It contains all IPC handler registrations across 30+ domains and 100+ handlers. While the file is well-organized (it delegates immediately to `src/lib/` services), it is increasingly hard to navigate.

**Mitigation:**
- The file is structured with clear section comments per domain
- A future refactor should split into `src/main/handlers/*.ts` files (see [`docs/what-is-left.md`](what-is-left.md) item #7)
- This is not blocking any functionality
- Adding a duplicate handler registration will crash the app at boot (see idiosyncrasies #15)

---

## R11 — Orchestrator Intelligence Is Basic

**Likelihood:** Certain (current state)
**Impact:** Medium
**Status:** ⚠️ Known limitation

**Description:** The Orchestrator currently calls OpenRouter directly and streams a response. It does not yet:
- Analyze the task and route to specialist Modes
- Collect results from multiple Modes
- Summarize long conversations
- Manage context window limits

This means the app works as a single-Mode AI chat, not as the multi-Mode orchestration system described in the product vision.

**Mitigation:**
- The Mode system infrastructure is in place (6 Modes, per-Mode model assignment, approval policies)
- Multi-Mode routing is a future enhancement, not a blocker for the current MVP
- The Orchestrator can be enhanced incrementally

---

## R12 — Brownfield Migration Backfill Debt

**Likelihood:** Low
**Impact:** Medium
**Status:** ⚠️ Technical debt

**Description:** The `capabilities` table (and possibly a few others) now has both old columns (`type`, `permissions_json`) and new columns (`class`, `owner`, `description`, `scope`, `actions_json`) coexisting. Rows created before Component 14 have values in the old columns but are empty in the new columns. Until old rows are back-filled to the new schema, UI components reading new columns may show empty/null values for legacy rows.

**Mitigation:**
- The old columns are preserved to avoid data loss (see idiosyncrasies #14)
- The dual-schema is documented so developers know not to "clean up" old columns prematurely
- Back-fill migration is listed in [`docs/what-is-left.md`](what-is-left.md)

---

## R13 — conversation_leases RLS Race Condition Is Load-Bearing

**Likelihood:** Low
**Impact:** High
**Status:** ⚠️ Mitigated but fragile

**Description:** The `ensure-remote` guard in `SyncEngine.acquireLease()` — a call to `pushConversation()` at the top of every lease-acquire operation — looks like redundant work. If it is removed (e.g., during a "cleanup" pass), lease acquisition will silently fail with FK violations when the conversation hasn't synced to Supabase yet.

**Mitigation:**
- The guard is documented in idiosyncrasies #11
- Any code review that "cleans up" the `acquireLease()` method must preserve this guard
- The guard is cheap — it is a no-op if the conversation row already exists in Supabase


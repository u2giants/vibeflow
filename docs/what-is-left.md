# VibeFlow — What Is Left to Do

Last updated: 2026-04-18

The MVP milestones and brownfield rebuild (Components 10–22) are all complete. Cloud sync is re-enabled. This document lists remaining work organized by priority.

---

## Critical Fixes (Must Do Before Real Use)

### 1. Verify packaged build works
- **What:** Run `electron-builder` and test the resulting installer on a clean Windows machine.
- **Verify:** App launches, sign-in works, all features work, keytar works, sql.js works, auto-updater doesn't crash.
- **Effort:** Medium (half a day including debugging)

### 2. Fix .env loading for packaged builds
- **What:** The `.env` file is loaded via `dotenv.config({ path: path.resolve(__dirname, '../../../../.env') })` which only works in development. In packaged builds, environment variables need to come from a different source.
- **Where:** [`apps/desktop/src/main/index.ts`](../apps/desktop/src/main/index.ts) — top of file
- **Fix:** Use `app.isPackaged` to switch between dev path and packaged path. Consider bundling Supabase URL and anon key into the app at build time (they are public values).
- **Effort:** Small (1–2 hours)

### 3. Validate two-device sync
- **What:** Sign in on two real devices with the same account. Verify projects sync, conversations appear on both, lease/heartbeat model works, takeover works.
- **Steps:**
  1. Launch app on Device A, sign in, create a project and conversation
  2. Launch app on Device B, sign in with the same account
  3. Verify project appears on Device B
  4. Start a conversation on Device A — verify Device B shows ownership banner
  5. Close Device A, wait 45 seconds, verify Device B shows run as "Recoverable"
  6. Click "Resume on this device" on Device B
- **Effort:** Medium (half a day)

---

## Near-Term Improvements (Should Do Soon)

### 4. Wire pnpm test + CI integration
- **What:** ~90+ scoped `.test.cjs` test files exist (memory-lifecycle, browser-automation, verification-engine, framework-detector, approval-engine, and others). They are not wired to `pnpm test` in `package.json`. CI does not run them.
- **Fix:**
  1. Add a test runner (Vitest or Node test runner) to `apps/desktop/package.json`
  2. Configure it to find and run `**/*.test.cjs` files
  3. Add a `test` step to `.github/workflows/ci.yml`
- **Effort:** Small-Medium (2–4 hours)

### ~~5. Split main/index.ts into domain-specific handler files~~ — DONE 2026-04-18

Completed. `src/main/handlers/*.ts` now holds all IPC domain files. `index.ts` is a thin lifecycle + registration entry point. The state container pattern in `handlers/state.ts` resolves the Rollup bundling constraint — see [idiosyncrasies #19](idiosyncrasies.md).

### 6. Back-fill capabilities table dual schema
- **What:** The `capabilities` table has both old columns (`type`, `permissions_json`) and new columns (`class`, `owner`, `description`, `scope`, `actions_json`). Old rows need their data migrated to the new columns.
- **Steps:**
  1. Write a SQL migration that back-fills old rows
  2. Update all read paths to use new columns only
  3. Drop old columns in a subsequent migration
- **Effort:** Medium (2–4 hours)

### 7. Enhance Orchestrator intelligence
- **What:** The OrchestrationEngine has role routing infrastructure but multi-Mode delegation, task analysis, and context window management are not fully implemented.
- **Steps:**
  1. Add task analysis to the Orchestrator — determine which Mode should handle a request
  2. Implement Mode delegation — Orchestrator sends sub-tasks to specialist Modes
  3. Implement result collection — Orchestrator synthesizes results
  4. Add conversation summarization — auto-summarize when approaching context limits
- **Effort:** Large (2–3 days)

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

## Documentation Consolidation

### 11. packages/ README files are aspirational stubs
- **What:** Most `packages/*/README.md` files describe an idealized package API that doesn't match reality. The actual code for each subsystem lives in `apps/desktop/src/lib/`. Each package README should clearly state whether it's a canonical source or a stub.
- **Status:** Status banners have been added to all package READMEs in the 2026-04-18 audit.
- **Remaining:** If the repo moves to NTFS, properly refactor packages back into real packages with `workspace:*` deps.

---

## Future Product Enhancements (Post-MVP)

### 12. Custom Mode creation
- Allow users to create entirely new Modes (not just edit built-in ones).
- **Effort:** Medium

### 13. Mode tool permissions
- Per-Mode configuration of which tools are allowed (currently all Modes have access to all tools).
- **Effort:** Medium

### 14. Conversation summarization
- Auto-summarize long conversations to stay within context limits.
- **Effort:** Medium

### 15. Multi-provider support
- Add direct Anthropic, OpenAI, Google providers alongside OpenRouter.
- **Effort:** Medium

### 16. Custom URL scheme for OAuth
- Replace the localhost HTTP server on port 54321 with a `vibeflow://` custom URL scheme for OAuth callbacks.
- **Effort:** Small-Medium

### 17. Encrypted secret sync
- Allow users to opt into syncing their API keys across devices with AES-256 encryption.
- **Effort:** Medium

### 18. macOS / Linux support
- Test and fix platform-specific issues. keytar and electron-builder support all platforms.
- **Effort:** Medium-Large

### 19. MCP server integration expansion
- Expand MCP beyond the basic connection management to deeper tool integration.
- **Where:** `packages/mcp-manager/` (README stub, code in `apps/desktop/src/lib/mcp-manager/`)
- **Effort:** Large

### 20. Conversation search
- Search across all conversations in a project.
- **Effort:** Small-Medium

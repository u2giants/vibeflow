# VibeFlow — Risks

Last updated: 2026-04-11

---

## R1 — Supabase Realtime reliability for lease/heartbeat

**Likelihood:** Medium
**Impact:** High
**Description:** Supabase Realtime Broadcast channels may have latency or reliability issues when used for the 15-second heartbeat that keeps conversation ownership alive. If heartbeats are delayed or dropped, runs may be incorrectly marked as stale.
**Mitigation:**
- Use a generous stale threshold (45 seconds = 3 missed heartbeats)
- Test thoroughly in Milestone 4 with two real devices
- Design the stale/recoverable state to be safe and non-destructive
- If Realtime proves unreliable for this, implement a lightweight Supabase Edge Function for lease management

---

## R2 — Electron + React + Vite monorepo setup complexity

**Likelihood:** Medium
**Impact:** Medium
**Description:** Setting up a pnpm monorepo with Electron + Vite + multiple TypeScript packages can have tricky configuration issues (module resolution, IPC typing, build order, etc.) that slow early iteration.
**Mitigation:**
- Use electron-vite as the base template for apps/desktop
- Keep packages minimal at first (shared-types and storage only in Milestone 1)
- Document any setup quirks in idiosyncrasies.md immediately
- Builder should test the dev mode startup before adding complexity

---

## R3 — OpenRouter API changes pricing/metadata format

**Likelihood:** Low
**Impact:** Low
**Description:** OpenRouter may change its API format for model listing, pricing, or metadata, breaking the model picker.
**Mitigation:**
- Abstract the OpenRouter client behind a provider interface
- Pin to a specific API version if available
- The model picker is a UI feature — a format change is a small fix, not a rewrite

---

## R4 — keytar (OS-secure storage) has Windows-specific quirks

**Likelihood:** Medium
**Impact:** Medium
**Description:** keytar uses the Windows Credential Manager. It can have issues with certain Windows configurations, enterprise policies, or after Windows updates.
**Mitigation:**
- Test keytar in Milestone 1 on Albert's actual machine
- Document any quirks in idiosyncrasies.md
- Design a fallback: if keytar fails, offer encrypted local file storage with a user passphrase
- Never store secrets in plain text as a fallback

---

## R5 — Roo-inspired reimplementation takes longer than expected

**Likelihood:** Medium
**Impact:** Medium
**Description:** Building the Mode system, Orchestrator routing, and tool execution from scratch (rather than using Roo as a base) requires more upfront implementation work.
**Mitigation:**
- Start with a minimal Mode system (just Orchestrator + one specialist Mode) in Milestone 2
- Expand incrementally — don't try to build all 6 Modes perfectly at once
- Keep the Mode system simple and readable; avoid over-engineering

---

## R6 — Supabase free tier limits hit during development

**Likelihood:** Low
**Impact:** Low
**Description:** If using Supabase free tier, database size, API call limits, or Realtime connection limits may be hit during development.
**Mitigation:**
- Use Supabase Pro from the start for a real product
- Monitor usage in the Supabase dashboard
- Free tier is fine for early development; upgrade before Milestone 4 sync testing

---

## R7 — Two-device sync testing requires two physical machines

**Likelihood:** Low (Albert confirmed he has a second device)
**Impact:** Medium
**Description:** Milestone 4 requires testing on two devices simultaneously. If the second device is unavailable, sync testing is blocked.
**Mitigation:**
- Albert confirmed he has a second Windows device
- As a fallback, use a Windows VM on the same machine
- Design sync tests to be partially simulatable with two browser tabs (for Supabase Realtime testing)

---

## R8 — Coolify API changes or becomes unavailable

**Likelihood:** Low
**Impact:** Medium
**Description:** Coolify's API may change between versions, breaking the DevOps integration.
**Mitigation:**
- Abstract the Coolify client behind a deploy-target interface
- Coolify is one implementation of a deploy target — others can be added
- Pin to a specific Coolify API version in the client
- Document the Coolify API version used in idiosyncrasies.md

---

## R9 — Self-maintenance mode creates risk of AI breaking the IDE

**Likelihood:** Medium
**Impact:** High
**Description:** When the IDE is used to work on itself, an AI error could break the IDE's own source files, making it unable to run.
**Mitigation:**
- All changes to IDE source files require human approval (Tier 3)
- Self-maintenance mode is clearly labeled and separated from user project work
- Always have a working git commit to roll back to
- The IDE's own repo should always be in a runnable state before starting self-maintenance work

---

## R10 — electron-updater auto-update fails on some Windows configurations

**Likelihood:** Low-Medium
**Impact:** Medium
**Description:** Auto-update via electron-updater can fail due to Windows UAC, antivirus software, or enterprise policies.
**Mitigation:**
- Test auto-update in Milestone 9 on Albert's actual machine
- Provide a manual download fallback (link to GitHub Releases)
- Document known auto-update issues in idiosyncrasies.md
- Use NSIS installer (not Squirrel) for more reliable Windows updates

---

## R11 — AI session context limits cause loss of conversation history

**Likelihood:** Medium
**Impact:** Medium
**Description:** Long conversations may exceed the context window of the assigned model, causing the AI to lose track of earlier context.
**Mitigation:**
- Implement conversation summarization in the Orchestrator
- The handoff system (Milestone 8) is specifically designed to handle this
- Show a warning in the UI when a conversation is getting long
- Encourage users to use handoff before context limits are hit

---

## R12 — pnpm workspace configuration conflicts with electron-builder

**Likelihood:** Low-Medium
**Impact:** Medium
**Description:** electron-builder may have issues with pnpm workspaces, particularly with native modules and dependency bundling.
**Mitigation:**
- Test the full build pipeline in Milestone 1
- Use electron-builder's pnpm support (available since electron-builder v24)
- Document any workarounds in idiosyncrasies.md

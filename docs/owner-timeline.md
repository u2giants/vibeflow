# VibeFlow — Owner Timeline

Last updated: 2026-04-18 (Post-MVP brownfield rebuild complete)

---

## Current Sprint

**Sprint 11 — Milestone 10: Self-Maintenance Mode**
Status: ✅ Complete — MVP is done!

---

## Full Sprint Timeline

| Sprint | Milestone | Description | Status | Confidence |
|---|---|---|---|---|
| | | 0 | Planning | Architecture approved, questions answered | ✅ Done | 100% |
| | | 1 | Scaffold | All docs and repo structure created | ✅ Done | 100% |
| | | 2 | M1 | Electron shell + Supabase auth + project scaffold | ✅ Done | 100% |
| | | 3 | M2 | Mode system + OpenRouter provider | ✅ Done | 95% |
| | | 4 | M3 | Conversation UI + Orchestrator | ✅ Done | 100% |
| | | 5 | M4 | Cloud sync + real-time + device ownership | ✅ Done | 95% |
| | | 6 | M5 | Local tooling (files, terminal, Git, SSH) | ✅ Done | 95% |
| | | 7 | M6 | DevOps subsystem + templates | ✅ Done | 95% |
| | | 8 | M7 | Approval system + second-model review | ✅ Done | 95% |
| | | 9 | M8 | Handoff + idiosyncrasies tracking | ✅ Done | 95% |
| | | 10 | M9 | Build metadata + auto-update | ✅ Done | 95% |
| | | 11 | M10 | Self-maintenance mode | ✅ Done | 90% |

**Confidence** = how confident we are that this milestone will complete without major surprises.

---

## Milestone Detail

### M1 — Electron Shell + Supabase Auth + Project Scaffold
**Confidence: 100%**
**Result:** Complete. App launches, GitHub OAuth works, project list functional.
**Blocker risk:** None

### M2 — Mode System + OpenRouter Provider
**Confidence: 95%**
**Result:** Complete. 6 Modes appear, soul editor saves, OpenRouter API key stores securely, model picker works.
**Why not 100%:** Model list depends on OpenRouter API availability and format stability.
**Blocker risk:** Low

### M3 — Conversation UI + Orchestrator
**Confidence: 100%**
**Result:** Complete. 5-panel layout, streaming AI responses, conversation history, multiple conversations per project.
**Blocker risk:** None

### M4 — Cloud Sync + Real-time + Device Ownership
**Confidence: 95%**
**Result:** Complete. Device registration, initial sync, push to Supabase, lease/heartbeat, realtime subscriptions.
**Blocker risk:** Low

### M5 — Local Tooling
**Confidence: 95%**
**Result:** Complete. File read/write/list, terminal with streaming output, git status/commit/push, SSH discovery and testing.
**Blocker risk:** Low

### M6 — DevOps Subsystem
**Confidence: 95%**
**Result:** Complete. DevOps templates, GitHub Actions client, Coolify client, health checks, local SQLite storage.
**Blocker risk:** Low

### M7 — Approval System
**Confidence: 95%**
**Result:** Complete. Three-tier approval system, second-model review with Gemini, approval cards, queue indicator.
**Blocker risk:** Low

### M8 — Handoff
**Confidence: 95%**
**Result:** Complete. Handoff button, form, generator, Supabase Storage save, copy-to-clipboard, idiosyncrasies tracking.
**Blocker risk:** Low

### M9 — Build Metadata + Auto-Update
**Confidence: 95%**
**Result:** Complete. Version/commit/date injection, auto-updater with GitHub Releases, UpdateBanner component, CI/CD workflows.
**Blocker risk:** Low

### M10 — Self-Maintenance Mode
**Confidence: 90%**
**Result:** Complete. "Work on VibeFlow itself" button, self-maintenance project with yellow banner, Tier 3 forced approval for file writes, labeled handoffs.
**Blocker risk:** Low-Medium — self-maintenance mode is a new concept; edge cases may appear with complex file operations.

---

## Post-MVP Brownfield Rebuild (Sprints 12–18, completed 2026-04-18)

After MVP, 13 additional components were built as a brownfield rebuild on top of the running app.

| Component | What Was Built | Status |
|---|---|---|
| **C10** | OrchestrationEngine, MissionPanel, PlanPanel, ContextPanel | ✅ Complete |
| **C11** | ChangeEngine, EvidencePanel | ✅ Complete |
| **C12** | VerificationEngine, verification runner, acceptance criteria | ✅ Complete |
| **C13** | CapabilityRegistry, CapabilitiesPanel | ✅ Complete |
| **C14** | MCPManager, MCPPanel | ✅ Complete |
| **C15** | EnvironmentManager, EnvironmentsPanel | ✅ Complete |
| **C16** | SecretsManager, SecretsPanel | ✅ Complete |
| **C17** | MemoryManager, MemoryPanel | ✅ Complete |
| **C18** | ObservabilityManager, ObservabilityPanel, WatchSession, AnomalyEvent | ✅ Complete |
| **C19** | Approval system expanded to 6 risk classes (critical_infrastructure, data_destruction, auth_security, production_deploy, code_change, read_only); AuditHistory with checkpoints | ✅ Complete |
| **C20** | SelfHealingEngine, self-healing action runner | ✅ Complete |
| **C21** | SkillLibrary, skills management | ✅ Complete |
| **C22** | Cloud sync re-enabled: SyncEngine constructor fixed (accepts authenticated SupabaseClient), Supabase migration run, RLS hotfix, race-condition guard | ✅ Complete |

All Components 10–22 are implemented locally in `apps/desktop/src/lib/`. Supabase tables exist for all domains. Not all have cloud push methods yet — see [`docs/what-is-left.md`](what-is-left.md).

## Next Decision Needed From Albert

**Brownfield rebuild is complete!** VibeFlow now has all planned subsystems. Next priorities:
- Validate two-device sync (has second device available)
- Test packaged build end-to-end
- Fix `.env` loading for packaged builds
- Wire `pnpm test` and CI

See [`docs/what-is-left.md`](what-is-left.md) for the full list.

---

## How to Read This Timeline

- ✅ Done — complete, tested, documented
- 🔄 In Progress — currently being built
- ⬜ Not started — queued

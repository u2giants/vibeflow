# VibeFlow — Owner Timeline

Last updated: 2026-04-12

---

## Current Sprint

**Sprint 3 — Milestone 2: Mode System + OpenRouter Provider**
Status: ✅ Complete

---

## Full Sprint Timeline

| Sprint | Milestone | Description | Status | Confidence |
|---|---|---|---|---|
| | 0 | Planning | Architecture approved, questions answered | ✅ Done | 100% |
| | 1 | Scaffold | All docs and repo structure created | ✅ Done | 100% |
| | 2 | M1 | Electron shell + Supabase auth + project scaffold | ✅ Done | 100% |
| | 3 | M2 | Mode system + OpenRouter provider | ✅ Done | 95% |
| | 4 | M3 | Conversation UI + Orchestrator | ⬜ Not started | 85% |
| | 5 | M4 | Cloud sync + real-time + device ownership | ⬜ Not started | 75% |
| | 6 | M5 | Local tooling (files, terminal, Git, SSH) | ⬜ Not started | 80% |
| | 7 | M6 | DevOps subsystem + templates | ⬜ Not started | 80% |
| | 8 | M7 | Approval system + second-model review | ⬜ Not started | 80% |
| | 9 | M8 | Handoff + idiosyncrasies tracking | ⬜ Not started | 85% |
| | 10 | M9 | Build metadata + auto-update | ⬜ Not started | 85% |
| | 11 | M10 | Self-maintenance mode | ⬜ Not started | 75% |

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
**Confidence: 85%**
**Why not 100%:** Streaming responses from OpenRouter via the Orchestrator routing layer is new code. May need iteration.
**Blocker risk:** Low

### M4 — Cloud Sync + Real-time + Device Ownership
**Confidence: 75%**
**Why not 100%:** Supabase Realtime lease/heartbeat coordination is the most complex new system. Two-device testing required. Latency and reliability need validation.
**Blocker risk:** Medium — if Supabase Realtime proves unreliable for heartbeats, we need a fallback plan.

### M5 — Local Tooling
**Confidence: 80%**
**Why not 100%:** SSH config discovery and IPC wiring for terminal streaming need careful testing on Windows.
**Blocker risk:** Low-Medium

### M6 — DevOps Subsystem
**Confidence: 80%**
**Why not 100%:** Coolify API integration depends on Albert's specific Coolify version and configuration.
**Blocker risk:** Low-Medium

### M7 — Approval System
**Confidence: 80%**
**Why not 100%:** Second-model review requires careful prompt engineering to avoid false escalations.
**Blocker risk:** Low

### M8 — Handoff
**Confidence: 85%**
**Why not 100%:** Handoff prompt quality depends on Orchestrator summarization quality.
**Blocker risk:** Low

### M9 — Build Metadata + Auto-Update
**Confidence: 85%**
**Why not 100%:** electron-updater auto-update on Windows can have UAC/antivirus issues.
**Blocker risk:** Low-Medium

### M10 — Self-Maintenance Mode
**Confidence: 75%**
**Why not 100%:** Self-maintenance mode requires careful sandboxing to prevent the AI from breaking the IDE.
**Blocker risk:** Medium

---

## Next Decision Needed From Albert

**You need an OpenRouter API key to enable AI features.** Get one from https://openrouter.ai/ and enter it in the Modes settings screen. After that, Milestone 3 (Conversation UI) can begin.

---

## How to Read This Timeline

- ✅ Done — complete, tested, documented
- 🔄 In Progress — currently being built
- ⬜ Not started — queued
- 🔴 Blocked — cannot proceed without a decision or fix
- **Confidence** — how likely this milestone is to complete without major surprises (not a time estimate)

# AGENTS.md — VibeFlow AI Agent Instructions

Every AI agent working in this repo must read this file before doing anything else.
Also read PROJECT_SOUL.md and CURRENT_TASK.md before starting any work.

---

## WHO DOES WHAT

| Agent | Mode | Responsibilities |
|---|---|---|
| Orchestrator | orchestrator | Plans, routes work, tracks progress, reports to Albert. Never writes code. |
| Architect | architect | Creates and updates all /docs files and repo structure. Never writes application code. |
| Builder | builder | Writes all TypeScript, React, config, and test code. |
| DevOps | devops | Handles GitHub Actions, CI/CD, git operations, infrastructure scripts. |
| Reviewer-Pusher | reviewer-pusher | Reviews all changes before any git push. Last checkpoint before remote. |

**Routing rules:**
- Bugs and features → Builder
- Infrastructure and git → DevOps
- Big new features → Architect first, then Builder
- Completed work → Reviewer-Pusher before any push
- Report to Albert in plain English

---

## MANDATORY RULES FOR ALL AGENTS

1. **Always read AGENTS.md, PROJECT_SOUL.md, and CURRENT_TASK.md before starting.**
2. **Update CURRENT_TASK.md when work begins and when work ends.**
3. **Never push to git without Reviewer-Pusher approval.**
4. **Never mark anything done unless it is implemented, tested, and documented.**
5. **Keep files small and modular.** No giant files. No giant classes.
6. **Name things so a non-programmer can roughly follow them.**
7. **Every action must have provenance:** which Mode, which model, which conversation, which project.
8. **Update /docs/non-programmer-dashboard.md after every milestone.**
9. **Update /docs/idiosyncrasies.md whenever intentional weirdness is introduced.**
10. **Do not bury important logic inside UI components.**
11. **Do not use clever metaprogramming, deep inheritance, or hidden state.**
12. **If something is incomplete, log it visibly — do not silently skip it.**
13. **Prefer readable TypeScript over clever TypeScript.**
14. **Comments only when they add real clarity — not noise.**

---

## REPO STRUCTURE

```
vibeflow/
├── apps/desktop/          ← Electron app (main + renderer + preload)
├── packages/              ← Shared TypeScript modules
│   ├── shared-types/      ← All TypeScript interfaces and types
│   ├── core-orchestrator/ ← Orchestrator logic and Mode routing
│   ├── mode-system/       ← Mode definitions, souls, config
│   ├── providers/         ← OpenRouter and future AI providers
│   ├── storage/           ← Local SQLite cache + Supabase sync client
│   ├── sync/              ← Sync engine, conflict resolution, lease/heartbeat
│   ├── tooling/           ← File, terminal, diff, build, test actions
│   ├── git-manager/       ← Git operations
│   ├── ssh-manager/       ← SSH config discovery and connection testing
│   ├── mcp-manager/       ← MCP server connections
│   ├── devops/            ← DevOps templates, deploy runs, health checks
│   ├── handoff/           ← Handoff artifact generation
│   ├── approval/          ← Approval tiers and second-model review
│   └── build-metadata/    ← Version/commit/time injection
├── docs/                  ← All documentation (Architect maintains)
├── scripts/               ← Dev, build, and release scripts
└── .github/workflows/     ← GitHub Actions (DevOps maintains)
```

---

## TECH STACK

- **Desktop:** Electron + TypeScript + React + Vite
- **Cloud backend:** Hosted Supabase (Auth + Postgres + Realtime + Storage)
- **AI provider:** OpenRouter (primary, day one)
- **Local secrets:** keytar (Windows Credential Manager)
- **Local cache:** SQLite via better-sqlite3
- **Packaging:** electron-builder
- **Auto-update:** electron-updater + GitHub Releases
- **CI/CD:** GitHub Actions
- **Container registry:** GitHub Container Registry (GHCR)
- **Deploy target:** Coolify (for user apps)

---

## COMMUNICATION FORMAT

Every agent response must include:
1. STATUS (green/yellow/red + one sentence)
2. WHAT WAS DONE
3. FILES CHANGED
4. HOW TO TEST
5. LIMITATIONS / RISKS
6. NEXT STEP

---

## HANDOFF RULES

- When a conversation gets long, generate a handoff artifact before ending
- See /docs/handoff-process.md for the full handoff procedure
- Always update /docs/idiosyncrasies.md with any intentional weirdness before handing off
- The handoff prompt must be ready for a brand-new AI session to continue without confusion

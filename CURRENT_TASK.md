# CURRENT_TASK.md — VibeFlow Active Sprint State

Every agent must update this file when work begins and when work ends.

---

## CURRENT SPRINT

**Sprint 2 — Milestone 1: Electron Shell + Supabase Auth + Project Scaffold**

| Step | Description | Status |
|---|---|---|
| 2.1 | Fix root package.json dev script | ✅ Done |
| 2.2 | Fix vite.config.ts — nuclear option: flatten packages to src/lib/ | ✅ Done |
| 2.3 | Fix tsconfig.json (remove references, add paths) | ✅ Done |
| 2.4 | Fix .npmrc (INI format for onlyBuiltDependencies) | ✅ Done |
| 2.5 | Flatten @vibeflow/* source into apps/desktop/src/lib/ | ✅ Done |
| 2.6 | Update all imports to use relative paths | ✅ Done |
| 2.7 | Run pnpm install + pnpm dev | ✅ Done — app launches from external terminal |
| 2.8 | Replace email/password with GitHub OAuth sign-in | ✅ Done |
| 2.9 | Fix better-sqlite3 bundling in vite.config.ts | ✅ Done |
| 2.10 | Add .env existence check with clear error message | ✅ Done |
| 2.11 | Smoke test: sign-in, project create, top bar, session persist | ✅ Done — app launches, GitHub OAuth works |
| 2.12 | Fix electron-vite config file name (vite.config.ts → electron.vite.config.ts) | ✅ Done |
| 2.13 | Fix ELECTRON_RUN_AS_NODE=1 env var causing crashes | ✅ Done |

**Current Step:** Milestone 1 complete. Ready for Milestone 2 (five-panel layout).

---

## COMPLETED SPRINTS

### Sprint 0 — Architecture & Planning (Complete)
- Delivered full planning document to Albert
- Albert approved architecture on 2026-04-11
- Confirmed: Supabase ✅ | OpenRouter ✅ | Coolify ✅ | Second device ✅
- Product name confirmed: VibeFlow
- Architecture approved: Roo-inspired reimplementation + Supabase + Electron + React + Vite + OpenRouter

### Sprint 1 — Repo Scaffold & Documentation (Complete)
- Created AGENTS.md, PROJECT_SOUL.md, CURRENT_TASK.md
- Created all /docs files
- Created package README files
- Created directory scaffold

---

## BLOCKERS

**Resolved:** Windows EPERM file lock on `node_modules/electron-vite` — use `pnpm install --ignore-scripts` then manually run `node node_modules/electron/install.js`.

**Resolved:** `ELECTRON_RUN_AS_NODE=1` environment variable was set globally, causing Electron to run as plain Node.js. Removed.

**Known constraint:** D: drive is exFAT — no symlinks. pnpm `workspace:*` deps cannot be used. Workaround: source files from `packages/` are copied into `apps/desktop/src/lib/`. See `docs/idiosyncrasies.md`.

---

## LAST UPDATED

- Date: 2026-04-12
- Updated by: Builder (Milestone 1 complete — GitHub OAuth working, build config fixed)
- Next update due: Start of Milestone 2 (five-panel layout)

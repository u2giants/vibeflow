# VibeFlow

VibeFlow is a Windows-first Electron desktop AI IDE. Non-programmers and light technical operators open a project, talk to an AI Orchestrator, and watch specialist AI Modes (Coder, Debugger, DevOps, Reviewer) do the work — while keeping full visibility over code, terminal, git, and deployment at all times.

---

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Git
- A `.env` file in the repo root (copy from `.env.example` and fill in Supabase URL + anon key)
- An [OpenRouter](https://openrouter.ai/) API key (for AI features)

### First-Time Setup

```bash
pnpm install --ignore-scripts
node node_modules/electron/install.js
```

### Run in Development

```bash
pnpm dev
```

This runs `scripts/inject-build-metadata.js` first, then `electron-vite dev`. The Electron window opens with the sign-in screen.

### Build Installer

```bash
pnpm build
```

Output: `apps/desktop/dist/VibeFlow-Setup-x.y.z.exe`

---

## Repo Layout

```
vibeflow/
├── apps/desktop/          ← Electron app (main + renderer + preload + all lib code)
├── packages/              ← Canonical shared packages (shared-types, storage, build-metadata)
│                            All other packages/ are README stubs — authoritative code is in apps/desktop/src/lib/
├── docs/                  ← All documentation
├── rebuild/               ← Binding specification files for the brownfield rebuild (Components 10–22)
├── scripts/               ← inject-build-metadata.js and other build helpers
├── supabase/              ← Supabase migration SQL files
└── .github/workflows/     ← CI/CD (ci.yml, release.yml, build.yml)
```

---

## Key Documentation

| Doc | What It's For |
|---|---|
| [`docs/handoff.md`](docs/handoff.md) | **Start here.** Single best file for a new developer or AI session. |
| [`AGENTS.md`](AGENTS.md) | AI agent team rules and routing |
| [`PROJECT_SOUL.md`](PROJECT_SOUL.md) | Product vision and non-negotiables |
| [`docs/architecture.md`](docs/architecture.md) | Full technical architecture |
| [`docs/idiosyncrasies.md`](docs/idiosyncrasies.md) | Intentional weirdness — read before changing anything |
| [`docs/decisions.md`](docs/decisions.md) | Why things are the way they are |
| [`docs/what-is-left.md`](docs/what-is-left.md) | Remaining work |
| [`docs/troubleshooting.md`](docs/troubleshooting.md) | Diagnosis and recovery guide |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop app | Electron + TypeScript + React + Vite |
| AI provider | OpenRouter (primary) |
| Cloud backend | Hosted Supabase (Auth + Postgres + Realtime + Storage) |
| Local secrets | keytar (Windows Credential Manager) |
| Local cache | SQLite via sql.js (pure JS — no native compilation needed) |
| Packaging | electron-builder (NSIS installer) |
| Auto-update | electron-updater + GitHub Releases |
| CI/CD | GitHub Actions |

---

## Important Gotchas for New Developers

1. **Read [`docs/idiosyncrasies.md`](docs/idiosyncrasies.md) before changing anything.** Many things that look like bugs are intentional.
2. **Do NOT add `workspace:*` dependencies** — the repo lives on an exFAT drive; symlinks don't work (see idiosyncrasies #3).
3. **Do NOT rename `electron.vite.config.ts`** — electron-vite requires this exact filename (see idiosyncrasies #1).
4. **The Vite config file is `electron.vite.config.ts`, not `vite.config.ts`.**
5. **`apps/desktop/src/lib/` is the authoritative app code.** `packages/` is canonical only for `shared-types`, `storage`, and `build-metadata`; everything else in `packages/` is a README stub.

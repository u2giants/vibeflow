# VibeFlow — Decision Log

This file records every major architecture or product decision, why it was made, and what alternatives were considered.
Agents must add an entry here whenever a significant decision is made or changed.

---

## Decision 1 — Foundation Strategy: Roo-Inspired Reimplementation

**Date:** 2026-04-11
**Decision:** Implement Mode/orchestration behavior in our own TypeScript codebase, inspired by Roo Code's concepts but not using Roo Code as a base.
**Decided by:** Orchestrator + Albert

**Alternatives considered:**
1. Use Roo Code as the primary base (wrap it in Electron)
2. **Roo-inspired reimplementation in our own TypeScript** ← CHOSEN
3. Hybrid: borrow selected Roo modules, write core orchestration ourselves

**Why this was chosen:**
Roo Code is a VS Code extension at its core. Its architecture assumes VS Code's extension host, VS Code's file system APIs, VS Code's terminal, and VS Code's editor. Wrapping that in a standalone Electron app would mean fighting VS Code's assumptions in every AI handoff session. A clean reimplementation gives us a codebase that any AI session can understand immediately, with no hidden VS Code dependencies.

**What we borrow from Roo conceptually:**
- Mode definitions with name, slug, soul/instructions, model assignment, tool permissions, approval policy
- Orchestrator-as-primary-user-facing-mode pattern
- Handoff artifact generation
- Per-mode temperature and inference settings

**Consequences:**
- More upfront work to implement Mode system from scratch
- Much cleaner codebase for AI-assisted maintenance
- No dependency on Roo Code's release cycle or VS Code API changes

---

## Decision 2 — Cloud Backend: Hosted Supabase

**Date:** 2026-04-11
**Decision:** Use hosted Supabase for Auth, Postgres, Realtime, and Storage.
**Decided by:** Orchestrator + Albert

**Alternatives considered:**
- Railway + custom backend
- Cloudflare Workers + D1
- Firebase
- Custom Node.js server + PostgreSQL
- **Hosted Supabase** ← CHOSEN

**Why this was chosen:**
Minimal moving parts for a solo non-technical builder using AI. Auth + Postgres + Realtime + Storage in one hosted service. Supabase Realtime handles live push to all clients. Supabase Auth handles device registration and sessions. No need to build or maintain a custom backend server for v1.

**Consequences:**
- Dependent on Supabase availability and pricing
- Supabase Realtime has some limitations for very high-frequency events (mitigated by using Broadcast channels for ephemeral events)
- Easy to migrate away from if needed — Supabase is open source and self-hostable

---

## Decision 3 — Approval Strategy: Three-Tier with Second-Model Review

**Date:** 2026-04-11
**Decision:** Implement a three-tier approval system: auto-allow / second-model review / human approval.
**Decided by:** Orchestrator + Albert

**Why this was chosen:**
The product requirement is to minimize human interruption. A second AI model (cheap and fast, e.g., Gemini Flash) handles routine review, so the human only sees genuinely risky or irreversible actions. This dramatically reduces approval fatigue while maintaining safety.

**Consequences:**
- Requires a second model call for Tier 2 actions (small cost, fast)
- Second-model review decisions are logged for auditability
- Human approval is rare and meaningful

See `/docs/approval-policy.md` for full details.

---

## Decision 4 — Secrets: keytar + Encrypted Supabase Vault

**Date:** 2026-04-11
**Decision:** Local device secrets use keytar (Windows Credential Manager). Synced secrets use encrypted Supabase Storage. SSH private keys stay local only.
**Decided by:** Orchestrator + Albert

**Why this was chosen:**
Local secrets (API keys, SSH passphrases) should never leave the device by default. keytar uses the OS-native secure storage on Windows. For users who want their API keys on multiple devices, we offer opt-in encrypted sync via Supabase Storage with AES-256 encryption. SSH private key material never syncs — only SSH target metadata (hostname, user, port) syncs.

**Consequences:**
- Users must enter their OpenRouter API key on each device (unless they opt into encrypted sync)
- SSH keys are always local — this is a feature, not a limitation
- keytar has some Windows-specific quirks (documented in idiosyncrasies.md when encountered)

---

## Decision 5 — AI Provider: OpenRouter First-Class

**Date:** 2026-04-11
**Decision:** OpenRouter is the primary AI provider from day one. Other providers can be added later via the provider abstraction layer.
**Decided by:** Orchestrator + Albert

**Why this was chosen:**
OpenRouter provides access to many models (GPT-4, Claude, Gemini, etc.) through a single API. It shows current pricing and model metadata. It supports per-mode model assignment. The provider abstraction layer means we can add direct Anthropic, OpenAI, or other providers later without rewriting the core.

**Consequences:**
- Dependent on OpenRouter availability and pricing
- Users need an OpenRouter API key
- Provider abstraction adds a small layer of indirection (worth it for future flexibility)

---

## Decision 6 — DevOps Templates: Standard + Albert

**Date:** 2026-04-11
**Decision:** Ship two starter DevOps templates: Standard (feature branch workflow) and Albert (push-to-main → GitHub Actions → GHCR → Coolify).
**Decided by:** Orchestrator + Albert

**Why this was chosen:**
Albert's specific workflow (push directly to main, GitHub Actions builds Docker image, pushes to GHCR, triggers Coolify via API) is the primary use case. The Standard template covers a more conventional branching workflow. Both are editable and duplicable.

**Consequences:**
- Albert template assumes: GitHub repo, GitHub Actions, GHCR access, Coolify instance with API access
- Standard template is more general but less opinionated
- Both templates are documented in `/docs/devops-templates.md`

---

## Decision 7 — Monorepo Structure: pnpm Workspaces

**Date:** 2026-04-11
**Decision:** Use pnpm workspaces for the monorepo with apps/desktop and packages/*.
**Decided by:** Orchestrator

**Why this was chosen:**
pnpm workspaces are fast, well-supported, and work well with TypeScript monorepos. The structure keeps the Electron app and shared packages cleanly separated. Each package has a clear purpose and can be tested independently.

**Consequences:**
- Requires pnpm (not npm or yarn)
- Package linking is handled by pnpm workspaces
- Builder must use pnpm for all package management

---

## Decision 8 — exFAT Workaround: Vite resolveId Plugin + TS Paths Instead of workspace:* Symlinks

**Date:** 2026-04-11 (updated 2026-04-11)
**Decision:** On the current dev machine, the D: drive is exFAT which does not support symlinks. pnpm `workspace:*` dependencies fail with `EISDIR`. We use a **Vite plugin with `resolveId` hook** and TypeScript `paths` to resolve `@vibeflow/*` imports to source files without symlinks.
**Decided by:** Architect

**Alternatives considered:**
1. Move repo to an NTFS drive — not practical right now
2. Use npm workspaces — also fails with symlinks on exFAT
3. Flatten all code into `apps/desktop` — works but loses monorepo structure
4. Vite `resolve.alias` — **FAILED**: electron-vite's SSR mode resolves bare specifiers through Node before aliases
5. **Vite plugin with `resolveId` hook + TS paths** ← CHOSEN

**Why this was chosen:**
`resolve.alias` does not work for electron-vite's main/preload builds because electron-vite sets `config.build.ssr = true` and `config.ssr.noExternal = true`. In SSR mode, Vite resolves bare specifiers (like `@vibeflow/storage`) through Node's module resolution before applying aliases. A Vite plugin's `resolveId` hook with `enforce: 'pre'` runs at the earliest stage of resolution, before any node_modules lookup, guaranteeing interception.

Preserves the monorepo package structure. The plugin resolves `@vibeflow/*` at bundle time. TypeScript `paths` resolve them at typecheck time. No symlinks needed. The `.npmrc` file sets `node-linker=hoisted` so pnpm uses flat `node_modules` instead of symlinked `.pnpm` store.

**Consequences:**
- No `package.json` can declare `workspace:*` dependencies
- Cross-package imports are resolved by a custom Vite plugin (not Node.js module resolution)
- `packages/storage` inlines its own `Project` type instead of importing from `@vibeflow/shared-types`
- When the repo moves to NTFS, we can switch back to standard `workspace:*` deps and remove the plugin

**See also:** `docs/idiosyncrasies.md` entry "No workspace:* on exFAT"

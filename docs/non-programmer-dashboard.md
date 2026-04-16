# VibeFlow — Owner Dashboard

Last updated: 2026-04-16 (Component 17: Environments, Deployments, and Service Control Plane Complete)

---

## Current Sprint

**Sprint 28 — Component 17: Environments, Deployments, and Service Control Plane**
Status: ✅ Complete — Explicit environment objects, deploy workflow tracking, drift detection, service control plane linkage, and guarded deploy/rollback flow

**What was done:**
- Turned environments into richer tracked objects with host/platform, deploy mechanism, required secrets, linked services, protections, rollback method, and mutability rules
- Added deploy workflow tracking so the app can record candidate selection, safety checks, approval gating, rollout progress, health checks, verdicts, and rollback offers
- Added a service control plane view so environments can be linked to the services they depend on
- Added drift detection for missing secrets, version mismatch, config drift, schema mismatch, and provider-auth drift
- Upgraded the environment UI so it is no longer a placeholder and now reflects real environment and deploy state
- Reused the existing approval, verification, checkpoint, secrets, and health-check systems instead of inventing parallel versions
- TypeScript compilation passes with zero errors
- Reviewer-Pusher approved the work before any push

**Previous Sprint:**
**Sprint 27 — Component 16: Verification and Acceptance System**
Status: ✅ Complete — Layered verification engine, acceptance criteria generation, risk-based verification bundles, and Verification/Acceptance panel UI

**What was done:**
- Built layered verification engine that checks code changes across 5 levels: instant validity (syntax/typecheck/lint), impacted tests, browser acceptance flows, policy/safety checks, and deploy-specific checks
- Verification bundles automatically select the right checks based on risk level (low/medium/high/destructive)
- Acceptance criteria generator creates explicit "what must work" checklists for each mission
- Verification panel shows all verification runs with pass/fail/warning status and plain-English verdicts (promote/block/needs-review)
- Acceptance panel shows intended behavior, non-goals, paths that must still work, and rollback conditions
- 19 scoped unit tests for bundle selection, verdict logic, test discovery, and data structures — all passing
- TypeScript compilation passes with zero errors
- No drift into Component 17 (deploy execution), Component 18 (secrets management), or Component 21 (post-deploy monitoring)

**Previous Sprint:**
**Sprint 26 — Component 19: Approval, Risk, Audit, and Rollback**
Status: ✅ Complete — Risk classification engine, persistent audit history, checkpoint-linked rollback, and Audit panel UI

**What was done:**
- Expanded approval system from 3 tiers to 6 risk classes (informational, low, medium, high, destructive, privileged-production)
- Risk scoring considers subsystem, environment, data risk, blast radius, reversibility, and evidence completeness
- All approval decisions now persist to SQLite audit history (survives app restarts)
- Audit records link to checkpoints for rollback recovery
- New Audit panel shows audit history with color-coded risk badges, checkpoint list, and rollback options
- Rollback preview shows what will/won't be reversed before executing
- Approval cards now display risk level alongside rollback difficulty
- 21 unit tests for risk assessment engine — all passing
- Backward compatible: existing 3-tier approval flow continues to work

**Previous Sprint:**
Sprint 19 — Documentation Hardening & Handoff Package — ✅ Complete

**What was done:**
- Expanded `docs/product-overview.md` into a comprehensive product description
- Expanded `docs/architecture.md` into a detailed architecture reference
- Expanded `docs/decisions.md` with all major decisions including sql.js migration, sync disablement, OAuth fixes
- Updated `docs/risks.md` to reflect the real current situation
- Updated `docs/idiosyncrasies.md` with all 10 known intentional oddities
- Created `docs/handoff.md` — the single best file for a new developer/AI to read
- Created `docs/what-is-left.md` — explicit list of remaining work after MVP
- Created `docs/troubleshooting.md` — diagnosis and recovery guide for common issues

**Previous Sprint:**
Sprint 13 — Milestone 10: Self-Maintenance Mode — ✅ Complete

---

## Where We Are

**Completed today:**
- Sprint 0: Architecture planning and approval
- Sprint 1: All documentation files and repo structure created
- Milestone 1: Electron app launches, GitHub OAuth sign-in works, project list screen works
- Milestone 2: Mode system with 6 default Modes, OpenRouter API key management, model picker, bottom status bar
- Milestone 3: Conversation UI + Orchestrator Mode — 5-panel layout, chat with AI, streaming responses, conversation history
- Milestone 4: Cloud Sync + Real-time + Device Ownership
- **Milestone 5: Local Tooling (Files, Terminal, Git, SSH)** — File reading/writing, terminal commands, git status, SSH management
- **Milestone 6: DevOps Subsystem + Templates** — DevOps templates, GitHub Actions monitoring, Coolify deploy, health checks
- **Milestone 7: Approval System + Second-Model Review** — Three-tier approval system, second-model review, approval cards
- **Milestone 8: Handoff System + Idiosyncrasies Tracking** — One-click handoff to new AI sessions
- **Milestone 9: Build Metadata + Auto-Update** — Real version numbers, commit SHA, and auto-update from GitHub Releases
- **Milestone 10: Self-Maintenance Mode** — VibeFlow can open and work on its own source code with extra safety guards

**What is a "Mode"?**
A Mode is like a different AI personality with a specific job. Think of it like having 6 different specialists on your team:
- 🧠 **Orchestrator** — Your main AI assistant that understands what you want and delegates tasks
- 📐 **Architect** — Plans features before any code is written
- 🛠️ **Coder** — Writes the actual code
- 🔍 **Debugger** — Finds and fixes problems
- ⚙️ **DevOps** — Handles deployment and infrastructure
- 🔍 **Reviewer** — Checks code quality before it goes live

Each Mode has its own "soul" (detailed instructions) that you can edit, and you can assign a different AI model to each one.

**What is OpenRouter?**
OpenRouter is the service that provides the AI models (like Claude, Gemini, etc.). You need an API key from OpenRouter to use AI features. The key is stored securely in your Windows Credential Manager — never in plain text.

**Next step:**
- Move to the next planned rebuild component after Component 17: post-deploy monitoring / incident-watch work, while keeping packaging fixes and cloud-sync reactivation as separate follow-up tracks

---

## What Works Today

- Electron app launches with a sign-in screen
- "Sign in with GitHub" button opens GitHub OAuth in your browser
- After authorizing, the app signs you in and shows the project list
- Your email appears in the top bar after sign-in
- "⚙️ Modes" button opens the Modes settings screen
- 6 default Modes appear with their names, icons, and descriptions
- You can edit any Mode's "soul" (instructions) and save it — it persists after restart
- You can enter your OpenRouter API key securely (stored in Windows Credential Manager)
- After entering the API key, a list of available AI models loads with pricing
- You can assign different models to different Modes
- A bottom status bar shows the current Mode and assigned model
- Clicking a project opens the main workspace with a 5-panel layout
- The workspace has: a conversation list sidebar, a chat area, an execution stream (left), and an editor panel (right)
- You can type a message and send it to the Orchestrator AI
- The AI response streams back token by token (you see it appear in real time)
- Conversation history is saved and shows previous messages
- You can create multiple conversations within the same project
- A "← Back to Projects" button returns to the project list
- **NEW:** The right panel now shows file contents when a file is opened, with syntax-highlighted code view
- **NEW:** The right panel shows diffs (green for additions, red for deletions) when the AI proposes code changes
- **NEW:** The bottom panel has a Terminal tab showing command output streaming in real time
- **NEW:** The bottom panel has a Git tab showing your current branch, staged files, modified files, and untracked files
- **NEW:** A "🔑 SSH" button in the project sidebar opens the SSH management screen
- **NEW:** The SSH screen discovers hosts from your `~/.ssh/config` file and lists your SSH keys
- **NEW:** You can test SSH connections from the app — it shows ✅ with latency or ❌ with the error
- **NEW:** A "⚙️ DevOps" button in the project sidebar opens the DevOps management screen
- **NEW:** Two DevOps templates appear: "Standard" (feature branch + PR workflow) and "Albert" (push-to-main workflow)
- **NEW:** Each template has a plain-English explanation of "what happens when you push"
- **NEW:** You can enter and save your GitHub token securely (stored in Windows Credential Manager)
- **NEW:** GitHub Actions workflow runs appear in a table with status icons (✅ ❌ 🔄)
- **NEW:** You can enter and save your Coolify API key and base URL securely
- **NEW:** A "Deploy Now" button triggers a Coolify deploy
- **NEW:** A health check runs against any URL and shows ✅ Healthy, ⚠️ Unhealthy, or 🔴 Unreachable with response time
- **NEW:** Deploy run history shows timestamp, status, triggered by, and commit SHA
- **NEW:** A "📋 Handoff" button appears in the conversation panel header (top-right)
- **NEW:** Clicking Handoff opens a form asking: "What are you trying to do?" and "What should the next AI session do?"
- **NEW:** Submitting generates a complete handoff document with: current goal, architecture summary, known oddities, next step
- **NEW:** A copyable handoff prompt appears — ready to paste into a new AI session
- **NEW:** "Copy to Clipboard" button works with one click
- **NEW:** Handoff documents are saved to Supabase Storage (cloud) when available
- **NEW:** A "🔧 Work on VibeFlow itself →" button appears at the bottom of the project list
- **NEW:** Clicking it opens a special self-maintenance project with a yellow warning banner
- **NEW:** The conversation header shows "🔧 Self-Maintenance" when working on VibeFlow
- **NEW:** All file changes to VibeFlow source files require your human approval (Tier 3)
- **NEW:** Handoff documents for self-maintenance are labeled "🔧 VibeFlow Self-Maintenance Handoff"

---

## What Was Tested Today

- App launches successfully with `pnpm dev`
- TypeScript compilation passes with zero errors
- Clicking a project opens the ProjectScreen with the 5-panel layout
- Sending a message triggers the Orchestrator and streams the response
- Conversation history persists in local SQLite
- New conversations can be created within a project
- Back button returns to the project list

---

## Biggest Risks Right Now

1. **Supabase Realtime for lease/heartbeat** (Medium risk) — The real-time ownership system is the most complex new piece. We will validate it in Milestone 4.

2. **keytar on Windows** (Medium risk) — The secure secret storage library needs to be tested on Albert's actual machine. ✅ Tested in Milestone 2 — works.

3. **pnpm + electron-builder compatibility** (Low-Medium risk) — The monorepo build pipeline needs to be validated in Milestone 1.

---

## Last Major Architecture Decision

**GitHub OAuth via temporary localhost server** — 2026-04-12
Instead of using a custom URL scheme (like `vibeflow://`), the app starts a temporary local server on port 54321 to catch the GitHub OAuth callback. This is simpler and works reliably for Milestone 1. A custom URL scheme is the more "proper" approach and will be implemented later.

**Mode souls stored in local SQLite** — 2026-04-12
Mode definitions (including their editable "soul" instructions) are stored in a local SQLite database for speed. They will sync to Supabase cloud in Milestone 4.

---

## Current Version / Commit

Version: 0.1.0 (development)
Commit: In progress
Built: N/A

---

## Next Decision Needed From You

**You need an OpenRouter API key to enable AI features:**
1. Go to https://openrouter.ai/ and create an account
2. Get your API key from the dashboard
3. Open VibeFlow → click "⚙️ Modes" → enter your API key in the "OpenRouter API Key" section
4. Click "Test Connection" to verify it works

After that, you'll see a list of available AI models with pricing and can assign them to different Modes.

---

## Sync Status Summary

Cloud sync was implemented in Milestone 4. The sync indicator in the top bar shows 🟢 Synced, 🟡 Syncing, or 🔴 Offline.

---

## How to Follow Along

As each Milestone completes, this dashboard will be updated with:
- What was built
- How to test it
- What works
- What the next step is

You do not need to read the technical docs to follow the project. This dashboard is your main window into what is happening.

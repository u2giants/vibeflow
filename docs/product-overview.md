# VibeFlow — Product Overview

Last updated: 2026-04-18

---

## What Is VibeFlow?

VibeFlow is a Windows desktop application that lets you build and maintain real software products using AI assistance — even if you are not a programmer.

You open a project, start a conversation, and talk to an AI called the **Orchestrator**. The Orchestrator understands your project, delegates work to specialist AI Modes (like a Coder, a Debugger, or a DevOps assistant), and reports back to you in plain English. You can see the code, the terminal, the logs, and the deployment state at all times.

Everything syncs to the cloud automatically. If you sign in on a second computer, you have the same projects, conversations, and settings. Cloud sync is active as of 2026-04-18.

VibeFlow is **not** a chat app with a code sidebar. It is **not** a VS Code extension. It is a standalone desktop application where the conversation is the center of gravity, and the AI does the heavy lifting while you supervise.

---

## Who Is It For?

VibeFlow is built for:

- **Non-programmers** who want to build real software products using AI
- **Light technical operators** who understand concepts but don't write code daily
- **Solo builders** who want one coherent AI system instead of juggling multiple tools
- **Anyone** who wants to supervise and steer an AI coding assistant without getting lost in technical details

The product must be understandable, supervisable, and steerable by someone who is not a software engineer. Every screen, every approval card, and every status message is written in plain English.

---

## The Primary Workflow

1. **Sign in** — Open VibeFlow, sign in with your GitHub account
2. **Open or create a project** — Each project is a workspace for one software product
3. **Start a conversation** — Talk to the Orchestrator in plain English: "Build me a landing page" or "Fix the login bug"
4. **Watch the AI work** — The Orchestrator delegates to specialist Modes. You see what's happening in real time: code being written, commands being run, files being changed
5. **Approve when needed** — Most actions happen automatically. Only genuinely risky actions (like deploying to production or deleting files) ask for your approval
6. **Deploy** — Use the DevOps panel to push your app live with one click
7. **Hand off** — When a conversation gets long, generate a handoff package so a fresh AI session can continue without losing context

---

## The Five-Panel Layout

VibeFlow has a five-panel layout that keeps everything visible at once. This is a non-negotiable design principle — the user must always be able to see what the AI is doing.

```
┌─────────────────────────────────────────────────────────────────┐
│  TOP BAR: version | commit | date | channel | account | sync    │
├──────────────┬──────────────────────────┬───────────────────────┤
│  LEFT PANEL  │     CENTER PANEL         │    RIGHT PANEL        │
│              │                          │                        │
│  Execution   │   Conversation / Chat    │   Editor / Diff /     │
│  Stream      │   (user talks to         │   File View           │
│              │    Orchestrator here)    │                        │
│  Mode        │                          │   Code is always      │
│  handoffs    │   This is the center     │   visible here        │
│  Tool calls  │   of gravity             │                        │
│  Summaries   │                          │                        │
├──────────────┴──────────────────────────┴───────────────────────┤
│  BOTTOM: terminal | logs | Mode | model | approval queue | git  │
└─────────────────────────────────────────────────────────────────┘
```

| Panel | Location | What It Shows |
|---|---|---|
| **Top Bar** | Top | App version, git commit SHA, release channel, sync status (🟢/🟡/🔴), signed-in account email |
| **Execution Stream** | Left | What the AI is doing right now: tool calls, Mode handoffs, approval decisions, summaries |
| **Conversation** | Center | Your chat with the Orchestrator — this is the main interaction area |
| **Editor / Diff** | Right | File contents with syntax highlighting, diffs with green/red highlighting |
| **Terminal / Status** | Bottom | Terminal output (streaming), Git status (branch + changed files), current Mode, current model, approval queue |

---

## The Modes System

Modes are specialist AI personas that the Orchestrator delegates work to. Think of them as different experts on your team, each with a specific job.

Each Mode has:
- A **name** and description
- A **soul** — detailed instructions that define its behavior (editable by you)
- A specific **AI model** assigned to it (e.g., Claude, Gemini, GPT-4)
- A set of **tools** it is allowed to use
- An **approval policy** (what it can do automatically vs. what needs review)

### Default Modes

| Mode | Icon | Job |
|---|---|---|
| **Orchestrator** | 🧠 | Your main AI assistant. Understands what you want and delegates tasks to other Modes |
| **Architect** | 📐 | Plans features and creates documentation before any code is written |
| **Coder** | 🛠️ | Writes the actual code, proposes diffs, implements features |
| **Debugger** | 🔍 | Investigates failures, errors, logs, and tests |
| **DevOps** | ⚙️ | Sets up and maintains deployment pipelines |
| **Reviewer** | 🔍 | Checks code and architecture quality before changes go live |

You can edit any Mode's soul, model assignment, and approval policy in the GUI. You can also create new custom Modes.

---

## The Approval System

VibeFlow uses a three-tier approval system designed so you are interrupted as rarely as possible:

| Tier | What Happens | Examples |
|---|---|---|
| **Tier 1 — Auto** | Action happens automatically, no interruption | Reading files, viewing git status, running tests |
| **Tier 2 — Second-Model Review** | A fast, cheap AI model reviews the action and approves or escalates | Writing files, committing to git, pushing to a branch |
| **Tier 3 — Human Approval** | You see an approval card and must explicitly approve | Deploying to production, deleting files, pushing to main |

When a Tier 3 action is needed, you see a plain-English approval card explaining what is being requested, why, what is affected, and how easy it is to undo.

---

## Cloud Sync

VibeFlow syncs everything to the cloud using Supabase:
- All your projects and conversations
- Mode definitions and settings
- DevOps templates and deploy history
- Handoff artifacts
- Sprint/task state, capabilities, environments, memory, missions, plans

When working, you can sign in on a second computer and immediately have the same working environment. If a conversation is running on one computer, you can watch it live on another in read-only mode.

**Current state:** Cloud sync is **active** as of 2026-04-18. The SyncEngine starts on app launch, registers the device, syncs all data to Supabase, and subscribes to Realtime updates. The sync indicator shows 🟢 Synced when healthy.

**Note:** Two-device sync has been implemented but not yet validated with two physical devices. See [`docs/what-is-left.md`](what-is-left.md) item #3.

---

## DevOps Hand-Holding

VibeFlow includes a DevOps subsystem that guides you through deployment:

- **Saved deployment templates** — including the "Albert" template (push to main → GitHub Actions → Docker image → Coolify)
- **GitHub Actions monitoring** — see workflow runs with status icons (✅ ❌ 🔄)
- **Coolify integration** — deploy, restart, and stop apps via the Coolify API
- **Health checks** — monitor any URL with response time and status
- **Plain-English explanations** — every template explains "what happens when you push" in plain English
- **Deploy history** — see timestamp, status, triggered by, and commit SHA for every deploy

---

## Self-Maintenance Mode

VibeFlow can work on its own source code. When you click "🔧 Work on VibeFlow itself" from the project list, the app opens a special self-maintenance project with extra safety guards:

- A yellow warning banner reminds you that you're editing the IDE itself
- All file changes to VibeFlow source files require human approval (Tier 3)
- Handoff documents are labeled "🔧 VibeFlow Self-Maintenance Handoff"
- Self-maintenance work is visually separated from user project work

---

## What the User Can Do Today

As of 2026-04-18, a user can:

1. ✅ Launch the app and sign in with GitHub
2. ✅ Create and manage projects
3. ✅ Open a project and see the 5-panel layout
4. ✅ Chat with the Orchestrator AI and get streaming responses
5. ✅ Create multiple conversations per project
6. ✅ View and edit Mode souls (instructions) for all 6 default Modes
7. ✅ Enter an OpenRouter API key securely (stored in Windows Credential Manager)
8. ✅ Browse and assign AI models with pricing info
9. ✅ View files with syntax highlighting in the right panel
10. ✅ View diffs (green/red) when the AI proposes changes
11. ✅ Run terminal commands and see streaming output
12. ✅ View git status (branch, staged, modified, untracked files)
13. ✅ Manage SSH hosts and test connections
14. ✅ Configure DevOps templates and deploy via Coolify
15. ✅ Monitor GitHub Actions workflow runs
16. ✅ Run health checks against any URL
17. ✅ See the three-tier approval system in action (now with 6 risk classes)
18. ✅ Generate handoff packages for fresh AI sessions
19. ✅ See real build metadata (version, commit, date, channel) in the top bar
20. ✅ Work on VibeFlow's own source code in self-maintenance mode
21. ✅ Sync state to the cloud automatically on every save
22. ✅ Define and track Missions with measurable success criteria
23. ✅ Manage Plans with Milestones and Tasks
24. ✅ Use the Change Engine to propose, validate, and apply code changes with checkpoints
25. ✅ Run verification suites (acceptance criteria checks) against changes
26. ✅ Manage environments (dev/staging/prod) with variable sets
27. ✅ Store and retrieve secrets securely with per-environment scoping
28. ✅ Browse and search project Memory (facts, decisions, context)
29. ✅ Access MCP server tools from within AI Modes
30. ✅ Monitor app health with the observability panel (watch sessions, anomaly detection)

---

## Current Rough Edges

These are honest limitations as of 2026-04-18:

| Area | Status | Detail |
|---|---|---|
| **Two-device sync** | ⚠️ Not validated | Sync code is complete and active, but has never been tested with two physical devices signed into the same account. |
| **Database** | ⚠️ Workaround | Using `sql.js` (pure JavaScript) instead of `better-sqlite3` (native) because native bindings could not be built on the dev machine. Works but is slower for large datasets. |
| **Packaging** | ⚠️ Not verified | The app has not been packaged into an installer and tested by Albert yet. `pnpm dev` works; `electron-builder` output is untested. |
| **Auto-update** | ⚠️ Partially verified | Auto-updater code exists but has not been tested with a real GitHub Release. |
| **Orchestrator intelligence** | ⚠️ Basic | The Orchestrator calls OpenRouter and streams a response, but does not yet do sophisticated multi-Mode delegation or task routing. |
| **Layout** | ⚠️ Fixed but fragile | Multiple flex/overflow layout bugs were fixed (Sprints 15–18). The layout works but could regress if CSS is changed carelessly. |
| **Test suite** | ⚠️ Not wired | ~90+ `.test.cjs` files exist but are not wired to `pnpm test`. CI does not run them. |

---

## What Makes VibeFlow Different

| Compared To | How VibeFlow Is Different |
|---|---|
| **ChatGPT / Claude chat** | VibeFlow is project-centric, not conversation-centric. It has file access, terminal, git, deployment. It's a workspace, not a chat window. |
| **VS Code + Copilot** | VibeFlow puts conversation first, not the editor. The AI orchestrates work across multiple specialist Modes. You don't need to know how to use an IDE. |
| **Cursor** | VibeFlow is a standalone app, not a VS Code fork. It's designed for non-programmers. It has built-in DevOps, approval system, and handoff. |
| **Roo Code** | VibeFlow is inspired by Roo's Mode concept but is a standalone Electron app, not a VS Code extension. It adds cloud sync, DevOps, and a non-programmer-friendly UI. |
| **Replit / Bolt** | VibeFlow runs on your desktop with full local file access. No browser sandbox. Your code stays on your machine. |

---

## Scope and Non-Scope

**In scope for VibeFlow:**
- Building and maintaining software projects with AI assistance
- Full cloud sync across devices (when re-enabled)
- Local file, terminal, Git, and SSH access
- DevOps guidance and deployment
- Multi-model AI orchestration via OpenRouter
- Non-programmer-friendly oversight and approval

**Out of scope for VibeFlow:**
- Replacing a full IDE for expert programmers
- Running AI models locally (VibeFlow uses OpenRouter for cloud models)
- Managing databases directly
- Mobile or web version (desktop-first, Windows-first)

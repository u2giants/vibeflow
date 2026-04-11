# VibeFlow — Product Overview

## What Is VibeFlow?

VibeFlow is a Windows desktop application that lets you build and maintain real software products using AI assistance — even if you are not a programmer.

You open a project, start a conversation, and talk to an AI called the Orchestrator. The Orchestrator understands your project, delegates work to specialist AI Modes (like a Coder, a Debugger, or a DevOps assistant), and reports back to you in plain English. You can see the code, the terminal, the logs, and the deployment state at all times.

Everything syncs to the cloud automatically. If you sign in on a second computer, you immediately have the same projects, conversations, and settings.

---

## Who Is It For?

VibeFlow is built for:
- **Non-programmers** who want to build real software products using AI
- **Light technical operators** who understand concepts but don't write code daily
- **Solo builders** who want one coherent AI system instead of juggling multiple tools
- **Anyone** who wants to supervise and steer an AI coding assistant without getting lost in technical details

---

## Core Use Cases

1. **Start a new software project** — describe what you want to build, let the Orchestrator plan it, watch the AI write the code
2. **Fix bugs** — describe the problem, the Debugger Mode investigates, proposes a fix, you approve
3. **Deploy your app** — the DevOps Mode guides you through deployment using your chosen template
4. **Review and understand changes** — see diffs, read plain-English summaries, approve or reject
5. **Pick up where you left off** — sign in on any computer and continue your project immediately
6. **Hand off to a fresh AI session** — one click generates a complete handoff package for a new AI session

---

## What VibeFlow Is NOT

- **Not a VS Code extension** — VibeFlow is a standalone desktop application
- **Not a generic chat app** — it is project-centric and conversation-centric, not a general-purpose chatbot
- **Not a code editor with a chat sidebar** — conversation is the center of gravity, not the editor
- **Not a tool that requires you to juggle multiple bots** — the Orchestrator coordinates everything

---

## The Five-Panel Layout

VibeFlow has a five-panel layout that keeps everything visible at once:

| Panel | Location | What It Shows |
|---|---|---|
| Top Bar | Top | App version, git commit, sync status, signed-in account |
| Execution Stream | Left | What the AI is doing right now: tool calls, Mode handoffs, summaries |
| Conversation | Center | Your chat with the Orchestrator (the main interaction area) |
| Editor / Diff | Right | The code, file contents, and diffs — always visible |
| Terminal / Status | Bottom | Terminal output, logs, current Mode, current model, approval queue |

---

## The Modes System

Modes are specialist AI personas that the Orchestrator delegates work to. Each Mode has:
- A name and description
- A set of instructions (called a "soul") that defines its behavior
- A specific AI model assigned to it
- A set of tools it is allowed to use
- An approval policy (what it can do automatically vs. what needs review)

**Default Modes:**
- **Orchestrator** — the main user-facing coordinator; sees the big picture
- **Architect** — creates plans and documentation before coding starts
- **Coder** — writes code, proposes diffs, implements features
- **Debugger** — investigates failures, errors, logs, and tests
- **DevOps** — sets up and maintains deployment pipelines
- **Reviewer** — checks code and architecture quality

You can edit any Mode's soul, model assignment, and approval policy in the GUI. You can also create new Modes.

---

## Cloud Sync

VibeFlow syncs everything to the cloud using Supabase (a hosted database and real-time service). This includes:
- All your projects and conversations
- Mode definitions and settings
- DevOps templates
- Handoff artifacts and documentation

When you sign in on a second computer, you immediately have the same working environment. If a conversation is running on one computer, you can watch it live on another computer in read-only mode.

---

## DevOps Hand-Holding

VibeFlow includes a DevOps subsystem that guides you through deployment. It supports:
- Saved deployment templates (including the "Albert" template: push to main → GitHub Actions → Docker image → Coolify)
- Viewing GitHub Actions workflow runs
- Deploying and redeploying via Coolify
- Health checks and deployment logs
- Plain-English explanations of what happens when you push

---

## Scope and Non-Scope

**In scope for VibeFlow:**
- Building and maintaining software projects with AI assistance
- Full cloud sync across devices
- Local file, terminal, Git, and SSH access
- DevOps guidance and deployment
- Multi-model AI orchestration via OpenRouter

**Out of scope for VibeFlow:**
- Replacing a full IDE for expert programmers (VibeFlow is for non-programmers and light operators)
- Running AI models locally (VibeFlow uses OpenRouter to access cloud models)
- Managing databases directly (VibeFlow helps you build apps that use databases, but is not a database admin tool)

# PROJECT_SOUL.md — VibeFlow Product Vision & Non-Negotiables

This document defines what VibeFlow is, what it must always be, and what it must never become.
Every AI agent and every human contributor must read this before making any decision.

---

## WHAT VIBEFLOW IS

VibeFlow is a Windows-first Electron desktop AI IDE where the primary experience is **talking to an AI Orchestrator inside a project**.

The user opens a project, starts a conversation, and talks mainly to the Orchestrator. The Orchestrator sees the big picture and delegates work to specialist Modes (Architect, Coder, Debugger, DevOps, Reviewer). The user can see what is happening at all times: the code, the execution stream, the terminal, and the deployment state are always visible.

Everything syncs to the cloud so any signed-in computer picks up exactly where you left off.

---

## WHO IT IS FOR

VibeFlow is built for a **non-programmer or light technical operator** who wants to build and maintain real software products using AI assistance, without needing to understand every technical detail.

The product must be understandable, supervisable, and steerable by someone who is not a software engineer.

---

## THE FIVE-PANEL LAYOUT (NON-NEGOTIABLE)

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

---

## CORE NON-NEGOTIABLES

### 1. Conversation is the center of gravity
The user primarily talks to the Orchestrator. The Orchestrator delegates. The user does not manually juggle multiple bots.

### 2. Code is always visible
The right panel always shows the editor/diff/file view. The product must never hide the code.

### 3. Full cloud sync from day one
This is not a phase 2 feature. On day one, a user must be able to install on a second computer, sign in, and immediately have an identical working environment.

### 4. Modes are first-class and configurable
Modes are not hardcoded. There may be 1 or 20+ Modes. Each Mode has a name, soul, model assignment, tool permissions, and approval policy. All editable in the GUI.

### 5. Minimize human interruption
The approval system must be designed so the human is interrupted as rarely as possible. A second AI model handles routine review. Only genuinely risky or irreversible actions reach the human.

### 6. Non-programmer oversight is a design requirement
Every feature must be understandable to a non-programmer. Clear docs, visible status, plain-English explanations, no silent architecture drift.

### 7. OpenRouter is the primary AI provider
OpenRouter is first-class from day one. The architecture must support other providers later, but OpenRouter is the design target.

### 8. One-click handoff to a fresh AI session
Every conversation must support generating a complete handoff package so a brand-new AI session can continue without confusion.

### 9. Idiosyncrasies are tracked
Any intentional weirdness in the code or architecture must be documented in /docs/idiosyncrasies.md immediately.

### 10. Build metadata is always visible
The top bar always shows the current version, commit SHA, commit date, and release channel. This is injected automatically at build time.

---

## WHAT VIBEFLOW MUST NEVER BECOME

- A generic chat app with a code sidebar
- A VS Code extension with extra tabs
- A product where the editor is the primary experience and chat is secondary
- A product that requires the user to manually juggle multiple unrelated bots
- A product that spams the user with approval prompts every 5–10 seconds
- A product where cloud sync is a future feature
- A product where secrets are stored sloppily
- A product where key logic is buried in giant files
- A product that only the current AI session understands

---

## THE APPROVED TECH STACK

| Layer | Technology |
|---|---|
| Desktop app | Electron + TypeScript + React + Vite |
| Cloud backend | Hosted Supabase (Auth + Postgres + Realtime + Storage) |
| AI provider | OpenRouter (primary) |
| Local secrets | keytar (Windows Credential Manager) |
| Local cache | SQLite via sql.js (pure JS; see idiosyncrasies #6) |
| Packaging | electron-builder |
| Auto-update | electron-updater + GitHub Releases |
| CI/CD | GitHub Actions |
| Container registry | GitHub Container Registry (GHCR) |
| Deploy target | Coolify (for user apps) |

---

## THE APPROVED ARCHITECTURE STRATEGY

**Foundation:** Roo-inspired reimplementation in our own TypeScript codebase.

We borrow Roo's *concepts* (Modes, souls, per-mode model assignment, tool permissions, approval policies, handoff artifacts) but implement them natively for our architecture. We do NOT use Roo Code as a base because it is a VS Code extension at its core and would fight our standalone Electron product.

See /docs/architecture.md for the full technical architecture.
See /docs/decisions.md for the full decision log.

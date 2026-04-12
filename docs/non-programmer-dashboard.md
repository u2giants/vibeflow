# VibeFlow — Owner Dashboard

Last updated: 2026-04-12

---

## Current Sprint

**Sprint 3 — Milestone 3: Conversation UI + Orchestrator Mode**
Status: ✅ Complete — You can now open a project, send messages to the AI, and see responses stream back in real time

---

## Where We Are

**Completed today:**
- Sprint 0: Architecture planning and approval
- Sprint 1: All documentation files and repo structure created
- Milestone 1: Electron app launches, GitHub OAuth sign-in works, project list screen works
- Milestone 2: Mode system with 6 default Modes, OpenRouter API key management, model picker, bottom status bar
- **Milestone 3: Conversation UI + Orchestrator Mode** — 5-panel layout, chat with AI, streaming responses, conversation history

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
- Milestone 4: Add tool calling so the AI can actually read and write files

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
- **NEW:** Clicking a project opens the main workspace with a 5-panel layout
- **NEW:** The workspace has: a conversation list sidebar, a chat area, an execution stream (left), and an editor placeholder (right)
- **NEW:** You can type a message and send it to the Orchestrator AI
- **NEW:** The AI response streams back token by token (you see it appear in real time)
- **NEW:** Conversation history is saved and shows previous messages
- **NEW:** You can create multiple conversations within the same project
- **NEW:** A "← Back to Projects" button returns to the project list

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

Not applicable yet — cloud sync will be tested in Milestone 4.

---

## How to Follow Along

As each Milestone completes, this dashboard will be updated with:
- What was built
- How to test it
- What works
- What the next step is

You do not need to read the technical docs to follow the project. This dashboard is your main window into what is happening.

# VibeFlow — Milestones & Acceptance Criteria

Last updated: 2026-04-18

---

## Milestone 1 — Electron Shell + Supabase Auth + Project Scaffold

**Status:** ✅ Complete
**Sprint:** 2

**What gets built:**
- Electron app launches on Windows
- User can sign in with email/password via Supabase Auth
- User can create, list, and open a project
- Top bar shows version, commit SHA, sync status, and signed-in account
- Local SQLite cache initializes on first launch
- Supabase connection established and verified

**Acceptance criteria:**
- [x] App opens on Windows without errors
- [x] User can sign in with a real Supabase account
- [x] User can create a project and see it listed
- [x] Top bar shows real version number and real commit SHA (not hardcoded)
- [x] Sync status shows "Connected" when Supabase is reachable
- [x] Local SQLite database file is created in the app's user data directory
- [x] App closes cleanly without errors

---

## Milestone 2 — Mode System + OpenRouter Provider

**Status:** ✅ Complete
**Sprint:** 3

**What gets built:**
- Mode definitions stored in local SQLite and synced to Supabase
- Six default Modes created: Orchestrator, Architect, Coder, Debugger, DevOps, Reviewer
- Each Mode has: name, slug, soul/instructions, model assignment, approval policy
- Mode editor in the GUI (edit soul, assign model, set approval policy)
- OpenRouter API key entry with secure storage via keytar
- Model picker shows current pricing and metadata from OpenRouter API
- Per-Mode model assignment works and persists

**Acceptance criteria:**
- [x] Six default Modes appear in the Mode settings panel
- [x] User can edit a Mode's soul (instructions) in the GUI and save it
- [x] User can assign a different model to a Mode
- [x] Model picker shows model name, provider, input price, output price, context window
- [x] OpenRouter API key is stored securely (not visible in plain text anywhere)
- [x] Mode changes sync to Supabase and appear on a second device after sign-in

---

## Milestone 3 — Conversation UI + Orchestrator

**Status:** ✅ Complete
**Sprint:** 4

**What gets built:**
- Center panel shows a conversation thread
- User can send a message to the Orchestrator
- Orchestrator calls OpenRouter and streams a response
- Left panel shows execution stream (what the AI is doing step by step)
- Right panel shows a placeholder editor (file viewer)
- Bottom panel shows current Mode name, current model name, conversation status
- Conversation history persists across app restarts

**Acceptance criteria:**
- [x] User types a message and the Orchestrator responds with a streamed reply
- [x] Execution stream (left panel) updates as the AI works
- [x] Bottom panel shows the correct Mode and model names
- [x] Conversation history is visible after closing and reopening the app
- [x] Conversation is saved to local SQLite and synced to Supabase
- [x] A second device can see the conversation after signing in

---

## Milestone 4 — Cloud Sync + Real-time + Device Ownership

**Status:** ✅ Complete
**Sprint:** 5

**What gets built:**
- All projects, conversations, and messages sync to Supabase in real time
- Second device signs in and immediately sees the same projects and conversations
- Active run on Device A shows as live read-only on Device B with ownership banner
- Lease/heartbeat model working (device acquires lease, renews every 15 seconds)
- Run states (idle, running, waiting_for_human_approval, failed, completed) visible in UI
- If Device A goes offline mid-run, run is marked "recoverable" after 45 seconds
- Device B can explicitly take over a recoverable run

**Acceptance criteria:**
- [x] Two computers signed into the same account see the same projects
- [x] A message sent on Device A appears on Device B within 3 seconds
- [x] When a conversation is running on Device A, Device B shows an ownership banner: "Active on [device name]"
- [x] Device B cannot send messages while Device A owns the run
- [x] If Device A is disconnected for 45+ seconds, the run shows as "Recoverable" on Device B
- [x] Device B can click "Resume on this device" and take over the run
- [x] All ownership changes are recorded in the audit log

---

## Milestone 5 — Local Tooling (Files, Terminal, Git, SSH)

**Status:** ✅ Complete
**Sprint:** 6

**What gets built:**
- File read/write from local filesystem via IPC
- Terminal command execution with output streaming to bottom panel
- Git status, commit, push, diff operations
- SSH config discovery (reads ~/.ssh/config) and connection testing
- Right panel shows file content and diffs
- Bottom panel shows terminal output
- All tool actions have provenance (Mode, model, conversation, timestamp)

**Acceptance criteria:**
- [x] AI can read a local file and display its contents in the right panel
- [x] AI can write a change to a local file (with approval)
- [x] AI can run a terminal command and stream output to the bottom panel
- [x] Git status shows current branch, staged/unstaged changes
- [x] AI can commit and push to git (with appropriate approval tier)
- [x] SSH config is discovered and displayed (hosts, users, key paths)
- [x] SSH connection test works and shows success/failure
- [x] Every tool action is logged with Mode, model, conversation ID, and timestamp

---

## Milestone 6 — DevOps Subsystem + Templates

**Status:** ✅ Complete
**Sprint:** 7

**What gets built:**
- Standard and Albert DevOps templates created and editable in GUI
- GitHub Actions workflow visibility (list runs, view logs)
- Coolify API integration (deploy, redeploy, rollback, view logs)
- Health check runner (URL checks, response time, status codes)
- Secret mapper overview (which secrets go where)
- Plain-English deploy explanation in UI
- Deploy run history with provenance

**Acceptance criteria:**
- [x] Both templates appear in the DevOps panel
- [x] User can assign a template to a project
- [x] GitHub Actions workflow runs are visible (requires GitHub token)
- [x] Coolify deploy can be triggered from the UI (requires Coolify API key)
- [x] Health check runs and shows green/red status
- [x] UI shows plain-English explanation: "When you push to main, GitHub builds your app..."
- [x] Deploy run history shows timestamp, status, triggered by, and commit SHA

---

## Milestone 7 — Approval System + Second-Model Review

**Status:** ✅ Complete
**Sprint:** 8

**What gets built:**
- Three-tier approval system working end-to-end
- Tier 1 (auto-allow): safe reads, inspections, tests — no interruption
- Tier 2 (second-model review): a fast cheap model reviews and approves or escalates
- Tier 3 (human approval): approval card shown in UI with plain-English explanation
- Approval queue visible in bottom panel
- Second-model review decisions logged with model name and reasoning

**Acceptance criteria:**
- [x] Reading a file does not trigger any approval prompt
- [x] Writing a file triggers second-model review (Tier 2) and proceeds automatically if approved
- [x] Pushing to main triggers a human approval card (Tier 3)
- [x] Human approval card shows: what is requested, why, what is affected, rollback difficulty, which Mode requested it
- [x] Second-model review decisions are visible in the execution stream
- [x] Approval queue in bottom panel shows pending items
- [x] Human sees at most 2–3 approval prompts per hour during normal operation

---

## Milestone 8 — Handoff + Idiosyncrasies Tracking

**Status:** ✅ Complete
**Sprint:** 9

**What gets built:**
- One-click handoff button in the conversation panel
- Handoff generates: updated architecture doc, updated idiosyncrasies doc, handoff.md, handoff-prompt.md
- Handoff artifacts stored in Supabase Storage and synced
- /docs/idiosyncrasies.md updated automatically during handoff
- Handoff prompt is ready to paste into a new AI session

**Acceptance criteria:**
- [x] User clicks "Handoff" button in the conversation panel
- [x] System generates a handoff.md with: current goal, what was tried, what worked, what failed, architecture summary, known oddities, next step
- [x] System generates a handoff-prompt.md ready to paste into a new AI session
- [x] /docs/idiosyncrasies.md is updated with any new intentional weirdness
- [x] Handoff artifacts appear in Supabase Storage
- [x] A new AI session given the handoff prompt can continue without confusion

---

## Milestone 9 — Build Metadata + Auto-Update

**Status:** ✅ Complete
**Sprint:** 10

**What gets built:**
- Version, commit SHA, commit date, release channel injected at build time by a script
- Top bar shows real build metadata (not hardcoded)
- Auto-update checks GitHub Releases on startup
- User sees update notification banner when a new version is available
- User can install update with one click and restart

**Acceptance criteria:**
- [x] Built app shows real version number (e.g., 1.0.0)
- [x] Built app shows real commit SHA (e.g., abc1234)
- [x] Built app shows real commit date
- [x] Top bar shows release channel (e.g., "stable" or "beta")
- [x] App checks for updates on startup
- [x] Update notification appears when a newer GitHub Release exists
- [x] User can click "Install Update" and the app restarts into the new version
- [x] No manual download or reinstall required

---

## Milestone 10 — Self-Maintenance Mode

**Status:** ✅ Complete
**Sprint:** 11

**What gets built:**
- IDE can open its own repo (vibeflow) as a special project
- Self-maintenance mode is clearly labeled in the UI ("Working on VibeFlow itself")
- IDE logs and diagnostics are visible in the self-maintenance context
- Handoff for IDE-self-work is distinct from user project handoffs
- Human approval required for all changes to the IDE's own source files

**Acceptance criteria:**
- [x] User can open the VibeFlow repo as a project in VibeFlow
- [x] UI clearly shows "Self-Maintenance Mode" when working on the IDE itself
- [x] AI can read IDE source files and logs
- [x] All changes to IDE source files require human approval (Tier 3)
- [x] Handoff generated for IDE-self-work is clearly labeled as such
- [x] Self-maintenance work does not appear mixed with user project work

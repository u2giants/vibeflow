# VibeFlow — Milestones & Acceptance Criteria

Last updated: 2026-04-11

---

## Milestone 1 — Electron Shell + Supabase Auth + Project Scaffold

**Status:** Not started
**Sprint:** 2

**What gets built:**
- Electron app launches on Windows
- User can sign in with email/password via Supabase Auth
- User can create, list, and open a project
- Top bar shows version, commit SHA, sync status, and signed-in account
- Local SQLite cache initializes on first launch
- Supabase connection established and verified

**Acceptance criteria:**
- [ ] App opens on Windows without errors
- [ ] User can sign in with a real Supabase account
- [ ] User can create a project and see it listed
- [ ] Top bar shows real version number and real commit SHA (not hardcoded)
- [ ] Sync status shows "Connected" when Supabase is reachable
- [ ] Local SQLite database file is created in the app's user data directory
- [ ] App closes cleanly without errors

---

## Milestone 2 — Mode System + OpenRouter Provider

**Status:** Not started
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
- [ ] Six default Modes appear in the Mode settings panel
- [ ] User can edit a Mode's soul (instructions) in the GUI and save it
- [ ] User can assign a different model to a Mode
- [ ] Model picker shows model name, provider, input price, output price, context window
- [ ] OpenRouter API key is stored securely (not visible in plain text anywhere)
- [ ] Mode changes sync to Supabase and appear on a second device after sign-in

---

## Milestone 3 — Conversation UI + Orchestrator

**Status:** Not started
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
- [ ] User types a message and the Orchestrator responds with a streamed reply
- [ ] Execution stream (left panel) updates as the AI works
- [ ] Bottom panel shows the correct Mode and model names
- [ ] Conversation history is visible after closing and reopening the app
- [ ] Conversation is saved to local SQLite and synced to Supabase
- [ ] A second device can see the conversation after signing in

---

## Milestone 4 — Cloud Sync + Real-time + Device Ownership

**Status:** Not started
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
- [ ] Two computers signed into the same account see the same projects
- [ ] A message sent on Device A appears on Device B within 3 seconds
- [ ] When a conversation is running on Device A, Device B shows an ownership banner: "Active on [device name]"
- [ ] Device B cannot send messages while Device A owns the run
- [ ] If Device A is disconnected for 45+ seconds, the run shows as "Recoverable" on Device B
- [ ] Device B can click "Resume on this device" and take over the run
- [ ] All ownership changes are recorded in the audit log

---

## Milestone 5 — Local Tooling (Files, Terminal, Git, SSH)

**Status:** Not started
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
- [ ] AI can read a local file and display its contents in the right panel
- [ ] AI can write a change to a local file (with approval)
- [ ] AI can run a terminal command and stream output to the bottom panel
- [ ] Git status shows current branch, staged/unstaged changes
- [ ] AI can commit and push to git (with appropriate approval tier)
- [ ] SSH config is discovered and displayed (hosts, users, key paths)
- [ ] SSH connection test works and shows success/failure
- [ ] Every tool action is logged with Mode, model, conversation ID, and timestamp

---

## Milestone 6 — DevOps Subsystem + Templates

**Status:** Not started
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
- [ ] Both templates appear in the DevOps panel
- [ ] User can assign a template to a project
- [ ] GitHub Actions workflow runs are visible (requires GitHub token)
- [ ] Coolify deploy can be triggered from the UI (requires Coolify API key)
- [ ] Health check runs and shows green/red status
- [ ] UI shows plain-English explanation: "When you push to main, GitHub builds your app..."
- [ ] Deploy run history shows timestamp, status, triggered by, and commit SHA

---

## Milestone 7 — Approval System + Second-Model Review

**Status:** Not started
**Sprint:** 8

**What gets built:**
- Three-tier approval system working end-to-end
- Tier 1 (auto-allow): safe reads, inspections, tests — no interruption
- Tier 2 (second-model review): a fast cheap model reviews and approves or escalates
- Tier 3 (human approval): approval card shown in UI with plain-English explanation
- Approval queue visible in bottom panel
- Second-model review decisions logged with model name and reasoning

**Acceptance criteria:**
- [ ] Reading a file does not trigger any approval prompt
- [ ] Writing a file triggers second-model review (Tier 2) and proceeds automatically if approved
- [ ] Pushing to main triggers a human approval card (Tier 3)
- [ ] Human approval card shows: what is requested, why, what is affected, rollback difficulty, which Mode requested it
- [ ] Second-model review decisions are visible in the execution stream
- [ ] Approval queue in bottom panel shows pending items
- [ ] Human sees at most 2–3 approval prompts per hour during normal operation

---

## Milestone 8 — Handoff + Idiosyncrasies Tracking

**Status:** Not started
**Sprint:** 9

**What gets built:**
- One-click handoff button in the conversation panel
- Handoff generates: updated architecture doc, updated idiosyncrasies doc, handoff.md, handoff-prompt.md
- Handoff artifacts stored in Supabase Storage and synced
- /docs/idiosyncrasies.md updated automatically during handoff
- Handoff prompt is ready to paste into a new AI session

**Acceptance criteria:**
- [ ] User clicks "Handoff" button in the conversation panel
- [ ] System generates a handoff.md with: current goal, what was tried, what worked, what failed, architecture summary, known oddities, next step
- [ ] System generates a handoff-prompt.md ready to paste into a new AI session
- [ ] /docs/idiosyncrasies.md is updated with any new intentional weirdness
- [ ] Handoff artifacts appear in Supabase Storage
- [ ] A new AI session given the handoff prompt can continue without confusion

---

## Milestone 9 — Build Metadata + Auto-Update

**Status:** Not started
**Sprint:** 10

**What gets built:**
- Version, commit SHA, commit date, release channel injected at build time by a script
- Top bar shows real build metadata (not hardcoded)
- Auto-update checks GitHub Releases on startup
- User sees update notification banner when a new version is available
- User can install update with one click and restart

**Acceptance criteria:**
- [ ] Built app shows real version number (e.g., 1.0.0)
- [ ] Built app shows real commit SHA (e.g., abc1234)
- [ ] Built app shows real commit date
- [ ] Top bar shows release channel (e.g., "stable" or "beta")
- [ ] App checks for updates on startup
- [ ] Update notification appears when a newer GitHub Release exists
- [ ] User can click "Install Update" and the app restarts into the new version
- [ ] No manual download or reinstall required

---

## Milestone 10 — Self-Maintenance Mode

**Status:** Not started
**Sprint:** 11

**What gets built:**
- IDE can open its own repo (vibeflow) as a special project
- Self-maintenance mode is clearly labeled in the UI ("Working on VibeFlow itself")
- IDE logs and diagnostics are visible in the self-maintenance context
- Handoff for IDE-self-work is distinct from user project handoffs
- Human approval required for all changes to the IDE's own source files

**Acceptance criteria:**
- [ ] User can open the VibeFlow repo as a project in VibeFlow
- [ ] UI clearly shows "Self-Maintenance Mode" when working on the IDE itself
- [ ] AI can read IDE source files and logs
- [ ] All changes to IDE source files require human approval (Tier 3)
- [ ] Handoff generated for IDE-self-work is clearly labeled as such
- [ ] Self-maintenance work does not appear mixed with user project work

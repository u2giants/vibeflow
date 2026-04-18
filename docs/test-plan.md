# VibeFlow — Test Plan

Last updated: 2026-04-18

---

## Current Test State (2026-04-18)

~90+ scoped `.test.cjs` test files exist in `apps/desktop/src/lib/` and adjacent directories, covering:
- `memory-lifecycle` tests
- `browser-automation` tests
- `verification-engine` tests
- `framework-detector` tests
- `approval-engine` tests
- And many more domain-specific test files

**These test files are NOT wired to `pnpm test` yet.** Running `pnpm test` in `apps/desktop` will fail or do nothing. CI does not run these tests.

**To wire tests:** See [`docs/what-is-left.md`](what-is-left.md) item #4 for the plan (add Vitest, configure glob to find `**/*.test.cjs`, add CI step).

---

## Planned Automated Test Coverage (Design Intent)

Each package should eventually have unit tests. Tests should live in `<package>/src/__tests__/` or as `*.test.cjs` co-located files.

| Package / Domain | What to Test |
|---|---|
| `shared-types` | Type guards and validation helpers |
| `core-orchestrator` | Mode routing logic, message dispatch, result aggregation |
| `mode-system` | Mode config CRUD, soul validation, model assignment |
| `providers` | OpenRouter client (mocked), model list parsing, streaming |
| `storage` | SQLite read/write, sync queue, conflict detection |
| `sync` | Lease acquisition, heartbeat renewal, stale detection, takeover |
| `approval` | Tier classification, second-model review flow (mocked), audit log |
| `handoff` | Handoff document generation, idiosyncrasies update |
| `build-metadata` | Metadata injection script output validation |
| `change-engine` | Change proposal, validation, apply, checkpoint, rollback |
| `verification-engine` | Acceptance criteria evaluation, evidence recording |
| `memory-manager` | Memory CRUD, search, scoped retrieval |
| `observability` | Watch session lifecycle, anomaly detection |

**Test runner:** Vitest (fast, TypeScript-native, compatible with Vite)

**Run all tests (once wired):**
```
pnpm test
```

---

## Manual Test Checklist

Run this checklist before every release. Check off each item as you test it.

### 1. App Startup
- [ ] App launches on Windows without errors
- [ ] Top bar shows version, commit SHA, commit date, release channel
- [ ] Top bar shows sync status (should show "Connecting..." then "Synced")
- [ ] No error dialogs on startup

### 2. Sign In
- [ ] Sign-in screen appears if not signed in
- [ ] User can enter email and password
- [ ] Successful sign-in shows the main app
- [ ] Failed sign-in shows a clear error message
- [ ] Signed-in account name appears in the top bar

### 3. Cloud Sync Across Devices
- [ ] Sign in on Device A, create a project
- [ ] Sign in on Device B with the same account
- [ ] Project created on Device A appears on Device B within 5 seconds
- [ ] Sync status shows "Synced" on both devices

### 4. Creating a Project
- [ ] User can click "New Project"
- [ ] User can enter a project name and description
- [ ] Project appears in the project list
- [ ] Project is saved after app restart

### 5. Creating a Conversation
- [ ] User can open a project
- [ ] User can click "New Conversation"
- [ ] Conversation appears in the conversation list
- [ ] User can type a message and send it

### 6. Switching Modes
- [ ] Bottom panel shows current Mode name
- [ ] User can see the list of available Modes
- [ ] Switching Modes updates the bottom panel display
- [ ] The correct model name appears next to the Mode

### 7. Editing Mode Souls in the GUI
- [ ] User can open Mode settings
- [ ] User can see the soul (instructions) for each Mode
- [ ] User can edit the soul text
- [ ] Saving the soul persists after app restart
- [ ] Soul changes sync to a second device

### 8. Mapping Models to Modes
- [ ] User can open the model picker for a Mode
- [ ] Model picker shows model names, providers, and pricing
- [ ] User can select a different model for a Mode
- [ ] Model assignment persists after app restart
- [ ] Model assignment syncs to a second device

### 9. Attaching Folders/Repos
- [ ] User can attach a local folder to a project
- [ ] Attached folder appears in the project panel
- [ ] AI can reference files in the attached folder

### 10. Reading and Editing Files
- [ ] AI can read a local file and display its contents in the right panel
- [ ] AI can propose a change to a file (shows diff)
- [ ] User can approve the change (Tier 2 or Tier 3 depending on policy)
- [ ] Approved change is written to the file
- [ ] File contents update in the right panel

### 11. Generating Diffs
- [ ] When AI proposes a code change, a diff is shown in the right panel
- [ ] Green lines show additions, red lines show removals
- [ ] Diff is readable and accurate

### 12. Running Commands
- [ ] AI can run a terminal command
- [ ] Command output streams to the bottom panel
- [ ] Command completion is shown (exit code)
- [ ] Failed commands show an error

### 13. Using the Approval System
- [ ] Reading a file does NOT trigger an approval prompt
- [ ] Writing a file triggers second-model review (no human interruption if approved)
- [ ] Pushing to main triggers a human approval card
- [ ] Approval card shows plain-English description of the action
- [ ] User can approve or reject
- [ ] Rejected actions are cancelled and the AI is notified

### 14. Configuring SSH
- [ ] SSH config is discovered from `~/.ssh/config`
- [ ] Discovered hosts appear in the SSH panel
- [ ] User can see which key is used for each host

### 15. Testing SSH
- [ ] User can click "Test Connection" for an SSH target
- [ ] Success shows a green checkmark
- [ ] Failure shows a clear error message

### 16. Configuring DevOps Templates
- [ ] Both starter templates appear in the DevOps panel
- [ ] User can assign a template to a project
- [ ] User can edit a template's fields
- [ ] Changes persist after app restart

### 17. Viewing Build Metadata
- [ ] Top bar shows real version number (not "0.0.0" or hardcoded)
- [ ] Top bar shows real commit SHA
- [ ] Top bar shows real commit date
- [ ] Top bar shows release channel

### 18. Using Handoff to a Fresh Session
- [ ] User can click the "Handoff" button
- [ ] System generates a handoff document
- [ ] System generates a handoff prompt
- [ ] Handoff prompt is displayed and copyable
- [ ] Pasting the prompt into a new AI session allows continuation without confusion

### 19. Working on the IDE Itself (Self-Maintenance Mode)
- [ ] User can open the VibeFlow repo as a project
- [ ] UI clearly shows "Self-Maintenance Mode"
- [ ] AI can read IDE source files
- [ ] Changes to IDE source files require human approval (Tier 3)

### 20. Packaging and Update Workflow
- [ ] `pnpm build` produces a Windows installer without errors
- [ ] Installer installs the app cleanly
- [ ] Installed app shows correct version in top bar
- [ ] App checks for updates on startup
- [ ] Update notification appears when a newer GitHub Release exists
- [ ] User can install the update and the app restarts into the new version

### 21. Active Run on Another Device
- [ ] Start a conversation run on Device A
- [ ] Device B shows the conversation with an ownership banner
- [ ] Device B shows live updates as the run progresses
- [ ] Device B cannot send messages while Device A owns the run

### 22. Recoverable Run After Device Disconnect
- [ ] Start a run on Device A
- [ ] Disconnect Device A (close app or disconnect network)
- [ ] After 45 seconds, Device B shows the run as "Recoverable"
- [ ] Device B can click "Resume on this device" and take over

### 23. Offline Mode
- [ ] Disconnect from the internet
- [ ] App shows "Offline" sync status
- [ ] App continues to work using local cache
- [ ] Reconnect — app shows "Syncing" then "Synced"
- [ ] Changes made offline are synced after reconnect

### 24. MCP Connection
- [ ] User can add an MCP server connection
- [ ] MCP tools appear as available in the Mode's tool list
- [ ] MCP actions are logged in the execution stream

### 25. GitHub Actions Visibility
- [ ] User can view GitHub Actions workflow runs for a project
- [ ] Workflow run status (success/failure) is visible
- [ ] User can view workflow run logs

### 26. Coolify Deploy
- [ ] User can trigger a deploy from the DevOps panel
- [ ] Deploy status is visible (deploying → live)
- [ ] Deploy logs are visible
- [ ] User can trigger a rollback

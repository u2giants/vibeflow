# VibeFlow — Approval Policy

Last updated: 2026-04-18

---

## Overview

VibeFlow uses a three-tier approval system designed to minimize human interruption while maintaining safety.

The goal: the human should see at most 2–3 approval prompts per hour during normal operation.

A second AI model (cheap and fast) handles routine review. Only genuinely risky or irreversible actions reach the human.

---

## The Three Tiers

### Tier 1 — Auto-Allow

The system automatically approves and executes these actions without any interruption.

**Examples:**
- Reading any local file
- Listing directory contents
- Viewing git status, git log, git diff
- Running read-only inspections (e.g., `npm list`, `git branch`)
- Viewing SSH config (not connecting)
- Viewing environment variable names (not values)
- Viewing deployment logs
- Viewing GitHub Actions workflow runs
- Running tests in a sandboxed environment
- Generating diffs (not applying them)
- Viewing health check results
- Reading Supabase data the user owns
- Generating handoff artifacts
- Updating documentation files

---

### Tier 2 — Second-Model Review

A fast, cheap AI model reviews the action and either approves it automatically or escalates to the human.

**Examples:**
- Writing or modifying a local file
- Applying a diff to source code
- Running a build command
- Running a test suite that modifies state
- Committing to git
- Pushing to a non-main branch
- Creating a new git branch
- Installing npm packages
- Modifying configuration files
- Sending an API request to a non-destructive endpoint
- Creating a new Supabase record
- Updating a Mode's soul or model assignment

**How second-model review works:**

1. The primary Mode requests an action
2. The system checks the action's risk tier → Tier 2
3. A fast model (e.g., `google/gemini-flash-1.5`) receives:
   - The action description in plain English
   - The affected files or systems
   - The requesting Mode and model
   - Relevant conversation context
4. The reviewer model returns one of:
   - `approve` — action proceeds automatically
   - `escalate_to_human` — human sees an approval card
   - `reject` — the requesting Mode is told why and must try a different approach
5. The decision is logged in the execution stream with the reviewer model name and reasoning

**Second-model review is invisible to the human unless it escalates.** The human only sees the result.

---

### Tier 3 — Human Approval Required

The human must explicitly approve these actions before they execute.

**Examples:**
- Pushing to the main branch
- Deploying to a production environment
- Redeploying or restarting a live service
- Deleting any file
- Deleting any database record
- Running a destructive command (e.g., `rm -rf`, `DROP TABLE`)
- Modifying GitHub Secrets
- Modifying Coolify environment variables
- Any action flagged as irreversible
- Any action the second-model reviewer escalates
- Any action on the IDE's own source files (self-maintenance mode)
- Any action that affects billing or account settings

---

## Human Approval Card

When a Tier 3 action is required, the user sees an approval card in the UI. The card always shows:

| Field | Example |
|---|---|
| **What is being requested** | "Push the current branch to main on GitHub" |
| **Why the system wants to do it** | "The Coder Mode has finished implementing the login feature and wants to publish it" |
| **What is affected** | "Repository: my-app, Branch: main, 3 files changed" |
| **Rollback difficulty** | "Easy — you can revert the commit with one command" |
| **Which Mode requested it** | "Coder Mode" |
| **Which model requested it** | "anthropic/claude-3.5-sonnet" |

The user can:
- ✅ **Approve** — action executes immediately
- ❌ **Reject** — action is cancelled; the requesting Mode is told why
- 💬 **Ask for more info** — the user can ask a question before deciding

---

## Approval Queue

The bottom panel shows a count of pending approvals. If there are pending Tier 3 approvals, a badge appears on the approval queue indicator.

The approval queue shows:
- Pending approvals (waiting for human)
- Recently auto-approved actions (last 5)
- Recently second-model-reviewed actions (last 5)

---

## Approval Policy Configuration

Each Mode has an approval policy that can be configured in the GUI:

| Setting | Options |
|---|---|
| Default tier for file writes | Auto / Second-model / Human |
| Default tier for git operations | Auto / Second-model / Human |
| Default tier for terminal commands | Auto / Second-model / Human |
| Default tier for deploy actions | Auto / Second-model / Human |
| Allow auto-approve for this Mode | Yes / No |

The global approval policy sets defaults. Per-Mode policies can override the global defaults.

---

## Audit Log

Every approval decision is recorded in the audit log with:
- Timestamp
- Action description
- Tier (1, 2, or 3)
- Decision (auto-approved / second-model-approved / second-model-escalated / human-approved / human-rejected)
- Reviewer model (for Tier 2)
- Reviewer reasoning (for Tier 2)
- Human note (for Tier 3 rejections)
- Requesting Mode
- Requesting model
- Conversation ID
- Project ID

---

## Design Principles

1. **Rare, meaningful interruptions** — The human should only be interrupted for things that genuinely matter
2. **Plain English always** — Every approval card must be understandable to a non-programmer
3. **No surprise actions** — The execution stream always shows what the AI is doing, even for auto-approved actions
4. **Reversibility matters** — The approval card always states how easy or hard rollback is
5. **Provenance always** — Every action is attributed to a Mode, a model, a conversation, and a timestamp

---

## Component 19 Expansion — Six Risk Classes (2026-04-18)

In the brownfield rebuild (Component 19), the approval system was extended from three tiers to six named risk classes. The tiers still exist, but each action is now classified by risk class first; the risk class determines the tier.

| Risk Class | Tier | Examples |
|---|---|---|
| `read_only` | Tier 1 (auto) | Reading files, viewing git status, listing directories |
| `code_change` | Tier 2 (second-model review) | Writing files, applying diffs, running builds |
| `production_deploy` | Tier 3 (human approval) | Deploying to production, triggering Coolify deploy |
| `auth_security` | Tier 3 (human approval) | Modifying auth config, changing GitHub Secrets |
| `data_destruction` | Tier 3 (human approval) | Deleting files, dropping database tables, `rm -rf` |
| `critical_infrastructure` | Tier 3 (human approval) + mandatory delay | Changes to CI/CD pipelines, DNS, TLS certs |

### Audit History with Checkpoints

Every Tier 3 approval now:
1. Creates a **Checkpoint** — a snapshot of project state before the action
2. Records the approval decision in the **AuditHistory** table with checkpoint reference
3. Links the checkpoint to the action record for easy rollback

This means every human-approved action can be rolled back to the pre-action state using the checkpoint. The UI shows a "Rollback to checkpoint" option for recent Tier 3 actions.

### Per-Mode Risk Class Overrides

Individual Modes can override the default tier for a risk class. For example, the DevOps Mode can be configured to auto-approve `production_deploy` actions (if Albert explicitly enables this). The default for all Modes is the table above.

The approval policy for each Mode is editable in the GUI (Modes screen → Mode → Approval Policy tab).

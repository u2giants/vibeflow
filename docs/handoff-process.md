# VibeFlow — Handoff Process

Last updated: 2026-04-18

---

## What Is a Handoff?

A handoff is a one-click operation that generates everything a brand-new AI session needs to continue your project without confusion.

AI sessions have limited memory. When a conversation gets long, the AI may start to lose track of earlier context. The handoff system solves this by generating a complete summary package that a fresh AI session can read at the start of a new conversation.

---

## When to Use Handoff

Use handoff when:
- A conversation is getting very long (the AI seems to be forgetting earlier context)
- You are switching to a different computer
- You want to start a fresh AI session on a specific task
- You are ending a work session and want to resume cleanly later
- The Orchestrator suggests it (the system will prompt you when conversations get long)

---

## How to Trigger a Handoff

1. Click the **"Handoff"** button in the conversation panel (top-right of the center panel)
2. The system generates the handoff package automatically
3. A dialog shows you the generated `handoff-prompt.md`
4. Copy the prompt and paste it into a new conversation to continue

---

## What Gets Generated

When you click Handoff, the system:

### 1. Updates `/docs/architecture.md`
Adds or updates the current architecture state so the new session has accurate technical context.

### 2. Updates `/docs/idiosyncrasies.md`
Adds any new intentional weirdness that was introduced during this session.

### 3. Generates `handoff-<timestamp>.md`
A detailed handoff document stored in Supabase Storage. Contains:
- What we are trying to do right now
- What we have tried
- What failed and why
- What worked
- Current architecture summary
- Relevant docs to read first
- Current repo/folder/server/deploy context
- Known oddities (linked to idiosyncrasies.md)
- Pending bugs
- Next recommended step
- Important warnings for a new AI session

### 4. Generates `handoff-prompt.md`
A ready-to-paste prompt for a new AI session. This is the main output you use. It contains:
- A brief instruction to the new AI session
- Links to the key docs to read first
- The current task summary
- The next recommended step
- Any critical warnings

---

## What a Fresh AI Session Should Do First

When starting a new session with a handoff prompt:

1. Read `AGENTS.md` — understand the team structure and rules
2. Read `PROJECT_SOUL.md` — understand the product vision and non-negotiables
3. Read `CURRENT_TASK.md` — understand the current sprint and step
4. Read the handoff document linked in the prompt
5. Read `/docs/architecture.md` — understand the current technical state
6. Read `/docs/idiosyncrasies.md` — understand any intentional weirdness
7. Ask one clarifying question if anything is unclear before starting work

---

## Handoff Document Format

Each `handoff-<timestamp>.md` follows this format:

```markdown
# Handoff — [Project Name] — [Timestamp]

## What We Are Trying to Do Right Now
[One paragraph describing the current goal]

## What We Have Tried
[Bullet list of approaches tried]

## What Failed and Why
[Bullet list of failures with reasons]

## What Worked
[Bullet list of successes]

## Current Architecture Summary
[Brief summary — link to /docs/architecture.md for full details]

## Docs to Read First
- /docs/architecture.md
- /docs/idiosyncrasies.md
- /docs/decisions.md (if architecture decisions are relevant)

## Current Context
- Repo: [repo URL or local path]
- Branch: [current branch]
- Last commit: [commit SHA and message]
- Deploy target: [if relevant]
- Active Modes: [which Modes are configured]

## Known Oddities
[Link to /docs/idiosyncrasies.md — list any new ones added this session]

## Pending Bugs
[Bullet list of known bugs not yet fixed]

## Next Recommended Step
[One clear next step for the new session]

## Important Warnings
[Anything a new AI session must not do or must be careful about]
```

---

## Handoff Artifacts Storage

All handoff artifacts are:
- Stored in Supabase Storage under the project's folder
- Synced to all devices
- Versioned (never overwritten — always a new file per handoff)
- Listed in the project's handoff history panel

---

## Idiosyncrasies Tracking During Handoff

Before generating the handoff, the system prompts the Orchestrator to review the current session for any intentional weirdness that should be documented.

The Orchestrator checks:
- Were any unusual workarounds introduced?
- Were any standard patterns deliberately avoided?
- Were any decisions made that look wrong but are correct?

If yes, these are added to `/docs/idiosyncrasies.md` before the handoff document is generated.

See `/docs/idiosyncrasies.md` for the format of each entry.

---

## Implementation Notes (2026-04-18)

The handoff system is implemented in `apps/desktop/src/lib/handoff/`. The IPC handler is in `apps/desktop/src/main/index.ts` under the `handoff:generate` channel.

**Key implementation details:**

- Handoff artifacts are saved to **Supabase Storage** in the `handoffs` bucket (created during Component 22 migration)
- The `handoffs` bucket is configured with **authenticated access only** (not public)
- The path to `docs/idiosyncrasies.md` for the handoff generator is resolved using `app.isPackaged ? path.join(process.resourcesPath, 'docs/idiosyncrasies.md') : path.resolve(__dirname, '../../../../docs/idiosyncrasies.md')` — this handles both dev and packaged builds (see idiosyncrasies #9, now resolved)
- The handoff generator reads `docs/idiosyncrasies.md` at handoff time (not at startup) so it always gets the current content
- In self-maintenance mode, handoff documents are automatically labeled with "🔧 VibeFlow Self-Maintenance Handoff" in the title

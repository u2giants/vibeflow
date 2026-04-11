# VibeFlow — Cloud Sync Architecture

Last updated: 2026-04-11

---

## Overview

VibeFlow syncs everything to the cloud using Supabase. This means:
- Install on any computer, sign in, and immediately have the same working environment
- Active conversations are visible on all devices in real time
- Only one device can actively drive a conversation at a time (ownership model)
- The app works offline using a local cache and reconciles when reconnected

---

## What Syncs vs. What Stays Local

### Synced to Supabase (available on all devices)

| Category | Examples |
|---|---|
| Account & devices | Account identity, device registrations, last-seen timestamps |
| Projects | Project definitions, metadata, attachments metadata |
| Conversations | All conversation threads and messages |
| Mode definitions | Mode names, slugs, souls/instructions, model assignments, approval policies |
| DevOps templates | Template definitions, project assignments |
| MCP metadata | MCP server connection metadata (not credentials) |
| SSH target metadata | Hostname, user, port, which key to use (not the key itself) |
| Handoff artifacts | Handoff documents, handoff prompts |
| Documentation | Architecture docs, idiosyncrasies docs |
| Sprint/task state | Current sprint, task status, owner timeline |
| Action history | Audit log of all major actions |
| UI preferences | Layout preferences, panel sizes |
| Run state | Current conversation run state, ownership, step |
| Approval queue | Pending approvals |

### Stays Local Only (never synced)

| What | Why |
|---|---|
| Local file system contents | Files live on the local machine; the AI accesses them via IPC |
| Terminal execution environment | Commands run on the local machine |
| Git repository contents | Repos live on the local machine (or remote git host) |
| SSH private key material | Private keys never leave the device |
| OpenRouter API key (default) | Stored in OS-secure storage; user can opt into encrypted sync |
| Coolify API key (default) | Stored in OS-secure storage; user can opt into encrypted sync |
| Local SQLite cache | A local copy of synced data for speed and offline use |

### Optionally Synced (user opt-in, encrypted)

| What | How |
|---|---|
| OpenRouter API key | AES-256 encrypted, stored in Supabase Storage, key derived from user password |
| Coolify API key | Same as above |
| Other user-defined secrets | Same as above |

---

## Sync Architecture

```
[Device A]                          [Supabase]                    [Device B]
  Local SQLite cache                 Postgres                      Local SQLite cache
       │                                │                                │
       │  write change                  │                                │
       ├──────────────────────────────► │                                │
       │                                │  Realtime push                 │
       │                                ├──────────────────────────────► │
       │                                │                                │  update local cache
       │                                │                                │
       │  read (fast, from cache)       │                                │
       │ ◄──────────────────────────────┤                                │
```

- **Supabase Postgres** is the canonical source of truth for all synced state
- **Local SQLite** is a local cache for speed and offline resilience
- **Supabase Realtime** pushes changes to all connected clients immediately
- On reconnect after being offline, the sync client reconciles local changes with Supabase

---

## Real-Time Communication

Two types of real-time events:

| Type | Channel | Used For |
|---|---|---|
| Durable state changes | Supabase Realtime Postgres Changes | New messages, mode config changes, project updates |
| Ephemeral live events | Supabase Realtime Broadcast | Heartbeats, run state changes, step updates, typing indicators |

Using Broadcast for ephemeral events avoids forcing every live coordination event through raw database row-change subscriptions, which would be slower and more expensive.

---

## Lease / Heartbeat Model (Conversation Ownership)

Only one device may actively drive a conversation at a time. This is enforced with a lease-and-heartbeat model.

**How it works:**

1. When a device starts a conversation run, it writes a `ConversationLease` record to Postgres:
   - `device_id` — which device owns the run
   - `conversation_id` — which conversation
   - `acquired_at` — when the lease was acquired
   - `expires_at` — when the lease expires (15 seconds from now)
   - `heartbeat_interval_seconds` — 15

2. The owning device sends a heartbeat every 15 seconds, updating `expires_at`

3. If `expires_at` passes without renewal (45 seconds = 3 missed heartbeats), the run is marked `recoverable`

4. Any other device can then explicitly claim the lease with a "Resume on this device" action

5. All ownership changes are written to the `AuditEvent` table

**Why 45 seconds?** This gives the owning device time to recover from a brief network hiccup without immediately marking the run as stale. It is short enough that a crashed device does not block the run for long.

---

## Conversation Run States

Every conversation run has an explicit state:

| State | Meaning |
|---|---|
| `idle` | No active run; conversation is at rest |
| `queued` | Run is queued, waiting to start |
| `running` | Actively running on the owning device |
| `waiting_for_second_model_review` | Waiting for a second AI model to review an action |
| `waiting_for_human_approval` | Waiting for the human to approve an action |
| `waiting_for_user_input` | Waiting for the user to provide input |
| `paused` | Run is paused by the user |
| `failed` | Run failed with an error |
| `completed` | Run completed successfully |
| `abandoned` | Run was abandoned by the user |
| `recoverable` | Owning device missed heartbeats; another device can take over |

These states are visible in the UI and synced across all devices.

---

## Read-Only View on Non-Owning Devices

When a conversation is actively running on another device:

- The conversation is shown normally with live updates
- A banner is displayed: **"Active on [Device Name] — Read-only while this run is in progress"**
- The user can watch logs, diffs, action stream, and status in real time
- Message sending and action-triggering controls are disabled
- If the run reaches `waiting_for_human_approval`, `waiting_for_user_input`, or `recoverable`, the non-owning device may request control

---

## Conflict Strategy

| Data Type | Strategy |
|---|---|
| Active conversation run | Single-owner lease. No concurrent mutation allowed. |
| Conversation messages | Append-only. No conflict possible. |
| Mode config edits | Last-write-wins with timestamp. UI warns if two devices edited within 60 seconds. |
| Settings edits | Last-write-wins with timestamp. |
| DevOps template edits | Last-write-wins with timestamp. |
| Handoff artifacts | Append-only versioned blobs. Never overwrite; always create a new version. |
| Architecture/idiosyncrasies docs | Append-only versioned blobs. |

**Silent data loss is unacceptable.** If a conflict cannot be resolved automatically, it must be surfaced to the user.

---

## Offline Behavior

If a device goes offline:
- The app continues to work using the local SQLite cache
- The sync status indicator shows "Offline" or "Degraded"
- Changes made offline are queued for sync when reconnected
- On reconnect, the sync client reconciles local changes with Supabase

If the owning device goes offline mid-run:
- The server detects missed heartbeats after 45 seconds
- The run is marked `recoverable`
- Another device can resume the run explicitly
- The takeover is recorded in the audit log

---

## Sync Status Visibility

The top bar always shows sync status:

| Status | Meaning |
|---|---|
| 🟢 Synced | All changes are up to date |
| 🟡 Syncing | Changes are being pushed or pulled |
| 🟠 Degraded | Connected but some items failed to sync |
| 🔴 Offline | No connection to Supabase |

The sync panel also shows:
- Last successful sync time
- Currently active device per running conversation
- Pending outbound changes
- Failed sync items
- Stale/recoverable runs
- Version mismatch warnings if devices are on different app versions

---

## Secret Sync Model

| Secret | Default | Opt-in Encrypted Sync |
|---|---|---|
| OpenRouter API key | Local only (keytar) | AES-256 encrypted blob in Supabase Storage |
| Coolify API key | Local only (keytar) | AES-256 encrypted blob in Supabase Storage |
| SSH private keys | Local only (never synced) | Not available — SSH keys stay local always |
| GitHub tokens | Local only (keytar) | AES-256 encrypted blob in Supabase Storage |

For encrypted sync:
- The encryption key is derived from the user's password using PBKDF2
- The encrypted blob is stored in Supabase Storage
- The plaintext secret never leaves the device unencrypted
- The user must enter their password on each new device to decrypt

---

## Security Requirements

- All data in transit uses HTTPS/WSS (enforced by Supabase)
- All data at rest in Supabase Postgres uses Supabase's built-in encryption
- Synced secret blobs are additionally encrypted with AES-256 before upload
- Local SQLite cache is stored in the app's user data directory (not accessible to other users on the same machine)
- The Supabase service key is never included in the desktop app bundle
- Row-level security (RLS) policies in Supabase ensure users can only access their own data

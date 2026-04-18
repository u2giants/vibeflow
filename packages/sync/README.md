# @vibeflow/sync

> **Status: Stub package — canonical code lives elsewhere**
>
> This package README describes the intended API. The actual implementation lives in
> [`apps/desktop/src/lib/sync/sync-engine.ts`](../../apps/desktop/src/lib/sync/sync-engine.ts).
> This package is not imported via `workspace:*` dependencies because the repo is on an
> exFAT drive where pnpm symlinks don't work. See
> [`docs/idiosyncrasies.md`](../../docs/idiosyncrasies.md) entry #12.

---

## What This Package Is For

This package is intended to manage the full cloud sync lifecycle: pushing local changes to Supabase, receiving real-time updates, managing conversation ownership leases, and handling offline/reconnect reconciliation.

## Actual Implementation

There is **one class**: `SyncEngine` in `apps/desktop/src/lib/sync/sync-engine.ts`.

It combines all sync responsibilities — lease management, heartbeat, Realtime subscriptions, conflict resolution, and offline queue — into a single class. The 6-class breakdown in older docs (`LeaseManager`, `HeartbeatService`, `RealtimeSubscriber`, `ConflictResolver`, `OfflineQueue`, `SyncStatusTracker`) was a design intention that was implemented as one unified class instead.

## SyncEngine Constructor

The `SyncEngine` constructor accepts an **already-authenticated `SupabaseClient`**, not raw credentials. This is required for Supabase RLS policies to work. See [`docs/idiosyncrasies.md`](../../docs/idiosyncrasies.md) entry #18.

```typescript
// Correct:
const syncEngine = new SyncEngine(supabaseClient, deviceId);

// Wrong — do not pass credentials directly:
const syncEngine = new SyncEngine(supabaseUrl, supabaseKey);
```

## Key Implementation Details

| Detail | Value |
|---|---|
| Heartbeat interval | 15 seconds |
| Stale threshold | 45 seconds (3 missed heartbeats) |
| Lease table | `conversation_leases` in Supabase Postgres |
| Realtime channels | Postgres Changes (durable) + Broadcast (ephemeral) |

## Race Condition Guard

`acquireLease()` calls `pushConversation()` before inserting a `ConversationLease` row. This satisfies the FK constraint in Supabase. Do NOT remove this guard. See [`docs/idiosyncrasies.md`](../../docs/idiosyncrasies.md) entry #11.

## Further Reading

- [`docs/cloud-sync.md`](../../docs/cloud-sync.md) — full sync architecture
- [`docs/idiosyncrasies.md`](../../docs/idiosyncrasies.md) entries #11, #18

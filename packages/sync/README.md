# @vibeflow/sync

## What This Package Does

This package manages the full cloud sync lifecycle: pushing local changes to Supabase, receiving real-time updates from Supabase, managing conversation ownership leases, and handling offline/reconnect reconciliation.

## What It Exports

- `SyncEngine` — the main sync coordinator; starts on app launch, runs continuously
- `LeaseManager` — acquires, renews, and releases conversation execution leases
- `HeartbeatService` — sends heartbeats every 15 seconds to keep the lease alive
- `RealtimeSubscriber` — subscribes to Supabase Realtime channels for live updates
- `ConflictResolver` — applies the conflict resolution strategy for each data type
- `OfflineQueue` — stores changes made while offline and replays them on reconnect
- `SyncStatusTracker` — tracks and emits sync status (synced/syncing/degraded/offline)

## Who Depends On It

- `apps/desktop` renderer process (sync status display, ownership banner)

## Dependencies

- `@vibeflow/shared-types`
- `@vibeflow/storage`

## Notes

- Lease heartbeat interval: 15 seconds
- Stale threshold: 45 seconds (3 missed heartbeats)
- See `/docs/cloud-sync.md` for the full sync architecture

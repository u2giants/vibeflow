# @vibeflow/storage

## What This Package Does

This package manages all data persistence for VibeFlow. It has two layers:
1. **Local SQLite cache** — fast local storage using `better-sqlite3`, works offline
2. **Supabase sync client** — reads and writes synced state to Supabase Postgres

All reads go to the local cache first (fast). All writes go to both the local cache and the sync queue. The sync engine (in `@vibeflow/sync`) pushes queued writes to Supabase.

## What It Exports

- `LocalDb` — SQLite database wrapper with typed read/write methods for all entities
- `SupabaseClient` — configured Supabase client instance
- `SyncQueue` — queue of pending writes waiting to be pushed to Supabase
- `EntityRepository` — typed CRUD operations for each entity type (projects, conversations, modes, etc.)

## Who Depends On It

- `@vibeflow/sync`
- `@vibeflow/mode-system`
- `@vibeflow/core-orchestrator`
- `apps/desktop` main and renderer processes

## Dependencies

- `@vibeflow/shared-types`
- `better-sqlite3` (local cache)
- `@supabase/supabase-js` (cloud sync)

## Notes

- The SQLite database file lives in Electron's `app.getPath('userData')` directory
- The Supabase anon key is safe to include in the app bundle (RLS policies protect data)
- The Supabase service key is NEVER included in the desktop app

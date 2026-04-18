# @vibeflow/storage

> **Status: Stub package — canonical code lives elsewhere**
>
> This package README describes the intended API. The actual implementation lives in
> [`apps/desktop/src/lib/`](../../apps/desktop/src/lib/) — specifically in the various
> domain managers (e.g., `database-manager/`, `sync/`). This package is not imported
> via `workspace:*` dependencies because the repo is on an exFAT drive where pnpm
> symlinks don't work. See [`docs/idiosyncrasies.md`](../../docs/idiosyncrasies.md) entry #12.

---

## What This Package Is For

This package is intended to manage all data persistence for VibeFlow:
1. **Local sql.js cache** — fast local storage using `sql.js` (pure JavaScript SQLite), works offline
2. **Supabase sync** — reads and writes synced state to Supabase Postgres via the SyncEngine

> **Important:** The local cache uses **`sql.js`**, not `better-sqlite3`. Native bindings
> could not be compiled on the dev machine (exFAT drive + Windows). See
> [`docs/idiosyncrasies.md`](../../docs/idiosyncrasies.md) entry #6.

## Intended Exports

- `LocalDb` — sql.js database wrapper with typed read/write methods for all entities
- `SupabaseClient` — configured Supabase client (must be authenticated before passing to SyncEngine)

> **Note:** `SyncQueue` and `EntityRepository` described in older docs **do not exist**
> as exported classes. Sync queuing and entity operations are handled directly inside
> `apps/desktop/src/lib/sync/sync-engine.ts`.

## Dependencies

- `@vibeflow/shared-types`
- `sql.js` (local cache — pure JavaScript, no native compilation needed)
- `@supabase/supabase-js` (cloud sync)

## Notes

- The SQLite database file lives in Electron's `app.getPath('userData')` directory
- The Supabase anon key is safe to include in the app bundle (RLS policies protect data)
- The Supabase service key is NEVER included in the desktop app
- All writes are flushed to disk immediately after each operation (sql.js does not auto-flush)

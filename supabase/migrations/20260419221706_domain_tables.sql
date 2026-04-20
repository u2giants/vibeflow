-- Domain tables: missions, evidence_items, capabilities, incidents, environments.
-- These were synced by sync-engine.ts but never migrated to Supabase.
-- All tables include user_id + RLS so each user only sees their own data.

-- ── missions ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS missions (
  id                           TEXT        PRIMARY KEY,
  user_id                      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id                   TEXT        NOT NULL,
  title                        TEXT        NOT NULL,
  operator_request             TEXT        NOT NULL DEFAULT '',
  clarified_constraints_json   TEXT        NOT NULL DEFAULT '[]',
  status                       TEXT        NOT NULL DEFAULT 'draft',
  owner                        TEXT,
  started_at                   TEXT,
  completed_at                 TEXT,
  created_at                   TEXT        NOT NULL,
  updated_at                   TEXT        NOT NULL
);
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own missions" ON missions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── evidence_items ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evidence_items (
  id          TEXT    PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id  TEXT    NOT NULL,
  type        TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'running',
  title       TEXT    NOT NULL,
  detail      TEXT,
  timestamp   TEXT    NOT NULL
);
ALTER TABLE evidence_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own evidence_items" ON evidence_items FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── capabilities ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS capabilities (
  id                  TEXT    PRIMARY KEY,
  user_id             UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id          TEXT,
  name                TEXT    NOT NULL,
  type                TEXT    NOT NULL DEFAULT 'direct',
  health              TEXT    NOT NULL DEFAULT 'unknown',
  last_failure        TEXT,
  permissions_json    TEXT    NOT NULL DEFAULT '[]',
  class               TEXT,
  owner               TEXT,
  description         TEXT    DEFAULT '',
  scope               TEXT    DEFAULT '',
  auth_method         TEXT,
  enabled             BOOLEAN DEFAULT true,
  last_success_at     TEXT,
  last_failure_at     TEXT,
  last_failure_reason TEXT,
  audit_notes         TEXT    DEFAULT '',
  actions_json        TEXT    DEFAULT '[]',
  created_at          TEXT,
  updated_at          TEXT
);
ALTER TABLE capabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own capabilities" ON capabilities FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── incidents ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incidents (
  id           TEXT    PRIMARY KEY,
  user_id      UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id   TEXT    NOT NULL,
  title        TEXT    NOT NULL,
  severity     TEXT    NOT NULL DEFAULT 'low',
  description  TEXT    NOT NULL DEFAULT '',
  status       TEXT    NOT NULL DEFAULT 'open',
  detected_at  TEXT    NOT NULL,
  resolved_at  TEXT
);
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own incidents" ON incidents FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── environments ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS environments (
  id               TEXT    PRIMARY KEY,
  user_id          UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id       TEXT    NOT NULL,
  name             TEXT    NOT NULL,
  type             TEXT    NOT NULL DEFAULT 'local',
  current_version  TEXT,
  secrets_complete BOOLEAN DEFAULT false,
  service_health   TEXT    NOT NULL DEFAULT 'unknown',
  branch_mapping   TEXT
);
ALTER TABLE environments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own environments" ON environments FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

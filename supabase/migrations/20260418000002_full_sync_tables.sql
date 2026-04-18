-- Track B: Full sync tables — 16 locally-only tables promoted to Supabase.
-- All tables use user_id + RLS so each user only sees their own data.

-- ── project_configs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_configs (
  project_id               TEXT        NOT NULL,
  user_id                  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  repo_url                 TEXT,
  local_folder_path        TEXT,
  coolify_base_url         TEXT,
  coolify_app_id           TEXT,
  supabase_project_url     TEXT,
  supabase_project_ref     TEXT,
  supabase_anon_key        TEXT,
  railway_project_id       TEXT,
  railway_service_id       TEXT,
  cloudflare_account_id    TEXT,
  cloudflare_zone_id       TEXT,
  google_oauth_client_id   TEXT,
  azure_oauth_client_id    TEXT,
  azure_oauth_tenant_id    TEXT,
  enabled_integrations_json TEXT DEFAULT '[]',
  updated_at               TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (project_id, user_id)
);
ALTER TABLE project_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own project_configs" ON project_configs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── mcp_servers ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mcp_servers (
  id                  TEXT        PRIMARY KEY,
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id          TEXT,
  name                TEXT        NOT NULL,
  description         TEXT        DEFAULT '',
  command             TEXT        NOT NULL,
  args_json           TEXT        DEFAULT '[]',
  env_json            TEXT,
  transport           TEXT        DEFAULT 'stdio',
  auth_method         TEXT,
  scope               TEXT        DEFAULT 'project',
  enabled             BOOLEAN     DEFAULT true,
  health              TEXT        DEFAULT 'unknown',
  created_at          TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE mcp_servers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own mcp_servers" ON mcp_servers FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── ssh_targets ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ssh_targets (
  id              TEXT        PRIMARY KEY,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id      TEXT,
  name            TEXT        NOT NULL,
  hostname        TEXT        NOT NULL,
  username        TEXT        NOT NULL,
  port            INTEGER     DEFAULT 22,
  identity_file   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE ssh_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ssh_targets" ON ssh_targets FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── memory_items ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memory_items (
  id                        TEXT        PRIMARY KEY,
  user_id                   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id                TEXT        NOT NULL,
  category                  TEXT        NOT NULL,
  title                     TEXT        NOT NULL,
  scope                     TEXT        DEFAULT '',
  tags_json                 TEXT        DEFAULT '[]',
  description               TEXT        DEFAULT '',
  free_form_notes           TEXT,
  examples_json             TEXT        DEFAULT '[]',
  trigger_conditions_json   TEXT        DEFAULT '[]',
  is_active                 BOOLEAN     DEFAULT true,
  created_at                TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at                TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE memory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own memory_items" ON memory_items FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── skills ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skills (
  id                      TEXT        PRIMARY KEY,
  user_id                 UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id              TEXT        NOT NULL,
  title                   TEXT        NOT NULL,
  description             TEXT        DEFAULT '',
  category                TEXT        DEFAULT 'skill-runbook',
  steps_json              TEXT        DEFAULT '[]',
  trigger_conditions_json TEXT        DEFAULT '[]',
  version                 INTEGER     DEFAULT 1,
  is_active               BOOLEAN     DEFAULT true,
  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own skills" ON skills FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── decision_records ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decision_records (
  id                    TEXT        PRIMARY KEY,
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id            TEXT        NOT NULL,
  decision_number       INTEGER     NOT NULL,
  title                 TEXT        NOT NULL,
  date                  TEXT        NOT NULL,
  decided_by            TEXT        DEFAULT '',
  decision              TEXT        DEFAULT '',
  rationale             TEXT        DEFAULT '',
  alternatives_json     TEXT        DEFAULT '[]',
  consequences_json     TEXT        DEFAULT '[]',
  related_files_json    TEXT        DEFAULT '[]',
  tags_json             TEXT        DEFAULT '[]',
  is_active             BOOLEAN     DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at            TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE decision_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own decision_records" ON decision_records FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── settings ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT        NOT NULL,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (key, user_id)
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own settings" ON settings FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── plans ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  mission_id TEXT        NOT NULL,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  steps_json TEXT        DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (mission_id, user_id)
);
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own plans" ON plans FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── acceptance_criteria ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS acceptance_criteria (
  id                                TEXT        PRIMARY KEY,
  user_id                           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id                        TEXT        NOT NULL,
  intended_behavior_json            TEXT        DEFAULT '[]',
  non_goals_json                    TEXT        DEFAULT '[]',
  paths_that_must_still_work_json   TEXT        DEFAULT '[]',
  comparison_targets_json           TEXT        DEFAULT '[]',
  regression_thresholds_json        TEXT        DEFAULT '[]',
  rollback_conditions_json          TEXT        DEFAULT '[]',
  created_at                        TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at                        TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE acceptance_criteria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own acceptance_criteria" ON acceptance_criteria FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── mission_lifecycle_states ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mission_lifecycle_states (
  mission_id           TEXT        NOT NULL,
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_step         INTEGER     DEFAULT 1,
  lifecycle_status     TEXT        DEFAULT 'idle',
  risk_assessment_json TEXT,
  workspace_run_id     TEXT,
  verification_run_id  TEXT,
  deploy_workflow_id   TEXT,
  watch_session_id     TEXT,
  updated_at           TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (mission_id, user_id)
);
ALTER TABLE mission_lifecycle_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own mission_lifecycle_states" ON mission_lifecycle_states FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── deploy_workflows ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deploy_workflows (
  id                TEXT        PRIMARY KEY,
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_id      TEXT        NOT NULL,
  environment_id    TEXT        NOT NULL,
  steps_json        TEXT        DEFAULT '[]',
  status            TEXT        DEFAULT 'pending',
  verdict           TEXT,
  verdict_reason    TEXT,
  evidence_ids_json TEXT        DEFAULT '[]',
  rollback_offered  BOOLEAN     DEFAULT false,
  started_at        TIMESTAMPTZ NOT NULL,
  completed_at      TIMESTAMPTZ
);
ALTER TABLE deploy_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own deploy_workflows" ON deploy_workflows FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── watch_sessions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watch_sessions (
  id                   TEXT        PRIMARY KEY,
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id           TEXT        NOT NULL,
  environment_id       TEXT        NOT NULL,
  deploy_workflow_id   TEXT        NOT NULL,
  status               TEXT        DEFAULT 'active',
  started_at           TIMESTAMPTZ NOT NULL,
  completed_at         TIMESTAMPTZ
);
ALTER TABLE watch_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own watch_sessions" ON watch_sessions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── anomaly_events ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS anomaly_events (
  id                TEXT        PRIMARY KEY,
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id        TEXT        NOT NULL,
  environment_id    TEXT        NOT NULL,
  watch_session_id  TEXT,
  anomaly_type      TEXT        NOT NULL,
  severity          TEXT        NOT NULL,
  description       TEXT        NOT NULL,
  detected_at       TIMESTAMPTZ NOT NULL
);
ALTER TABLE anomaly_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own anomaly_events" ON anomaly_events FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── self_healing_actions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS self_healing_actions (
  id               TEXT        PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id       TEXT        NOT NULL,
  environment_id   TEXT        NOT NULL,
  anomaly_event_id TEXT,
  action_type      TEXT        NOT NULL,
  status           TEXT        DEFAULT 'pending',
  result           TEXT,
  executed_at      TIMESTAMPTZ
);
ALTER TABLE self_healing_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own self_healing_actions" ON self_healing_actions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── drift_reports ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drift_reports (
  id             TEXT        PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id     TEXT        NOT NULL,
  environment_id TEXT        NOT NULL,
  drift_type     TEXT        NOT NULL,
  severity       TEXT        NOT NULL,
  description    TEXT        NOT NULL,
  detected_at    TIMESTAMPTZ NOT NULL,
  resolved       BOOLEAN     DEFAULT false
);
ALTER TABLE drift_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own drift_reports" ON drift_reports FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── audit_records ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_records (
  id              TEXT        PRIMARY KEY,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id      TEXT,
  action_type     TEXT        NOT NULL,
  parameters_json TEXT        DEFAULT '{}',
  risk_class      TEXT        NOT NULL,
  risk_score      INTEGER     DEFAULT 0,
  result          TEXT        NOT NULL,
  initiated_by    TEXT        DEFAULT 'system',
  initiated_at    TIMESTAMPTZ NOT NULL,
  completed_at    TIMESTAMPTZ
);
ALTER TABLE audit_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own audit_records" ON audit_records FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

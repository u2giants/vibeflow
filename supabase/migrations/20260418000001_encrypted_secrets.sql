-- Track A: Encrypted project secrets for cross-device sync
-- AES-256-GCM encrypted blobs keyed by (user_id, project_id, credential_type).
-- The passphrase never leaves the client — only encrypted blobs are stored here.

CREATE TABLE IF NOT EXISTS encrypted_project_secrets (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id   TEXT        NOT NULL,
  credential_type TEXT     NOT NULL,
  encrypted_blob  TEXT     NOT NULL,  -- JSON: {iv, tag, data, salt} all hex-encoded
  created_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (user_id, project_id, credential_type)
);

ALTER TABLE encrypted_project_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own encrypted secrets"
  ON encrypted_project_secrets
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

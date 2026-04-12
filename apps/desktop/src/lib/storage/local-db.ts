/** Local SQLite cache using better-sqlite3 (synchronous, file-backed). */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import type { Mode, ApprovalPolicy, ConversationThread, Message, RunState, ProjectDevOpsConfig, DeployRun } from '../shared-types';

// Minimal Project type (mirrors shared-types)
interface Project {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  isSelfMaintenance: boolean;
  createdAt: string;
  updatedAt: string;
  syncedAt: string | null;
}

export class LocalDb {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /** Initialize the database and create the schema if it doesn't exist. */
  async init(): Promise<void> {
    // Ensure the directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        is_self_maintenance INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at TEXT
      );

      CREATE TABLE IF NOT EXISTS modes (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        soul TEXT NOT NULL,
        model_id TEXT NOT NULL,
        fallback_model_id TEXT,
        temperature REAL NOT NULL DEFAULT 0.7,
        approval_policy TEXT NOT NULL DEFAULT 'second-model',
        is_built_in INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        user_id TEXT DEFAULT '',
        title TEXT NOT NULL,
        run_state TEXT NOT NULL DEFAULT 'idle',
        owner_device_id TEXT,
        owner_device_name TEXT,
        lease_expires_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        mode_id TEXT,
        model_id TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS project_devops_configs (
        project_id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        github_owner TEXT NOT NULL DEFAULT '',
        github_repo TEXT NOT NULL DEFAULT '',
        coolify_app_id TEXT NOT NULL DEFAULT '',
        coolify_base_url TEXT NOT NULL DEFAULT '',
        image_name TEXT NOT NULL DEFAULT '',
        health_check_url TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS deploy_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        template_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        commit_sha TEXT,
        triggered_by TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        error TEXT
      );
    `);
  }

  // ── Project CRUD ──────────────────────────────────────────────

  listProjects(userId: string): Project[] {
    if (!this.db) return [];
    const stmt = this.db.prepare(
      'SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC'
    );
    const rows = stmt.all(userId) as Array<Record<string, unknown>>;
    return rows.map(rowToProject);
  }

  insertProject(project: Project): void {
    if (!this.db) return;
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO projects
       (id, user_id, name, description, is_self_maintenance, created_at, updated_at, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      project.id,
      project.userId,
      project.name,
      project.description,
      project.isSelfMaintenance ? 1 : 0,
      project.createdAt,
      project.updatedAt,
      project.syncedAt
    );
  }

  // ── Mode CRUD ───────────────────────────────────────────────────

  listModes(): Mode[] {
    if (!this.db) return [];
    const stmt = this.db.prepare('SELECT * FROM modes ORDER BY slug');
    const rows = stmt.all() as Array<Record<string, unknown>>;
    return rows.map(rowToMode);
  }

  getMode(id: string): Mode | null {
    if (!this.db) return null;
    const stmt = this.db.prepare('SELECT * FROM modes WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? rowToMode(row) : null;
  }

  upsertMode(mode: Mode): void {
    if (!this.db) return;
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO modes
       (id, slug, name, description, icon, color, soul, model_id, fallback_model_id,
        temperature, approval_policy, is_built_in, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      mode.id,
      mode.slug,
      mode.name,
      mode.description,
      mode.icon,
      mode.color,
      mode.soul,
      mode.modelId,
      mode.fallbackModelId,
      mode.temperature,
      mode.approvalPolicy,
      mode.isBuiltIn ? 1 : 0,
      mode.createdAt,
      mode.updatedAt
    );
  }

  updateModeSoul(id: string, soul: string): void {
    if (!this.db) return;
    const stmt = this.db.prepare(
      'UPDATE modes SET soul = ?, updated_at = ? WHERE id = ?'
    );
    stmt.run(soul, new Date().toISOString(), id);
  }

  updateModeModel(id: string, modelId: string): void {
    if (!this.db) return;
    const stmt = this.db.prepare(
      'UPDATE modes SET model_id = ?, updated_at = ? WHERE id = ?'
    );
    stmt.run(modelId, new Date().toISOString(), id);
  }

  seedDefaultModes(modes: Omit<Mode, 'createdAt' | 'updatedAt'>[]): void {
    if (!this.db) return;
    // Only seed if the table is empty
    const count = this.db.prepare('SELECT COUNT(*) as count FROM modes').get() as { count: number };
    if (count.count > 0) return;

    const now = new Date().toISOString();
    const stmt = this.db.prepare(
      `INSERT INTO modes
       (id, slug, name, description, icon, color, soul, model_id, fallback_model_id,
        temperature, approval_policy, is_built_in, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const insertMany = this.db.transaction((modeList: typeof modes) => {
      for (const m of modeList) {
        stmt.run(
          m.id,
          m.slug,
          m.name,
          m.description,
          m.icon,
          m.color,
          m.soul,
          m.modelId,
          m.fallbackModelId,
          m.temperature,
          m.approvalPolicy,
          m.isBuiltIn ? 1 : 0,
          now,
          now
        );
      }
    });

    insertMany(modes);
  }

  // ── Settings (device ID storage) ──────────────────────────────────

  getDeviceId(): string | null {
    if (!this.db) return null;
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    const row = stmt.get('device_id') as { value: string } | undefined;
    return row?.value ?? null;
  }

  setDeviceId(id: string): void {
    if (!this.db) return;
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
    );
    stmt.run('device_id', id);
  }

  // ── Conversation CRUD ─────────────────────────────────────────────

  listConversations(projectId: string): ConversationThread[] {
    if (!this.db) return [];
    const stmt = this.db.prepare(
      'SELECT * FROM conversations WHERE project_id = ? ORDER BY updated_at DESC'
    );
    const rows = stmt.all(projectId) as Array<Record<string, unknown>>;
    return rows.map(rowToConversation);
  }

  createConversation(conv: ConversationThread): void {
    if (!this.db) return;
    const stmt = this.db.prepare(
      `INSERT INTO conversations (id, project_id, user_id, title, run_state, owner_device_id, owner_device_name, lease_expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      conv.id,
      conv.projectId,
      conv.userId ?? '',
      conv.title,
      conv.runState ?? 'idle',
      conv.ownerDeviceId ?? null,
      conv.ownerDeviceName ?? null,
      conv.leaseExpiresAt ?? null,
      conv.createdAt,
      conv.updatedAt
    );
  }

  upsertConversation(conv: ConversationThread): void {
    if (!this.db) return;
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO conversations
       (id, project_id, user_id, title, run_state, owner_device_id, owner_device_name, lease_expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      conv.id,
      conv.projectId,
      conv.userId ?? '',
      conv.title,
      conv.runState ?? 'idle',
      conv.ownerDeviceId ?? null,
      conv.ownerDeviceName ?? null,
      conv.leaseExpiresAt ?? null,
      conv.createdAt,
      conv.updatedAt
    );
  }

  updateConversationRunState(id: string, state: RunState, ownerDeviceId?: string, ownerDeviceName?: string, leaseExpiresAt?: string): void {
    if (!this.db) return;
    const stmt = this.db.prepare(
      'UPDATE conversations SET run_state = ?, owner_device_id = ?, owner_device_name = ?, lease_expires_at = ?, updated_at = ? WHERE id = ?'
    );
    stmt.run(state, ownerDeviceId ?? null, ownerDeviceName ?? null, leaseExpiresAt ?? null, new Date().toISOString(), id);
  }

  listMessages(conversationId: string): Message[] {
    if (!this.db) return [];
    const stmt = this.db.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    );
    const rows = stmt.all(conversationId) as Array<Record<string, unknown>>;
    return rows.map(rowToMessage);
  }

  insertMessage(msg: Message): void {
    if (!this.db) return;
    const stmt = this.db.prepare(
      `INSERT INTO messages (id, conversation_id, role, content, mode_id, model_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(msg.id, msg.conversationId, msg.role, msg.content, msg.modeId, msg.modelId, msg.createdAt);
  }

  upsertMessage(msg: Message): void {
    if (!this.db) return;
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO messages (id, conversation_id, role, content, mode_id, model_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(msg.id, msg.conversationId, msg.role, msg.content, msg.modeId, msg.modelId, msg.createdAt);
  }

  // ── DevOps Config CRUD ────────────────────────────────────────────

  getProjectDevOpsConfig(projectId: string): ProjectDevOpsConfig | null {
    if (!this.db) return null;
    const stmt = this.db.prepare('SELECT * FROM project_devops_configs WHERE project_id = ?');
    const row = stmt.get(projectId) as Record<string, unknown> | undefined;
    return row ? rowToProjectDevOpsConfig(row) : null;
  }

  saveProjectDevOpsConfig(config: ProjectDevOpsConfig): void {
    if (!this.db) return;
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO project_devops_configs
       (project_id, template_id, github_owner, github_repo, coolify_app_id, coolify_base_url, image_name, health_check_url, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      config.projectId,
      config.templateId,
      config.githubOwner,
      config.githubRepo,
      config.coolifyAppId,
      config.coolifyBaseUrl,
      config.imageName,
      config.healthCheckUrl,
      config.updatedAt
    );
  }

  // ── Deploy Run CRUD ───────────────────────────────────────────────

  insertDeployRun(run: DeployRun): void {
    if (!this.db) return;
    const stmt = this.db.prepare(
      `INSERT INTO deploy_runs (id, project_id, template_id, status, commit_sha, triggered_by, started_at, completed_at, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      run.id,
      run.projectId,
      run.templateId,
      run.status,
      run.commitSha,
      run.triggeredBy,
      run.startedAt,
      run.completedAt,
      run.error
    );
  }

  updateDeployRun(run: DeployRun): void {
    if (!this.db) return;
    const stmt = this.db.prepare(
      `UPDATE deploy_runs SET status = ?, commit_sha = ?, triggered_by = ?, started_at = ?, completed_at = ?, error = ? WHERE id = ?`
    );
    stmt.run(
      run.status,
      run.commitSha,
      run.triggeredBy,
      run.startedAt,
      run.completedAt,
      run.error,
      run.id
    );
  }

  listDeployRuns(projectId: string): DeployRun[] {
    if (!this.db) return [];
    const stmt = this.db.prepare(
      'SELECT * FROM deploy_runs WHERE project_id = ? ORDER BY started_at DESC'
    );
    const rows = stmt.all(projectId) as Array<Record<string, unknown>>;
    return rows.map(rowToDeployRun);
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

function rowToProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    isSelfMaintenance: (row.is_self_maintenance as number) === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    syncedAt: (row.synced_at as string) ?? null,
  };
}

function rowToMode(row: Record<string, unknown>): Mode {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    description: row.description as string,
    icon: row.icon as string,
    color: row.color as string,
    soul: row.soul as string,
    modelId: row.model_id as string,
    fallbackModelId: (row.fallback_model_id as string) ?? null,
    temperature: row.temperature as number,
    approvalPolicy: row.approval_policy as ApprovalPolicy,
    isBuiltIn: (row.is_built_in as number) === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToConversation(row: Record<string, unknown>): ConversationThread {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    userId: (row.user_id as string) ?? '',
    title: row.title as string,
    runState: (row.run_state as RunState) ?? 'idle',
    ownerDeviceId: (row.owner_device_id as string) ?? null,
    ownerDeviceName: (row.owner_device_name as string) ?? null,
    leaseExpiresAt: (row.lease_expires_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToProjectDevOpsConfig(row: Record<string, unknown>): ProjectDevOpsConfig {
  return {
    projectId: row.project_id as string,
    templateId: row.template_id as string,
    githubOwner: (row.github_owner as string) ?? '',
    githubRepo: (row.github_repo as string) ?? '',
    coolifyAppId: (row.coolify_app_id as string) ?? '',
    coolifyBaseUrl: (row.coolify_base_url as string) ?? '',
    imageName: (row.image_name as string) ?? '',
    healthCheckUrl: (row.health_check_url as string) ?? '',
    updatedAt: row.updated_at as string,
  };
}

function rowToDeployRun(row: Record<string, unknown>): DeployRun {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    templateId: row.template_id as string,
    status: row.status as DeployRun['status'],
    commitSha: (row.commit_sha as string) ?? null,
    triggeredBy: row.triggered_by as string,
    startedAt: row.started_at as string,
    completedAt: (row.completed_at as string) ?? null,
    error: (row.error as string) ?? null,
  };
}

function rowToMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    role: row.role as 'user' | 'assistant' | 'system',
    content: row.content as string,
    modeId: (row.mode_id as string) ?? null,
    modelId: (row.model_id as string) ?? null,
    createdAt: row.created_at as string,
  };
}

/** Local SQLite cache using sql.js (pure JavaScript, no native compilation needed). */

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const initSqlJs = require('sql.js') as (opts?: { locateFile?: (f: string) => string }) => Promise<any>;
import * as path from 'path';
import * as fs from 'fs';
import type { Mode, ApprovalPolicy, ConversationThread, Message, RunState, ProjectDevOpsConfig, DeployRun } from '../shared-types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SqlJsDb = any;

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

interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_self_maintenance: number;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

interface ModeRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  soul: string;
  model_id: string;
  fallback_model_id: string | null;
  temperature: number;
  approval_policy: string;
  is_built_in: number;
  created_at: string;
  updated_at: string;
}

interface ConversationRow {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  run_state: string;
  owner_device_id: string | null;
  owner_device_name: string | null;
  lease_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  mode_id: string | null;
  model_id: string | null;
  created_at: string;
}

export class LocalDb {
  private db: SqlJsDb | null = null;
  private dbPath: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sqlJsModule: any | null = null;

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

    // Initialize sql.js
    // __dirname in bundled main process is apps/desktop/out/main
    // node_modules is at repo root: D:\repos\vibeflow\node_modules
    // Need to go up 4 levels: out/main -> out -> desktop -> apps -> vibeflow
    const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
    this.sqlJsModule = await initSqlJs({
      locateFile: (file: string) => path.join(repoRoot, 'node_modules', 'sql.js', 'dist', file),
    });

    // Load existing database or create new one
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new this.sqlJsModule.Database(buffer);
    } else {
      this.db = new this.sqlJsModule.Database();
    }

    this.initializeSchema();
    this.save();
  }

  private save(): void {
    if (this.db) {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    }
  }

  private initializeSchema(): void {
    this.db!.run(`
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

  close(): void {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }

  // ── Settings ────────────────────────────────────────────────────────

  getDeviceId(): string | null {
    const row = this.db!.exec('SELECT value FROM settings WHERE key = ?', ['deviceId'])[0];
    return row?.values?.[0]?.[0] as string | null;
  }

  setDeviceId(id: string): void {
    this.db!.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['deviceId', id]);
    this.save();
  }

  // ── Helper: convert sql.js array row to object using column names ────

  private toObj(result: { columns: string[]; values: AnyRow[] }, rowIndex: number): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    result.columns.forEach((col, i) => { obj[col] = result.values[rowIndex][i]; });
    return obj;
  }

  private toObjAll(result: { columns: string[]; values: AnyRow[] } | undefined): Record<string, unknown>[] {
    if (!result?.values) return [];
    return result.values.map((_, i) => this.toObj(result, i));
  }

  // ── Projects ────────────────────────────────────────────────────────

  listProjects(userId: string): Project[] {
    const result = this.db!.exec('SELECT * FROM projects WHERE user_id = ?', [userId])[0];
    return this.toObjAll(result).map((r) => this.rowToProject(r as unknown as ProjectRow));
  }

  insertProject(project: Project): void {
    this.db!.run(
      'INSERT OR REPLACE INTO projects (id, user_id, name, description, is_self_maintenance, created_at, updated_at, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [project.id, project.userId, project.name, project.description, project.isSelfMaintenance ? 1 : 0, project.createdAt, project.updatedAt, project.syncedAt]
    );
    this.save();
  }

  getSelfMaintenanceProject(): Project | null {
    const result = this.db!.exec('SELECT * FROM projects WHERE is_self_maintenance = 1 LIMIT 1')[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToProject(objs[0] as unknown as ProjectRow);
  }

  private rowToProject(row: ProjectRow): Project {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description ?? null,
      isSelfMaintenance: row.is_self_maintenance === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      syncedAt: row.synced_at,
    };
  }

  // ── Modes ───────────────────────────────────────────────────────────

  listModes(): Mode[] {
    const result = this.db!.exec('SELECT * FROM modes')[0];
    return this.toObjAll(result).map((r) => this.rowToMode(r as unknown as ModeRow));
  }

  getMode(id: string): Mode | null {
    const result = this.db!.exec('SELECT * FROM modes WHERE id = ?', [id])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToMode(objs[0] as unknown as ModeRow);
  }

  upsertMode(mode: Mode): void {
    this.db!.run(
      'INSERT OR REPLACE INTO modes (id, slug, name, description, icon, color, soul, model_id, fallback_model_id, temperature, approval_policy, is_built_in, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [mode.id, mode.slug, mode.name, mode.description, mode.icon, mode.color, mode.soul, mode.modelId, mode.fallbackModelId, mode.temperature, mode.approvalPolicy, mode.isBuiltIn ? 1 : 0, mode.createdAt, mode.updatedAt]
    );
    this.save();
  }

  updateModeSoul(id: string, soul: string): void {
    this.db!.run('UPDATE modes SET soul = ?, updated_at = ? WHERE id = ?', [soul, new Date().toISOString(), id]);
    this.save();
  }

  updateModeModel(id: string, modelId: string): void {
    this.db!.run('UPDATE modes SET model_id = ?, updated_at = ? WHERE id = ?', [modelId, new Date().toISOString(), id]);
    this.save();
  }

  seedDefaultModes(modes: Omit<Mode, 'createdAt' | 'updatedAt'>[]): void {
    const existing = this.listModes();
    if (existing.length > 0) return;
    const now = new Date().toISOString();
    for (const mode of modes) {
      this.upsertMode({ ...mode, createdAt: now, updatedAt: now } as Mode);
    }
  }

  private rowToMode(row: ModeRow): Mode {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      icon: row.icon,
      color: row.color,
      soul: row.soul,
      modelId: row.model_id,
      fallbackModelId: row.fallback_model_id,
      temperature: row.temperature,
      approvalPolicy: row.approval_policy as ApprovalPolicy,
      isBuiltIn: row.is_built_in === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ── Conversations ───────────────────────────────────────────────────

  listConversations(projectId: string | undefined): ConversationThread[] {
    if (!projectId) return [];
    const result = this.db!.exec('SELECT * FROM conversations WHERE project_id = ?', [projectId])[0];
    return this.toObjAll(result).map((r) => this.rowToConversation(r as unknown as ConversationRow));
  }

  getConversation(id: string): ConversationThread | null {
    const result = this.db!.exec('SELECT * FROM conversations WHERE id = ?', [id])[0];
    const objs = this.toObjAll(result);
    if (!objs.length) return null;
    return this.rowToConversation(objs[0] as unknown as ConversationRow);
  }

  createConversation(conv: ConversationThread): void {
    this.db!.run(
      'INSERT INTO conversations (id, project_id, user_id, title, run_state, owner_device_id, owner_device_name, lease_expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [conv.id, conv.projectId, conv.userId ?? '', conv.title, conv.runState ?? 'idle', conv.ownerDeviceId, conv.ownerDeviceName, conv.leaseExpiresAt, conv.createdAt, conv.updatedAt]
    );
    this.save();
  }

  updateConversationRunState(id: string, state: RunState, ownerDeviceId?: string, ownerDeviceName?: string, leaseExpiresAt?: string): void {
    this.db!.run(
      'UPDATE conversations SET run_state = ?, owner_device_id = ?, owner_device_name = ?, lease_expires_at = ?, updated_at = ? WHERE id = ?',
      [state, ownerDeviceId ?? null, ownerDeviceName ?? null, leaseExpiresAt ?? null, new Date().toISOString(), id]
    );
    this.save();
  }

  upsertConversation(conv: ConversationThread): void {
    this.db!.run(
      'INSERT OR REPLACE INTO conversations (id, project_id, user_id, title, run_state, owner_device_id, owner_device_name, lease_expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [conv.id, conv.projectId, conv.userId ?? '', conv.title, conv.runState ?? 'idle', conv.ownerDeviceId, conv.ownerDeviceName, conv.leaseExpiresAt, conv.createdAt, conv.updatedAt]
    );
    this.save();
  }

  private rowToConversation(row: ConversationRow): ConversationThread {
    return {
      id: row.id,
      projectId: row.project_id,
      userId: row.user_id || undefined,
      title: row.title,
      runState: row.run_state as RunState,
      ownerDeviceId: row.owner_device_id,
      ownerDeviceName: row.owner_device_name,
      leaseExpiresAt: row.lease_expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ── Messages ────────────────────────────────────────────────────────

  listMessages(conversationId: string): Message[] {
    const result = this.db!.exec('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC', [conversationId])[0];
    return this.toObjAll(result).map((r) => this.rowToMessage(r as unknown as MessageRow));
  }

  insertMessage(msg: Message): void {
    this.db!.run(
      'INSERT INTO messages (id, conversation_id, role, content, mode_id, model_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [msg.id, msg.conversationId, msg.role, msg.content, msg.modeId, msg.modelId, msg.createdAt]
    );
    this.save();
  }

  upsertMessage(msg: Message): void {
    this.db!.run(
      'INSERT OR REPLACE INTO messages (id, conversation_id, role, content, mode_id, model_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [msg.id, msg.conversationId, msg.role, msg.content, msg.modeId, msg.modelId, msg.createdAt]
    );
    this.save();
  }

  private rowToMessage(row: MessageRow): Message {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role as 'user' | 'assistant' | 'system',
      content: row.content,
      modeId: row.mode_id,
      modelId: row.model_id,
      createdAt: row.created_at,
    };
  }

  // ── DevOps ──────────────────────────────────────────────────────────

  getProjectDevOpsConfig(projectId: string): ProjectDevOpsConfig | null {
    const rows = this.db!.exec('SELECT * FROM project_devops_configs WHERE project_id = ?', [projectId])[0];
    if (!rows?.values?.length) return null;
    const r = rows.values[0] as any;
    return {
      projectId: r.project_id,
      templateId: r.template_id,
      githubOwner: r.github_owner,
      githubRepo: r.github_repo,
      coolifyAppId: r.coolify_app_id,
      coolifyBaseUrl: r.coolify_base_url,
      imageName: r.image_name,
      healthCheckUrl: r.health_check_url,
      updatedAt: r.updated_at,
    };
  }

  saveProjectDevOpsConfig(config: ProjectDevOpsConfig): void {
    this.db!.run(
      'INSERT OR REPLACE INTO project_devops_configs (project_id, template_id, github_owner, github_repo, coolify_app_id, coolify_base_url, image_name, health_check_url, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [config.projectId, config.templateId, config.githubOwner, config.githubRepo, config.coolifyAppId, config.coolifyBaseUrl, config.imageName, config.healthCheckUrl, config.updatedAt]
    );
    this.save();
  }

  insertDeployRun(run: DeployRun): void {
    this.db!.run(
      'INSERT INTO deploy_runs (id, project_id, template_id, status, commit_sha, triggered_by, started_at, completed_at, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [run.id, run.projectId, run.templateId, run.status, run.commitSha, run.triggeredBy, run.startedAt, run.completedAt, run.error]
    );
    this.save();
  }

  updateDeployRun(id: string, updates: Partial<DeployRun>): void {
    const fields: string[] = [];
    const values: any[] = [];
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.commitSha !== undefined) { fields.push('commit_sha = ?'); values.push(updates.commitSha); }
    if (updates.completedAt !== undefined) { fields.push('completed_at = ?'); values.push(updates.completedAt); }
    if (updates.error !== undefined) { fields.push('error = ?'); values.push(updates.error); }
    if (fields.length === 0) return;
    values.push(id);
    this.db!.run(`UPDATE deploy_runs SET ${fields.join(', ')} WHERE id = ?`, values);
    this.save();
  }

  listDeployRuns(projectId: string): DeployRun[] {
    const rows = this.db!.exec('SELECT * FROM deploy_runs WHERE project_id = ? ORDER BY started_at DESC', [projectId])[0];
    if (!rows?.values) return [];
    return rows.values.map((r: any) => ({
      id: r.id,
      projectId: r.project_id,
      templateId: r.template_id,
      status: r.status,
      commitSha: r.commit_sha,
      triggeredBy: r.triggered_by,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      error: r.error,
    }));
  }
}

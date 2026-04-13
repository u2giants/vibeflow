/**
 * Sync engine — manages Supabase sync, device registration, lease/heartbeat,
 * and Supabase Realtime subscriptions.
 *
 * Local SQLite is the primary read/write store for speed.
 * Supabase Postgres is the canonical cloud source of truth.
 * Supabase Realtime pushes changes to all connected clients.
 */

import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { SyncStatus, ConversationThread, Message, Project, RunState, Mode, ApprovalPolicy } from '../shared-types';
import type { LocalDb } from '../storage/local-db';

export type SyncEventType =
  | 'sync-status-changed'
  | 'conversation-updated'
  | 'message-added'
  | 'lease-changed';

export interface SyncEvent {
  type: SyncEventType;
  data: unknown;
}

const LEASE_DURATION_SECONDS = 45;
const HEARTBEAT_INTERVAL_MS = 15_000;

export class SyncEngine {
  private supabase: SupabaseClient;
  private deviceId: string;
  private deviceName: string;
  private userId: string;
  private localDb: LocalDb;
  private status: SyncStatus = 'offline';
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private activeLeaseConversationId: string | null = null;
  private channel: RealtimeChannel | null = null;
  private listeners: ((event: SyncEvent) => void)[] = [];

  constructor(
    supabaseUrl: string,
    supabaseAnonKey: string,
    deviceId: string,
    deviceName: string,
    userId: string,
    localDb: LocalDb
  ) {
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
    this.deviceId = deviceId;
    this.deviceName = deviceName;
    this.userId = userId;
    this.localDb = localDb;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  async start(): Promise<void> {
    this.setStatus('syncing');
    await this.registerDevice();
    await this.syncAll();
    this.subscribeToRealtime();
    this.setStatus('synced');
  }

  stop(): void {
    this.stopHeartbeat();
    if (this.channel) {
      this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.listeners = [];
    this.setStatus('offline');
  }

  // ── Device Registration ───────────────────────────────────────────

  async registerDevice(): Promise<void> {
    const { error } = await this.supabase.from('devices').upsert({
      id: this.deviceId,
      user_id: this.userId,
      name: this.deviceName,
      last_seen_at: new Date().toISOString(),
    });
    if (error) {
      console.error('[sync] Device registration failed:', error.message);
    }
  }

  // ── Initial Sync ──────────────────────────────────────────────────

  async syncAll(): Promise<void> {
    this.setStatus('syncing');
    await this.syncProjects();
    await this.syncConversations();
    await this.syncMessages();
    await this.syncModes();
    this.setStatus('synced');
  }

  private async syncProjects(): Promise<void> {
    const { data, error } = await this.supabase
      .from('projects')
      .select('*')
      .eq('user_id', this.userId);

    if (error) {
      console.error('[sync] Failed to sync projects:', error.message);
      return;
    }

    if (data) {
      for (const row of data) {
        const project: Project = {
          id: row.id,
          userId: row.user_id,
          name: row.name,
          description: row.description ?? null,
          isSelfMaintenance: row.is_self_maintenance ?? false,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          syncedAt: row.updated_at,
        };
        this.localDb.insertProject(project);
      }
    }
  }

  private async syncConversations(): Promise<void> {
    const { data, error } = await this.supabase
      .from('conversations')
      .select('*')
      .eq('user_id', this.userId);

    if (error) {
      console.error('[sync] Failed to sync conversations:', error.message);
      return;
    }

    if (data) {
      for (const row of data) {
        const conv: ConversationThread = {
          id: row.id,
          projectId: row.project_id,
          userId: row.user_id,
          title: row.title,
          runState: row.run_state ?? 'idle',
          ownerDeviceId: row.owner_device_id ?? null,
          ownerDeviceName: row.owner_device_name ?? null,
          leaseExpiresAt: row.lease_expires_at ?? null,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
        this.localDb.upsertConversation(conv);
      }
    }
  }

  private async syncMessages(): Promise<void> {
    // Get all conversation IDs for this user
    const { data: convs, error: convError } = await this.supabase
      .from('conversations')
      .select('id')
      .eq('user_id', this.userId);

    if (convError) {
      console.error('[sync] Failed to get conversation IDs:', convError.message);
      return;
    }

    if (!convs || convs.length === 0) return;

    const convIds = convs.map((c) => c.id);

    const { data, error } = await this.supabase
      .from('messages')
      .select('*')
      .in('conversation_id', convIds);

    if (error) {
      console.error('[sync] Failed to sync messages:', error.message);
      return;
    }

    if (data) {
      for (const row of data) {
        const msg: Message = {
          id: row.id,
          conversationId: row.conversation_id,
          role: row.role,
          content: row.content,
          modeId: row.mode_id ?? null,
          modelId: row.model_id ?? null,
          createdAt: row.created_at,
        };
        this.localDb.upsertMessage(msg);
      }
    }
  }

  // ── Push to Supabase ──────────────────────────────────────────────

  async pushProject(project: Project): Promise<void> {
    const { error } = await this.supabase.from('projects').upsert({
      id: project.id,
      user_id: project.userId,
      name: project.name,
      description: project.description,
      is_self_maintenance: project.isSelfMaintenance,
      created_at: project.createdAt,
      updated_at: project.updatedAt,
    });
    if (error) {
      console.error('[sync] Failed to push project:', error.message);
    }
  }

  async pushConversation(conv: ConversationThread): Promise<void> {
    const { error } = await this.supabase.from('conversations').upsert({
      id: conv.id,
      project_id: conv.projectId,
      user_id: conv.userId ?? this.userId,
      title: conv.title,
      run_state: conv.runState ?? 'idle',
      owner_device_id: conv.ownerDeviceId,
      owner_device_name: conv.ownerDeviceName,
      lease_expires_at: conv.leaseExpiresAt,
      created_at: conv.createdAt,
      updated_at: conv.updatedAt,
    });
    if (error) {
      console.error('[sync] Failed to push conversation:', error.message);
    }
  }

  async pushMessage(msg: Message): Promise<void> {
    const { error } = await this.supabase.from('messages').insert({
      id: msg.id,
      conversation_id: msg.conversationId,
      user_id: this.userId,
      role: msg.role,
      content: msg.content,
      mode_id: msg.modeId,
      model_id: msg.modelId,
      created_at: msg.createdAt,
    });
    if (error) {
      console.error('[sync] Failed to push message:', error.message);
    }
  }

  async pushMode(mode: Mode): Promise<void> {
    const { error } = await this.supabase.from('modes').upsert({
      id: mode.id,
      user_id: this.userId,
      slug: mode.slug,
      name: mode.name,
      description: mode.description,
      icon: mode.icon,
      color: mode.color,
      soul: mode.soul,
      model_id: mode.modelId,
      fallback_model_id: mode.fallbackModelId,
      temperature: mode.temperature,
      approval_policy: mode.approvalPolicy,
      is_built_in: mode.isBuiltIn,
      created_at: mode.createdAt,
      updated_at: mode.updatedAt,
    });
    if (error) {
      console.error('[sync] Failed to push mode:', error.message);
    }
  }

  private async syncModes(): Promise<void> {
    const { data, error } = await this.supabase
      .from('modes')
      .select('*')
      .eq('user_id', this.userId);
    if (error) { console.error('[sync] Failed to sync modes:', error.message); return; }
    if (data) {
      for (const row of data) {
        const mode: Mode = {
          id: row.id, slug: row.slug, name: row.name, description: row.description,
          icon: row.icon, color: row.color, soul: row.soul, modelId: row.model_id,
          fallbackModelId: row.fallback_model_id ?? null, temperature: row.temperature,
          approvalPolicy: (row.approval_policy as ApprovalPolicy), isBuiltIn: row.is_built_in,
          createdAt: row.created_at, updatedAt: row.updated_at,
        };
        this.localDb.upsertMode(mode);
      }
    }
  }

  // ── Lease Management ──────────────────────────────────────────────

  async acquireLease(conversationId: string): Promise<{ success: boolean; error?: string }> {
    // Check if there's an existing active lease
    const existingLease = await this.getLease(conversationId);
    if (existingLease) {
      const isExpired = new Date(existingLease.expiresAt) < new Date();
      if (!isExpired && existingLease.deviceId !== this.deviceId) {
        return { success: false, error: `Active on ${existingLease.deviceName} — Read-only while this run is in progress` };
      }
    }

    const expiresAt = new Date(Date.now() + LEASE_DURATION_SECONDS * 1000).toISOString();

    const { error } = await this.supabase.from('conversation_leases').upsert({
      conversation_id: conversationId,
      device_id: this.deviceId,
      device_name: this.deviceName,
      acquired_at: new Date().toISOString(),
      expires_at: expiresAt,
      heartbeat_interval_seconds: 15,
    });

    if (error) {
      console.error('[sync] Failed to acquire lease:', error.message);
      return { success: false, error: error.message };
    }

    // Update local conversation run state
    this.localDb.updateConversationRunState(conversationId, 'running', this.deviceId, this.deviceName, expiresAt);

    // Start heartbeat
    this.activeLeaseConversationId = conversationId;
    this.startHeartbeat(conversationId);

    return { success: true };
  }

  async releaseLease(conversationId: string): Promise<{ success: boolean }> {
    const { error } = await this.supabase
      .from('conversation_leases')
      .delete()
      .eq('conversation_id', conversationId);

    if (error) {
      console.error('[sync] Failed to release lease:', error.message);
    }

    // Update local conversation run state
    this.localDb.updateConversationRunState(conversationId, 'idle');

    // Stop heartbeat
    if (this.activeLeaseConversationId === conversationId) {
      this.stopHeartbeat();
      this.activeLeaseConversationId = null;
    }

    return { success: true };
  }

  async renewLease(): Promise<void> {
    if (!this.activeLeaseConversationId) return;

    const expiresAt = new Date(Date.now() + LEASE_DURATION_SECONDS * 1000).toISOString();

    const { error } = await this.supabase
      .from('conversation_leases')
      .update({
        expires_at: expiresAt,
        acquired_at: new Date().toISOString(),
      })
      .eq('conversation_id', this.activeLeaseConversationId)
      .eq('device_id', this.deviceId);

    if (error) {
      console.error('[sync] Failed to renew lease:', error.message);
      return;
    }

    // Update local conversation
    this.localDb.updateConversationRunState(
      this.activeLeaseConversationId,
      'running',
      this.deviceId,
      this.deviceName,
      expiresAt
    );
  }

  async takeoverLease(conversationId: string): Promise<{ success: boolean; error?: string }> {
    // Delete the old lease (it should be expired)
    const { error: deleteError } = await this.supabase
      .from('conversation_leases')
      .delete()
      .eq('conversation_id', conversationId);

    if (deleteError) {
      console.error('[sync] Failed to delete old lease:', deleteError.message);
      return { success: false, error: deleteError.message };
    }

    // Acquire new lease
    return this.acquireLease(conversationId);
  }

  async getLease(conversationId: string): Promise<{ deviceId: string; deviceName: string; expiresAt: string } | null> {
    const { data, error } = await this.supabase
      .from('conversation_leases')
      .select('device_id, device_name, expires_at')
      .eq('conversation_id', conversationId)
      .single();

    if (error || !data) return null;

    return {
      deviceId: data.device_id,
      deviceName: data.device_name,
      expiresAt: data.expires_at,
    };
  }

  // ── Heartbeat ─────────────────────────────────────────────────────

  private startHeartbeat(conversationId: string): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.renewLease().catch((err) => {
        console.error('[sync] Heartbeat renewal failed:', err);
      });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ── Realtime Subscriptions ────────────────────────────────────────

  private subscribeToRealtime(): void {
    this.channel = this.supabase
      .channel('sync-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations', filter: `user_id=eq.${this.userId}` },
        (payload) => {
          this.handleConversationChange(payload);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          this.handleMessageInsert(payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_leases' },
        (payload) => {
          this.emit({ type: 'lease-changed', data: payload });
        }
      )
      .subscribe();
  }

  private handleConversationChange(payload: unknown): void {
    const data = payload as { new?: Record<string, unknown>; old?: Record<string, unknown> };
    if (data.new) {
      const conv: ConversationThread = {
        id: data.new.id as string,
        projectId: data.new.project_id as string,
        userId: (data.new.user_id as string) ?? '',
        title: data.new.title as string,
        runState: (data.new.run_state as RunState) ?? 'idle',
        ownerDeviceId: (data.new.owner_device_id as string) ?? null,
        ownerDeviceName: (data.new.owner_device_name as string) ?? null,
        leaseExpiresAt: (data.new.lease_expires_at as string) ?? null,
        createdAt: data.new.created_at as string,
        updatedAt: data.new.updated_at as string,
      };
      this.localDb.upsertConversation(conv);
      this.emit({ type: 'conversation-updated', data: conv });
    }
  }

  private handleMessageInsert(payload: unknown): void {
    const data = payload as { new?: Record<string, unknown> };
    if (data.new) {
      const msg: Message = {
        id: data.new.id as string,
        conversationId: data.new.conversation_id as string,
        role: data.new.role as 'user' | 'assistant' | 'system',
        content: data.new.content as string,
        modeId: (data.new.mode_id as string) ?? null,
        modelId: (data.new.model_id as string) ?? null,
        createdAt: data.new.created_at as string,
      };
      this.localDb.upsertMessage(msg);
      this.emit({ type: 'message-added', data: msg });
    }
  }

  // ── Event Emitter ─────────────────────────────────────────────────

  on(listener: (event: SyncEvent) => void): void {
    this.listeners.push(listener);
  }

  off(listener: (event: SyncEvent) => void): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  private emit(event: SyncEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[sync] Listener error:', err);
      }
    }
  }

  // ── Status ────────────────────────────────────────────────────────

  getStatus(): SyncStatus {
    return this.status;
  }

  getDeviceId(): string {
    return this.deviceId;
  }

  getDeviceName(): string {
    return this.deviceName;
  }

  private setStatus(status: SyncStatus): void {
    this.status = status;
    this.emit({ type: 'sync-status-changed', data: status });
  }
}

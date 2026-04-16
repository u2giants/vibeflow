/** Central capability registry — manages all registered capabilities. */

import type {
  Capability,
  CapabilityClass,
  CapabilityHealth,
  CapabilityInvocationLog,
  CapabilityAction,
} from '../shared-types';
import type { LocalDb } from '../storage/local-db';

/** Event emitted when a capability's health changes. */
export interface CapabilityHealthEvent {
  capabilityId: string;
  health: CapabilityHealth;
  previousHealth: CapabilityHealth;
  timestamp: string;
}

/** Callback type for health change events. */
export type HealthChangeCallback = (event: CapabilityHealthEvent) => void;

export class CapabilityRegistry {
  private capabilities: Map<string, Capability> = new Map();
  private listeners: HealthChangeCallback[] = [];
  public db: LocalDb | null = null;

  constructor(db?: LocalDb) {
    this.db = db ?? null;
  }

  /** Load all capabilities from the database into the in-memory registry. */
  loadFromDb(): void {
    if (!this.db) return;
    const caps = this.db.listCapabilities();
    this.capabilities.clear();
    for (const cap of caps) {
      this.capabilities.set(cap.id, cap);
    }
  }

  /** Register a new capability. */
  register(capability: Capability): void {
    this.capabilities.set(capability.id, capability);
    this.persistCapability(capability);
  }

  /** Remove a capability from the registry. */
  deregister(id: string): void {
    this.capabilities.delete(id);
    if (this.db) {
      this.db.deleteCapability(id);
    }
  }

  /** Get a single capability by id. */
  get(id: string): Capability | null {
    return this.capabilities.get(id) ?? null;
  }

  /** List all registered capabilities. */
  list(): Capability[] {
    return Array.from(this.capabilities.values());
  }

  /** List capabilities by class. */
  listByClass(cls: CapabilityClass): Capability[] {
    return this.list().filter((c) => c.class === cls);
  }

  /** List capabilities by health status. */
  listByHealth(health: CapabilityHealth): Capability[] {
    return this.list().filter((c) => c.health === health);
  }

  /** Get a map of capability id → health status. */
  getHealth(): Record<string, CapabilityHealth> {
    const result: Record<string, CapabilityHealth> = {};
    for (const [id, cap] of this.capabilities) {
      result[id] = cap.health;
    }
    return result;
  }

  /** Update the health status of a capability. */
  updateHealth(id: string, health: CapabilityHealth): void {
    const cap = this.capabilities.get(id);
    if (!cap) return;

    const previousHealth = cap.health;
    cap.health = health;
    cap.updatedAt = new Date().toISOString();

    if (health === 'unauthorized' || health === 'misconfigured' || health === 'offline' || health === 'degraded') {
      cap.lastFailureAt = new Date().toISOString();
    } else if (health === 'healthy') {
      cap.lastSuccessAt = new Date().toISOString();
    }

    this.capabilities.set(id, cap);
    this.persistCapability(cap);

    // Emit health change event
    if (previousHealth !== health) {
      this.emitHealthChange({
        capabilityId: id,
        health,
        previousHealth,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /** Record a successful invocation for a capability. */
  recordSuccess(id: string): void {
    const cap = this.capabilities.get(id);
    if (!cap) return;
    cap.lastSuccessAt = new Date().toISOString();
    cap.health = 'healthy';
    cap.updatedAt = new Date().toISOString();
    this.capabilities.set(id, cap);
    this.persistCapability(cap);
  }

  /** Record a failed invocation for a capability. */
  recordFailure(id: string, reason: string): void {
    const cap = this.capabilities.get(id);
    if (!cap) return;
    cap.lastFailureAt = new Date().toISOString();
    cap.lastFailureReason = reason;
    cap.health = 'degraded';
    cap.updatedAt = new Date().toISOString();
    this.capabilities.set(id, cap);
    this.persistCapability(cap);
  }

  /** Log a capability invocation. */
  logInvocation(log: CapabilityInvocationLog): void {
    if (this.db) {
      this.db.logCapabilityInvocation(log);
    }
    // Update health based on result
    if (log.success) {
      this.recordSuccess(log.capabilityId);
    } else {
      this.recordFailure(log.capabilityId, log.error ?? 'Unknown error');
    }
  }

  /** Get recent invocations for a capability. */
  getInvocationLog(capabilityId: string, limit: number = 50): CapabilityInvocationLog[] {
    if (!this.db) return [];
    return this.db.getCapabilityInvocations(capabilityId, limit);
  }

  /** Subscribe to health change events. */
  onHealthChange(callback: HealthChangeCallback): void {
    this.listeners.push(callback);
  }

  /** Unsubscribe from health change events. */
  offHealthChange(callback: HealthChangeCallback): void {
    this.listeners = this.listeners.filter((l) => l !== callback);
  }

  private emitHealthChange(event: CapabilityHealthEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[CapabilityRegistry] Health change listener error:', err);
      }
    }
  }

  private persistCapability(cap: Capability): void {
    if (!this.db) return;
    try {
      this.db.upsertCapability(cap);
    } catch (err) {
      console.error('[CapabilityRegistry] Failed to persist capability:', err);
    }
  }
}

/** Core entity interfaces shared across all VibeFlow packages. */
export interface Account {
    id: string;
    email: string;
    displayName: string | null;
    createdAt: string;
}
export interface Device {
    id: string;
    userId: string;
    name: string;
    lastSeenAt: string;
    createdAt: string;
}
export interface Project {
    id: string;
    userId: string;
    name: string;
    description: string | null;
    isSelfMaintenance: boolean;
    createdAt: string;
    updatedAt: string;
    syncedAt: string | null;
}
export interface ConversationThread {
    id: string;
    projectId: string;
    title: string;
    createdAt: string;
    updatedAt: string;
}
export interface Message {
    id: string;
    threadId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: string;
}
export declare enum RunState {
    Idle = "idle",
    Running = "running",
    Paused = "paused",
    Completed = "completed",
    Failed = "failed"
}
export declare enum SyncStatus {
    Offline = "offline",
    Connecting = "connecting",
    Connected = "connected",
    Syncing = "syncing",
    Error = "error"
}
//# sourceMappingURL=entities.d.ts.map
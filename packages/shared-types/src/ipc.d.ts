/** IPC message types for Electron main ↔ renderer communication. */
import type { Project, SyncStatus, Account } from './entities';
export interface AuthSignInArgs {
    email: string;
    password: string;
}
export interface AuthSignInResult {
    success: boolean;
    error?: string;
    account?: Account;
}
export interface AuthChannel {
    signIn: (args: AuthSignInArgs) => Promise<AuthSignInResult>;
    signOut: () => Promise<void>;
    getSession: () => Promise<{
        email: string | null;
    }>;
}
export interface CreateProjectArgs {
    name: string;
    description?: string;
}
export interface ProjectsChannel {
    list: () => Promise<Project[]>;
    create: (args: CreateProjectArgs) => Promise<Project>;
}
export interface BuildMetadataResult {
    version: string;
    commitSha: string;
    commitDate: string;
    releaseChannel: string;
}
export interface BuildMetadataChannel {
    get: () => Promise<BuildMetadataResult>;
}
export interface VibeFlowAPI {
    auth: AuthChannel;
    projects: ProjectsChannel;
    buildMetadata: BuildMetadataChannel;
    syncStatus: {
        subscribe: (callback: (status: SyncStatus) => void) => () => void;
    };
}
//# sourceMappingURL=ipc.d.ts.map
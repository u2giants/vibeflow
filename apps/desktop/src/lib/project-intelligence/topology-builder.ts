/**
 * TopologyBuilder — aggregates capability registry, MCP servers, and
 * detected services into a service topology map.
 */

import type { ServiceNode, ServiceEdge, DetectedStack } from '../shared-types';
import type { LocalDb } from '../storage/local-db';

/** Known service type mappings from framework names. */
const FRAMEWORK_TO_SERVICE_TYPE: Record<string, ServiceNode['type']> = {
  'React': 'frontend',
  'Next.js': 'frontend',
  'Vue': 'frontend',
  'Svelte': 'frontend',
  'Angular': 'frontend',
  'Express': 'backend',
  'Fastify': 'backend',
  'NestJS': 'backend',
  'Hono': 'backend',
  'Koa': 'backend',
  'Node.js': 'backend',
  'Bun': 'backend',
  'Python': 'backend',
  'Go': 'backend',
  'Prisma': 'database',
  'Drizzle': 'database',
  'TypeORM': 'database',
  'Sequelize': 'database',
  'Mongoose': 'database',
  'Supabase': 'database',
  'Firebase': 'database',
  'Docker': 'deploy-platform',
  'Docker Compose': 'deploy-platform',
  'Coolify': 'deploy-platform',
  'Serverless Framework': 'deploy-platform',
};

export class TopologyBuilder {
  private db: LocalDb;
  private projectId: string;

  constructor(db: LocalDb, projectId: string) {
    this.db = db;
    this.projectId = projectId;
  }

  /** Build the service topology for a project. */
  build(stack: DetectedStack): { nodes: ServiceNode[]; edges: ServiceEdge[] } {
    const nodes: ServiceNode[] = [];
    const edges: ServiceEdge[] = [];
    const nodeIds = new Map<string, string>(); // framework name → node id

    // Add nodes from detected stack
    const allFrameworks = [...stack.frontend, ...stack.backend, ...stack.database, ...stack.deployment];

    for (const fw of allFrameworks) {
      const type = FRAMEWORK_TO_SERVICE_TYPE[fw] ?? 'external-api';
      const nodeId = `svc-${this.projectId}-${fw.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
      nodeIds.set(fw, nodeId);

      nodes.push({
        id: nodeId,
        projectId: this.projectId,
        name: fw,
        type,
        url: null,
        healthStatus: 'unknown',
        capabilityId: null,
        mcpServerId: null,
      });
    }

    // Add nodes from MCP servers
    const mcpServers = this.db.listMcpServers();
    for (const server of mcpServers) {
      const nodeId = `svc-${this.projectId}-mcp-${server.id}`;
      nodes.push({
        id: nodeId,
        projectId: this.projectId,
        name: `MCP: ${server.name}`,
        type: 'external-api',
        url: null,
        healthStatus: server.health,
        capabilityId: null,
        mcpServerId: server.id,
      });
    }

    // Add nodes from capabilities
    const capabilities = this.db.listCapabilities();
    for (const cap of capabilities) {
      const nodeId = `svc-${this.projectId}-cap-${cap.id}`;
      nodes.push({
        id: nodeId,
        projectId: this.projectId,
        name: `Capability: ${cap.name}`,
        type: this.capabilityClassToServiceType(cap.class),
        url: null,
        healthStatus: cap.health,
        capabilityId: cap.id,
        mcpServerId: null,
      });
    }

    // Build edges based on common relationships
    // Frontend → Backend
    const frontendNodes = nodes.filter(n => n.type === 'frontend');
    const backendNodes = nodes.filter(n => n.type === 'backend');
    for (const fe of frontendNodes) {
      for (const be of backendNodes) {
        edges.push({
          id: `edge-${fe.id}-to-${be.id}`,
          projectId: this.projectId,
          sourceNodeId: fe.id,
          targetNodeId: be.id,
          relationship: 'calls',
        });
      }
    }

    // Backend → Database
    const dbNodes = nodes.filter(n => n.type === 'database');
    for (const be of backendNodes) {
      for (const db of dbNodes) {
        edges.push({
          id: `edge-${be.id}-to-${db.id}`,
          projectId: this.projectId,
          sourceNodeId: be.id,
          targetNodeId: db.id,
          relationship: 'stores-in',
        });
      }
    }

    // Backend → Deploy Platform
    const deployNodes = nodes.filter(n => n.type === 'deploy-platform');
    for (const be of backendNodes) {
      for (const dp of deployNodes) {
        edges.push({
          id: `edge-${be.id}-to-${dp.id}`,
          projectId: this.projectId,
          sourceNodeId: be.id,
          targetNodeId: dp.id,
          relationship: 'deploys-to',
        });
      }
    }

    return { nodes, edges };
  }

  /** Map capability class to service node type. */
  private capabilityClassToServiceType(cls: string): ServiceNode['type'] {
    switch (cls) {
      case 'filesystem': return 'runtime-host';
      case 'git': return 'external-api';
      case 'terminal': return 'runtime-host';
      case 'browser': return 'external-api';
      case 'mcp': return 'external-api';
      case 'direct-api': return 'external-api';
      case 'ssh': return 'external-api';
      case 'secrets': return 'auth';
      case 'logs-metrics': return 'external-api';
      case 'build-package': return 'deploy-platform';
      default: return 'external-api';
    }
  }
}

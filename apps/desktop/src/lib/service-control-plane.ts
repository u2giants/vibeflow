/** ServiceControlPlane — service topology with environment linkage for Component 17. */

import type { ServiceControlPlane, ServiceNode, ServiceEdge, Environment, DetectedStack } from './shared-types';
import { TopologyBuilder } from './project-intelligence';
import { LocalDb } from './storage';

export class ServiceControlPlaneManager {
  constructor(private db: LocalDb) {}

  /** Build the service control plane for a project. */
  buildControlPlane(projectId: string, environments: Environment[], stack: DetectedStack): ServiceControlPlane {
    const topologyBuilder = new TopologyBuilder(this.db, projectId);
    const topology = topologyBuilder.build(stack);

    // Build environment-to-service mappings
    const environmentMappings: Record<string, string[]> = {};
    for (const env of environments) {
      // Link services based on environment's linkedServiceIds or default to all services
      const serviceIds = env.linkedServiceIds.length > 0
        ? env.linkedServiceIds
        : topology.nodes.map((n) => n.id);
      environmentMappings[env.id] = serviceIds;
    }

    return {
      projectId,
      services: topology.nodes,
      edges: topology.edges,
      environmentMappings,
      updatedAt: new Date().toISOString(),
    };
  }

  /** Get services for a specific environment. */
  getServicesForEnvironment(projectId: string, environmentId: string, stack: DetectedStack): ServiceNode[] {
    const topologyBuilder = new TopologyBuilder(this.db, projectId);
    const topology = topologyBuilder.build(stack);
    // For now, return all services — future: filter by environment linkage
    return topology.nodes;
  }

  /** Get service dependencies for a service. */
  getServiceDependencies(projectId: string, serviceId: string, stack: DetectedStack): ServiceNode[] {
    const topologyBuilder = new TopologyBuilder(this.db, projectId);
    const topology = topologyBuilder.build(stack);
    const edgeTargets = topology.edges
      .filter((e) => e.sourceNodeId === serviceId)
      .map((e) => e.targetNodeId);
    return topology.nodes.filter((n) => edgeTargets.includes(n.id));
  }

  /** Check if a service mutation is reversible. */
  isServiceMutationReversible(service: ServiceNode): boolean {
    // Reversible services: frontend, backend, queue, cdn, email
    // Irreversible services: database, auth (without backup)
    const reversibleTypes = ['frontend', 'backend', 'queue', 'cdn', 'email', 'external-api', 'deploy-platform', 'runtime-host'];
    return reversibleTypes.includes(service.type);
  }

  /** Get environments that use a specific service. */
  getEnvironmentsForService(controlPlane: ServiceControlPlane, serviceId: string): string[] {
    return Object.entries(controlPlane.environmentMappings)
      .filter(([, serviceIds]) => serviceIds.includes(serviceId))
      .map(([envId]) => envId);
  }
}

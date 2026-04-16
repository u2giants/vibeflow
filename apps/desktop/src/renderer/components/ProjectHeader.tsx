/** ProjectHeader — shows active project context with status badges. */

import type { Project, Environment, Mission } from '../../lib/shared-types';

interface ProjectHeaderProps {
  project: Project;
  environment: Environment | null;
  activeMission: Mission | null;
  pendingApprovalCount: number;
  unhealthyCapabilityCount: number;
  lastDeployStatus: 'success' | 'failed' | 'pending' | 'none';
}

export default function ProjectHeader({
  project,
  environment,
  activeMission,
  pendingApprovalCount,
  unhealthyCapabilityCount,
  lastDeployStatus,
}: ProjectHeaderProps) {
  const deployColor =
    lastDeployStatus === 'success'
      ? '#28a745'
      : lastDeployStatus === 'failed'
      ? '#dc3545'
      : lastDeployStatus === 'pending'
      ? '#ffc107'
      : '#8b949e';

  const deployLabel =
    lastDeployStatus === 'none' ? 'No deploys' : `Last deploy: ${lastDeployStatus}`;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '8px 16px',
        backgroundColor: '#161b22',
        borderBottom: '1px solid #30363d',
        fontSize: 13,
        color: '#c9d1d9',
        flexWrap: 'wrap',
      }}
    >
      {/* Project name */}
      <div style={{ fontWeight: 600, fontSize: 14 }}>
        {project.isSelfMaintenance ? '🔧 ' : ''}{project.name}
      </div>

      {/* Environment badge */}
      <div
        style={{
          padding: '2px 8px',
          backgroundColor: '#1a2332',
          borderRadius: 4,
          border: '1px solid #30363d',
          fontSize: 11,
        }}
      >
        Env: {environment?.name ?? 'none'}
      </div>

      {/* Mission status */}
      <div
        style={{
          padding: '2px 8px',
          backgroundColor: activeMission ? '#23863620' : '#1a2332',
          borderRadius: 4,
          border: `1px solid ${activeMission ? '#238636' : '#30363d'}`,
          fontSize: 11,
          color: activeMission ? '#28a745' : '#8b949e',
        }}
      >
        Mission: {activeMission?.status ?? 'none'}
      </div>

      {/* Deploy status */}
      <div
        style={{
          padding: '2px 8px',
          backgroundColor: '#1a2332',
          borderRadius: 4,
          border: '1px solid #30363d',
          fontSize: 11,
          color: deployColor,
        }}
      >
        {deployLabel}
      </div>

      {/* Pending approvals */}
      {pendingApprovalCount > 0 && (
        <div
          style={{
            padding: '2px 8px',
            backgroundColor: '#fd7e1420',
            borderRadius: 4,
            border: '1px solid #fd7e14',
            fontSize: 11,
            color: '#fd7e14',
          }}
        >
          ⏳ {pendingApprovalCount} pending approval{pendingApprovalCount > 1 ? 's' : ''}
        </div>
      )}

      {/* Unhealthy capabilities */}
      {unhealthyCapabilityCount > 0 && (
        <div
          style={{
            padding: '2px 8px',
            backgroundColor: '#dc354520',
            borderRadius: 4,
            border: '1px solid #dc3545',
            fontSize: 11,
            color: '#dc3545',
          }}
        >
          ⚠️ {unhealthyCapabilityCount} unhealthy
        </div>
      )}
    </div>
  );
}

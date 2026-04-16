/** LeftRail — primary navigation rail for the product shell. */

export type LeftRailSection =
  | 'projects'
  | 'missions'
  | 'environments'
  | 'deploys'
  | 'incidents'
  | 'memory-packs'
  | 'capabilities'
  | 'audit-rollback';

interface LeftRailProps {
  activeSection: LeftRailSection;
  onSectionChange: (section: LeftRailSection) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const SECTIONS: { id: LeftRailSection; icon: string; label: string }[] = [
  { id: 'projects', icon: '📁', label: 'Projects' },
  { id: 'missions', icon: '🎯', label: 'Missions' },
  { id: 'environments', icon: '🌍', label: 'Environments' },
  { id: 'deploys', icon: '🚀', label: 'Deploys' },
  { id: 'incidents', icon: '🔥', label: 'Incidents' },
  { id: 'memory-packs', icon: '🧠', label: 'Memory Packs' },
  { id: 'capabilities', icon: '🔌', label: 'Capabilities' },
  { id: 'audit-rollback', icon: '📋', label: 'Audit / Rollback' },
];

export default function LeftRail({ activeSection, onSectionChange, collapsed, onToggleCollapse }: LeftRailProps) {
  return (
    <div
      style={{
        width: collapsed ? 48 : 200,
        backgroundColor: '#0d1117',
        borderRight: '1px solid #30363d',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Collapse toggle */}
      <div style={{ padding: '8px 4px', borderBottom: '1px solid #30363d' }}>
        <button
          onClick={onToggleCollapse}
          style={{
            width: '100%',
            padding: '4px 8px',
            backgroundColor: 'transparent',
            color: '#8b949e',
            border: '1px solid #30363d',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
          }}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>

      {/* Navigation items */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {SECTIONS.map((section) => (
          <div
            key={section.id}
            onClick={() => onSectionChange(section.id)}
            style={{
              padding: collapsed ? '8px 12px' : '8px 16px',
              marginBottom: 2,
              cursor: 'pointer',
              fontSize: 13,
              color: activeSection === section.id ? '#fff' : '#8b949e',
              backgroundColor: activeSection === section.id ? '#238636' : 'transparent',
              borderRadius: 4,
              margin: '0 4px 2px 4px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={section.label}
          >
            <span style={{ marginRight: collapsed ? 0 : 8 }}>{section.icon}</span>
            {!collapsed && <span>{section.label}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

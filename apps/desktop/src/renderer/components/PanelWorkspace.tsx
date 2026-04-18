/** PanelWorkspace — multi-panel mission workspace with collapsible panels.
 *
 * Component 10 cleanup: panel collapse state is now persisted via the shared
 * useUiState hook instead of local useState.  Conversation is reachable from
 * within the mission workspace via a "Conversations" quick-action button in
 * the Mission panel header.
 */

import { useState, useEffect } from 'react';
import type { Project, ConversationThread, Mode, Mission } from '../../lib/shared-types';
import MissionPanel from './panels/MissionPanel';
import PlanPanel from './panels/PlanPanel';
import ContextPanel from './panels/ContextPanel';
import ChangePanel from './panels/ChangePanel';
import EvidencePanel from './panels/EvidencePanel';
import EnvironmentPanel from './panels/EnvironmentPanel';
import CapabilitiesPanel from './panels/CapabilitiesPanel';
import WatchPanel from './panels/WatchPanel';
import AuditPanel from './panels/AuditPanel';
import MemoryPanel from './panels/MemoryPanel';
import { VerificationPanel } from './panels/VerificationPanel';
import { AcceptancePanel } from './panels/AcceptancePanel';
import ConversationScreen from '../screens/ConversationScreen';
import { useUiState } from '../hooks/useUiState';

interface PanelWorkspaceProps {
  activeMission: Mission | null;
  /** Provided so the conversation list can be loaded inside the workspace. */
  activeProject: Project;
  email: string;
  currentMode: Mode | null;
}

const PANELS = [
  { id: 'mission', label: 'Mission', component: MissionPanel },
  { id: 'plan', label: 'Plan', component: PlanPanel },
  { id: 'context', label: 'Context', component: ContextPanel },
  { id: 'change', label: 'Change', component: ChangePanel },
  { id: 'evidence', label: 'Evidence', component: EvidencePanel },
  { id: 'environment', label: 'Environment', component: EnvironmentPanel },
  { id: 'capabilities', label: 'Capabilities', component: CapabilitiesPanel },
  { id: 'watch', label: 'Watch', component: WatchPanel },
  { id: 'audit', label: 'Audit', component: AuditPanel },
  { id: 'verification', label: 'Verification', component: VerificationPanel },
  { id: 'acceptance', label: 'Acceptance', component: AcceptancePanel },
  { id: 'memory', label: 'Memory', component: MemoryPanel },
];

const DEFAULT_COLLAPSED: Record<string, boolean> = {
  plan: true,
  context: true,
  change: true,
  evidence: true,
  environment: true,
  capabilities: true,
  watch: true,
  audit: true,
  verification: true,
  acceptance: true,
  memory: true,
};

export default function PanelWorkspace({
  activeMission,
  activeProject,
  email,
  currentMode,
}: PanelWorkspaceProps) {
  const { state: uiState, setPanelCollapsed } = useUiState();

  // Merge persisted layout with defaults on first mount
  const [collapsedPanels, setCollapsedPanels] = useState<Record<string, boolean>>(() => {
    const persisted = uiState.panelLayout ?? {};
    return { ...DEFAULT_COLLAPSED, ...persisted };
  });

  // Keep local state in sync when persisted state changes externally
  useEffect(() => {
    if (uiState.panelLayout && Object.keys(uiState.panelLayout).length > 0) {
      setCollapsedPanels((prev) => ({ ...prev, ...uiState.panelLayout }));
    }
  }, [uiState.panelLayout]);

  const togglePanel = (panelId: string) => {
    const next = !collapsedPanels[panelId];
    setCollapsedPanels((prev) => ({ ...prev, [panelId]: next }));
    setPanelCollapsed(panelId, next);
  };

  // --- Conversation reachable from within the mission workspace ---
  const [conversations, setConversations] = useState<ConversationThread[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationThread | null>(null);
  const [showConversation, setShowConversation] = useState(false);

  useEffect(() => {
    if (!activeProject) return;
    window.vibeflow.conversations.list(activeProject.id).then((convs) => {
      setConversations(convs);
      if (convs.length > 0 && !activeConversation) {
        setActiveConversation(convs[0]);
      }
    });
  }, [activeProject?.id]);

  const handleNewConversation = async () => {
    const conv = await window.vibeflow.conversations.create({
      projectId: activeProject.id,
      title: `Conversation ${conversations.length + 1}`,
    });
    setConversations((prev) => [conv, ...prev]);
    setActiveConversation(conv);
  };

  /** Ensure an active conversation exists before showing the conversation view.
   *  - If one is already selected, just open the view.
   *  - If conversations exist but none is selected, pick the first.
   *  - If no conversations exist yet, create one automatically.
   */
  const handleOpenConversations = async () => {
    if (!activeConversation) {
      if (conversations.length > 0) {
        setActiveConversation(conversations[0]);
      } else {
        await handleNewConversation();
      }
    }
    setShowConversation(true);
  };

  // If the user has opened the conversation view, render it full-width here
  if (showConversation && activeConversation) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Back-to-panels bar */}
        <div
          style={{
            padding: '4px 12px',
            backgroundColor: '#0d1117',
            borderBottom: '1px solid #30363d',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <button
            onClick={() => setShowConversation(false)}
            style={{
              padding: '4px 10px',
              backgroundColor: 'transparent',
              color: '#8b949e',
              border: '1px solid #30363d',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            ← Back to Panels
          </button>
          <span style={{ fontSize: 13, color: '#c9d1d9' }}>
            {activeConversation.title}
          </span>
        </div>
        <ConversationScreen
          conversation={activeConversation}
          currentMode={currentMode}
          onNewConversation={handleNewConversation}
          isSelfMaintenance={activeProject.isSelfMaintenance}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        padding: 16,
        backgroundColor: '#161b22',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {PANELS.map(({ id, label, component: PanelComponent }) => (
          <div
            key={id}
            style={{
              backgroundColor: '#0d1117',
              borderRadius: 6,
              border: '1px solid #30363d',
              overflow: 'hidden',
            }}
          >
            {/* Panel header */}
            <div
              onClick={() => togglePanel(id)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#161b22',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: collapsedPanels[id] ? 'none' : '1px solid #30363d',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: '#c9d1d9' }}>
                {label}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Conversations button — only on Mission panel */}
                {id === 'mission' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenConversations();
                    }}
                    style={{
                      padding: '2px 8px',
                      backgroundColor: '#238636',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 11,
                    }}
                    title="Open conversations"
                  >
                    💬 Conversations
                  </button>
                )}
                <span style={{ fontSize: 11, color: '#8b949e' }}>
                  {collapsedPanels[id] ? '▶' : '▼'}
                </span>
              </span>
            </div>

            {/* Panel content */}
            {!collapsedPanels[id] && (
              <div style={{ padding: 16 }}>
                <PanelComponent mission={activeMission} projectId={activeProject.id} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

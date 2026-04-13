/** ProjectScreen — project wrapper with conversation list sidebar. */

import { useState, useEffect } from 'react';
import type { Project, ConversationThread, Mode } from '../../lib/shared-types';
import ConversationScreen from './ConversationScreen';
import SshScreen from './SshScreen';
import DevOpsScreen from './DevOpsScreen';
import McpScreen from './McpScreen';
import TopBar from '../components/TopBar';
import BottomBar from '../components/BottomBar';

interface ProjectScreenProps {
  project: Project;
  email: string;
  currentMode: Mode | null;
  onBack: () => void;
  onOpenModes: () => void;
}

export default function ProjectScreen({ project, email, currentMode, onBack, onOpenModes }: ProjectScreenProps) {
  const [conversations, setConversations] = useState<ConversationThread[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationThread | null>(null);
  const [openRouterConnected, setOpenRouterConnected] = useState(false);
  const [showSsh, setShowSsh] = useState(false);
  const [showDevOps, setShowDevOps] = useState(false);
  const [showMcp, setShowMcp] = useState(false);

  useEffect(() => {
    window.vibeflow.openrouter.getApiKey().then((r) => setOpenRouterConnected(r.hasKey));
  }, []);

  useEffect(() => {
    window.vibeflow.conversations.list(project.id).then((convs) => {
      setConversations(convs);
      if (convs.length > 0 && !activeConversation) {
        setActiveConversation(convs[0]);
      }
    });
  }, [project.id]);

  const handleNewConversation = async () => {
    const conv = await window.vibeflow.conversations.create({
      projectId: project.id,
      title: `Conversation ${conversations.length + 1}`,
    });
    setConversations(prev => [conv, ...prev]);
    setActiveConversation(conv);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <TopBar email={email} />

      {/* Self-maintenance banner */}
      {project.isSelfMaintenance && (
        <div style={{
          padding: '8px 16px',
          backgroundColor: '#fff3cd',
          color: '#856404',
          borderBottom: '1px solid #ffc107',
          fontSize: 13,
          fontWeight: 500,
        }}>
          🔧 Self-Maintenance Mode — You are working on VibeFlow itself. All file changes require your approval.
        </div>
      )}

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Conversation sidebar */}
        <div style={{
          width: 220,
          backgroundColor: '#0d1117',
          borderRight: '1px solid #30363d',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Back button and project name */}
          <div style={{ padding: 12, borderBottom: '1px solid #30363d' }}>
            <button
              onClick={onBack}
              style={{
                padding: '4px 8px',
                backgroundColor: 'transparent',
                color: '#8b949e',
                border: '1px solid #30363d',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
                marginBottom: 8,
                width: '100%',
              }}
            >
              ← Back to Projects
            </button>
            <div style={{ fontSize: 14, color: '#c9d1d9', fontWeight: 600 }}>
              {project.isSelfMaintenance ? '🔧 ' : ''}{project.name}
            </div>
            <button
              onClick={() => setShowSsh(true)}
              style={{
                marginTop: 8,
                padding: '4px 8px',
                backgroundColor: '#1a2332',
                color: '#58a6ff',
                border: '1px solid #30363d',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
                width: '100%',
              }}
            >
              🔑 SSH
            </button>
            <button
              onClick={() => setShowDevOps(true)}
              style={{
                marginTop: 4,
                padding: '4px 8px',
                backgroundColor: '#1a2332',
                color: '#58a6ff',
                border: '1px solid #30363d',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
                width: '100%',
              }}
            >
              ⚙️ DevOps
            </button>
            <button
              onClick={() => setShowMcp(true)}
              style={{
                marginTop: 4,
                padding: '4px 8px',
                backgroundColor: '#1a2332',
                color: '#58a6ff',
                border: '1px solid #30363d',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
                width: '100%',
              }}
            >
              🔌 MCP
            </button>
          </div>

          {/* Conversation list */}
          <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
            <div style={{ fontSize: 11, color: '#484f58', textTransform: 'uppercase', padding: '4px 8px' }}>
              Conversations
            </div>
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setActiveConversation(conv)}
                style={{
                  padding: '8px 12px',
                  marginBottom: 2,
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 13,
                  color: activeConversation?.id === conv.id ? '#fff' : '#8b949e',
                  backgroundColor: activeConversation?.id === conv.id ? '#238636' : 'transparent',
                }}
              >
                {conv.title}
              </div>
            ))}
          </div>

          {/* New conversation button */}
          <div style={{ padding: 8, borderTop: '1px solid #30363d' }}>
            <button
              onClick={handleNewConversation}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#238636',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              + New Conversation
            </button>
          </div>
        </div>

        {/* Main conversation area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {showDevOps ? (
            <DevOpsScreen projectId={project.id} onBack={() => setShowDevOps(false)} />
          ) : showMcp ? (
            <McpScreen projectId={project.id} onBack={() => setShowMcp(false)} />
          ) : showSsh ? (
            <SshScreen onBack={() => setShowSsh(false)} projectId={project.id} />
          ) : activeConversation ? (
            <ConversationScreen
              conversation={activeConversation}
              currentMode={currentMode}
              onNewConversation={handleNewConversation}
              isSelfMaintenance={project.isSelfMaintenance}
            />
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#161b22',
              color: '#8b949e',
              fontSize: 16,
            }}>
              Select or create a conversation to start
            </div>
          )}
        </div>
      </div>

      <BottomBar currentMode={currentMode} openRouterConnected={openRouterConnected} />
    </div>
  );
}

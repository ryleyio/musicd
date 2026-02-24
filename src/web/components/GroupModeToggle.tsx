import React from 'react';

interface GroupModeToggleProps {
  isInGroup: boolean;
  isConnecting: boolean;
  memberCount: number;
  onToggle: () => void;
}

export default function GroupModeToggle({
  isInGroup,
  isConnecting,
  memberCount,
  onToggle,
}: GroupModeToggleProps) {
  return (
    <>
      <style>{`
        .group-toggle {
          background: ${isInGroup ? '#1db954' : 'transparent'};
          border: 1px solid ${isInGroup ? '#1db954' : '#333'};
          color: ${isInGroup ? '#000' : '#999'};
          padding: 6px 12px;
          border-radius: 16px;
          cursor: pointer;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .group-toggle:hover {
          border-color: ${isInGroup ? '#1ed760' : '#666'};
          background: ${isInGroup ? '#1ed760' : '#222'};
          color: ${isInGroup ? '#000' : '#fff'};
        }
        .group-toggle:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .group-icon {
          font-size: 14px;
        }
        .group-count {
          background: ${isInGroup ? 'rgba(0,0,0,0.2)' : '#333'};
          padding: 1px 6px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: bold;
        }
        @keyframes connecting {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .group-toggle.connecting {
          animation: connecting 1s infinite;
        }
      `}</style>
      <button
        className={`group-toggle ${isConnecting ? 'connecting' : ''}`}
        onClick={onToggle}
        disabled={isConnecting}
        title={isInGroup ? 'Leave group mode' : 'Join group mode - syncs playback with other listeners'}
      >
        <span className="group-icon">{isInGroup ? '📡' : '👥'}</span>
        {isConnecting ? 'Connecting...' : 'Group'}
        {isInGroup && memberCount > 0 && (
          <span className="group-count">{memberCount}</span>
        )}
      </button>
    </>
  );
}

import React, { useRef, useCallback, useEffect, useState } from 'react';
import type { Track } from '../hooks/usePlayer';

interface PlayerProps {
  track: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onNext: () => void;
  onPrev?: () => void;
  queueLength: number;
  onExpand?: () => void;
  isInGroup?: boolean;
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function Player({
  track,
  isPlaying,
  currentTime,
  duration,
  volume,
  onTogglePlay,
  onSeek,
  onVolumeChange,
  onNext,
  queueLength,
  onExpand,
  isInGroup = false,
}: PlayerProps) {
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [previewTime, setPreviewTime] = useState<number | null>(null);
  const [hoverProgress, setHoverProgress] = useState(false);
  const [hoverVolume, setHoverVolume] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const displayTime = isDraggingProgress && previewTime !== null ? previewTime : currentTime;
  const progress = duration > 0 ? (displayTime / duration) * 100 : 0;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          onTogglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          onSeek(Math.min(duration, currentTime + 10));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onSeek(Math.max(0, currentTime - 10));
          break;
        case 'ArrowUp':
          e.preventDefault();
          onVolumeChange(Math.min(1, volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          onVolumeChange(Math.max(0, volume - 0.1));
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTogglePlay, onSeek, onVolumeChange, duration, currentTime, volume]);

  const calcPreviewTime = useCallback((clientX: number) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setPreviewTime(percent * duration);
  }, [duration]);

  const calcHoverTime = useCallback((clientX: number) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setHoverTime(percent * duration);
  }, [duration]);

  const calcVolume = useCallback((clientX: number) => {
    if (!volumeRef.current) return;
    const rect = volumeRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onVolumeChange(percent);
  }, [onVolumeChange]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingProgress) calcPreviewTime(e.clientX);
      if (isDraggingVolume) calcVolume(e.clientX);
    };
    const handleMouseUp = () => {
      if (isDraggingProgress && previewTime !== null) {
        onSeek(previewTime);
        setPreviewTime(null);
      }
      setIsDraggingProgress(false);
      setIsDraggingVolume(false);
    };
    if (isDraggingProgress || isDraggingVolume) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingProgress, isDraggingVolume, calcPreviewTime, calcVolume, previewTime, onSeek]);

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingProgress(true);
    calcPreviewTime(e.clientX);
  };

  const handleVolumeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingVolume(true);
    calcVolume(e.clientX);
  };

  return (
    <>
      <style>{`
        .player {
          background: #181818;
          border-top: 1px solid #282828;
          padding: 15px 20px;
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .player-cover {
          width: 56px;
          height: 56px;
          background: #333;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #666;
          font-size: 24px;
          transition: transform 0.2s;
        }
        .player-cover:hover {
          transform: scale(1.05);
        }
        .player-expand-area {
          display: flex;
          align-items: center;
          gap: 15px;
          cursor: pointer;
        }
        .player-expand-area:hover .player-cover,
        .player-expand-area:hover .player-cover-img {
          transform: scale(1.05);
        }
        .player-cover-img {
          width: 56px;
          height: 56px;
          border-radius: 4px;
          object-fit: cover;
          transition: transform 0.2s;
        }
        .player-cover-img:hover {
          transform: scale(1.05);
        }
        .player-info {
          width: 200px;
        }
        .player-title {
          font-weight: bold;
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .player-artist {
          color: #999;
          font-size: 14px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .player-controls {
          display: flex;
          align-items: center;
          gap: 15px;
        }
        .play-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #fff;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          transition: transform 0.1s, background 0.2s;
        }
        .play-btn:hover:not(:disabled) {
          transform: scale(1.06);
          background: #1db954;
        }
        .play-btn:active:not(:disabled) {
          transform: scale(0.95);
        }
        .play-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .skip-btn {
          background: none;
          border: none;
          color: #999;
          cursor: pointer;
          font-size: 20px;
          padding: 5px;
          transition: color 0.2s, transform 0.1s;
        }
        .skip-btn:hover:not(:disabled) {
          color: #fff;
          transform: scale(1.1);
        }
        .skip-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .progress-section {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .time {
          color: #999;
          font-size: 12px;
          min-width: 40px;
          font-variant-numeric: tabular-nums;
        }
        .progress-bar {
          flex: 1;
          height: 4px;
          background: #333;
          border-radius: 2px;
          cursor: pointer;
          position: relative;
          transition: height 0.1s;
        }
        .progress-bar:hover, .progress-bar.dragging {
          height: 6px;
        }
        .progress-fill {
          height: 100%;
          background: #1db954;
          border-radius: 2px;
          position: relative;
          transition: background 0.2s;
        }
        .progress-bar:hover .progress-fill {
          background: #1ed760;
        }
        .progress-thumb {
          position: absolute;
          right: -6px;
          top: 50%;
          transform: translateY(-50%) scale(0);
          width: 12px;
          height: 12px;
          background: #fff;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          transition: transform 0.1s;
        }
        .progress-bar:hover .progress-thumb,
        .progress-bar.dragging .progress-thumb {
          transform: translateY(-50%) scale(1);
        }
        .hover-time {
          position: absolute;
          top: -28px;
          background: #282828;
          color: #fff;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          transform: translateX(-50%);
          pointer-events: none;
          white-space: nowrap;
        }
        .volume-section {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 150px;
        }
        .volume-icon {
          color: #999;
          font-size: 16px;
          cursor: pointer;
          transition: color 0.2s;
        }
        .volume-icon:hover {
          color: #fff;
        }
        .volume-bar {
          flex: 1;
          height: 4px;
          background: #333;
          border-radius: 2px;
          cursor: pointer;
          position: relative;
          overflow: visible;
          transition: height 0.1s;
        }
        .volume-bar:hover, .volume-bar.dragging {
          height: 6px;
        }
        .volume-bar .progress-fill {
          overflow: visible;
        }
        .volume-bar:hover .progress-fill {
          background: #1ed760;
        }
        .volume-bar:hover .progress-thumb,
        .volume-bar.dragging .progress-thumb {
          transform: translateY(-50%) scale(1);
        }
        .queue-badge {
          background: #1db954;
          color: #000;
          border-radius: 10px;
          padding: 2px 8px;
          font-size: 12px;
          font-weight: bold;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .group-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #1db954;
          font-size: 12px;
          padding: 2px 8px;
          background: rgba(29, 185, 84, 0.15);
          border-radius: 10px;
        }
        .group-indicator-icon {
          font-size: 14px;
        }

        /* ===== MOBILE STYLES ===== */
        @media (max-width: 768px) {
          .player {
            flex-wrap: wrap;
            padding: 10px 15px;
            gap: 10px;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 100;
          }
          .player-cover, .player-cover-img {
            width: 48px;
            height: 48px;
          }
          .player-info {
            flex: 1;
            width: auto;
            min-width: 0;
          }
          .player-title {
            font-size: 14px;
          }
          .player-artist {
            font-size: 12px;
          }
          .player-controls {
            gap: 10px;
          }
          .play-btn {
            width: 44px;
            height: 44px;
          }
          .skip-btn {
            padding: 10px;
            font-size: 18px;
          }
          .progress-section {
            width: 100%;
            order: 10;
            gap: 8px;
          }
          .progress-bar {
            height: 6px;
          }
          .progress-thumb {
            transform: translateY(-50%) scale(1);
          }
          .time {
            font-size: 11px;
            min-width: 35px;
          }
          .volume-section {
            display: none;
          }
          .hover-time {
            display: none;
          }
        }

        @media (max-width: 480px) {
          .player {
            padding: 8px 12px;
          }
          .player-cover, .player-cover-img {
            width: 40px;
            height: 40px;
          }
          .skip-btn {
            display: none;
          }
          .queue-badge {
            display: none;
          }
        }
      `}</style>
      <div className="player">
        <div className="player-expand-area" onClick={track && onExpand ? onExpand : undefined}>
          {track?.coverId ? (
            <img src={`/api/cover/${track.coverId}`} alt="" className="player-cover-img" />
          ) : (
            <div className="player-cover">&#9835;</div>
          )}

          <div className="player-info">
            {track ? (
              <>
                <div className="player-title">{track.title || 'Unknown'}</div>
                <div className="player-artist">{track.artist || 'Unknown Artist'}</div>
              </>
            ) : (
              <div className="player-artist">No track playing</div>
            )}
          </div>
        </div>

        <div className="player-controls">
          <button className="skip-btn" onClick={() => onSeek(0)} title="Restart (or previous)">
            &#9664;&#9664;
          </button>
          <button className="play-btn" onClick={onTogglePlay} disabled={!track} title="Play/Pause (Space)">
            {isPlaying ? '❚❚' : '▶'}
          </button>
          <button className="skip-btn" onClick={onNext} disabled={queueLength === 0} title="Next track">
            &#9654;&#9654;
          </button>
          {queueLength > 0 && <span className="queue-badge">{queueLength}</span>}
          {isInGroup && (
            <span className="group-indicator" title="Synced with group">
              <span className="group-indicator-icon">📡</span>
            </span>
          )}
        </div>

        <div className="progress-section">
          <span className="time">{formatTime(displayTime)}</span>
          <div
            ref={progressRef}
            className={`progress-bar ${isDraggingProgress ? 'dragging' : ''}`}
            onMouseDown={handleProgressMouseDown}
            onMouseEnter={() => setHoverProgress(true)}
            onMouseLeave={() => { setHoverProgress(false); setHoverTime(null); }}
            onMouseMove={(e) => !isDraggingProgress && calcHoverTime(e.clientX)}
          >
            {hoverProgress && !isDraggingProgress && hoverTime !== null && (
              <div
                className="hover-time"
                style={{ left: `${(hoverTime / duration) * 100}%` }}
              >
                {formatTime(hoverTime)}
              </div>
            )}
            <div style={{ width: `${progress}%` }} className="progress-fill">
              <div className="progress-thumb" />
            </div>
          </div>
          <span className="time">{formatTime(duration)}</span>
        </div>

        <div className="volume-section">
          <span
            className="volume-icon"
            onClick={() => onVolumeChange(volume > 0 ? 0 : 1)}
            title="Mute/Unmute"
          >
            {volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
          </span>
          <div
            ref={volumeRef}
            className={`volume-bar ${isDraggingVolume ? 'dragging' : ''}`}
            onMouseDown={handleVolumeMouseDown}
            onMouseEnter={() => setHoverVolume(true)}
            onMouseLeave={() => setHoverVolume(false)}
          >
            <div style={{ width: `${volume * 100}%` }} className="progress-fill">
              <div className="progress-thumb" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

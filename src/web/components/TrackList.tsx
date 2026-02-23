import React, { useState } from 'react';
import type { Track } from '../hooks/usePlayer';

interface TrackListProps {
  tracks: Track[];
  onPlay: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  currentTrack: Track | null;
  isPlaying?: boolean;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Animated equalizer bars for now playing
function NowPlayingIndicator({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div className="equalizer">
      <style>{`
        .equalizer {
          display: flex;
          align-items: flex-end;
          gap: 2px;
          height: 14px;
          width: 14px;
        }
        .eq-bar {
          width: 3px;
          background: #1db954;
          border-radius: 1px;
          animation: ${isPlaying ? 'eq-bounce' : 'none'} 0.5s ease-in-out infinite alternate;
        }
        .eq-bar:nth-child(1) { height: ${isPlaying ? '60%' : '40%'}; animation-delay: 0s; }
        .eq-bar:nth-child(2) { height: ${isPlaying ? '100%' : '60%'}; animation-delay: 0.2s; }
        .eq-bar:nth-child(3) { height: ${isPlaying ? '40%' : '30%'}; animation-delay: 0.4s; }
        @keyframes eq-bounce {
          0% { transform: scaleY(0.3); }
          100% { transform: scaleY(1); }
        }
      `}</style>
      <div className="eq-bar" />
      <div className="eq-bar" />
      <div className="eq-bar" />
    </div>
  );
}

export default function TrackList({ tracks, onPlay, onAddToQueue, currentTrack, isPlaying = false }: TrackListProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [queuedId, setQueuedId] = useState<number | null>(null);

  const handleAddToQueue = (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    onAddToQueue(track);
    setQueuedId(track.id);
    setTimeout(() => setQueuedId(null), 1500);
  };

  return (
    <>
      <style>{`
        .track-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .track-row {
          display: flex;
          align-items: center;
          padding: 10px 15px;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .track-row:hover {
          background: rgba(255,255,255,0.1);
        }
        .track-row.playing {
          background: rgba(29, 185, 84, 0.15);
        }
        .track-number {
          width: 30px;
          color: #999;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .track-row:hover .track-number-text {
          display: none;
        }
        .track-row:hover .track-play-icon {
          display: flex;
        }
        .track-play-icon {
          display: none;
          color: #fff;
          font-size: 12px;
        }
        .track-row.playing .track-number-text {
          display: none;
        }
        .track-row.playing .track-play-icon {
          display: none;
        }
        .track-cover {
          width: 40px;
          height: 40px;
          background: #333;
          border-radius: 4px;
          margin-right: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #666;
          position: relative;
          overflow: hidden;
        }
        .track-cover-img {
          width: 40px;
          height: 40px;
          border-radius: 4px;
          object-fit: cover;
          transition: transform 0.2s, filter 0.2s;
        }
        .track-row:hover .track-cover-img {
          transform: scale(1.05);
          filter: brightness(0.7);
        }
        .track-cover-play {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s;
          font-size: 18px;
          color: #fff;
        }
        .track-row:hover .track-cover-play {
          opacity: 1;
        }
        .track-info {
          flex: 1;
          min-width: 0;
        }
        .track-title {
          font-weight: 500;
          margin-bottom: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: color 0.2s;
        }
        .track-row.playing .track-title {
          color: #1db954;
        }
        .track-artist {
          color: #999;
          font-size: 14px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .track-duration {
          color: #999;
          font-size: 14px;
          margin-left: 15px;
          font-variant-numeric: tabular-nums;
        }
        .add-queue-btn {
          background: none;
          border: 1px solid transparent;
          color: #999;
          padding: 6px 12px;
          border-radius: 20px;
          cursor: pointer;
          margin-left: 10px;
          font-size: 12px;
          opacity: 0;
          transition: all 0.2s;
        }
        .track-row:hover .add-queue-btn {
          opacity: 1;
          border-color: #666;
        }
        .add-queue-btn:hover {
          color: #fff;
          border-color: #fff;
          transform: scale(1.05);
        }
        .add-queue-btn.added {
          background: #1db954;
          border-color: #1db954;
          color: #000;
          opacity: 1;
        }

        /* ===== MOBILE STYLES ===== */
        @media (max-width: 768px) {
          .track-row {
            padding: 12px 10px;
          }
          .track-row:hover {
            background: transparent;
          }
          .track-row:active {
            background: rgba(255,255,255,0.1);
          }
          .track-number {
            width: 24px;
            font-size: 12px;
          }
          .track-cover {
            width: 44px;
            height: 44px;
            margin-right: 12px;
          }
          .track-cover-img {
            width: 44px;
            height: 44px;
          }
          .track-row:hover .track-cover-img {
            transform: none;
            filter: none;
          }
          .track-cover-play {
            display: none;
          }
          .track-title {
            font-size: 14px;
          }
          .track-artist {
            font-size: 12px;
          }
          .track-duration {
            font-size: 12px;
            margin-left: 10px;
          }
          .add-queue-btn {
            opacity: 1;
            border-color: #444;
            padding: 8px 12px;
            font-size: 11px;
          }
          .track-row:hover .track-number-text {
            display: flex;
          }
          .track-row:hover .track-play-icon {
            display: none;
          }
        }

        @media (max-width: 480px) {
          .track-row {
            padding: 10px 8px;
          }
          .track-number {
            display: none;
          }
          .track-cover {
            width: 40px;
            height: 40px;
            margin-right: 10px;
          }
          .track-cover-img {
            width: 40px;
            height: 40px;
          }
          .track-duration {
            display: none;
          }
          .add-queue-btn {
            padding: 10px;
            min-width: 44px;
          }
        }
      `}</style>
      <div className="track-list">
        {tracks.map((track, index) => {
          const isCurrentTrack = currentTrack?.id === track.id;
          const isHovered = hovered === track.id;
          const justQueued = queuedId === track.id;

          return (
            <div
              key={track.id}
              className={`track-row ${isCurrentTrack ? 'playing' : ''}`}
              onMouseEnter={() => setHovered(track.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onPlay(track)}
            >
              <span className="track-number">
                {isCurrentTrack ? (
                  <NowPlayingIndicator isPlaying={isPlaying} />
                ) : (
                  <>
                    <span className="track-number-text">{track.trackNumber || index + 1}</span>
                    <span className="track-play-icon">▶</span>
                  </>
                )}
              </span>

              <div className="track-cover">
                {track.coverId ? (
                  <img src={`/api/cover/${track.coverId}`} alt="" className="track-cover-img" />
                ) : (
                  <span>&#9835;</span>
                )}
                <div className="track-cover-play">▶</div>
              </div>

              <div className="track-info">
                <div className="track-title">{track.title || 'Unknown'}</div>
                <div className="track-artist">{track.artist || 'Unknown Artist'}</div>
              </div>

              <span className="track-duration">{formatDuration(track.duration)}</span>

              <button
                className={`add-queue-btn ${justQueued ? 'added' : ''}`}
                onClick={(e) => handleAddToQueue(e, track)}
              >
                {justQueued ? '✓ Added' : '+ Queue'}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

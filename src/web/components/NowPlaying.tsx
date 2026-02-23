import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Track } from '../hooks/usePlayer';

interface NowPlayingProps {
  track: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  queue: Track[];
  queueIndex: number;
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function NowPlaying({
  track,
  isPlaying,
  currentTime,
  duration,
  onTogglePlay,
  onSeek,
  onNext,
  onPrev,
  onClose,
  queue,
  queueIndex,
}: NowPlayingProps) {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Handle touch start
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
    setIsTransitioning(false);
  };

  // Handle touch move
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const delta = e.touches[0].clientX - touchStart;
    setTouchDelta(delta);
  };

  // Handle touch end
  const handleTouchEnd = () => {
    if (touchStart === null) return;

    const threshold = 80; // Minimum swipe distance

    if (touchDelta > threshold) {
      // Swiped right -> previous
      setSwipeDirection('right');
      setIsTransitioning(true);
      setTimeout(() => {
        onPrev();
        setSwipeDirection(null);
        setIsTransitioning(false);
      }, 200);
    } else if (touchDelta < -threshold) {
      // Swiped left -> next
      setSwipeDirection('left');
      setIsTransitioning(true);
      setTimeout(() => {
        onNext();
        setSwipeDirection(null);
        setIsTransitioning(false);
      }, 200);
    }

    setTouchStart(null);
    setTouchDelta(0);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          onPrev();
          break;
        case 'ArrowRight':
          onNext();
          break;
        case 'Space':
          e.preventDefault();
          onTogglePlay();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onPrev, onNext, onTogglePlay]);

  // Progress bar click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    onSeek(percent * duration);
  };

  // Calculate transform based on swipe
  const getTransform = () => {
    if (swipeDirection === 'left') return 'translateX(-100%)';
    if (swipeDirection === 'right') return 'translateX(100%)';
    if (touchDelta !== 0) return `translateX(${touchDelta}px)`;
    return 'translateX(0)';
  };

  if (!track) return null;

  return (
    <>
      <style>{`
        .now-playing-overlay {
          position: fixed;
          inset: 0;
          background: linear-gradient(180deg, #1a1a2e 0%, #0a0a0a 100%);
          z-index: 200;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .np-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px;
          flex-shrink: 0;
        }
        .np-close {
          background: none;
          border: none;
          color: #fff;
          font-size: 28px;
          cursor: pointer;
          padding: 10px;
          opacity: 0.8;
          transition: opacity 0.2s;
        }
        .np-close:hover {
          opacity: 1;
        }
        .np-title {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: #999;
        }
        .np-queue-info {
          color: #666;
          font-size: 14px;
        }

        .np-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          touch-action: pan-y;
          user-select: none;
        }

        .np-artwork-container {
          position: relative;
          width: 100%;
          max-width: 400px;
          aspect-ratio: 1;
          margin-bottom: 40px;
        }
        .np-artwork-wrapper {
          width: 100%;
          height: 100%;
          transition: ${isTransitioning ? 'transform 0.2s ease-out, opacity 0.2s' : 'none'};
          opacity: ${swipeDirection ? 0 : 1};
        }
        .np-artwork {
          width: 100%;
          height: 100%;
          background: #282828;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 120px;
          color: #444;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }
        .np-artwork-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 8px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }

        .np-swipe-hint {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          font-size: 48px;
          color: rgba(255,255,255,0.3);
          pointer-events: none;
          transition: opacity 0.2s;
        }
        .np-swipe-hint.left {
          left: -60px;
          opacity: ${touchDelta < -30 ? 1 : 0};
        }
        .np-swipe-hint.right {
          right: -60px;
          opacity: ${touchDelta > 30 ? 1 : 0};
        }

        .np-track-info {
          text-align: center;
          margin-bottom: 30px;
          max-width: 400px;
          width: 100%;
        }
        .np-track-title {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .np-track-artist {
          font-size: 18px;
          color: #999;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .np-progress-section {
          width: 100%;
          max-width: 400px;
          margin-bottom: 30px;
        }
        .np-progress-bar {
          height: 6px;
          background: #333;
          border-radius: 3px;
          cursor: pointer;
          position: relative;
          margin-bottom: 10px;
        }
        .np-progress-fill {
          height: 100%;
          background: #1db954;
          border-radius: 3px;
          position: relative;
        }
        .np-progress-thumb {
          position: absolute;
          right: -8px;
          top: 50%;
          transform: translateY(-50%);
          width: 16px;
          height: 16px;
          background: #fff;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .np-times {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #999;
          font-variant-numeric: tabular-nums;
        }

        .np-controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 30px;
          margin-bottom: 40px;
        }
        .np-skip-btn {
          background: none;
          border: none;
          color: #fff;
          font-size: 32px;
          cursor: pointer;
          padding: 15px;
          opacity: 0.8;
          transition: opacity 0.2s, transform 0.1s;
        }
        .np-skip-btn:hover {
          opacity: 1;
        }
        .np-skip-btn:active {
          transform: scale(0.9);
        }
        .np-play-btn {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: #fff;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          transition: transform 0.1s, background 0.2s;
        }
        .np-play-btn:hover {
          transform: scale(1.05);
          background: #1db954;
        }
        .np-play-btn:active {
          transform: scale(0.95);
        }

        /* Desktop nav arrows */
        .np-nav-arrow {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(0,0,0,0.5);
          border: none;
          color: #fff;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 24px;
          opacity: 0;
          transition: opacity 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .now-playing-overlay:hover .np-nav-arrow {
          opacity: 0.7;
        }
        .np-nav-arrow:hover {
          opacity: 1 !important;
          background: rgba(0,0,0,0.8);
        }
        .np-nav-arrow.prev {
          left: 30px;
        }
        .np-nav-arrow.next {
          right: 30px;
        }

        /* Mobile styles */
        @media (max-width: 768px) {
          .np-header {
            padding: 15px;
          }
          .np-content {
            padding: 15px;
          }
          .np-artwork-container {
            max-width: 300px;
            margin-bottom: 30px;
          }
          .np-artwork {
            font-size: 80px;
          }
          .np-track-title {
            font-size: 20px;
          }
          .np-track-artist {
            font-size: 16px;
          }
          .np-controls {
            gap: 20px;
          }
          .np-skip-btn {
            font-size: 28px;
            padding: 12px;
          }
          .np-play-btn {
            width: 64px;
            height: 64px;
            font-size: 24px;
          }
          .np-nav-arrow {
            display: none;
          }
        }

        @media (max-width: 480px) {
          .np-artwork-container {
            max-width: 250px;
            margin-bottom: 25px;
          }
          .np-track-title {
            font-size: 18px;
          }
          .np-track-artist {
            font-size: 14px;
          }
        }
      `}</style>

      <div className="now-playing-overlay" ref={containerRef}>
        <header className="np-header">
          <button className="np-close" onClick={onClose} title="Close (Esc)">
            ↓
          </button>
          <span className="np-title">Now Playing</span>
          <span className="np-queue-info">
            {queue.length > 0 ? `${queueIndex + 1} / ${queue.length + 1}` : ''}
          </span>
        </header>

        <div
          className="np-content"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="np-artwork-container">
            <div
              className="np-artwork-wrapper"
              style={{ transform: getTransform() }}
            >
              {track.coverId ? (
                <img
                  src={`/api/cover/${track.coverId}`}
                  alt=""
                  className="np-artwork-img"
                  draggable={false}
                />
              ) : (
                <div className="np-artwork">🎵</div>
              )}
            </div>
            <span className="np-swipe-hint left">›</span>
            <span className="np-swipe-hint right">‹</span>
          </div>

          <div className="np-track-info">
            <div className="np-track-title">{track.title || 'Unknown'}</div>
            <div className="np-track-artist">{track.artist || 'Unknown Artist'}</div>
          </div>

          <div className="np-progress-section">
            <div className="np-progress-bar" onClick={handleProgressClick}>
              <div className="np-progress-fill" style={{ width: `${progress}%` }}>
                <div className="np-progress-thumb" />
              </div>
            </div>
            <div className="np-times">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="np-controls">
            <button className="np-skip-btn" onClick={onPrev} title="Previous">
              ⏮
            </button>
            <button className="np-play-btn" onClick={onTogglePlay}>
              {isPlaying ? '❚❚' : '▶'}
            </button>
            <button className="np-skip-btn" onClick={onNext} title="Next">
              ⏭
            </button>
          </div>
        </div>

        {/* Desktop navigation arrows */}
        <button className="np-nav-arrow prev" onClick={onPrev} title="Previous (←)">
          ‹
        </button>
        <button className="np-nav-arrow next" onClick={onNext} title="Next (→)">
          ›
        </button>
      </div>
    </>
  );
}

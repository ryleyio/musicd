import React from 'react';
import type { Track } from '../hooks/usePlayer';

interface QueueProps {
  currentTrack: Track | null;
  queue: Track[];
  onClear: () => void;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
  },
  clearButton: {
    background: 'none',
    border: '1px solid #333',
    color: '#999',
    padding: '8px 16px',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  section: {
    marginBottom: '30px',
  },
  sectionTitle: {
    color: '#999',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '15px',
  },
  track: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px',
    borderRadius: '4px',
    marginBottom: '4px',
  },
  currentTrack: {
    background: '#1db95422',
  },
  cover: {
    width: '48px',
    height: '48px',
    background: '#333',
    borderRadius: '4px',
    marginRight: '15px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#666',
    fontSize: '20px',
  },
  coverImg: {
    width: '48px',
    height: '48px',
    borderRadius: '4px',
    objectFit: 'cover',
  },
  info: {
    flex: 1,
  },
  trackTitle: {
    fontWeight: 500,
    marginBottom: '2px',
  },
  trackTitlePlaying: {
    color: '#1db954',
  },
  artist: {
    color: '#999',
    fontSize: '14px',
  },
  empty: {
    color: '#666',
    textAlign: 'center',
    padding: '40px',
  },
};

export default function Queue({ currentTrack, queue, onClear }: QueueProps) {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Queue</h1>
        {queue.length > 0 && (
          <button style={styles.clearButton} onClick={onClear}>
            Clear Queue
          </button>
        )}
      </div>

      {currentTrack && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Now Playing</div>
          <div style={{ ...styles.track, ...styles.currentTrack }}>
            {currentTrack.coverId ? (
              <img src={`/api/cover/${currentTrack.coverId}`} alt="" style={styles.coverImg} />
            ) : (
              <div style={styles.cover}>&#9835;</div>
            )}
            <div style={styles.info}>
              <div style={{ ...styles.trackTitle, ...styles.trackTitlePlaying }}>
                {currentTrack.title || 'Unknown'}
              </div>
              <div style={styles.artist}>{currentTrack.artist || 'Unknown Artist'}</div>
            </div>
          </div>
        </div>
      )}

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Up Next ({queue.length})</div>
        {queue.length === 0 ? (
          <div style={styles.empty}>Queue is empty</div>
        ) : (
          queue.map((track, index) => (
            <div key={`${track.id}-${index}`} style={styles.track}>
              {track.coverId ? (
                <img src={`/api/cover/${track.coverId}`} alt="" style={styles.coverImg} />
              ) : (
                <div style={styles.cover}>&#9835;</div>
              )}
              <div style={styles.info}>
                <div style={styles.trackTitle}>{track.title || 'Unknown'}</div>
                <div style={styles.artist}>{track.artist || 'Unknown Artist'}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

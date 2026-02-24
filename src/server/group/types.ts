// Shared types for group mode WebSocket communication

export interface Track {
  id: number;
  path: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  trackNumber: number | null;
  discNumber: number | null;
  year: number | null;
  duration: number | null;
  genres: string | null;
  fileType: string | null;
  codec: string | null;
  coverId: number | null;
}

// Group playback state
export interface GroupPlaybackState {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  position: number;       // Current playback position in seconds
  lastUpdate: number;     // Timestamp of last position update
}

// Client → Server messages
export type ClientMessage =
  | { type: 'join' }
  | { type: 'leave' }
  | { type: 'play'; track: Track }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'seek'; position: number }
  | { type: 'next' }
  | { type: 'addToQueue'; track: Track }
  | { type: 'heartbeat'; position: number };

// Server → Client messages
export type ServerMessage =
  | { type: 'joined'; state: GroupPlaybackState; memberCount: number }
  | { type: 'memberJoined'; memberCount: number }
  | { type: 'memberLeft'; memberCount: number }
  | { type: 'sync'; state: GroupPlaybackState; serverTime: number }
  | { type: 'play'; track: Track; position: number; serverTime: number }
  | { type: 'pause'; position: number }
  | { type: 'resume'; position: number; serverTime: number }
  | { type: 'seek'; position: number }
  | { type: 'next'; track: Track | null; position: number; serverTime: number }
  | { type: 'addToQueue'; track: Track }
  | { type: 'error'; message: string };

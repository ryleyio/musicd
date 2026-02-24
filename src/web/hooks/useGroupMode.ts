import { useState, useRef, useCallback, useEffect } from 'react';
import type { Track } from './usePlayer';

// Import types inline to avoid server-side imports in the web bundle
interface GroupPlaybackState {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  position: number;
  lastUpdate: number;
}

type ServerMessage =
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

interface PlayerControls {
  externalPlay: (track: Track, position?: number) => void;
  externalSeek: (position: number) => void;
  externalPause: () => void;
  externalResume: () => void;
  externalAddToQueue: (track: Track) => void;
  getCurrentTime: () => number;
}

interface UseGroupModeOptions {
  playerControls: PlayerControls | null;
}

export function useGroupMode({ playerControls }: UseGroupModeOptions) {
  const [isInGroup, setIsInGroup] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Drift correction threshold in seconds
  const DRIFT_THRESHOLD = 0.5;

  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws/group`;
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    heartbeatRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN && playerControls) {
        wsRef.current.send(JSON.stringify({
          type: 'heartbeat',
          position: playerControls.getCurrentTime(),
        }));
      }
    }, 10000); // Every 10 seconds
  }, [playerControls, stopHeartbeat]);

  const handleMessage = useCallback((event: MessageEvent) => {
    if (!playerControls) return;

    try {
      const message: ServerMessage = JSON.parse(event.data);

      switch (message.type) {
        case 'joined':
          setMemberCount(message.memberCount);
          // Sync to current group state
          if (message.state.currentTrack) {
            let position = message.state.position;
            // If playing, adjust for network latency (estimate ~50ms)
            if (message.state.isPlaying) {
              position += 0.05;
            }
            playerControls.externalPlay(message.state.currentTrack, position);
            if (!message.state.isPlaying) {
              playerControls.externalPause();
            }
          }
          // Add queued tracks
          for (const track of message.state.queue) {
            playerControls.externalAddToQueue(track);
          }
          break;

        case 'memberJoined':
        case 'memberLeft':
          setMemberCount(message.memberCount);
          break;

        case 'sync': {
          if (!message.state.currentTrack) break;

          // Calculate expected position with network latency adjustment
          const now = Date.now();
          const latency = (now - message.serverTime) / 1000;
          let expectedPosition = message.state.position;
          if (message.state.isPlaying) {
            expectedPosition += latency;
          }

          // Apply drift correction if needed
          const currentPosition = playerControls.getCurrentTime();
          const drift = Math.abs(currentPosition - expectedPosition);
          if (drift > DRIFT_THRESHOLD) {
            console.log(`[Group] Drift correction: ${drift.toFixed(2)}s`);
            playerControls.externalSeek(expectedPosition);
          }
          break;
        }

        case 'play': {
          const now = Date.now();
          const latency = (now - message.serverTime) / 1000;
          const adjustedPosition = message.position + latency;
          playerControls.externalPlay(message.track, adjustedPosition);
          break;
        }

        case 'pause':
          playerControls.externalSeek(message.position);
          playerControls.externalPause();
          break;

        case 'resume': {
          const now = Date.now();
          const latency = (now - message.serverTime) / 1000;
          const adjustedPosition = message.position + latency;
          playerControls.externalSeek(adjustedPosition);
          playerControls.externalResume();
          break;
        }

        case 'seek':
          playerControls.externalSeek(message.position);
          break;

        case 'next': {
          if (message.track) {
            const now = Date.now();
            const latency = (now - message.serverTime) / 1000;
            const adjustedPosition = message.position + latency;
            playerControls.externalPlay(message.track, adjustedPosition);
          } else {
            playerControls.externalPause();
          }
          break;
        }

        case 'addToQueue':
          playerControls.externalAddToQueue(message.track);
          break;

        case 'error':
          console.error('[Group] Server error:', message.message);
          break;
      }
    } catch (error) {
      console.error('[Group] Failed to parse message:', error);
    }
  }, [playerControls]);

  const disconnect = useCallback(() => {
    stopHeartbeat();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsInGroup(false);
    setMemberCount(0);
    setIsConnecting(false);
    reconnectAttempts.current = 0;
  }, [stopHeartbeat]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setIsConnecting(true);
    const ws = new WebSocket(getWebSocketUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[Group] Connected');
      setIsConnecting(false);
      setIsInGroup(true);
      reconnectAttempts.current = 0;
      ws.send(JSON.stringify({ type: 'join' }));
      startHeartbeat();
    };

    ws.onmessage = handleMessage;

    ws.onclose = () => {
      console.log('[Group] Disconnected');
      stopHeartbeat();

      // Attempt reconnection if was in group
      if (isInGroup && reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        console.log(`[Group] Reconnecting... attempt ${reconnectAttempts.current}`);
        setTimeout(connect, 1000 * reconnectAttempts.current);
      } else {
        setIsInGroup(false);
        setMemberCount(0);
        setIsConnecting(false);
      }
    };

    ws.onerror = (error) => {
      console.error('[Group] WebSocket error:', error);
      setIsConnecting(false);
    };
  }, [getWebSocketUrl, handleMessage, startHeartbeat, stopHeartbeat, isInGroup]);

  // Handle tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Pause heartbeat when tab is hidden
        stopHeartbeat();
      } else if (isInGroup) {
        // Resume heartbeat and request sync when tab is visible
        startHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isInGroup, startHeartbeat, stopHeartbeat]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const joinGroup = useCallback(() => {
    if (!isInGroup && !isConnecting) {
      connect();
    }
  }, [isInGroup, isConnecting, connect]);

  const leaveGroup = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'leave' }));
    }
    disconnect();
  }, [disconnect]);

  // Broadcast actions to the group
  const broadcastPlay = useCallback((track: Track) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'play', track }));
    }
  }, []);

  const broadcastPause = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'pause' }));
    }
  }, []);

  const broadcastResume = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'resume' }));
    }
  }, []);

  const broadcastSeek = useCallback((position: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'seek', position }));
    }
  }, []);

  const broadcastNext = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'next' }));
    }
  }, []);

  const broadcastAddToQueue = useCallback((track: Track) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'addToQueue', track }));
    }
  }, []);

  return {
    isInGroup,
    isConnecting,
    memberCount,
    joinGroup,
    leaveGroup,
    broadcastPlay,
    broadcastPause,
    broadcastResume,
    broadcastSeek,
    broadcastNext,
    broadcastAddToQueue,
  };
}

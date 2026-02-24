import type { WebSocket } from '@fastify/websocket';
import type { GroupPlaybackState, ServerMessage, Track, ClientMessage } from './types.js';

interface Member {
  ws: WebSocket;
  lastHeartbeat: number;
}

export class GroupState {
  private members: Map<string, Member> = new Map();
  private state: GroupPlaybackState = {
    currentTrack: null,
    queue: [],
    isPlaying: false,
    position: 0,
    lastUpdate: Date.now(),
  };
  private syncInterval: NodeJS.Timeout | null = null;
  private heartbeatCheckInterval: NodeJS.Timeout | null = null;
  private stateExpiryTimeout: NodeJS.Timeout | null = null;

  private static instance: GroupState | null = null;

  static getInstance(): GroupState {
    if (!GroupState.instance) {
      GroupState.instance = new GroupState();
    }
    return GroupState.instance;
  }

  private constructor() {
    // Start heartbeat check interval
    this.heartbeatCheckInterval = setInterval(() => {
      this.checkHeartbeats();
    }, 10000); // Check every 10 seconds
  }

  private generateMemberId(): string {
    return `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCurrentPosition(): number {
    if (!this.state.isPlaying) {
      return this.state.position;
    }
    // Calculate current position based on elapsed time since last update
    const elapsed = (Date.now() - this.state.lastUpdate) / 1000;
    return this.state.position + elapsed;
  }

  private updatePosition(position: number): void {
    this.state.position = position;
    this.state.lastUpdate = Date.now();
  }

  addMember(ws: WebSocket): string {
    const memberId = this.generateMemberId();
    this.members.set(memberId, {
      ws,
      lastHeartbeat: Date.now(),
    });

    // Clear state expiry timeout if it exists
    if (this.stateExpiryTimeout) {
      clearTimeout(this.stateExpiryTimeout);
      this.stateExpiryTimeout = null;
    }

    // Start sync interval if this is the first member
    if (this.members.size === 1 && !this.syncInterval) {
      this.startSyncInterval();
    }

    // Send current state to the new member
    const currentPosition = this.getCurrentPosition();
    this.sendTo(memberId, {
      type: 'joined',
      state: { ...this.state, position: currentPosition },
      memberCount: this.members.size,
    });

    // Notify all other members
    this.broadcastExcept(memberId, {
      type: 'memberJoined',
      memberCount: this.members.size,
    });

    console.log(`[Group] Member ${memberId} joined. Total: ${this.members.size}`);
    return memberId;
  }

  removeMember(memberId: string): void {
    const member = this.members.get(memberId);
    if (!member) return;

    this.members.delete(memberId);
    console.log(`[Group] Member ${memberId} left. Total: ${this.members.size}`);

    // Notify remaining members
    this.broadcast({
      type: 'memberLeft',
      memberCount: this.members.size,
    });

    // If no members left, set state to expire after 5 minutes
    if (this.members.size === 0) {
      this.stopSyncInterval();
      this.stateExpiryTimeout = setTimeout(() => {
        this.resetState();
      }, 5 * 60 * 1000);
    }
  }

  handleMessage(memberId: string, message: ClientMessage): void {
    const member = this.members.get(memberId);
    if (!member) return;

    // Update heartbeat timestamp
    member.lastHeartbeat = Date.now();

    switch (message.type) {
      case 'play':
        this.handlePlay(message.track);
        break;
      case 'pause':
        this.handlePause();
        break;
      case 'resume':
        this.handleResume();
        break;
      case 'seek':
        this.handleSeek(message.position);
        break;
      case 'next':
        this.handleNext();
        break;
      case 'addToQueue':
        this.handleAddToQueue(message.track);
        break;
      case 'heartbeat':
        // Just update heartbeat timestamp (already done above)
        break;
      case 'leave':
        this.removeMember(memberId);
        break;
    }
  }

  private handlePlay(track: Track): void {
    this.state.currentTrack = track;
    this.state.isPlaying = true;
    this.updatePosition(0);

    this.broadcast({
      type: 'play',
      track,
      position: 0,
      serverTime: Date.now(),
    });
  }

  private handlePause(): void {
    const currentPosition = this.getCurrentPosition();
    this.state.isPlaying = false;
    this.updatePosition(currentPosition);

    this.broadcast({
      type: 'pause',
      position: currentPosition,
    });
  }

  private handleResume(): void {
    this.state.isPlaying = true;
    this.state.lastUpdate = Date.now();

    this.broadcast({
      type: 'resume',
      position: this.state.position,
      serverTime: Date.now(),
    });
  }

  private handleSeek(position: number): void {
    this.updatePosition(position);

    this.broadcast({
      type: 'seek',
      position,
    });
  }

  private handleNext(): void {
    if (this.state.queue.length > 0) {
      const [next, ...rest] = this.state.queue;
      this.state.currentTrack = next;
      this.state.queue = rest;
      this.state.isPlaying = true;
      this.updatePosition(0);

      this.broadcast({
        type: 'next',
        track: next,
        position: 0,
        serverTime: Date.now(),
      });
    } else {
      // No more tracks in queue
      this.state.isPlaying = false;
      this.updatePosition(0);

      this.broadcast({
        type: 'next',
        track: null,
        position: 0,
        serverTime: Date.now(),
      });
    }
  }

  private handleAddToQueue(track: Track): void {
    this.state.queue.push(track);

    this.broadcast({
      type: 'addToQueue',
      track,
    });
  }

  private startSyncInterval(): void {
    // Send sync every 5 seconds when playing
    this.syncInterval = setInterval(() => {
      if (this.state.isPlaying && this.members.size > 0) {
        const currentPosition = this.getCurrentPosition();
        this.broadcast({
          type: 'sync',
          state: { ...this.state, position: currentPosition },
          serverTime: Date.now(),
        });
      }
    }, 5000);
  }

  private stopSyncInterval(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private checkHeartbeats(): void {
    const now = Date.now();
    const timeout = 30000; // 30 seconds

    for (const [memberId, member] of this.members) {
      if (now - member.lastHeartbeat > timeout) {
        console.log(`[Group] Member ${memberId} timed out`);
        this.removeMember(memberId);
        try {
          member.ws.close();
        } catch {
          // Ignore close errors
        }
      }
    }
  }

  private resetState(): void {
    this.state = {
      currentTrack: null,
      queue: [],
      isPlaying: false,
      position: 0,
      lastUpdate: Date.now(),
    };
    console.log('[Group] State reset after timeout');
  }

  private sendTo(memberId: string, message: ServerMessage): void {
    const member = this.members.get(memberId);
    if (member && member.ws.readyState === member.ws.OPEN) {
      try {
        member.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`[Group] Failed to send to ${memberId}:`, error);
      }
    }
  }

  private broadcast(message: ServerMessage): void {
    const data = JSON.stringify(message);
    for (const [memberId, member] of this.members) {
      if (member.ws.readyState === member.ws.OPEN) {
        try {
          member.ws.send(data);
        } catch (error) {
          console.error(`[Group] Failed to broadcast to ${memberId}:`, error);
        }
      }
    }
  }

  private broadcastExcept(excludeId: string, message: ServerMessage): void {
    const data = JSON.stringify(message);
    for (const [memberId, member] of this.members) {
      if (memberId !== excludeId && member.ws.readyState === member.ws.OPEN) {
        try {
          member.ws.send(data);
        } catch (error) {
          console.error(`[Group] Failed to broadcast to ${memberId}:`, error);
        }
      }
    }
  }

  getMemberCount(): number {
    return this.members.size;
  }
}

import type { FastifyInstance } from 'fastify';
import { GroupState } from '../group/GroupState.js';
import type { ClientMessage } from '../group/types.js';

export function registerWebSocketRoutes(app: FastifyInstance): void {
  const groupState = GroupState.getInstance();

  app.get('/ws/group', { websocket: true }, (socket, _req) => {
    const memberId = groupState.addMember(socket);

    socket.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());
        groupState.handleMessage(memberId, message);
      } catch (err) {
        console.error('[WebSocket] Failed to parse message:', err);
        socket.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    socket.on('close', () => {
      groupState.removeMember(memberId);
    });

    socket.on('error', (err: Error) => {
      console.error('[WebSocket] Socket error:', err);
      groupState.removeMember(memberId);
    });
  });
}

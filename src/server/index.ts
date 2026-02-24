import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './db/schema.js';
import { MusicDatabase } from './db/queries.js';
import { registerApiRoutes } from './routes/api.js';
import { registerStreamRoutes } from './routes/stream.js';
import { registerWebSocketRoutes } from './routes/websocket.js';
import { scanDirectory } from '../cli/scan.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ServerOptions {
  dbPath: string;
  port: number;
  host?: string;
  musicPath?: string;
}

export async function startServer(options: ServerOptions) {
  const { dbPath, port, host = '0.0.0.0', musicPath } = options;

  const rawDb = await initDatabase(dbPath);
  const db = new MusicDatabase(rawDb);

  // Scan if music path provided and database is empty
  if (musicPath) {
    const stats = db.getStats();
    if (stats.trackCount === 0) {
      console.log('Database is empty, scanning music library...');
      await scanDirectory(musicPath, db, { verbose: false });
    }
  }

  const app = Fastify({ logger: false });

  // CORS for development
  await app.register(fastifyCors, {
    origin: true,
  });

  // WebSocket support for group mode
  await app.register(fastifyWebsocket);
  registerWebSocketRoutes(app);

  // Register API routes
  registerApiRoutes(app, db);
  registerStreamRoutes(app, db);

  // Rescan endpoint
  app.post<{ Body: { path?: string } }>('/api/rescan', async (request) => {
    const scanPath = request.body?.path || musicPath;
    if (!scanPath) {
      return { error: 'No music path configured' };
    }
    await scanDirectory(scanPath, db, { verbose: false });
    return db.getStats();
  });

  // Serve static web UI if built
  const webDir = join(__dirname, '../web');
  if (existsSync(webDir)) {
    await app.register(fastifyStatic, {
      root: webDir,
      prefix: '/',
    });

    // SPA fallback
    app.setNotFoundHandler((_, reply) => {
      reply.sendFile('index.html');
    });
  } else {
    app.get('/', async () => {
      return { message: 'musicd API server running. Web UI not built yet.' };
    });
  }

  await app.listen({ port, host });
  console.log(`musicd server running at http://localhost:${port}`);

  return app;
}

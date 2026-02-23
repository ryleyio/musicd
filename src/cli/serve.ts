import { startServer, type ServerOptions } from '../server/index.js';

export async function serve(options: ServerOptions) {
  await startServer(options);
}

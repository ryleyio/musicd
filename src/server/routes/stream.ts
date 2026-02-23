import type { FastifyInstance } from 'fastify';
import { spawn, execSync } from 'child_process';
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import type { MusicDatabase } from '../db/queries.js';

// Check if ffmpeg is available
function checkFfmpeg(): boolean {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const FFMPEG_AVAILABLE = checkFfmpeg();
const CACHE_DIR = join(process.env.HOME || '/tmp', '.musicd', 'cache');

// Ensure cache directory exists
if (!existsSync(CACHE_DIR)) {
  mkdirSync(CACHE_DIR, { recursive: true });
}

// Browser-safe formats that don't need transcoding
const BROWSER_SAFE_FORMATS = new Set(['MP3', 'AAC', 'OGG', 'OPUS', 'M4A']);

export function registerStreamRoutes(app: FastifyInstance, db: MusicDatabase) {
  // Check ffmpeg status
  app.get('/api/ffmpeg-status', async () => {
    return { available: FFMPEG_AVAILABLE };
  });

  // Stream audio
  app.get<{ Params: { id: string } }>('/api/stream/:id', async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    const track = db.getTrack(id);

    if (!track) {
      return reply.status(404).send({ error: 'Track not found' });
    }

    if (!existsSync(track.path)) {
      return reply.status(404).send({ error: 'File not found' });
    }

    const fileType = track.fileType?.toUpperCase() || '';
    const needsTranscode = !BROWSER_SAFE_FORMATS.has(fileType);

    if (!needsTranscode) {
      // Serve directly
      const stat = statSync(track.path);
      const mimeType = getMimeType(fileType);

      const range = request.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkSize = end - start + 1;

        reply.header('Content-Range', `bytes ${start}-${end}/${stat.size}`);
        reply.header('Accept-Ranges', 'bytes');
        reply.header('Content-Length', chunkSize);
        reply.header('Content-Type', mimeType);
        reply.status(206);

        return createReadStream(track.path, { start, end });
      }

      reply.header('Content-Type', mimeType);
      reply.header('Content-Length', stat.size);
      reply.header('Accept-Ranges', 'bytes');

      return createReadStream(track.path);
    }

    // Needs transcoding
    if (!FFMPEG_AVAILABLE) {
      return reply.status(503).send({
        error: 'ffmpeg is required to play this format',
        message: 'Please install ffmpeg to play FLAC and WAV files',
      });
    }

    // Check cache
    const cacheKey = createHash('sha256')
      .update(`${track.path}:${track.mtime}:${track.size}`)
      .digest('hex');
    const cachePath = join(CACHE_DIR, `${cacheKey}.ogg`);

    if (existsSync(cachePath)) {
      // Serve from cache
      const stat = statSync(cachePath);
      reply.header('Content-Type', 'audio/ogg');
      reply.header('Content-Length', stat.size);
      reply.header('Accept-Ranges', 'bytes');
      return createReadStream(cachePath);
    }

    // Transcode on-the-fly to Opus/Ogg
    // We pipe directly to the response for streaming
    reply.header('Content-Type', 'audio/ogg');
    reply.header('Transfer-Encoding', 'chunked');

    const ffmpeg = spawn('ffmpeg', [
      '-i', track.path,
      '-c:a', 'libopus',
      '-b:a', '128k',
      '-vn',           // No video
      '-f', 'ogg',
      '-'              // Output to stdout
    ], {
      stdio: ['ignore', 'pipe', 'ignore']
    });

    // Also write to cache for future requests
    const cacheStream = createWriteStream(cachePath);
    ffmpeg.stdout.pipe(cacheStream);

    return reply.send(ffmpeg.stdout);
  });
}

function getMimeType(fileType: string): string {
  const types: Record<string, string> = {
    'MP3': 'audio/mpeg',
    'M4A': 'audio/mp4',
    'AAC': 'audio/aac',
    'OGG': 'audio/ogg',
    'OPUS': 'audio/opus',
    'FLAC': 'audio/flac',
    'WAV': 'audio/wav',
    'AIFF': 'audio/aiff',
  };
  return types[fileType] || 'application/octet-stream';
}

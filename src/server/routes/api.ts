import type { FastifyInstance } from 'fastify';
import type { MusicDatabase } from '../db/queries.js';

export function registerApiRoutes(app: FastifyInstance, db: MusicDatabase) {
  // Get all artists
  app.get('/api/artists', async () => {
    return db.getArtists();
  });

  // Get albums by artist
  app.get<{ Params: { name: string } }>('/api/artists/:name/albums', async (request) => {
    const name = decodeURIComponent(request.params.name);
    return db.getAlbumsByArtist(name);
  });

  // Get all albums
  app.get('/api/albums', async () => {
    return db.getAlbums();
  });

  // Get tracks in album
  app.get<{ Querystring: { album: string; artist: string } }>('/api/albums/tracks', async (request) => {
    const { album, artist } = request.query;
    return db.getTracksByAlbum(album, artist);
  });

  // Get all tracks
  app.get('/api/tracks', async () => {
    return db.getTracks();
  });

  // Get single track
  app.get<{ Params: { id: string } }>('/api/tracks/:id', async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    const track = db.getTrack(id);
    if (!track) {
      return reply.status(404).send({ error: 'Track not found' });
    }
    return track;
  });

  // Get cover art
  app.get<{ Params: { id: string } }>('/api/cover/:id', async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    const cover = db.getCover(id);
    if (!cover) {
      return reply.status(404).send({ error: 'Cover not found' });
    }
    // Convert Uint8Array to Buffer for proper response
    const data = Buffer.from(cover.data);
    return reply
      .header('Content-Type', cover.mimeType)
      .header('Cache-Control', 'public, max-age=31536000')
      .send(data);
  });

  // Search
  app.get<{ Querystring: { q: string } }>('/api/search', async (request) => {
    const { q } = request.query;
    if (!q || q.length < 1) {
      return { tracks: [], albums: [], artists: [] };
    }
    return db.search(q);
  });

  // Library stats
  app.get('/api/stats', async () => {
    return db.getStats();
  });
}

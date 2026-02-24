import type { FastifyInstance } from 'fastify';
import type { MusicDatabase } from '../db/queries.js';
import { fetchAlbumCover } from '../cover-fetcher.js';

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

  // Get album cover (checks embedded first, then fetched)
  app.get<{ Querystring: { artist: string; album: string } }>('/api/album-cover', async (request, reply) => {
    const { artist, album } = request.query;

    if (!artist || !album) {
      return reply.status(400).send({ error: 'artist and album parameters required' });
    }

    // First check for embedded cover from tracks
    const embeddedCoverId = db.getAlbumEmbeddedCoverId(artist, album);
    if (embeddedCoverId) {
      const cover = db.getCover(embeddedCoverId);
      if (cover) {
        const data = Buffer.from(cover.data);
        return reply
          .header('Content-Type', cover.mimeType)
          .header('Cache-Control', 'public, max-age=31536000')
          .send(data);
      }
    }

    // Then check for fetched cover
    const albumCover = db.getAlbumCover(artist, album);
    if (albumCover) {
      const data = Buffer.from(albumCover.data);
      return reply
        .header('Content-Type', albumCover.mimeType)
        .header('Cache-Control', 'public, max-age=31536000')
        .send(data);
    }

    return reply.status(404).send({ error: 'No cover found' });
  });

  // Manually trigger fetch for an album cover
  app.post<{ Body: { artist: string; album: string } }>('/api/album-cover/fetch', async (request, reply) => {
    const { artist, album } = request.body || {};

    if (!artist || !album) {
      return reply.status(400).send({ error: 'artist and album required in body' });
    }

    // Check if already cached
    const existing = db.getAlbumCover(artist, album);
    if (existing) {
      return { success: true, cached: true, source: existing.source };
    }

    // Fetch from external source
    const cover = await fetchAlbumCover(artist, album);
    if (!cover) {
      return reply.status(404).send({ error: 'Could not find cover art for this album' });
    }

    // Cache it
    db.upsertAlbumCover(artist, album, cover.data, cover.mimeType, cover.source);

    return { success: true, cached: false, source: cover.source };
  });

  // List albums without any cover (embedded or fetched)
  app.get('/api/albums-missing-covers', async () => {
    return db.getAlbumsMissingCovers();
  });
}

import type { Database } from 'sql.js';
import { createHash } from 'crypto';
import { saveDatabase } from './schema.js';

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
  mtime: number;
  size: number;
}

export interface Cover {
  id: number;
  hash: string;
  data: Uint8Array;
  mimeType: string;
}

export interface AlbumCover {
  id: number;
  artist: string;
  album: string;
  data: Uint8Array;
  mimeType: string;
  source: string;
  fetchedAt: number;
}

export interface TrackInput {
  path: string;
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  trackNumber?: number;
  discNumber?: number;
  year?: number;
  duration?: number;
  genres?: string[];
  fileType?: string;
  codec?: string;
  coverData?: Buffer;
  coverMimeType?: string;
  mtime: number;
  size: number;
}

// Helper to convert sql.js results to array of objects
function queryAll<T>(db: Database, sql: string, params: any[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row as T);
  }
  stmt.free();
  return results;
}

function queryOne<T>(db: Database, sql: string, params: any[] = []): T | undefined {
  const results = queryAll<T>(db, sql, params);
  return results[0];
}

function run(db: Database, sql: string, params: any[] = []): { lastId: number; changes: number } {
  db.run(sql, params);
  const lastId = db.exec('SELECT last_insert_rowid() as id')[0]?.values[0]?.[0] as number || 0;
  const changes = db.exec('SELECT changes() as c')[0]?.values[0]?.[0] as number || 0;
  return { lastId, changes };
}

export class MusicDatabase {
  constructor(private db: Database) {}

  getTrackFingerprint(path: string): { mtime: number; size: number } | null {
    const result = queryOne<{ mtime: number; size: number }>(
      this.db,
      'SELECT mtime, size FROM tracks WHERE path = ?',
      [path]
    );
    return result || null;
  }

  upsertCover(data: Buffer, mimeType: string): number {
    const hash = createHash('sha256').update(data).digest('hex');

    const existing = queryOne<{ id: number }>(
      this.db,
      'SELECT id FROM covers WHERE hash = ?',
      [hash]
    );
    if (existing) return existing.id;

    const { lastId } = run(
      this.db,
      'INSERT INTO covers (hash, data, mimeType) VALUES (?, ?, ?)',
      [hash, data, mimeType]
    );

    return lastId;
  }

  upsertTrack(input: TrackInput): void {
    let coverId: number | null = null;
    if (input.coverData && input.coverMimeType) {
      coverId = this.upsertCover(input.coverData, input.coverMimeType);
    }

    run(this.db, `
      INSERT INTO tracks (path, title, artist, album, albumArtist, trackNumber, discNumber, year, duration, genres, fileType, codec, coverId, mtime, size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        title = excluded.title,
        artist = excluded.artist,
        album = excluded.album,
        albumArtist = excluded.albumArtist,
        trackNumber = excluded.trackNumber,
        discNumber = excluded.discNumber,
        year = excluded.year,
        duration = excluded.duration,
        genres = excluded.genres,
        fileType = excluded.fileType,
        codec = excluded.codec,
        coverId = excluded.coverId,
        mtime = excluded.mtime,
        size = excluded.size
    `, [
      input.path,
      input.title ?? null,
      input.artist ?? null,
      input.album ?? null,
      input.albumArtist ?? null,
      input.trackNumber ?? null,
      input.discNumber ?? null,
      input.year ?? null,
      input.duration ?? null,
      input.genres ? JSON.stringify(input.genres) : null,
      input.fileType ?? null,
      input.codec ?? null,
      coverId,
      input.mtime,
      input.size
    ]);

    saveDatabase();
  }

  getAllPaths(): string[] {
    const rows = queryAll<{ path: string }>(this.db, 'SELECT path FROM tracks');
    return rows.map(r => r.path);
  }

  deleteTrack(path: string): void {
    run(this.db, 'DELETE FROM tracks WHERE path = ?', [path]);
    saveDatabase();
  }

  cleanupOrphanedCovers(): void {
    run(this.db, `
      DELETE FROM covers WHERE id NOT IN (SELECT DISTINCT coverId FROM tracks WHERE coverId IS NOT NULL)
    `);
    saveDatabase();
  }

  getArtists(): { name: string; trackCount: number }[] {
    return queryAll(this.db, `
      SELECT COALESCE(albumArtist, artist, 'Unknown Artist') as name, COUNT(*) as trackCount
      FROM tracks
      GROUP BY name
      ORDER BY name COLLATE NOCASE
    `);
  }

  getAlbums(): { album: string; artist: string; coverId: number | null; trackCount: number; year: number | null }[] {
    return queryAll(this.db, `
      SELECT
        COALESCE(album, 'Unknown Album') as album,
        COALESCE(albumArtist, artist, 'Unknown Artist') as artist,
        MAX(coverId) as coverId,
        COUNT(*) as trackCount,
        MAX(year) as year
      FROM tracks
      GROUP BY COALESCE(album, 'Unknown Album'), COALESCE(albumArtist, artist, 'Unknown Artist')
      ORDER BY album COLLATE NOCASE
    `);
  }

  getAlbumsByArtist(artist: string): { album: string; artist: string; coverId: number | null; trackCount: number; year: number | null }[] {
    return queryAll(this.db, `
      SELECT
        COALESCE(album, 'Unknown Album') as album,
        COALESCE(albumArtist, artist, 'Unknown Artist') as artist,
        MAX(coverId) as coverId,
        COUNT(*) as trackCount,
        MAX(year) as year
      FROM tracks
      WHERE COALESCE(albumArtist, artist, 'Unknown Artist') = ?
      GROUP BY COALESCE(album, 'Unknown Album')
      ORDER BY year DESC, album COLLATE NOCASE
    `, [artist]);
  }

  getTracks(): Track[] {
    return queryAll(this.db, `
      SELECT * FROM tracks ORDER BY
        COALESCE(albumArtist, artist, 'Unknown Artist') COLLATE NOCASE,
        COALESCE(album, 'Unknown Album') COLLATE NOCASE,
        COALESCE(discNumber, 1),
        COALESCE(trackNumber, 999)
    `);
  }

  getTracksByAlbum(album: string, artist: string): Track[] {
    return queryAll(this.db, `
      SELECT * FROM tracks
      WHERE COALESCE(album, 'Unknown Album') = ?
        AND COALESCE(albumArtist, artist, 'Unknown Artist') = ?
      ORDER BY COALESCE(discNumber, 1), COALESCE(trackNumber, 999)
    `, [album, artist]);
  }

  getTrack(id: number): Track | undefined {
    return queryOne(this.db, 'SELECT * FROM tracks WHERE id = ?', [id]);
  }

  getCover(id: number): Cover | undefined {
    return queryOne(this.db, 'SELECT * FROM covers WHERE id = ?', [id]);
  }

  search(query: string): { tracks: Track[]; albums: { album: string; artist: string; coverId: number | null }[]; artists: string[] } {
    const pattern = `%${query}%`;

    const tracks = queryAll<Track>(this.db, `
      SELECT * FROM tracks
      WHERE title LIKE ? OR artist LIKE ? OR album LIKE ? OR albumArtist LIKE ?
      LIMIT 50
    `, [pattern, pattern, pattern, pattern]);

    const albums = queryAll<{ album: string; artist: string; coverId: number | null }>(this.db, `
      SELECT DISTINCT
        COALESCE(album, 'Unknown Album') as album,
        COALESCE(albumArtist, artist, 'Unknown Artist') as artist,
        MAX(coverId) as coverId
      FROM tracks
      WHERE album LIKE ? OR albumArtist LIKE ?
      GROUP BY album, artist
      LIMIT 20
    `, [pattern, pattern]);

    const artistRows = queryAll<{ name: string }>(this.db, `
      SELECT DISTINCT COALESCE(albumArtist, artist, 'Unknown Artist') as name
      FROM tracks
      WHERE artist LIKE ? OR albumArtist LIKE ?
      LIMIT 20
    `, [pattern, pattern]);
    const artists = artistRows.map(r => r.name);

    return { tracks, albums, artists };
  }

  getStats(): { trackCount: number; artistCount: number; albumCount: number } {
    const trackCount = queryOne<{ count: number }>(this.db, 'SELECT COUNT(*) as count FROM tracks')?.count || 0;
    const artistCount = queryOne<{ count: number }>(this.db, 'SELECT COUNT(DISTINCT COALESCE(albumArtist, artist)) as count FROM tracks')?.count || 0;
    const albumCount = queryOne<{ count: number }>(this.db, 'SELECT COUNT(DISTINCT album) as count FROM tracks')?.count || 0;
    return { trackCount, artistCount, albumCount };
  }

  // Album cover methods for externally fetched covers
  getAlbumCover(artist: string, album: string): AlbumCover | undefined {
    return queryOne<AlbumCover>(
      this.db,
      'SELECT * FROM album_covers WHERE artist = ? AND album = ?',
      [artist, album]
    );
  }

  upsertAlbumCover(artist: string, album: string, data: Buffer, mimeType: string, source: string): number {
    const fetchedAt = Date.now();

    run(this.db, `
      INSERT INTO album_covers (artist, album, data, mimeType, source, fetchedAt)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(artist, album) DO UPDATE SET
        data = excluded.data,
        mimeType = excluded.mimeType,
        source = excluded.source,
        fetchedAt = excluded.fetchedAt
    `, [artist, album, data, mimeType, source, fetchedAt]);

    saveDatabase();

    const result = queryOne<{ id: number }>(
      this.db,
      'SELECT id FROM album_covers WHERE artist = ? AND album = ?',
      [artist, album]
    );
    return result?.id || 0;
  }

  getAlbumsMissingCovers(): { album: string; artist: string; trackCount: number }[] {
    return queryAll(this.db, `
      SELECT
        COALESCE(t.album, 'Unknown Album') as album,
        COALESCE(t.albumArtist, t.artist, 'Unknown Artist') as artist,
        COUNT(*) as trackCount
      FROM tracks t
      WHERE t.coverId IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM album_covers ac
          WHERE ac.artist = COALESCE(t.albumArtist, t.artist, 'Unknown Artist')
            AND ac.album = COALESCE(t.album, 'Unknown Album')
        )
      GROUP BY COALESCE(t.album, 'Unknown Album'), COALESCE(t.albumArtist, t.artist, 'Unknown Artist')
      ORDER BY album COLLATE NOCASE
    `);
  }

  // Check if an album has any embedded cover (from tracks)
  getAlbumEmbeddedCoverId(artist: string, album: string): number | null {
    const result = queryOne<{ coverId: number | null }>(
      this.db,
      `SELECT MAX(coverId) as coverId FROM tracks
       WHERE COALESCE(album, 'Unknown Album') = ?
         AND COALESCE(albumArtist, artist, 'Unknown Artist') = ?
         AND coverId IS NOT NULL`,
      [album, artist]
    );
    return result?.coverId ?? null;
  }
}

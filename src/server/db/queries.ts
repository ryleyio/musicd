import type Database from 'better-sqlite3';
import { createHash } from 'crypto';

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
  data: Buffer;
  mimeType: string;
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

export class MusicDatabase {
  constructor(private db: Database.Database) {}

  getTrackFingerprint(path: string): { mtime: number; size: number } | null {
    const stmt = this.db.prepare('SELECT mtime, size FROM tracks WHERE path = ?');
    return stmt.get(path) as { mtime: number; size: number } | null;
  }

  upsertCover(data: Buffer, mimeType: string): number {
    const hash = createHash('sha256').update(data).digest('hex');

    const existing = this.db.prepare('SELECT id FROM covers WHERE hash = ?').get(hash) as { id: number } | undefined;
    if (existing) return existing.id;

    const result = this.db.prepare(
      'INSERT INTO covers (hash, data, mimeType) VALUES (?, ?, ?)'
    ).run(hash, data, mimeType);

    return result.lastInsertRowid as number;
  }

  upsertTrack(input: TrackInput): void {
    let coverId: number | null = null;
    if (input.coverData && input.coverMimeType) {
      coverId = this.upsertCover(input.coverData, input.coverMimeType);
    }

    const stmt = this.db.prepare(`
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
    `);

    stmt.run(
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
    );
  }

  getAllPaths(): string[] {
    const rows = this.db.prepare('SELECT path FROM tracks').all() as { path: string }[];
    return rows.map(r => r.path);
  }

  deleteTrack(path: string): void {
    this.db.prepare('DELETE FROM tracks WHERE path = ?').run(path);
  }

  cleanupOrphanedCovers(): void {
    this.db.prepare(`
      DELETE FROM covers WHERE id NOT IN (SELECT DISTINCT coverId FROM tracks WHERE coverId IS NOT NULL)
    `).run();
  }

  getArtists(): { name: string; trackCount: number }[] {
    return this.db.prepare(`
      SELECT COALESCE(albumArtist, artist, 'Unknown Artist') as name, COUNT(*) as trackCount
      FROM tracks
      GROUP BY name
      ORDER BY name COLLATE NOCASE
    `).all() as { name: string; trackCount: number }[];
  }

  getAlbums(): { album: string; artist: string; coverId: number | null; trackCount: number; year: number | null }[] {
    return this.db.prepare(`
      SELECT
        COALESCE(album, 'Unknown Album') as album,
        COALESCE(albumArtist, artist, 'Unknown Artist') as artist,
        MAX(coverId) as coverId,
        COUNT(*) as trackCount,
        MAX(year) as year
      FROM tracks
      GROUP BY COALESCE(album, 'Unknown Album'), COALESCE(albumArtist, artist, 'Unknown Artist')
      ORDER BY album COLLATE NOCASE
    `).all() as { album: string; artist: string; coverId: number | null; trackCount: number; year: number | null }[];
  }

  getAlbumsByArtist(artist: string): { album: string; artist: string; coverId: number | null; trackCount: number; year: number | null }[] {
    return this.db.prepare(`
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
    `).all(artist) as { album: string; artist: string; coverId: number | null; trackCount: number; year: number | null }[];
  }

  getTracks(): Track[] {
    return this.db.prepare(`
      SELECT * FROM tracks ORDER BY
        COALESCE(albumArtist, artist, 'Unknown Artist') COLLATE NOCASE,
        COALESCE(album, 'Unknown Album') COLLATE NOCASE,
        COALESCE(discNumber, 1),
        COALESCE(trackNumber, 999)
    `).all() as Track[];
  }

  getTracksByAlbum(album: string, artist: string): Track[] {
    return this.db.prepare(`
      SELECT * FROM tracks
      WHERE COALESCE(album, 'Unknown Album') = ?
        AND COALESCE(albumArtist, artist, 'Unknown Artist') = ?
      ORDER BY COALESCE(discNumber, 1), COALESCE(trackNumber, 999)
    `).all(album, artist) as Track[];
  }

  getTrack(id: number): Track | undefined {
    return this.db.prepare('SELECT * FROM tracks WHERE id = ?').get(id) as Track | undefined;
  }

  getCover(id: number): Cover | undefined {
    return this.db.prepare('SELECT * FROM covers WHERE id = ?').get(id) as Cover | undefined;
  }

  search(query: string): { tracks: Track[]; albums: { album: string; artist: string; coverId: number | null }[]; artists: string[] } {
    const pattern = `%${query}%`;

    const tracks = this.db.prepare(`
      SELECT * FROM tracks
      WHERE title LIKE ? OR artist LIKE ? OR album LIKE ? OR albumArtist LIKE ?
      LIMIT 50
    `).all(pattern, pattern, pattern, pattern) as Track[];

    const albums = this.db.prepare(`
      SELECT DISTINCT
        COALESCE(album, 'Unknown Album') as album,
        COALESCE(albumArtist, artist, 'Unknown Artist') as artist,
        MAX(coverId) as coverId
      FROM tracks
      WHERE album LIKE ? OR albumArtist LIKE ?
      GROUP BY album, artist
      LIMIT 20
    `).all(pattern, pattern) as { album: string; artist: string; coverId: number | null }[];

    const artistRows = this.db.prepare(`
      SELECT DISTINCT COALESCE(albumArtist, artist, 'Unknown Artist') as name
      FROM tracks
      WHERE artist LIKE ? OR albumArtist LIKE ?
      LIMIT 20
    `).all(pattern, pattern) as { name: string }[];
    const artists = artistRows.map(r => r.name);

    return { tracks, albums, artists };
  }

  getStats(): { trackCount: number; artistCount: number; albumCount: number } {
    const trackCount = (this.db.prepare('SELECT COUNT(*) as count FROM tracks').get() as { count: number }).count;
    const artistCount = (this.db.prepare('SELECT COUNT(DISTINCT COALESCE(albumArtist, artist)) as count FROM tracks').get() as { count: number }).count;
    const albumCount = (this.db.prepare('SELECT COUNT(DISTINCT album) as count FROM tracks').get() as { count: number }).count;
    return { trackCount, artistCount, albumCount };
  }
}

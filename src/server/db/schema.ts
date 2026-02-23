import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export function initDatabase(dbPath: string): Database.Database {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS covers (
      id INTEGER PRIMARY KEY,
      hash TEXT UNIQUE NOT NULL,
      data BLOB NOT NULL,
      mimeType TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY,
      path TEXT UNIQUE NOT NULL,
      title TEXT,
      artist TEXT,
      album TEXT,
      albumArtist TEXT,
      trackNumber INTEGER,
      discNumber INTEGER,
      year INTEGER,
      duration REAL,
      genres TEXT,
      fileType TEXT,
      codec TEXT,
      coverId INTEGER,
      mtime INTEGER NOT NULL,
      size INTEGER NOT NULL,
      FOREIGN KEY (coverId) REFERENCES covers(id)
    );

    CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
    CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
    CREATE INDEX IF NOT EXISTS idx_tracks_albumArtist ON tracks(albumArtist);
    CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);
  `);

  return db;
}

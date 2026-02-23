import initSqlJs, { Database } from 'sql.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';

let db: Database | null = null;
let dbPath: string = '';

export async function initDatabase(path: string): Promise<Database> {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  dbPath = path;
  const SQL = await initSqlJs();

  if (existsSync(path)) {
    const fileBuffer = readFileSync(path);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS covers (
      id INTEGER PRIMARY KEY,
      hash TEXT UNIQUE NOT NULL,
      data BLOB NOT NULL,
      mimeType TEXT NOT NULL
    )
  `);

  db.run(`
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
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tracks_albumArtist ON tracks(albumArtist)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title)');

  saveDatabase();
  return db;
}

export function getDatabase(): Database {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export function saveDatabase(): void {
  if (!db || !dbPath) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(dbPath, buffer);
}

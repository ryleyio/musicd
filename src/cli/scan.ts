import { readdirSync, statSync, existsSync, readFileSync } from 'fs';
import { join, extname, dirname, basename } from 'path';
import { parseFile } from 'music-metadata';
import { MusicDatabase, type TrackInput } from '../server/db/queries.js';

const AUDIO_EXTENSIONS = new Set(['.flac', '.mp3', '.m4a', '.aac', '.ogg', '.opus', '.wav', '.wma', '.aiff']);
const COVER_FILENAMES = ['cover.jpg', 'cover.jpeg', 'cover.png', 'folder.jpg', 'folder.jpeg', 'folder.png', 'album.jpg', 'album.png', 'front.jpg', 'front.png'];

export interface ScanOptions {
  verbose?: boolean;
}

export async function scanDirectory(musicPath: string, db: MusicDatabase, options: ScanOptions = {}): Promise<void> {
  const { verbose = false } = options;
  const startTime = Date.now();

  const existingPaths = new Set(db.getAllPaths());
  const scannedPaths = new Set<string>();

  let added = 0;
  let updated = 0;
  let unchanged = 0;
  let deleted = 0;
  let errors = 0;

  const log = (msg: string) => {
    if (verbose) console.log(msg);
  };

  async function walk(dir: string) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      console.error(`Cannot read directory: ${dir}`);
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      // Skip symlinks
      try {
        const stat = statSync(fullPath, { throwIfNoEntry: false });
        if (!stat || stat.isSymbolicLink()) continue;
      } catch {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (AUDIO_EXTENSIONS.has(ext)) {
          scannedPaths.add(fullPath);

          try {
            const stat = statSync(fullPath);
            const fingerprint = db.getTrackFingerprint(fullPath);

            if (fingerprint && fingerprint.mtime === Math.floor(stat.mtimeMs) && fingerprint.size === stat.size) {
              unchanged++;
              log(`  Unchanged: ${entry.name}`);
              continue;
            }

            const isNew = !fingerprint;
            const metadata = await parseFile(fullPath);
            const { common, format } = metadata;

            // Extract embedded cover art
            let coverData: Buffer | undefined;
            let coverMimeType: string | undefined;

            if (common.picture && common.picture.length > 0) {
              const pic = common.picture[0];
              coverData = Buffer.from(pic.data);
              coverMimeType = pic.format;
            } else {
              // Look for folder cover art
              const albumDir = dirname(fullPath);
              for (const coverName of COVER_FILENAMES) {
                const coverPath = join(albumDir, coverName);
                if (existsSync(coverPath)) {
                  coverData = readFileSync(coverPath);
                  coverMimeType = coverName.endsWith('.png') ? 'image/png' : 'image/jpeg';
                  break;
                }
              }
            }

            const track: TrackInput = {
              path: fullPath,
              title: common.title || basename(fullPath, ext),
              artist: common.artist,
              album: common.album,
              albumArtist: common.albumartist,
              trackNumber: common.track?.no ?? undefined,
              discNumber: common.disk?.no ?? undefined,
              year: common.year,
              duration: format.duration,
              genres: common.genre,
              fileType: ext.slice(1).toUpperCase(),
              codec: format.codec,
              coverData,
              coverMimeType,
              mtime: Math.floor(stat.mtimeMs),
              size: stat.size,
            };

            db.upsertTrack(track);

            if (isNew) {
              added++;
              log(`  Added: ${entry.name}`);
            } else {
              updated++;
              log(`  Updated: ${entry.name}`);
            }
          } catch (e) {
            errors++;
            console.error(`  Error parsing ${entry.name}: ${e instanceof Error ? e.message : e}`);
          }
        }
      }
    }
  }

  console.log(`Scanning: ${musicPath}`);
  await walk(musicPath);

  // Remove tracks that no longer exist
  for (const path of existingPaths) {
    if (!scannedPaths.has(path)) {
      db.deleteTrack(path);
      deleted++;
      log(`  Deleted: ${path}`);
    }
  }

  // Cleanup orphaned covers
  db.cleanupOrphanedCovers();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\nScan complete in ${elapsed}s`);
  console.log(`  Added: ${added}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Unchanged: ${unchanged}`);
  console.log(`  Deleted: ${deleted}`);
  if (errors > 0) console.log(`  Errors: ${errors}`);

  const stats = db.getStats();
  console.log(`\nLibrary: ${stats.trackCount} tracks, ${stats.artistCount} artists, ${stats.albumCount} albums`);
}

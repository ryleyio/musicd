#!/usr/bin/env node
import { Command } from 'commander';
import { join, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { initDatabase } from '../server/db/schema.js';
import { MusicDatabase } from '../server/db/queries.js';
import { scanDirectory } from './scan.js';
import { serve } from './serve.js';

const DEFAULT_DB_PATH = join(process.env.HOME || '/tmp', '.musicd', 'db.sqlite');
const DEFAULT_PORT = 3000;

const program = new Command();

program
  .name('musicd')
  .description('Self-hosted music streaming server')
  .version('1.0.0');

program
  .command('scan')
  .description('Scan a directory for music files')
  .argument('<path>', 'Path to music directory')
  .option('-d, --db <path>', 'Database path', DEFAULT_DB_PATH)
  .option('-v, --verbose', 'Verbose output')
  .action(async (musicPath: string, options: { db: string; verbose?: boolean }) => {
    const resolvedPath = resolve(musicPath);
    if (!existsSync(resolvedPath)) {
      console.error(`Error: Directory not found: ${resolvedPath}`);
      process.exit(1);
    }

    const rawDb = initDatabase(options.db);
    const db = new MusicDatabase(rawDb);
    await scanDirectory(resolvedPath, db, { verbose: options.verbose });
  });

program
  .command('serve')
  .description('Start the music server')
  .option('-d, --db <path>', 'Database path', DEFAULT_DB_PATH)
  .option('-p, --port <number>', 'Port to listen on', String(DEFAULT_PORT))
  .option('-m, --music <path>', 'Music directory (for auto-scan if DB empty)')
  .action(async (options: { db: string; port: string; music?: string }) => {
    const port = parseInt(options.port, 10);

    let musicPath: string | undefined;
    if (options.music) {
      musicPath = resolve(options.music);
      if (!existsSync(musicPath)) {
        console.error(`Error: Music directory not found: ${musicPath}`);
        process.exit(1);
      }
    }

    await serve({
      dbPath: options.db,
      port,
      musicPath,
    });
  });

// Default command: scan if needed and serve
program
  .argument('[path]', 'Path to music directory')
  .option('-d, --db <path>', 'Database path', DEFAULT_DB_PATH)
  .option('-p, --port <number>', 'Port to listen on', String(DEFAULT_PORT))
  .action(async (musicPath: string | undefined, options: { db: string; port: string }) => {
    const port = parseInt(options.port, 10);

    let resolvedMusicPath: string | undefined;
    if (musicPath) {
      resolvedMusicPath = resolve(musicPath);
      if (!existsSync(resolvedMusicPath)) {
        console.error(`Error: Directory not found: ${resolvedMusicPath}`);
        process.exit(1);
      }
    }

    await serve({
      dbPath: options.db,
      port,
      musicPath: resolvedMusicPath,
    });
  });

program.parse();

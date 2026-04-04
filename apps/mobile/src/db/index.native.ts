import * as SQLite from 'expo-sqlite';
import { generateUUID } from '../utils/uuid';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('jot.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS jots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      transcript TEXT NOT NULL,
      audio_path TEXT,
      engine TEXT DEFAULT 'webspeech',
      duration_seconds INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      uuid TEXT,
      updated_at DATETIME,
      github_sha TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_jots_created_at ON jots(created_at DESC);
  `);

  // Migrations for existing databases
  try { await db.execAsync('ALTER TABLE jots ADD COLUMN uuid TEXT'); } catch {}
  try { await db.execAsync('ALTER TABLE jots ADD COLUMN updated_at DATETIME'); } catch {}
  try { await db.execAsync('ALTER TABLE jots ADD COLUMN github_sha TEXT'); } catch {}

  // Backfill UUIDs for existing jots
  const unkeyed = await db.getAllAsync<{ id: number }>('SELECT id FROM jots WHERE uuid IS NULL');
  for (const { id } of unkeyed) {
    await db.runAsync('UPDATE jots SET uuid = ? WHERE id = ?', [generateUUID(), id]);
  }

  return db;
}

export interface Jot {
  id: number;
  title: string;
  transcript: string;
  audio_path: string | null;
  engine: string;
  duration_seconds: number | null;
  created_at: string;
  uuid: string;
  updated_at: string;
  github_sha: string | null;
}

export async function saveJot(params: {
  title: string;
  transcript: string;
  engine: string;
  duration_seconds: number;
  audio_path?: string;
}): Promise<number> {
  const database = await getDb();
  const uuid = generateUUID();
  const now = new Date().toISOString();
  const result = await database.runAsync(
    'INSERT INTO jots (title, transcript, engine, duration_seconds, audio_path, uuid, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [params.title, params.transcript, params.engine, params.duration_seconds, params.audio_path ?? null, uuid, now]
  );
  return result.lastInsertRowId;
}

export async function getAllJots(): Promise<Jot[]> {
  const database = await getDb();
  return database.getAllAsync<Jot>('SELECT * FROM jots ORDER BY created_at DESC');
}

export async function deleteJot(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync('DELETE FROM jots WHERE id = ?', [id]);
}

export async function updateJot(id: number, title: string, transcript: string): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    'UPDATE jots SET title = ?, transcript = ?, updated_at = ?, github_sha = NULL WHERE id = ?',
    [title, transcript, new Date().toISOString(), id]
  );
}

export async function updateJotSha(id: number, sha: string): Promise<void> {
  const database = await getDb();
  await database.runAsync('UPDATE jots SET github_sha = ? WHERE id = ?', [sha, id]);
}

export async function upsertJot(params: {
  title: string;
  transcript: string;
  engine: string;
  duration_seconds: number | null;
  audio_path: string | null;
  created_at: string;
  uuid: string;
  updated_at: string;
  github_sha: string;
}): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    `INSERT OR IGNORE INTO jots
      (title, transcript, engine, duration_seconds, audio_path, created_at, uuid, updated_at, github_sha)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.title, params.transcript, params.engine,
      params.duration_seconds, params.audio_path,
      params.created_at, params.uuid, params.updated_at, params.github_sha,
    ]
  );
}

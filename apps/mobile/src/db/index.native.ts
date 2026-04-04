import * as SQLite from 'expo-sqlite';

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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_jots_created_at ON jots(created_at DESC);
  `);
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
}

export async function saveJot(params: {
  title: string;
  transcript: string;
  engine: string;
  duration_seconds: number;
  audio_path?: string;
}): Promise<number> {
  const database = await getDb();
  const result = await database.runAsync(
    'INSERT INTO jots (title, transcript, engine, duration_seconds, audio_path) VALUES (?, ?, ?, ?, ?)',
    [params.title, params.transcript, params.engine, params.duration_seconds, params.audio_path ?? null]
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

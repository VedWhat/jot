// Web storage implementation using localStorage.
// Metro picks this file on web builds; index.native.ts is used on iOS/Android.

export interface Jot {
  id: number;
  title: string;
  transcript: string;
  audio_path: string | null;
  engine: string;
  duration_seconds: number | null;
  created_at: string;
}

const STORAGE_KEY = 'jot:jots';
const COUNTER_KEY = 'jot:next_id';

function readAll(): Jot[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeAll(jots: Jot[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jots));
}

function nextId(): number {
  const id = parseInt(localStorage.getItem(COUNTER_KEY) ?? '1', 10);
  localStorage.setItem(COUNTER_KEY, String(id + 1));
  return id;
}

export async function getDb(): Promise<null> {
  // No-op on web — storage is always ready
  return null;
}

export async function saveJot(params: {
  title: string;
  transcript: string;
  engine: string;
  duration_seconds: number;
  audio_path?: string;
}): Promise<number> {
  const jots = readAll();
  const id = nextId();
  const jot: Jot = {
    id,
    title: params.title,
    transcript: params.transcript,
    engine: params.engine,
    duration_seconds: params.duration_seconds,
    audio_path: params.audio_path ?? null,
    created_at: new Date().toISOString(),
  };
  jots.unshift(jot); // newest first
  writeAll(jots);
  return id;
}

export async function getAllJots(): Promise<Jot[]> {
  return readAll();
}

export async function deleteJot(id: number): Promise<void> {
  writeAll(readAll().filter((j) => j.id !== id));
}

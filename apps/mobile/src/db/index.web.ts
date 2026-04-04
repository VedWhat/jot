// Web storage implementation using localStorage.
// Metro picks this file on web builds; index.native.ts is used on iOS/Android.
import { generateUUID } from '../utils/uuid';

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

const STORAGE_KEY = 'jot:jots';
const COUNTER_KEY = 'jot:next_id';

function readAll(): Jot[] {
  try {
    const raw: Jot[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    // Migrate existing jots that predate the uuid/updated_at fields
    return raw.map((j) => ({
      ...j,
      uuid: j.uuid ?? generateUUID(),
      updated_at: j.updated_at ?? j.created_at,
      github_sha: j.github_sha ?? null,
    }));
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
  const now = new Date().toISOString();
  const jot: Jot = {
    id,
    title: params.title,
    transcript: params.transcript,
    engine: params.engine,
    duration_seconds: params.duration_seconds,
    audio_path: params.audio_path ?? null,
    created_at: now,
    uuid: generateUUID(),
    updated_at: now,
    github_sha: null,
  };
  jots.unshift(jot);
  writeAll(jots);
  return id;
}

export async function getAllJots(): Promise<Jot[]> {
  return readAll();
}

export async function deleteJot(id: number): Promise<void> {
  writeAll(readAll().filter((j) => j.id !== id));
}

export async function updateJot(id: number, title: string, transcript: string): Promise<void> {
  const jots = readAll();
  const idx = jots.findIndex((j) => j.id === id);
  if (idx === -1) return;
  jots[idx] = { ...jots[idx], title, transcript, updated_at: new Date().toISOString(), github_sha: null };
  writeAll(jots);
}

export async function updateJotSha(id: number, sha: string): Promise<void> {
  const jots = readAll();
  const idx = jots.findIndex((j) => j.id === id);
  if (idx === -1) return;
  jots[idx] = { ...jots[idx], github_sha: sha };
  writeAll(jots);
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
  const jots = readAll();
  if (jots.some((j) => j.uuid === params.uuid)) return; // already exists
  const id = nextId();
  jots.push({ id, ...params });
  jots.sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
  writeAll(jots);
}

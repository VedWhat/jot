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
  category: string | null;
}

const STORAGE_KEY = 'jot:jots';
const COUNTER_KEY = 'jot:next_id';

function readAll(): Jot[] {
  try {
    const raw: Jot[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return raw.map((j) => ({
      ...j,
      uuid: j.uuid ?? generateUUID(),
      updated_at: j.updated_at ?? j.created_at,
      category: j.category ?? null,
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

export async function getAllJots(): Promise<Jot[]> {
  return readAll();
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
    category: null,
  };
  jots.unshift(jot);
  writeAll(jots);
  return id;
}

export async function deleteJot(id: number): Promise<void> {
  writeAll(readAll().filter((j) => j.id !== id));
}

export async function updateJot(id: number, title: string, transcript: string, category?: string | null): Promise<void> {
  const jots = readAll();
  const idx = jots.findIndex((j) => j.id === id);
  if (idx === -1) return;
  jots[idx] = {
    ...jots[idx],
    title,
    transcript,
    updated_at: new Date().toISOString(),
    ...(category !== undefined ? { category } : {}),
  };
  writeAll(jots);
}

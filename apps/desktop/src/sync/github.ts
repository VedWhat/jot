import type { Jot } from '../db';

const API = 'https://api.github.com';

export async function assertRepoIsPrivate(pat: string, repo: string): Promise<void> {
  const res = await fetch(`${API}/repos/${repo}`, {
    headers: { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github+json' },
  });
  if (res.status === 404) throw new Error(`Repo "${repo}" not found — check the name and PAT permissions`);
  if (!res.ok) throw new Error(`GitHub error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (!data.private) throw new Error(`Repo "${repo}" is public — jots sync requires a private repo`);
}

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function fromBase64(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function formatJot(jot: Jot): string {
  return `---
jot-id: ${jot.uuid}
jot-title: ${jot.title}
jot-created-at: ${jot.created_at}
jot-updated-at: ${jot.updated_at}
jot-engine: ${jot.engine}
---

${jot.transcript}`;
}

export function parseJotFile(content: string): Partial<Jot> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/);
  if (!match) return null;
  const frontmatter = match[1];
  const transcript = match[2].trim();
  const get = (key: string) => frontmatter.match(new RegExp(`^${key}: (.+)$`, 'm'))?.[1]?.trim();
  const uuid = get('jot-id');
  const title = get('jot-title');
  const created_at = get('jot-created-at');
  const updated_at = get('jot-updated-at') ?? created_at;
  const engine = get('jot-engine') ?? 'webspeech';
  if (!uuid || !title || !created_at) return null;
  return { uuid, title, created_at, updated_at, engine, transcript };
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
}

export async function syncJots(
  jots: Jot[],
  pat: string,
  repo: string,
  onShaUpdate: (id: number, sha: string) => Promise<void>,
  onUpsert: (params: Parameters<typeof import('../db').upsertJot>[0]) => Promise<void>,
): Promise<void> {
  const headers = {
    Authorization: `Bearer ${pat}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };

  // List all files in jots/ directory
  const listRes = await fetch(`${API}/repos/${repo}/contents/jots`, { headers });
  const remoteFiles: Array<{ name: string; sha: string }> =
    listRes.ok ? await listRes.json() : [];

  const remoteMap = new Map(remoteFiles.map((f) => [f.name, f.sha]));

  // Push local jots that are new or updated
  for (const jot of jots) {
    const filename = `${slugify(jot.title)}-${jot.uuid.slice(0, 8)}.md`;
    const content = toBase64(formatJot(jot));
    const existingSha = remoteMap.get(filename);

    if (existingSha && existingSha === jot.github_sha) continue; // up to date

    const body: Record<string, unknown> = {
      message: existingSha ? `update: ${jot.title}` : `add: ${jot.title}`,
      content,
    };
    if (existingSha) body.sha = existingSha;

    const res = await fetch(`${API}/repos/${repo}/contents/jots/${filename}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`Failed to push ${filename}:`, await res.text());
      continue;
    }
    const data = await res.json();
    await onShaUpdate(jot.id, data.content.sha);
  }

  // Pull remote jots not present locally
  const localUuids = new Set(jots.map((j) => j.uuid));
  for (const file of remoteFiles) {
    if (!file.name.endsWith('.md')) continue;
    const fileRes = await fetch(`${API}/repos/${repo}/contents/jots/${file.name}`, { headers });
    if (!fileRes.ok) continue;
    const fileData = await fileRes.json();
    const parsed = parseJotFile(fromBase64(fileData.content));
    if (!parsed?.uuid || localUuids.has(parsed.uuid)) continue;
    await onUpsert({
      title: parsed.title ?? 'Untitled',
      transcript: parsed.transcript ?? '',
      engine: parsed.engine ?? 'webspeech',
      duration_seconds: null,
      audio_path: null,
      created_at: parsed.created_at ?? new Date().toISOString(),
      uuid: parsed.uuid,
      updated_at: parsed.updated_at ?? parsed.created_at ?? new Date().toISOString(),
      github_sha: file.sha,
    });
  }
}

// ── Secrets sync ────────────────────────────────────────────────────────────

async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('jot-secrets-salt'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encrypt(text: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(b64: string, key: CryptoKey): Promise<string> {
  const combined = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plain);
}

export async function pushSecrets(
  pat: string,
  repo: string,
  secrets: Record<string, string>,
  passphrase: string,
): Promise<void> {
  const key = await deriveKey(passphrase);
  const encrypted = await encrypt(JSON.stringify(secrets), key);
  const headers = {
    Authorization: `Bearer ${pat}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
  const existing = await fetch(`${API}/repos/${repo}/contents/.jot-secrets`, { headers });
  const existingSha = existing.ok ? (await existing.json()).sha : undefined;
  const body: Record<string, unknown> = { message: 'update jot secrets', content: toBase64(encrypted) };
  if (existingSha) body.sha = existingSha;
  const res = await fetch(`${API}/repos/${repo}/contents/.jot-secrets`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to push secrets: ${await res.text()}`);
}

export async function pullSecrets(
  pat: string,
  repo: string,
  passphrase: string,
): Promise<Record<string, string>> {
  const headers = { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github+json' };
  const res = await fetch(`${API}/repos/${repo}/contents/.jot-secrets`, { headers });
  if (!res.ok) throw new Error('No secrets file found in repo');
  const data = await res.json();
  const encrypted = fromBase64(data.content);
  const key = await deriveKey(passphrase);
  const plain = await decrypt(encrypted, key);
  return JSON.parse(plain);
}

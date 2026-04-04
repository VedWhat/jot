import { Jot } from '../db';

const API = 'https://api.github.com';

interface RemoteFile {
  name: string;
  sha: string;
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
jot-engine: ${jot.engine}
---

${jot.transcript}`;
}

export function parseJotFile(content: string): Partial<Jot> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/);
  if (!match) return null;

  const frontmatter = match[1];
  const transcript = match[2].trim();
  const get = (key: string) =>
    frontmatter.match(new RegExp(`^${key}: (.+)$`, 'm'))?.[1]?.trim();

  const uuid = get('jot-id');
  const title = get('jot-title');
  const created_at = get('jot-created-at');
  const engine = get('jot-engine') ?? 'webspeech';

  if (!uuid || !title || !created_at) return null;
  return { uuid, title, created_at, engine, transcript };
}

async function listRemoteJots(pat: string, repo: string): Promise<RemoteFile[]> {
  const res = await fetch(`${API}/repos/${repo}/contents/jots`, {
    headers: { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github+json' },
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub list failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function putJotFile(
  pat: string,
  repo: string,
  uuid: string,
  content: string,
  remoteSha: string | null,
  commitMessage: string,
): Promise<string> {
  const body: Record<string, string> = { message: commitMessage, content: toBase64(content) };
  if (remoteSha) body.sha = remoteSha;

  const res = await fetch(`${API}/repos/${repo}/contents/jots/${uuid}.md`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub put failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.content.sha as string;
}

async function getJotFileContent(pat: string, repo: string, filename: string): Promise<string> {
  const res = await fetch(`${API}/repos/${repo}/contents/jots/${filename}`, {
    headers: { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`GitHub get failed: ${res.status}`);
  const data = await res.json();
  return fromBase64(data.content as string);
}

export async function syncJots(
  localJots: Jot[],
  pat: string,
  repo: string,
  onUpdateSha: (id: number, sha: string) => Promise<void>,
  onInsertJot: (params: {
    title: string; transcript: string; engine: string;
    duration_seconds: null; audio_path: null;
    created_at: string; uuid: string; updated_at: string; github_sha: string;
  }) => Promise<void>,
): Promise<void> {
  const remoteFiles = await listRemoteJots(pat, repo);
  const remoteMap = new Map(remoteFiles.map((f) => [f.name, f.sha]));
  const localUuids = new Set(localJots.map((j) => j.uuid).filter(Boolean));

  // Push unsynced local jots
  for (const jot of localJots) {
    if (!jot.uuid) continue;
    if (jot.github_sha !== null) continue;

    const remoteSha = remoteMap.get(`${jot.uuid}.md`) ?? null;
    const newSha = await putJotFile(pat, repo, jot.uuid, formatJot(jot), remoteSha, `jot: ${jot.title}`);
    await onUpdateSha(jot.id, newSha);
  }

  // Pull remote jots not in local DB
  for (const file of remoteFiles) {
    const uuid = file.name.replace(/\.md$/, '');
    if (localUuids.has(uuid)) continue;

    const content = await getJotFileContent(pat, repo, file.name);
    const parsed = parseJotFile(content);
    if (!parsed?.uuid || !parsed.transcript || !parsed.title || !parsed.created_at) continue;

    await onInsertJot({
      title: parsed.title,
      transcript: parsed.transcript,
      engine: parsed.engine ?? 'webspeech',
      duration_seconds: null,
      audio_path: null,
      created_at: parsed.created_at,
      uuid: parsed.uuid,
      updated_at: parsed.created_at,
      github_sha: file.sha,
    });
  }
}

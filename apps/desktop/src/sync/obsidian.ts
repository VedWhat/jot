import { invoke } from '@tauri-apps/api/core';
import type { Jot } from '../db';
import type { SyncResult } from './types';

function formatAsMarkdown(jot: Jot): string {
  return `---
jot-id: ${jot.uuid}
title: ${jot.title}
created: ${jot.created_at}
engine: ${jot.engine}
---

${jot.transcript}
`;
}

function safeFilename(jot: Jot): string {
  const date = jot.created_at.split('T')[0];
  const slug = jot.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40);
  return `${date}-${slug}-${jot.uuid.slice(0, 6)}.md`;
}

export async function syncToObsidian(jots: Jot[], vaultPath: string): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, errors: [] };
  const jotsFolder = `${vaultPath}/Jots`;

  for (const jot of jots) {
    try {
      const path = `${jotsFolder}/${safeFilename(jot)}`;
      const content = formatAsMarkdown(jot);
      await invoke<void>('write_file', { path, content });
      result.synced++;
    } catch (e) {
      result.errors.push(`${jot.title}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return result;
}

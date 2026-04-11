import { invoke } from '@tauri-apps/api/core';
import type { Jot } from '../db';
import type { SyncResult } from './types';

const CATEGORY_FOLDER: Record<string, string> = {
  idea: 'Ideas',
  task: 'Tasks',
  remember: 'Remember',
  other: 'Other',
};

function yamlStr(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function formatAsMarkdown(jot: Jot): string {
  const tags = ['jot', ...(jot.category ? [jot.category] : [])].join(', ');
  return `---
jot-id: ${jot.uuid}
title: ${yamlStr(jot.title)}
created: ${jot.created_at}
engine: ${jot.engine}
tags: [${tags}]${jot.category ? `\ncategory: ${jot.category}` : ''}
---

${jot.transcript}
`;
}

function safeFilename(jot: Jot): string {
  const slug = jot.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return `${slug}.md`;
}

function jotFolder(jot: Jot, jotsRoot: string): string {
  const sub = jot.category && CATEGORY_FOLDER[jot.category];
  return sub ? `${jotsRoot}/${sub}` : `${jotsRoot}/Inbox`;
}

export async function syncToObsidian(jots: Jot[], vaultPath: string, gitRemote?: string): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, errors: [] };
  const jotsRoot = `${vaultPath}/Jots`;

  console.log('[obsidian] syncing', jots.length, 'jots to', jotsRoot, gitRemote ? `remote: ${gitRemote}` : '(no remote)');

  for (const jot of jots) {
    try {
      const folder = jotFolder(jot, jotsRoot);
      const path = `${folder}/${safeFilename(jot)}`;
      await invoke<void>('write_file', { path, content: formatAsMarkdown(jot) });
      result.synced++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[obsidian] write failed for', jot.title, msg);
      result.errors.push(`${jot.title}: ${msg}`);
    }
  }

  console.log('[obsidian] wrote', result.synced, 'files,', result.errors.length, 'errors');

  if (result.synced > 0) {
    // Git commit + push — credentials come from the system (macOS Keychain / SSH keys).
    try {
      console.log('[git] init');
      await invoke<string>('run_git', { dir: jotsRoot, args: ['init'] });

      if (gitRemote) {
        console.log('[git] setting remote:', gitRemote);
        await invoke<string>('run_git', { dir: jotsRoot, args: ['remote', 'add', 'origin', gitRemote] })
          .catch(() => invoke<string>('run_git', { dir: jotsRoot, args: ['remote', 'set-url', 'origin', gitRemote] }));
      }

      console.log('[git] add -A');
      await invoke<string>('run_git', { dir: jotsRoot, args: ['add', '-A'] });

      const date = new Date().toISOString().slice(0, 10);
      console.log('[git] commit');
      await invoke<string>('run_git', { dir: jotsRoot, args: ['commit', '-m', `jot sync ${date}`] })
        .catch((e) => console.log('[git] commit skipped (nothing new?):', e));

      if (gitRemote) {
        console.log('[git] push');
        try {
          await invoke<string>('run_git', { dir: jotsRoot, args: ['push', '-u', 'origin', 'HEAD'] });
          console.log('[git] push ok');
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error('[git] push failed:', msg);
          result.gitError = `Git push failed — check that your SSH key or HTTPS credentials are configured for this remote.\n\n${msg}`;
        }
      }
    } catch (e) {
      console.error('[git] unexpected error:', e);
    }
  }

  return result;
}

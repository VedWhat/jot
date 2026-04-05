import { invoke } from '@tauri-apps/api/core';

const PREFIX = 'jot:secret:';
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function getSecret(key: string): Promise<string | null> {
  if (isTauri) return invoke<string | null>('get_secret', { key: PREFIX + key });
  return localStorage.getItem(PREFIX + key);
}

export async function setSecret(key: string, value: string): Promise<void> {
  if (isTauri) {
    await invoke('set_secret', { key: PREFIX + key, value });
    return;
  }
  localStorage.setItem(PREFIX + key, value);
}

export async function deleteSecret(key: string): Promise<void> {
  if (isTauri) {
    await invoke('delete_secret', { key: PREFIX + key });
    return;
  }
  localStorage.removeItem(PREFIX + key);
}

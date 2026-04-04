const PREFIX = 'jot:secret:';

export async function getSecret(key: string): Promise<string | null> {
  return localStorage.getItem(PREFIX + key);
}

export async function setSecret(key: string, value: string): Promise<void> {
  localStorage.setItem(PREFIX + key, value);
}

export async function deleteSecret(key: string): Promise<void> {
  localStorage.removeItem(PREFIX + key);
}

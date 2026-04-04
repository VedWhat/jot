export function generateTitle(transcript: string): string {
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'Untitled';
  const first6 = words.slice(0, 6).join(' ');
  return words.length > 6 ? first6 + '...' : first6;
}

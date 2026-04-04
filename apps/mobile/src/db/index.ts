// TypeScript uses this file for type resolution.
// Metro replaces it with index.native.ts (iOS/Android)
// or index.web.ts (web) at bundle time.
export { getDb, saveJot, getAllJots, deleteJot, updateJot, updateJotSha, upsertJot } from './index.web';
export type { Jot } from './index.web';

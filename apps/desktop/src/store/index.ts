import { create } from 'zustand';
import {
  Jot,
  getAllJots,
  saveJot,
  deleteJot,
  updateJot,
  updateJotSha,
  upsertJot,
} from '../db';
import { generateTitle } from '../utils/title';
import { getSecret, setSecret } from '../storage/secrets';
import { syncJots, assertRepoIsPrivate, pushSecrets, pullSecrets } from '../sync/github';
import { syncToObsidian } from '../sync/obsidian';

export type View = 'record' | 'gallery';
export type EngineName = 'webspeech' | 'whisper' | 'elevenlabs';

export interface ApiKeys {
  openai: string;
  elevenlabs: string;
}

export interface GitHubSettings {
  pat: string;
  repo: string;
}

export interface ObsidianSettings {
  vaultPath: string;
}

interface JotStore {
  // Navigation
  view: View;
  settingsOpen: boolean;
  setView: (v: View) => void;
  setSettingsOpen: (v: boolean) => void;

  // Jots
  jots: Jot[];
  loadJots: () => Promise<void>;
  addJot: (params: { transcript: string; engine: EngineName; duration_seconds: number }) => Promise<void>;
  removeJot: (id: number) => Promise<void>;
  editJot: (id: number, transcript: string) => Promise<void>;

  // Engine
  engine: EngineName;
  setEngine: (e: EngineName) => void;

  // API keys
  apiKeys: ApiKeys;
  loadApiKeys: () => Promise<void>;
  saveApiKey: (service: keyof ApiKeys, value: string) => Promise<void>;

  // GitHub sync
  github: GitHubSettings;
  githubError: string | null;
  isSyncing: boolean;
  syncError: string | null;
  loadGithubSettings: () => Promise<void>;
  saveGithubSettings: (settings: GitHubSettings) => Promise<void>;
  syncWithGitHub: () => Promise<void>;

  // Obsidian sync
  obsidian: ObsidianSettings;
  isSyncingObsidian: boolean;
  obsidianSyncError: string | null;
  obsidianSyncSuccess: string | null;
  loadObsidianSettings: () => Promise<void>;
  saveObsidianSettings: (settings: ObsidianSettings) => Promise<void>;
  syncWithObsidian: () => Promise<void>;

  // Secrets sync
  syncPassphrase: string;
  loadSyncPassphrase: () => Promise<void>;
  saveSyncPassphrase: (p: string) => Promise<void>;
  isPushingSecrets: boolean;
  isPullingSecrets: boolean;
  secretsSyncError: string | null;
  secretsSyncSuccess: string | null;
  pushSecretsToGitHub: () => Promise<void>;
  pullSecretsFromGitHub: (passphrase: string) => Promise<void>;

  // Recording state
  isRecording: boolean;
  isStopped: boolean;
  isTranscribing: boolean;
  transcript: string;
  elapsedSeconds: number;
  silenceProgress: number;
  setIsRecording: (v: boolean) => void;
  setIsStopped: (v: boolean) => void;
  setIsTranscribing: (v: boolean) => void;
  setTranscript: (t: string) => void;
  setElapsedSeconds: (s: number) => void;
  setSilenceProgress: (p: number) => void;
  resetRecordingState: () => void;
}

export const useJotStore = create<JotStore>((set, get) => ({
  view: 'record',
  settingsOpen: false,
  setView: (v) => set({ view: v }),
  setSettingsOpen: (v) => set({ settingsOpen: v }),

  jots: [],
  loadJots: async () => set({ jots: await getAllJots() }),
  addJot: async ({ transcript, engine, duration_seconds }) => {
    const title = generateTitle(transcript);
    await saveJot({ title, transcript, engine, duration_seconds });
    set({ jots: await getAllJots() });
  },
  removeJot: async (id) => {
    await deleteJot(id);
    set((s) => ({ jots: s.jots.filter((j) => j.id !== id) }));
  },
  editJot: async (id, transcript) => {
    await updateJot(id, generateTitle(transcript), transcript);
    set({ jots: await getAllJots() });
  },

  engine: 'webspeech',
  setEngine: (e) => set({ engine: e }),

  apiKeys: { openai: '', elevenlabs: '' },
  loadApiKeys: async () => {
    const [openai, elevenlabs] = await Promise.all([
      getSecret('openai_api_key'),
      getSecret('elevenlabs_api_key'),
    ]);
    set({ apiKeys: { openai: openai ?? '', elevenlabs: elevenlabs ?? '' } });
  },
  saveApiKey: async (service, value) => {
    const key = service === 'openai' ? 'openai_api_key' : 'elevenlabs_api_key';
    await setSecret(key, value);
    set((s) => ({ apiKeys: { ...s.apiKeys, [service]: value } }));
  },

  github: { pat: '', repo: '' },
  githubError: null,
  isSyncing: false,
  syncError: null,
  loadGithubSettings: async () => {
    const [pat, repo] = await Promise.all([getSecret('github_pat'), getSecret('github_repo')]);
    set({ github: { pat: pat ?? '', repo: repo ?? '' } });
  },
  saveGithubSettings: async ({ pat, repo }) => {
    const p = pat.trim(), r = repo.trim();
    if (p && r) {
      try { await assertRepoIsPrivate(p, r); }
      catch (e) { set({ githubError: e instanceof Error ? e.message : 'Repo check failed' }); throw e; }
    }
    await Promise.all([setSecret('github_pat', p), setSecret('github_repo', r)]);
    set({ github: { pat: p, repo: r }, githubError: null });
  },
  syncWithGitHub: async () => {
    const { github, jots } = get();
    if (!github.pat || !github.repo) { set({ syncError: 'GitHub PAT and repo required' }); return; }
    set({ isSyncing: true, syncError: null });
    try {
      await syncJots(
        jots, github.pat, github.repo,
        async (id, sha) => { await updateJotSha(id, sha); },
        async (params) => { await upsertJot(params); },
      );
      set({ jots: await getAllJots() });
    } catch (e) {
      set({ syncError: e instanceof Error ? e.message : 'Sync failed' });
    } finally {
      set({ isSyncing: false });
    }
  },

  obsidian: { vaultPath: '' },
  isSyncingObsidian: false,
  obsidianSyncError: null,
  obsidianSyncSuccess: null,
  loadObsidianSettings: async () => {
    const vaultPath = await getSecret('obsidian_vault_path');
    set({ obsidian: { vaultPath: vaultPath ?? '' } });
  },
  saveObsidianSettings: async ({ vaultPath }) => {
    await setSecret('obsidian_vault_path', vaultPath);
    set({ obsidian: { vaultPath } });
  },
  syncWithObsidian: async () => {
    const { obsidian, jots } = get();
    if (!obsidian.vaultPath) { set({ obsidianSyncError: 'Set your Obsidian vault path first' }); return; }
    set({ isSyncingObsidian: true, obsidianSyncError: null, obsidianSyncSuccess: null });
    try {
      const result = await syncToObsidian(jots, obsidian.vaultPath);
      if (result.errors.length > 0) {
        set({ obsidianSyncError: result.errors.join(', ') });
      } else {
        set({ obsidianSyncSuccess: `${result.synced} jots exported` });
        setTimeout(() => set({ obsidianSyncSuccess: null }), 3000);
      }
    } catch (e) {
      set({ obsidianSyncError: e instanceof Error ? e.message : 'Obsidian sync failed' });
    } finally {
      set({ isSyncingObsidian: false });
    }
  },

  syncPassphrase: '',
  loadSyncPassphrase: async () => set({ syncPassphrase: (await getSecret('sync_passphrase')) ?? '' }),
  saveSyncPassphrase: async (p) => { await setSecret('sync_passphrase', p); set({ syncPassphrase: p }); },
  isPushingSecrets: false,
  isPullingSecrets: false,
  secretsSyncError: null,
  secretsSyncSuccess: null,
  pushSecretsToGitHub: async () => {
    const { github, apiKeys, syncPassphrase } = get();
    if (!github.pat || !github.repo) { set({ secretsSyncError: 'GitHub PAT and repo required' }); return; }
    if (!syncPassphrase) { set({ secretsSyncError: 'Enter a passphrase first' }); return; }
    set({ isPushingSecrets: true, secretsSyncError: null, secretsSyncSuccess: null });
    try {
      await pushSecrets(github.pat, github.repo, { openai_api_key: apiKeys.openai, elevenlabs_api_key: apiKeys.elevenlabs }, syncPassphrase);
      set({ secretsSyncSuccess: 'Secrets pushed' });
      setTimeout(() => set({ secretsSyncSuccess: null }), 3000);
    } catch (e) {
      set({ secretsSyncError: e instanceof Error ? e.message : 'Push failed' });
    } finally {
      set({ isPushingSecrets: false });
    }
  },
  pullSecretsFromGitHub: async (passphrase) => {
    const { github } = get();
    if (!github.pat || !github.repo) { set({ secretsSyncError: 'GitHub PAT and repo required' }); return; }
    set({ isPullingSecrets: true, secretsSyncError: null, secretsSyncSuccess: null });
    try {
      const secrets = await pullSecrets(github.pat, github.repo, passphrase);
      await Promise.all([
        setSecret('openai_api_key', secrets.openai_api_key ?? ''),
        setSecret('elevenlabs_api_key', secrets.elevenlabs_api_key ?? ''),
        setSecret('sync_passphrase', passphrase),
      ]);
      set({
        apiKeys: { openai: secrets.openai_api_key ?? '', elevenlabs: secrets.elevenlabs_api_key ?? '' },
        syncPassphrase: passphrase,
        secretsSyncSuccess: 'Secrets restored',
      });
      setTimeout(() => set({ secretsSyncSuccess: null }), 3000);
    } catch (e) {
      set({ secretsSyncError: e instanceof Error ? e.message : 'Pull failed' });
    } finally {
      set({ isPullingSecrets: false });
    }
  },

  isRecording: false,
  isStopped: false,
  isTranscribing: false,
  transcript: '',
  elapsedSeconds: 0,
  silenceProgress: 0,
  setIsRecording: (v) => set({ isRecording: v }),
  setIsStopped: (v) => set({ isStopped: v }),
  setIsTranscribing: (v) => set({ isTranscribing: v }),
  setTranscript: (t) => set({ transcript: t }),
  setElapsedSeconds: (s) => set({ elapsedSeconds: s }),
  setSilenceProgress: (p) => set({ silenceProgress: p }),
  resetRecordingState: () =>
    set({ isRecording: false, isStopped: false, isTranscribing: false, transcript: '', elapsedSeconds: 0, silenceProgress: 0 }),
}));

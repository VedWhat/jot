import { create } from 'zustand';
import { Jot, getAllJots, saveJot, deleteJot, updateJot, updateJotSha, upsertJot } from '../db';
import { generateTitle } from '../utils/title';
import { getSecret, setSecret } from '../storage/secrets';
import { EngineName } from '../engines/types';
import { syncJots } from '../sync/github';

type View = 'record' | 'gallery';

export interface ApiKeys {
  openai: string;
  elevenlabs: string;
}

export interface GitHubSettings {
  pat: string;
  repo: string; // "owner/repo"
}

interface JotStore {
  // View
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

  // Engine preference
  engine: EngineName;
  setEngine: (e: EngineName) => void;

  // API keys
  apiKeys: ApiKeys;
  loadApiKeys: () => Promise<void>;
  saveApiKey: (service: keyof ApiKeys, value: string) => Promise<void>;

  // GitHub sync
  github: GitHubSettings;
  loadGithubSettings: () => Promise<void>;
  saveGithubSettings: (settings: GitHubSettings) => Promise<void>;
  isSyncing: boolean;
  syncError: string | null;
  syncWithGitHub: () => Promise<void>;

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
  loadJots: async () => {
    const jots = await getAllJots();
    set({ jots });
  },
  addJot: async ({ transcript, engine, duration_seconds }) => {
    const title = generateTitle(transcript);
    await saveJot({ title, transcript, engine, duration_seconds });
    const jots = await getAllJots();
    set({ jots });
  },
  removeJot: async (id) => {
    await deleteJot(id);
    set((s) => ({ jots: s.jots.filter((j) => j.id !== id) }));
  },
  editJot: async (id, transcript) => {
    const title = generateTitle(transcript);
    await updateJot(id, title, transcript);
    const jots = await getAllJots();
    set({ jots });
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
    const storageKey = service === 'openai' ? 'openai_api_key' : 'elevenlabs_api_key';
    await setSecret(storageKey, value);
    set((s) => ({ apiKeys: { ...s.apiKeys, [service]: value } }));
  },

  github: { pat: '', repo: '' },
  loadGithubSettings: async () => {
    const [pat, repo] = await Promise.all([
      getSecret('github_pat'),
      getSecret('github_repo'),
    ]);
    set({ github: { pat: pat ?? '', repo: repo ?? '' } });
  },
  saveGithubSettings: async ({ pat, repo }) => {
    await Promise.all([
      setSecret('github_pat', pat.trim()),
      setSecret('github_repo', repo.trim()),
    ]);
    set({ github: { pat: pat.trim(), repo: repo.trim() } });
  },

  isSyncing: false,
  syncError: null,
  syncWithGitHub: async () => {
    const { github, jots } = get();
    if (!github.pat || !github.repo) {
      set({ syncError: 'GitHub PAT and repo are required' });
      return;
    }
    set({ isSyncing: true, syncError: null });
    try {
      await syncJots(
        jots,
        github.pat,
        github.repo,
        async (id, sha) => { await updateJotSha(id, sha); },
        async (params) => { await upsertJot(params); },
      );
      const updated = await getAllJots();
      set({ jots: updated });
    } catch (e) {
      set({ syncError: e instanceof Error ? e.message : 'Sync failed' });
    } finally {
      set({ isSyncing: false });
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
    set({
      isRecording: false,
      isStopped: false,
      isTranscribing: false,
      transcript: '',
      elapsedSeconds: 0,
      silenceProgress: 0,
    }),
}));

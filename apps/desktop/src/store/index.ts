import { create } from 'zustand';
import {
  Jot,
  getAllJots,
  saveJot,
  deleteJot,
  updateJot,
} from '../db';
import { generateTitle } from '../utils/title';
import { getSecret, setSecret } from '../storage/secrets';
import { syncToObsidian } from '../sync/obsidian';
import { generateUUID } from '../utils/uuid';

export type View = 'record' | 'gallery';
export type EngineName = 'webspeech' | 'whisper' | 'elevenlabs';

export interface ApiKeys {
  openai: string;
  elevenlabs: string;
}

export interface ObsidianSettings {
  vaultPath: string;
  gitRemote: string;
}

export interface Toast {
  id: string;
  type: 'error' | 'success';
  message: string;
}

interface JotStore {
  // Navigation
  view: View;
  settingsOpen: boolean;
  isCompact: boolean;
  setView: (v: View) => void;
  setSettingsOpen: (v: boolean) => void;
  setIsCompact: (v: boolean) => void;

  // Jots
  jots: Jot[];
  loadJots: () => Promise<void>;
  addJot: (params: { transcript: string; engine: EngineName; duration_seconds: number }) => Promise<number>;
  removeJot: (id: number) => Promise<void>;
  editJot: (id: number, transcript: string, category?: string | null, customTitle?: string) => Promise<void>;

  // Engine
  engine: EngineName;
  setEngine: (e: EngineName) => void;

  // API keys
  apiKeys: ApiKeys;
  loadApiKeys: () => Promise<void>;
  saveApiKey: (service: keyof ApiKeys, value: string) => Promise<void>;

  // Obsidian sync
  obsidian: ObsidianSettings;
  isSyncingObsidian: boolean;
  obsidianSyncError: string | null;
  obsidianSyncSuccess: string | null;
  loadObsidianSettings: () => Promise<void>;
  saveObsidianSettings: (settings: ObsidianSettings) => Promise<void>;
  syncWithObsidian: () => Promise<void>;

  // Auto-sync
  autoSync: boolean;
  loadAutoSync: () => Promise<void>;
  saveAutoSync: (v: boolean) => Promise<void>;
  _autoSyncIfEnabled: () => void;


  // Toasts
  toasts: Toast[];
  addToast: (type: Toast['type'], message: string) => void;
  removeToast: (id: string) => void;

  // Recording state
  isRecording: boolean;
  isStopped: boolean;
  isTranscribing: boolean;
  transcript: string;
  transcriptionError: string | null;
  elapsedSeconds: number;
  silenceProgress: number;
  setIsRecording: (v: boolean) => void;
  setIsStopped: (v: boolean) => void;
  setIsTranscribing: (v: boolean) => void;
  setTranscript: (t: string) => void;
  setTranscriptionError: (e: string | null) => void;
  setElapsedSeconds: (s: number) => void;
  setSilenceProgress: (p: number) => void;
  resetRecordingState: () => void;
}

export const useJotStore = create<JotStore>((set, get) => ({
  view: 'record',
  settingsOpen: false,
  isCompact: false,
  setView: (v) => set({ view: v }),
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  setIsCompact: (v) => set({ isCompact: v }),

  jots: [],
  loadJots: async () => set({ jots: await getAllJots() }),
  addJot: async ({ transcript, engine, duration_seconds }) => {
    const title = generateTitle(transcript);
    const id = await saveJot({ title, transcript, engine, duration_seconds });
    set({ jots: await getAllJots() });
    get()._autoSyncIfEnabled();
    return id;
  },
  removeJot: async (id) => {
    await deleteJot(id);
    set((s) => ({ jots: s.jots.filter((j) => j.id !== id) }));
    get()._autoSyncIfEnabled();
  },
  editJot: async (id, transcript, category?, customTitle?) => {
    const title = customTitle ?? generateTitle(transcript);
    await updateJot(id, title, transcript, category);
    set({ jots: await getAllJots() });
    get()._autoSyncIfEnabled();
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

  obsidian: { vaultPath: '', gitRemote: '' },
  isSyncingObsidian: false,
  obsidianSyncError: null,
  obsidianSyncSuccess: null,
  loadObsidianSettings: async () => {
    const [vaultPath, gitRemote] = await Promise.all([
      getSecret('obsidian_vault_path'),
      getSecret('obsidian_git_remote'),
    ]);
    set({ obsidian: { vaultPath: vaultPath ?? '', gitRemote: gitRemote ?? '' } });
  },
  saveObsidianSettings: async ({ vaultPath, gitRemote }) => {
    await Promise.all([
      setSecret('obsidian_vault_path', vaultPath),
      setSecret('obsidian_git_remote', gitRemote),
    ]);
    set({ obsidian: { vaultPath, gitRemote } });
  },
  syncWithObsidian: async () => {
    const { obsidian, jots } = get();
    if (!obsidian.vaultPath) { set({ obsidianSyncError: 'Set your Obsidian vault path first' }); return; }
    set({ isSyncingObsidian: true, obsidianSyncError: null, obsidianSyncSuccess: null });
    try {
      const result = await syncToObsidian(jots, obsidian.vaultPath, obsidian.gitRemote || undefined);
      if (result.errors.length > 0) {
        const msg = result.errors.join(', ');
        set({ obsidianSyncError: msg });
        get().addToast('error', `Obsidian: ${result.errors[0]}${result.errors.length > 1 ? ` (+${result.errors.length - 1} more)` : ''}`);
      } else {
        set({ obsidianSyncSuccess: `${result.synced} jots exported` });
        if (get().autoSync) get().addToast('success', `${result.synced} jots synced`);
      }
      if (result.gitError) {
        get().addToast('error', result.gitError);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Obsidian sync failed';
      set({ obsidianSyncError: msg });
      get().addToast('error', `Obsidian: ${msg}`);
    } finally {
      set({ isSyncingObsidian: false });
    }
  },

  autoSync: false,
  loadAutoSync: async () => set({ autoSync: (await getSecret('auto_sync')) === 'true' }),
  saveAutoSync: async (v) => { await setSecret('auto_sync', v ? 'true' : 'false'); set({ autoSync: v }); },
  _autoSyncIfEnabled: () => {
    const { autoSync, obsidian } = get();
    if (!autoSync || !obsidian.vaultPath) return;
    get().syncWithObsidian();
  },

  toasts: [],
  addToast: (type, message) => {
    const id = generateUUID();
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => get().removeToast(id), 4000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  isRecording: false,
  isStopped: false,
  isTranscribing: false,
  transcript: '',
  transcriptionError: null,
  elapsedSeconds: 0,
  silenceProgress: 0,
  setIsRecording: (v) => set({ isRecording: v }),
  setIsStopped: (v) => set({ isStopped: v }),
  setIsTranscribing: (v) => set({ isTranscribing: v }),
  setTranscript: (t) => set({ transcript: t }),
  setTranscriptionError: (e) => set({ transcriptionError: e }),
  setElapsedSeconds: (s) => set({ elapsedSeconds: s }),
  setSilenceProgress: (p) => set({ silenceProgress: p }),
  resetRecordingState: () =>
    set({ isRecording: false, isStopped: false, isTranscribing: false, transcript: '', transcriptionError: null, elapsedSeconds: 0, silenceProgress: 0 }),
}));

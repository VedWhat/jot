import React, { useState, useEffect } from 'react';
import { useJotStore } from '../store';

type Tab = 'keys' | 'sync' | 'enrich';

function Input({
  label, value, onChange, placeholder, type = 'text', hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; hint?: string;
}) {
  return (
    <div>
      <p className="text-[11px] text-stone-400 mb-1">{label}</p>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-[13px] text-stone-700 border border-stone-200 rounded-lg px-3 py-2 bg-white outline-none focus:border-stone-400 placeholder:text-stone-200 transition-colors"
      />
      {hint && <p className="text-[10px] text-stone-300 mt-1">{hint}</p>}
    </div>
  );
}

function ActionBtn({
  onClick, disabled, children,
}: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-1.5 rounded-lg border border-stone-200 text-[12px] text-stone-600 hover:border-stone-300 hover:bg-stone-50 transition-colors disabled:opacity-30"
    >
      {children}
    </button>
  );
}

export function SettingsPanel() {
  const {
    settingsOpen, setSettingsOpen,
    apiKeys, saveApiKey,
    github, saveGithubSettings, githubError,
    obsidian, saveObsidianSettings, syncWithObsidian, isSyncingObsidian, obsidianSyncError, obsidianSyncSuccess,
    syncWithGitHub, isSyncing, syncError,
    enrichPrompt, saveEnrichPrompt,
  } = useJotStore();

  const [activeTab, setActiveTab] = useState<Tab>('keys');
  const [openaiKey, setOpenaiKey] = useState('');
  const [elevenKey, setElevenKey] = useState('');
  const [githubPat, setGithubPat] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [vaultPath, setVaultPath] = useState('');
  const [enrichDraft, setEnrichDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  useEffect(() => {
    if (!settingsOpen) return;
    setOpenaiKey(apiKeys.openai);
    setElevenKey(apiKeys.elevenlabs);
    setGithubPat(github.pat);
    setGithubRepo(github.repo);
    setVaultPath(obsidian.vaultPath);
    setEnrichDraft(enrichPrompt);
  }, [settingsOpen]);

  if (!settingsOpen) return null;

  async function handleSave() {
    setSaving(true);
    try {
      await Promise.all([
        saveApiKey('openai', openaiKey),
        saveApiKey('elevenlabs', elevenKey),
        saveObsidianSettings({ vaultPath }),
        saveEnrichPrompt(enrichDraft),
      ]);
      if (githubPat !== github.pat || githubRepo !== github.repo) {
        await saveGithubSettings({ pat: githubPat, repo: githubRepo });
      }
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2000);
    } catch { /* errors shown inline */ }
    finally { setSaving(false); }
  }

  return (
    <div className="absolute inset-0 bg-stone-50 z-50 flex flex-col">
      {/* Header */}
      <div className="drag-region flex items-center justify-between px-5 py-3.5">
        <span className="text-[14px] font-semibold text-stone-700">settings</span>
        <button
          onClick={() => setSettingsOpen(false)}
          className="no-drag w-6 h-6 flex items-center justify-center rounded-md text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-stone-100 px-5">
        {(['keys', 'sync', 'enrich'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              'font-mono text-[10px] uppercase tracking-widest py-2.5 pr-6 border-b-[1.5px] -mb-px transition-colors',
              activeTab === tab
                ? 'text-stone-700 border-stone-700'
                : 'text-stone-300 border-transparent hover:text-stone-400',
            ].join(' ')}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

        {/* ── Keys tab ── */}
        {activeTab === 'keys' && (
          <>
            <Input
              label="OpenAI (Whisper + Enrich)"
              value={openaiKey}
              onChange={setOpenaiKey}
              placeholder="sk-..."
              type="password"
            />
            <Input
              label="ElevenLabs"
              value={elevenKey}
              onChange={setElevenKey}
              placeholder="..."
              type="password"
            />
          </>
        )}

        {/* ── Sync tab ── */}
        {activeTab === 'sync' && (
          <>
            <p className="font-mono text-[9px] text-stone-300 uppercase tracking-widest">github</p>
            <Input
              label="Personal access token"
              value={githubPat}
              onChange={setGithubPat}
              placeholder="ghp_..."
              type="password"
            />
            <Input
              label="Repo (must be private)"
              value={githubRepo}
              onChange={setGithubRepo}
              placeholder="you/jots-backup"
            />
            {(githubError || syncError) && (
              <p className="font-mono text-[10px] text-accent">{githubError || syncError}</p>
            )}
            <ActionBtn onClick={syncWithGitHub} disabled={isSyncing || !github.pat || !github.repo}>
              {isSyncing ? 'syncing...' : '↑↓  sync now'}
            </ActionBtn>

            <div className="pt-3 border-t border-stone-100">
              <p className="font-mono text-[9px] text-stone-300 uppercase tracking-widest mb-4">obsidian</p>
              <Input
                label="Vault path"
                value={vaultPath}
                onChange={setVaultPath}
                placeholder="/Users/you/Documents/MyVault"
                hint="Exports to {vault}/Jots/ as markdown"
              />
            </div>
            {obsidianSyncError && <p className="font-mono text-[10px] text-accent">{obsidianSyncError}</p>}
            {obsidianSyncSuccess && <p className="font-mono text-[10px] text-emerald-500">{obsidianSyncSuccess}</p>}
            <ActionBtn onClick={syncWithObsidian} disabled={isSyncingObsidian || !obsidian.vaultPath}>
              {isSyncingObsidian ? 'exporting...' : '→  export to obsidian'}
            </ActionBtn>
          </>
        )}

        {/* ── Enrich tab ── */}
        {activeTab === 'enrich' && (
          <>
            <p className="text-[12px] text-stone-400 leading-relaxed">
              When you enrich a jot, this prompt guides the AI to transform your transcript. Uses <span className="font-mono">gpt-4o-mini</span> with your OpenAI key.
            </p>
            <div>
              <p className="text-[11px] text-stone-400 mb-1">Prompt</p>
              <textarea
                value={enrichDraft}
                onChange={(e) => setEnrichDraft(e.target.value)}
                placeholder="e.g. Format this as clear bullet points. Extract key action items and insights."
                rows={6}
                className="w-full text-[13px] text-stone-700 border border-stone-200 rounded-lg px-3 py-2.5 bg-white outline-none focus:border-stone-400 placeholder:text-stone-200 transition-colors font-sans leading-relaxed"
              />
            </div>
            {!apiKeys.openai && (
              <p className="font-mono text-[10px] text-stone-300">⚠ Add your OpenAI key in the keys tab first</p>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-stone-100 flex items-center justify-between">
        <span className={[
          'font-mono text-[10px] transition-opacity',
          saveOk ? 'text-emerald-500 opacity-100' : 'opacity-0',
        ].join(' ')}>
          saved
        </span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 rounded-xl bg-stone-900 text-white text-[13px] font-medium hover:bg-stone-800 transition-colors disabled:opacity-40"
        >
          {saving ? 'saving...' : 'save'}
        </button>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { useJotStore } from "../store";

type Tab = "keys" | "sync";

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-stone-700 mb-1">{label}</p>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-[13px] text-stone-900 border border-stone-300 rounded-lg px-3 py-2 bg-white outline-none focus:border-stone-500 placeholder:text-stone-300 transition-colors"
      />
      {hint && <p className="text-[10px] text-stone-500 mt-1">{hint}</p>}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[9px] font-bold text-stone-600 uppercase tracking-widest">
      {children}
    </p>
  );
}

function ActionBtn({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-1.5 rounded-lg border border-stone-300 text-[12px] text-stone-700 hover:border-stone-400 hover:bg-stone-100 transition-colors disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between select-none">
      <span className="text-[13px] text-stone-700">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          "relative flex-shrink-0 w-9 h-5 rounded-full transition-colors duration-200",
          checked ? "bg-stone-700" : "bg-stone-200",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-4" : "translate-x-0",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

export function SettingsPanel() {
  const {
    settingsOpen,
    setSettingsOpen,
    apiKeys,
    saveApiKey,
    obsidian,
    saveObsidianSettings,
    syncWithObsidian,
    isSyncingObsidian,
    obsidianSyncError,
    obsidianSyncSuccess,
    autoSync,
    saveAutoSync,
  } = useJotStore();

  const [activeTab, setActiveTab] = useState<Tab>("keys");
  const [openaiKey, setOpenaiKey] = useState("");
  const [elevenKey, setElevenKey] = useState("");
  const [vaultPath, setVaultPath] = useState("");
  const [gitRemote, setGitRemote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  useEffect(() => {
    if (!settingsOpen) return;
    setOpenaiKey(apiKeys.openai);
    setElevenKey(apiKeys.elevenlabs);
    setVaultPath(obsidian.vaultPath);
    setGitRemote(obsidian.gitRemote);
  }, [settingsOpen]);

  if (!settingsOpen) return null;

  async function handleSave() {
    setSaving(true);
    try {
      await Promise.all([
        saveApiKey("openai", openaiKey),
        saveApiKey("elevenlabs", elevenKey),
        saveObsidianSettings({ vaultPath, gitRemote }),
      ]);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2000);
    } catch {
      /* errors shown inline */
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="absolute inset-0 bg-stone-50 z-50 flex flex-col">
      {/* Header */}
      <div className="drag-region flex items-center justify-between px-5 py-3.5">
        <span className="text-[14px] font-bold text-stone-900">settings</span>
        <button
          onClick={() => setSettingsOpen(false)}
          className="no-drag w-6 h-6 flex items-center justify-center rounded-md text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-stone-200 px-5">
        {(["keys", "sync"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              "font-mono text-[10px] font-bold uppercase tracking-widest py-2.5 mr-6 border-b-2 -mb-px transition-colors",
              activeTab === tab
                ? "text-stone-900 border-stone-900"
                : "text-stone-400 border-transparent hover:text-stone-700",
            ].join(" ")}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {/* ── Keys tab ── */}
        {activeTab === "keys" && (
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
        {activeTab === "sync" && (
          <>
            <Toggle
              label="Auto-sync on save"
              checked={autoSync}
              onChange={saveAutoSync}
            />
            <p className="text-[11px] text-stone-500 leading-relaxed">
              When on, every saved or deleted jot automatically exports to your
              Obsidian vault.
            </p>

            <div className="pt-3 border-t border-stone-100">
              <SectionLabel>obsidian</SectionLabel>
            </div>
            <Input
              label="Vault path"
              value={vaultPath}
              onChange={setVaultPath}
              placeholder="/Users/you/Documents/MyVault"
              hint="Exports to {vault}/Jots/{category}/{slug}.md"
            />
            <Input
              label="Git remote (optional)"
              value={gitRemote}
              onChange={setGitRemote}
              placeholder="git@github.com:you/jots-private.git"
              hint="If set, jots are committed and pushed here on every sync using your system's git credentials."
            />
            {obsidianSyncError && (
              <p className="font-mono text-[10px] text-accent">
                {obsidianSyncError}
              </p>
            )}
            {obsidianSyncSuccess && (
              <p className="font-mono text-[10px] text-emerald-600">
                {obsidianSyncSuccess}
              </p>
            )}
            <ActionBtn
              onClick={syncWithObsidian}
              disabled={isSyncingObsidian || !obsidian.vaultPath}
            >
              {isSyncingObsidian ? "exporting..." : "→  export to obsidian"}
            </ActionBtn>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-stone-200 flex items-center justify-between">
        <span
          className={[
            "font-mono text-[10px] transition-opacity",
            saveOk ? "text-emerald-600 opacity-100" : "opacity-0",
          ].join(" ")}
        >
          saved
        </span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 rounded-xl bg-stone-900 text-white text-[13px] font-medium hover:bg-stone-800 transition-colors disabled:opacity-40"
        >
          {saving ? "saving..." : "save"}
        </button>
      </div>
    </div>
  );
}

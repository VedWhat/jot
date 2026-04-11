import React, { useEffect } from 'react';
import { useJotStore } from '../store';
import { JotCard } from './JotCard';

export function GalleryView() {
  const {
    jots, loadJots, setView, setSettingsOpen,
    syncWithObsidian, isSyncingObsidian,
    obsidian, autoSync,
  } = useJotStore();

  useEffect(() => { loadJots(); }, []);

  const canSync = !!obsidian.vaultPath;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="drag-region flex items-center justify-between px-5 py-3.5 border-b border-stone-150">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[15px] font-bold text-stone-900 tracking-tight">jots</span>
          <span className="font-mono text-[11px] font-semibold text-stone-500">{jots.length}</span>
        </div>

        <div className="no-drag flex items-center gap-3">
          {isSyncingObsidian ? (
            <div className="w-3 h-3 border-2 border-stone-200 border-t-stone-600 rounded-full animate-spin" />
          ) : canSync ? (
            <button
              onClick={syncWithObsidian}
              className="font-mono text-[10px] font-semibold text-stone-500 hover:text-stone-900 transition-colors"
              title="Export to Obsidian"
            >
              {autoSync ? '⟳ auto' : '→'}
            </button>
          ) : null}

          <button
            onClick={() => setSettingsOpen(true)}
            className="w-6 h-6 flex items-center justify-center rounded-md text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors"
            title="Settings"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>

          <button
            onClick={() => setView('record')}
            className="px-3 py-1 rounded-full text-[12px] font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 transition-colors"
          >
            + jot
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {jots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-[14px] font-medium text-stone-600">nothing here yet</p>
            <p className="text-[11px] text-stone-400 font-mono">tap + jot to start</p>
          </div>
        ) : (
          jots.map((jot) => <JotCard key={jot.id} jot={jot} />)
        )}
      </div>
    </div>
  );
}

import React, { useEffect } from 'react';
import { useJotStore } from '../store';
import { JotCard } from './JotCard';

export function GalleryView() {
  const { jots, loadJots, setView, syncWithGitHub, isSyncing, syncError, github } = useJotStore();

  useEffect(() => { loadJots(); }, []);

  const canSync = !!(github.pat && github.repo);

  return (
    <div className="flex flex-col h-full bg-stone-50">
      {/* Header */}
      <div className="drag-region flex items-center justify-between px-5 py-3.5 border-b border-stone-100">
        <div className="flex items-baseline gap-2">
          <span className="text-[16px] font-semibold text-stone-800">jots</span>
          <span className="font-mono text-[11px] text-stone-300">{jots.length}</span>
        </div>

        <div className="no-drag flex items-center gap-3">
          {canSync && (
            isSyncing ? (
              <div className="w-3 h-3 border-[1.5px] border-stone-200 border-t-stone-400 rounded-full animate-spin" />
            ) : (
              <button
                onClick={syncWithGitHub}
                className="text-[13px] text-stone-400 hover:text-stone-600 transition-colors"
                title="Sync with GitHub"
              >
                ↑↓
              </button>
            )
          )}
          <button
            onClick={() => setView('record')}
            className="px-3 py-1 rounded-full text-[12px] font-medium text-stone-600 bg-white border border-stone-200 hover:border-stone-300 transition-colors"
          >
            + jot
          </button>
        </div>
      </div>

      {syncError && (
        <div className="px-5 py-2 bg-red-50 border-b border-red-100">
          <p className="font-mono text-[11px] text-accent">{syncError}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {jots.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[13px] text-stone-300">nothing here yet</p>
          </div>
        ) : (
          jots.map((jot) => <JotCard key={jot.id} jot={jot} />)
        )}
      </div>
    </div>
  );
}

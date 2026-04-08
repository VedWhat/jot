import React, { useEffect } from 'react';
import { useJotStore } from './store';
import { RecordView } from './components/RecordView';
import { GalleryView } from './components/GalleryView';
import { SettingsPanel } from './components/SettingsPanel';

export default function App() {
  const { view, loadJots, loadApiKeys, loadGithubSettings, loadObsidianSettings, loadSyncPassphrase, loadEnrichPrompt } = useJotStore();

  useEffect(() => {
    Promise.all([
      loadJots(),
      loadApiKeys(),
      loadGithubSettings(),
      loadObsidianSettings(),
      loadSyncPassphrase(),
      loadEnrichPrompt(),
    ]).catch(console.error);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const { isStopped, isTranscribing, settingsOpen } = useJotStore.getState();
      if (e.key === 'Escape') {
        if (settingsOpen) { useJotStore.getState().setSettingsOpen(false); return; }
        if (isStopped || isTranscribing) { useJotStore.getState().resetRecordingState(); return; }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="h-full bg-stone-50 relative overflow-hidden">
      {view === 'record' ? <RecordView /> : <GalleryView />}
      <SettingsPanel />
    </div>
  );
}

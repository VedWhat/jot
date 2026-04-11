import React, { useEffect } from 'react';
import { useJotStore } from './store';
import { RecordView } from './components/RecordView';
import { GalleryView } from './components/GalleryView';
import { SettingsPanel } from './components/SettingsPanel';
import type { Toast } from './store';

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  return (
    <div
      onClick={onRemove}
      className={[
        'flex items-start gap-2.5 px-4 py-3 rounded-xl shadow-lg cursor-pointer max-w-[280px]',
        toast.type === 'error' ? 'bg-stone-900' : 'bg-stone-800',
      ].join(' ')}
    >
      <span className={[
        'flex-shrink-0 mt-px text-[12px] font-bold',
        toast.type === 'error' ? 'text-accent' : 'text-emerald-400',
      ].join(' ')}>
        {toast.type === 'error' ? '!' : '✓'}
      </span>
      <p className="text-[12px] text-stone-100 leading-snug">{toast.message}</p>
    </div>
  );
}

function Toasts() {
  const { toasts, removeToast } = useJotStore();
  if (toasts.length === 0) return null;
  return (
    <div className="absolute bottom-5 left-0 right-0 flex flex-col items-center gap-2 z-[100] pointer-events-none px-6">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onRemove={() => removeToast(t.id)} />
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const { view, loadJots, loadApiKeys, loadObsidianSettings, loadAutoSync } = useJotStore();

  useEffect(() => {
    Promise.all([
      loadJots(),
      loadApiKeys(),
      loadObsidianSettings(),
      loadAutoSync(),
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
    <div className="h-full p-1.5 bg-transparent">
      <div className="h-full bg-white rounded-2xl overflow-hidden shadow-2xl ring-1 ring-stone-900/10 relative flex flex-col">
        {view === 'record' ? <RecordView /> : <GalleryView />}
        <SettingsPanel />
        <Toasts />
      </div>
    </div>
  );
}

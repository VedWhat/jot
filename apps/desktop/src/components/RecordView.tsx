import React, { useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useJotStore } from '../store';
import { MicButton } from './MicButton';
import { useTranscription } from '../hooks/useTranscription';
import { useSilenceDetection } from '../hooks/useSilenceDetection';
import { formatDuration } from '../utils/time';

const ENGINES = [
  { name: 'webspeech' as const, label: 'web' },
  { name: 'whisper' as const, label: 'whisper' },
  { name: 'elevenlabs' as const, label: 'eleven' },
];

export function RecordView() {
  const {
    isRecording, isStopped, isTranscribing,
    transcript, transcriptionError,
    elapsedSeconds, silenceProgress,
    engine, setEngine, setView, setSettingsOpen,
    isCompact, setIsCompact,
    jots, addJot, editJot, removeJot, resetRecordingState, setElapsedSeconds, addToast,
  } = useJotStore();

  const isLive = engine === 'webspeech';

  useEffect(() => {
    if (!isRecording) return;
    const startAt = Date.now();
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startAt) / 1000));
    }, 500);
    return () => clearInterval(timer);
  }, [isRecording, setElapsedSeconds]);

  const saveJot = useCallback(async (text: string) => {
    if (!text.trim()) { resetRecordingState(); return; }
    await addJot({ transcript: text, engine, duration_seconds: elapsedSeconds });
    resetRecordingState();
  }, [addJot, engine, elapsedSeconds, resetRecordingState]);

  const stopListeningRef = useRef<(() => void) | null>(null);
  const elapsedRef = useRef(elapsedSeconds);
  elapsedRef.current = elapsedSeconds;

  const { onSpeechDetected, startSilenceTimer, stopSilenceTimer } = useSilenceDetection(
    useCallback(() => { stopListeningRef.current?.(); }, [])
  );

  const { startListening, stopListening, getFinalTranscript, stopApiGetBlob, doTranscribe } = useTranscription(
    onSpeechDetected,
    startSilenceTimer,
  );

  // Background transcription for API engines
  const stopAndTranscribeInBackground = useCallback(async () => {
    stopSilenceTimer();
    const blob = await stopApiGetBlob();
    const dur = elapsedRef.current;
    const id = await addJot({ transcript: '[transcribing…]', engine, duration_seconds: dur });
    resetRecordingState();
    addToast('success', 'Saved! Transcribing in background…');
    doTranscribe(blob)
      .then(async (text) => {
        if (text.trim()) await editJot(id, text.trim());
        else removeJot(id);
      })
      .catch((e: any) => {
        addToast('error', `Transcription failed: ${e.message}`);
        removeJot(id);
      });
  }, [stopSilenceTimer, stopApiGetBlob, addJot, engine, resetRecordingState, addToast, doTranscribe, editJot, removeJot]);

  stopListeningRef.current = async () => {
    if (!isLive) {
      await stopAndTranscribeInBackground();
    } else {
      stopSilenceTimer();
      await stopListening();
      await saveJot(getFinalTranscript() || transcript);
    }
  };

  const handleMicPress = useCallback(async () => {
    if (!isRecording && !isStopped && !isTranscribing) {
      await startListening();
    } else if (isRecording) {
      if (!isLive) {
        await stopAndTranscribeInBackground();
      } else {
        stopSilenceTimer();
        await stopListening();
        // webspeech: isStopped becomes true, user sees save/discard
      }
    }
  }, [isRecording, isStopped, isTranscribing, isLive, startListening, stopListening, stopSilenceTimer, stopAndTranscribeInBackground]);

  const handleSave = useCallback(async () => {
    await saveJot(getFinalTranscript() || transcript);
  }, [getFinalTranscript, transcript, saveJot]);

  const handleToggleCompact = useCallback(async () => {
    const next = !isCompact;
    try {
      await invoke('set_compact_mode', { compact: next });
      setIsCompact(next);
    } catch (e) {
      console.error('set_compact_mode failed:', e);
    }
  }, [isCompact, setIsCompact]);

  const showSilenceBar = isRecording && isLive && silenceProgress > 0;
  const hasTranscript = transcript.trim().length > 0;

  // ── Compact (capsule) mode ─────────────────────────────────────────────────
  if (isCompact) {
    return (
      // Entire pill is clickable to expand — no drag-region so clicks aren't swallowed
      <div
        className="flex h-full items-center px-3 gap-2.5 cursor-pointer select-none"
        onClick={handleToggleCompact}
      >
        {/* Mic — click to record, stopPropagation so it doesn't also expand */}
        <div
          onClick={(e) => { e.stopPropagation(); handleMicPress(); }}
          className={[
            'flex-shrink-0 w-7 h-7 rounded-full border flex items-center justify-center transition-colors duration-300',
            isRecording ? 'border-accent/50 bg-red-50' : 'border-stone-200 bg-white',
          ].join(' ')}
        >
          {isRecording && (
            <span className="absolute w-7 h-7 rounded-full border border-accent/25 mic-ripple-1 pointer-events-none" />
          )}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke={isRecording ? '#E24B4A' : '#C4BDB8'}
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="11" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="8" y1="22" x2="16" y2="22" />
          </svg>
        </div>

        <span className={[
          'text-[12px] font-medium flex-1 leading-none',
          isRecording ? 'text-accent' : 'text-stone-500',
        ].join(' ')}>
          {isRecording ? 'listening…' : 'tap to jot'}
        </span>
      </div>
    );
  }

  // ── Full mode ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white select-none">

      {/* Top bar */}
      <div className="drag-region flex items-center justify-between px-5 pt-4 pb-2">
        <button
          onClick={() => setSettingsOpen(true)}
          disabled={isRecording}
          className="no-drag w-7 h-7 flex items-center justify-center rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 disabled:opacity-20 transition-colors"
          title="Settings"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>

        {/* Engine selector */}
        <div className="no-drag flex items-center gap-1">
          {ENGINES.map((e, i) => (
            <React.Fragment key={e.name}>
              {i > 0 && <span className="text-stone-300 text-[10px] mx-0.5">/</span>}
              <button
                onClick={() => !isRecording && !isTranscribing && setEngine(e.name)}
                disabled={isRecording || isTranscribing}
                className={[
                  'font-mono text-[10px] px-2 py-0.5 rounded-md transition-colors disabled:cursor-default',
                  engine === e.name
                    ? 'text-stone-900 bg-stone-100 font-semibold'
                    : 'text-stone-400 hover:text-stone-700',
                ].join(' ')}
              >
                {e.label}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Compact toggle */}
        <button
          onClick={handleToggleCompact}
          disabled={isRecording}
          className="no-drag w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 disabled:opacity-20 transition-colors text-[14px] leading-none"
          title="Widget mode"
        >
          ⊡
        </button>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-4">

        <MicButton onPress={handleMicPress} />

        {/* State label */}
        <p className={[
          'text-[13px] font-medium tracking-wide -mt-1',
          isRecording ? 'text-accent' : 'text-stone-500',
        ].join(' ')}>
          {isTranscribing
            ? 'transcribing...'
            : isRecording
            ? (engine === 'webspeech' ? 'listening...' : 'recording...')
            : isStopped
            ? 'tap to jot again'
            : 'tap to jot'}
        </p>

        {/* Timer */}
        {(isRecording || isStopped) && !isTranscribing && (
          <p className="font-mono text-[11px] text-stone-500 -mt-1">
            {formatDuration(elapsedSeconds)}
          </p>
        )}

        {/* Spinner */}
        {isTranscribing && (
          <div className="w-4 h-4 border-2 border-stone-200 border-t-stone-600 rounded-full animate-spin -mt-1" />
        )}

        {/* Transcription error */}
        {transcriptionError && (
          <div className="w-full rounded-xl bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-[12px] font-semibold text-red-800 mb-0.5">Transcription failed</p>
            <p className="text-[11px] text-red-600 font-mono leading-relaxed">{transcriptionError}</p>
            <button
              onClick={() => resetRecordingState()}
              className="mt-2.5 text-[11px] font-semibold text-red-700 hover:text-red-900"
            >
              dismiss
            </button>
          </div>
        )}

        {/* Live transcript */}
        {hasTranscript && !transcriptionError && (
          <div className="w-full rounded-xl bg-stone-50 border border-stone-200 px-4 py-3 max-h-40 overflow-y-auto">
            <p className="text-[14px] text-stone-800 leading-relaxed text-center">
              {transcript}
            </p>
          </div>
        )}

        {/* Silence bar */}
        {showSilenceBar && (
          <div className="w-full h-[3px] bg-stone-100 rounded-full overflow-hidden -mt-1">
            <div
              className="h-full bg-accent/70 rounded-full"
              style={{ width: `${silenceProgress * 100}%`, transition: 'none' }}
            />
          </div>
        )}

        {/* Save / Discard (webspeech only — API engines save immediately in background) */}
        {isStopped && hasTranscript && !transcriptionError && (
          <div className="flex items-center gap-4 mt-1">
            <button
              onClick={handleSave}
              className="px-8 py-2 rounded-xl bg-stone-900 text-white text-[13px] font-semibold hover:bg-stone-800 transition-colors"
            >
              save
            </button>
            <button
              onClick={() => resetRecordingState()}
              className="text-[13px] font-medium text-stone-500 hover:text-stone-800 transition-colors"
            >
              discard
            </button>
          </div>
        )}

        {isStopped && !hasTranscript && !transcriptionError && (
          <button
            onClick={() => resetRecordingState()}
            className="text-[13px] font-medium text-stone-500 hover:text-stone-800"
          >
            discard
          </button>
        )}
      </div>

      {/* Bottom */}
      <div className="flex justify-center pb-6">
        <button
          onClick={() => setView('gallery')}
          className="font-mono text-[11px] font-medium text-stone-500 hover:text-stone-900 transition-colors"
        >
          {jots.length} {jots.length === 1 ? 'jot' : 'jots'}
        </button>
      </div>
    </div>
  );
}

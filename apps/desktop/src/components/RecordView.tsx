import React, { useCallback, useEffect, useRef } from 'react';
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
    transcript, elapsedSeconds, silenceProgress,
    engine, setEngine, setView, setSettingsOpen,
    jots, addJot, resetRecordingState, setElapsedSeconds,
  } = useJotStore();

  const isLive = engine === 'webspeech';

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRecording) return;
    const startAt = Date.now();
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startAt) / 1000));
    }, 500);
    return () => clearInterval(timer);
  }, [isRecording, setElapsedSeconds]);

  // ── Recording logic ───────────────────────────────────────────────────────
  const saveJot = useCallback(async (text: string) => {
    if (!text.trim()) { resetRecordingState(); return; }
    await addJot({ transcript: text, engine, duration_seconds: elapsedSeconds });
    resetRecordingState();
  }, [addJot, engine, elapsedSeconds, resetRecordingState]);

  const stopListeningRef = useRef<(() => void) | null>(null);

  const { onSpeechDetected, startSilenceTimer, stopSilenceTimer } = useSilenceDetection(
    useCallback(() => { stopListeningRef.current?.(); }, [])
  );

  const { startListening, stopListening, getFinalTranscript } = useTranscription(
    onSpeechDetected,
    startSilenceTimer,
  );

  stopListeningRef.current = async () => {
    stopSilenceTimer();
    await stopListening();
    await saveJot(getFinalTranscript() || transcript);
  };

  const handleMicPress = useCallback(async () => {
    if (!isRecording && !isStopped && !isTranscribing) {
      await startListening();
    } else if (isRecording) {
      stopSilenceTimer();
      await stopListening();
    }
  }, [isRecording, isStopped, isTranscribing, startListening, stopListening, stopSilenceTimer]);

  const handleSave = useCallback(async () => {
    await saveJot(getFinalTranscript() || transcript);
  }, [getFinalTranscript, transcript, saveJot]);

  const showSilenceBar = isRecording && isLive && silenceProgress > 0;

  return (
    <div className="flex flex-col h-full bg-stone-50 select-none">

      {/* Top bar */}
      <div className="drag-region flex items-center justify-between px-5 pt-4 pb-2">
        {/* Settings */}
        <button
          onClick={() => setSettingsOpen(true)}
          disabled={isRecording}
          className="no-drag w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 disabled:opacity-20 transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>

        {/* Engine selector — minimal text links */}
        <div className="no-drag flex items-center">
          {ENGINES.map((e, i) => (
            <React.Fragment key={e.name}>
              {i > 0 && (
                <span className="font-mono text-[9px] text-stone-200 select-none mx-1.5">·</span>
              )}
              <button
                onClick={() => !isRecording && !isTranscribing && setEngine(e.name)}
                disabled={isRecording || isTranscribing}
                className={[
                  'font-mono text-[10px] transition-colors disabled:cursor-default',
                  engine === e.name
                    ? 'text-stone-600'
                    : 'text-stone-300 hover:text-stone-400',
                ].join(' ')}
              >
                {e.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-5">

        <MicButton onPress={handleMicPress} />

        {/* State label */}
        <p className={[
          'text-[13px] tracking-wide -mt-2',
          isRecording ? 'text-accent' : 'text-stone-400',
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
          <p className="font-mono text-[11px] text-stone-300 -mt-2">
            {formatDuration(elapsedSeconds)}
          </p>
        )}

        {/* Spinner */}
        {isTranscribing && (
          <div className="w-4 h-4 border-[1.5px] border-stone-200 border-t-stone-400 rounded-full animate-spin -mt-2" />
        )}

        {/* Live transcript */}
        {transcript.length > 0 && (
          <div className="w-full max-h-36 overflow-y-auto px-2">
            <p className="text-[14px] text-stone-600 leading-relaxed text-center">
              {transcript}
            </p>
          </div>
        )}

        {/* Silence bar */}
        {showSilenceBar && (
          <div className="w-full h-[2px] bg-stone-100 rounded-full overflow-hidden -mt-2">
            <div
              className="h-full bg-accent/70 rounded-full"
              style={{ width: `${silenceProgress * 100}%`, transition: 'none' }}
            />
          </div>
        )}

        {/* Save / Discard */}
        {isStopped && transcript.trim().length > 0 && (
          <div className="flex items-center gap-4 mt-1">
            <button
              onClick={handleSave}
              className="px-7 py-2 rounded-xl bg-stone-900 text-white text-[13px] font-medium hover:bg-stone-800 transition-colors"
            >
              save
            </button>
            <button
              onClick={() => resetRecordingState()}
              className="text-[13px] text-stone-400 hover:text-stone-600 transition-colors"
            >
              discard
            </button>
          </div>
        )}

        {isStopped && transcript.trim().length === 0 && (
          <button
            onClick={() => resetRecordingState()}
            className="text-[13px] text-stone-400 hover:text-stone-600"
          >
            discard
          </button>
        )}
      </div>

      {/* Bottom */}
      <div className="flex justify-center pb-6">
        <button
          onClick={() => setView('gallery')}
          className="font-mono text-[11px] text-stone-300 hover:text-stone-500 transition-colors"
        >
          {jots.length} {jots.length === 1 ? 'jot' : 'jots'}
        </button>
      </div>
    </div>
  );
}

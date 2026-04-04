import { useRef, useCallback, useEffect } from 'react';
import { useJotStore } from '../store';

const SILENCE_DURATION_MS = 4000;
const TICK_MS = 50;

/**
 * Tracks silence after last speech event.
 * Call `onSpeechDetected()` whenever new words arrive.
 * When 4s of silence elapses, calls `onSilenceComplete`.
 */
export function useSilenceDetection(onSilenceComplete: () => void) {
  const { isRecording, setSilenceProgress } = useJotStore();
  const silenceStartRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onSilenceCompleteRef = useRef(onSilenceComplete);

  useEffect(() => {
    onSilenceCompleteRef.current = onSilenceComplete;
  }, [onSilenceComplete]);

  const startSilenceTimer = useCallback(() => {
    silenceStartRef.current = Date.now();

    if (tickRef.current) clearInterval(tickRef.current);

    tickRef.current = setInterval(() => {
      if (silenceStartRef.current == null) return;
      const elapsed = Date.now() - silenceStartRef.current;
      const progress = Math.min(elapsed / SILENCE_DURATION_MS, 1);
      setSilenceProgress(progress);

      if (progress >= 1) {
        if (tickRef.current) clearInterval(tickRef.current);
        silenceStartRef.current = null;
        onSilenceCompleteRef.current();
      }
    }, TICK_MS);
  }, [setSilenceProgress]);

  const onSpeechDetected = useCallback(() => {
    // Reset silence timer
    silenceStartRef.current = null;
    if (tickRef.current) clearInterval(tickRef.current);
    setSilenceProgress(0);
    startSilenceTimer();
  }, [startSilenceTimer, setSilenceProgress]);

  const stopSilenceTimer = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    silenceStartRef.current = null;
    setSilenceProgress(0);
  }, [setSilenceProgress]);

  // Clean up when recording stops
  useEffect(() => {
    if (!isRecording) stopSilenceTimer();
  }, [isRecording, stopSilenceTimer]);

  return { onSpeechDetected, startSilenceTimer, stopSilenceTimer };
}

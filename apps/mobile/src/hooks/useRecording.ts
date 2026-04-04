import { useRef, useEffect, useCallback } from 'react';
import { useJotStore } from '../store';

/**
 * Manages the elapsed-time ticker while recording is active.
 * Also exposes a stopRecording helper that other hooks call.
 */
export function useRecording() {
  const { isRecording, setElapsedSeconds, elapsedSeconds, resetRecordingState } = useJotStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (isRecording) {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsedSeconds(elapsed);
      }, 500);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  return { elapsedSeconds };
}

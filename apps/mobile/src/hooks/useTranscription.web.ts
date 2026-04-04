import { useCallback, useRef } from 'react';
import { useJotStore } from '../store';
import { startRecording, stopRecording } from '../engines/recorder.web';
import { transcribeWithWhisper } from '../engines/whisper';
import { transcribeWithElevenLabs } from '../engines/elevenLabs';

type SpeechRecognitionInstance = InstanceType<typeof window.SpeechRecognition>;

export function useTranscription(onSpeechDetected: () => void, onSilenceStart: () => void) {
  const { setTranscript, setIsRecording, setIsStopped, setIsTranscribing } = useJotStore();
  const finalTranscriptRef = useRef('');
  const hasSpokenRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const stoppedManuallyRef = useRef(false);

  // ── Web Speech (live) ──────────────────────────────────────────────────────

  const buildRecognition = useCallback((): SpeechRecognitionInstance | null => {
    const SR = window.SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) { console.warn('SpeechRecognition not supported'); return null; }

    const rec: SpeechRecognitionInstance = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-IN';

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        e.results[i].isFinal ? (final += text) : (interim += text);
      }
      if (final) finalTranscriptRef.current += final;
      const display = finalTranscriptRef.current + interim;
      setTranscript(display);
      if (display.trim().length > 0) {
        if (!hasSpokenRef.current) { hasSpokenRef.current = true; onSilenceStart(); }
        onSpeechDetected();
      }
    };
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') console.warn('SpeechRecognition error:', e.error);
    };
    rec.onend = () => {
      if (!stoppedManuallyRef.current && useJotStore.getState().isRecording) {
        try { rec.start(); } catch { /* already started */ }
      }
    };
    return rec;
  }, [onSpeechDetected, onSilenceStart, setTranscript]);

  const startWebSpeech = useCallback(async () => {
    finalTranscriptRef.current = '';
    hasSpokenRef.current = false;
    stoppedManuallyRef.current = false;
    const rec = buildRecognition();
    if (!rec) return;
    recognitionRef.current = rec;
    rec.start();
    setIsRecording(true);
    setIsStopped(false);
  }, [buildRecognition, setIsRecording, setIsStopped]);

  const stopWebSpeech = useCallback(async () => {
    stoppedManuallyRef.current = true;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsRecording(false);
    setIsStopped(true);
  }, [setIsRecording, setIsStopped]);

  // ── Whisper (record then transcribe) ──────────────────────────────────────

  const startWhisper = useCallback(async () => {
    finalTranscriptRef.current = '';
    await startRecording();
    setIsRecording(true);
    setIsStopped(false);
  }, [setIsRecording, setIsStopped]);

  const stopWithApi = useCallback(async () => {
    setIsRecording(false);
    setIsTranscribing(true);
    try {
      const blob = await stopRecording();
      const { engine, apiKeys } = useJotStore.getState();
      let text = '';
      if (engine === 'whisper') {
        if (!apiKeys.openai) throw new Error('No OpenAI API key set — add it in settings.');
        text = await transcribeWithWhisper({ audio: blob, apiKey: apiKeys.openai });
      } else {
        if (!apiKeys.elevenlabs) throw new Error('No ElevenLabs API key set — add it in settings.');
        text = await transcribeWithElevenLabs({ audio: blob, apiKey: apiKeys.elevenlabs });
      }
      finalTranscriptRef.current = text;
      setTranscript(text);
    } catch (e: any) {
      console.error('Transcription error:', e);
      setTranscript(`[error: ${e.message}]`);
    } finally {
      setIsTranscribing(false);
      setIsStopped(true);
    }
  }, [setIsRecording, setIsStopped, setIsTranscribing, setTranscript]);

  // ── Public API ─────────────────────────────────────────────────────────────

  const startListening = useCallback(async () => {
    const { engine } = useJotStore.getState();
    if (engine === 'whisper' || engine === 'elevenlabs') return startWhisper();
    return startWebSpeech();
  }, [startWebSpeech, startWhisper]);

  const stopListening = useCallback(async () => {
    const { engine } = useJotStore.getState();
    if (engine === 'whisper' || engine === 'elevenlabs') return stopWithApi();
    return stopWebSpeech();
  }, [stopWebSpeech, stopWithApi]);

  return { startListening, stopListening, getFinalTranscript: () => finalTranscriptRef.current };
}

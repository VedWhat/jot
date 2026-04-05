import { useCallback, useRef } from 'react';
import { useJotStore } from '../store';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionInstance = any;

// Minimal recorder for Whisper/ElevenLabs
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];

async function startRecording(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioChunks = [];
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
  mediaRecorder.start();
}

async function stopRecording(): Promise<Blob> {
  return new Promise((resolve) => {
    if (!mediaRecorder) { resolve(new Blob()); return; }
    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      mediaRecorder?.stream.getTracks().forEach((t) => t.stop());
      resolve(blob);
    };
    mediaRecorder.stop();
  });
}

async function transcribeWithWhisper(audio: Blob, apiKey: string): Promise<string> {
  const form = new FormData();
  form.append('file', audio, 'recording.webm');
  form.append('model', 'whisper-1');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Whisper error: ${res.status} ${await res.text()}`);
  return (await res.json()).text ?? '';
}

async function transcribeWithElevenLabs(audio: Blob, apiKey: string): Promise<string> {
  const form = new FormData();
  form.append('file', audio, 'recording.webm');
  form.append('model_id', 'scribe_v1');
  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
  });
  if (!res.ok) throw new Error(`ElevenLabs error: ${res.status} ${await res.text()}`);
  return (await res.json()).text ?? '';
}

export function useTranscription(onSpeechDetected: () => void, onSilenceStart: () => void) {
  const { setTranscript, setIsRecording, setIsStopped, setIsTranscribing } = useJotStore();
  const finalTranscriptRef = useRef('');
  const hasSpokenRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const stoppedManuallyRef = useRef(false);

  // ── Web Speech ────────────────────────────────────────────────────────────

  const buildRecognition = useCallback((): SpeechRecognitionInstance | null => {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) { console.warn('SpeechRecognition not supported'); return null; }

    const rec: SpeechRecognitionInstance = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-IN';

    rec.onresult = (e: any) => {
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
    rec.onerror = (e: any) => {
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

  // ── Whisper / ElevenLabs ──────────────────────────────────────────────────

  const startApiEngine = useCallback(async () => {
    finalTranscriptRef.current = '';
    await startRecording();
    setIsRecording(true);
    setIsStopped(false);
  }, [setIsRecording, setIsStopped]);

  const stopApiEngine = useCallback(async () => {
    setIsRecording(false);
    setIsTranscribing(true);
    try {
      const blob = await stopRecording();
      const { engine, apiKeys } = useJotStore.getState();
      let text = '';
      if (engine === 'whisper') {
        if (!apiKeys.openai) throw new Error('No OpenAI API key — add it in settings.');
        text = await transcribeWithWhisper(blob, apiKeys.openai);
      } else {
        if (!apiKeys.elevenlabs) throw new Error('No ElevenLabs API key — add it in settings.');
        text = await transcribeWithElevenLabs(blob, apiKeys.elevenlabs);
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

  // ── Public API ────────────────────────────────────────────────────────────

  const startListening = useCallback(async () => {
    const { engine } = useJotStore.getState();
    return engine === 'webspeech' ? startWebSpeech() : startApiEngine();
  }, [startWebSpeech, startApiEngine]);

  const stopListening = useCallback(async () => {
    const { engine } = useJotStore.getState();
    return engine === 'webspeech' ? stopWebSpeech() : stopApiEngine();
  }, [stopWebSpeech, stopApiEngine]);

  return { startListening, stopListening, getFinalTranscript: () => finalTranscriptRef.current };
}

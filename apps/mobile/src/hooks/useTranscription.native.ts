import { useCallback, useRef } from 'react';
import Voice, { SpeechResultsEvent, SpeechErrorEvent } from '@react-native-voice/voice';
import { useJotStore } from '../store';
import { startRecording, stopRecording } from '../engines/recorder.native';
import { transcribeWithWhisper } from '../engines/whisper';
import { transcribeWithElevenLabs } from '../engines/elevenLabs';

export function useTranscription(onSpeechDetected: () => void, onSilenceStart: () => void) {
  const { setTranscript, setIsRecording, setIsStopped, setIsTranscribing } = useJotStore();
  const finalTranscriptRef = useRef('');
  const hasSpokenRef = useRef(false);

  // ── Web Speech (live) ──────────────────────────────────────────────────────

  const setupVoice = useCallback(() => {
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      const text = e.value?.[0] ?? '';
      finalTranscriptRef.current = text;
      setTranscript(text);
      if (text.trim().length > 0) {
        if (!hasSpokenRef.current) { hasSpokenRef.current = true; onSilenceStart(); }
        onSpeechDetected();
      }
    };
    Voice.onSpeechError = (e: SpeechErrorEvent) => { console.log('Voice error:', e.error); };
    Voice.onSpeechEnd = () => {
      if (useJotStore.getState().isRecording) {
        Voice.start('en-IN').catch(console.log);
      }
    };
  }, [onSpeechDetected, onSilenceStart, setTranscript]);

  const startWebSpeech = useCallback(async () => {
    finalTranscriptRef.current = '';
    hasSpokenRef.current = false;
    setupVoice();
    try {
      await Voice.start('en-IN');
      setIsRecording(true);
      setIsStopped(false);
    } catch (e) {
      console.log('Voice.start error:', e);
    }
  }, [setupVoice, setIsRecording, setIsStopped]);

  const stopWebSpeech = useCallback(async () => {
    try {
      await Voice.stop();
      await Voice.destroy();
    } catch (e) {
      console.log('Voice.stop error:', e);
    }
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
      const audioFile = await stopRecording();
      const { engine, apiKeys } = useJotStore.getState();
      let text = '';
      if (engine === 'whisper') {
        if (!apiKeys.openai) throw new Error('No OpenAI API key set — add it in settings.');
        text = await transcribeWithWhisper({ audio: audioFile, apiKey: apiKeys.openai });
      } else {
        if (!apiKeys.elevenlabs) throw new Error('No ElevenLabs API key set — add it in settings.');
        text = await transcribeWithElevenLabs({ audio: audioFile, apiKey: apiKeys.elevenlabs });
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

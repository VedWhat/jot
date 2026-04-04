/**
 * Calls the ElevenLabs Scribe API to transcribe audio.
 * Platform-agnostic — works with either a Blob (web) or a file URI (native).
 *
 * Docs: https://elevenlabs.io/docs/api-reference/speech-to-text
 */
export async function transcribeWithElevenLabs(params: {
  audio: Blob | { uri: string; mimeType: string };
  apiKey: string;
  language?: string;
}): Promise<string> {
  const { audio, apiKey, language = 'en' } = params;

  const form = new FormData();
  form.append('model_id', 'scribe_v1');
  form.append('language_code', language);

  if (audio instanceof Blob) {
    form.append('file', audio, 'recording.webm');
  } else {
    const response = await fetch(audio.uri);
    const blob = await response.blob();
    form.append('file', blob, 'recording.m4a');
  }

  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
    },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs API error ${res.status}: ${err}`);
  }

  const json = await res.json();
  return json.text ?? '';
}

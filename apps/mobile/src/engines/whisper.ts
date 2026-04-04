/**
 * Calls the OpenAI Whisper API to transcribe audio.
 * Platform-agnostic — works with either a Blob (web) or a file URI (native).
 */
export async function transcribeWithWhisper(params: {
  audio: Blob | { uri: string; mimeType: string };
  apiKey: string;
  language?: string;
}): Promise<string> {
  const { audio, apiKey, language = 'en' } = params;

  const form = new FormData();
  form.append('model', 'whisper-1');
  form.append('language', language);

  if (audio instanceof Blob) {
    form.append('file', audio, 'recording.webm');
  } else {
    // React Native: fetch the file and append as blob
    const response = await fetch(audio.uri);
    const blob = await response.blob();
    form.append('file', blob, 'recording.m4a');
  }

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whisper API error ${res.status}: ${err}`);
  }

  const json = await res.json();
  return json.text ?? '';
}

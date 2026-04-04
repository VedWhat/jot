<p align="center">
  <img src="complete-logo.png" width="360" alt="Jot" />
</p>

<p align="center">
  Voice-to-idea capture. Open → tap mic → speak → saved.
</p>

---

## Run

**Android**
```bash
npm run android
```

**Mac**
```bash
cd apps/desktop && npm run dev
```

**Mac production build**
```bash
cd apps/desktop && npm run build
```

## Transcription engines

| Engine | How | Key needed |
|---|---|---|
| webspeech | On-device, live | No |
| whisper | OpenAI Whisper API | Yes |
| elevenlabs | ElevenLabs Scribe API | Yes |

API keys are entered in-app via ⚙️ and stored securely on-device.

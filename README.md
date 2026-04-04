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

---

## Server Sync

jot uses a very simple github repo syncing procedure, this is done to save costs :D if you wish to sync it across devices
create a simple private (or public) repo and just add a fine grained github pat with the owner/repo in it. 

Every sync will be a simple uuid and hash lookup and compare.
# Jot — Voice-to-Idea Capture App

## What This Is
A personal voice-to-text idea capture app. The core UX is: open app → tap mic → speak → idea auto-saves to a gallery. Maximum friction reduction between thought and record. Think Webex's swipe-to-mic simplicity but for idea capture.

This is a personal tool — the developer (Ved) is the sole user. Prioritize speed, UX polish, and developer experience over enterprise patterns.

## Target Platforms
- **Mobile**: iOS + Android via React Native + Expo
- **Mac Desktop**: Tauri wrapper around a web build (shared React components)
- Ship mobile first, Mac second. Both share core logic.

## Tech Stack

### Mobile (Primary)
- **Framework**: React Native + Expo (managed workflow)
- **Voice Recording**: `expo-av` for mic access
- **Transcription**: 
  - Default: Web Speech API (free, good enough for quick dumps)
  - Optional: OpenAI Whisper API for higher accuracy (user toggles between engines)
- **Storage**: `expo-sqlite` with a simple schema
- **Navigation**: Single-screen app with two views (record + gallery), no router needed — use state-driven view switching

### Mac Desktop
- **Shell**: Tauri v2 (Rust-based, native webview, tiny binary)
- **Voice**: Web Speech API in the webview, or Whisper API
- **Storage**: `better-sqlite3` or Tauri's built-in SQLite plugin
- **Reuse**: Same React components from the mobile app, compiled as a web build

### Shared
- **State Management**: Zustand (lightweight, no boilerplate)
- **Styling**: Nativewind (Tailwind for React Native) on mobile, Tailwind CSS on web/Tauri

## Database Schema

SQLite with one table. Keep it dead simple.

```sql
CREATE TABLE jots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,           -- Auto-generated from first ~6 words of transcript
  transcript TEXT NOT NULL,       -- Full transcription text
  audio_path TEXT,               -- Optional: path to saved audio file for replay
  engine TEXT DEFAULT 'webspeech', -- 'webspeech' or 'whisper'
  duration_seconds INTEGER,       -- Recording duration
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_jots_created_at ON jots(created_at DESC);
```

No tags, no categories, no folders. Just a chronological stream of jots. If search/tagging is needed later, it gets added later.

## Core UX — Two Screens

### Screen 1: Record (Default/Home)
This is the screen the app opens to. It should feel ephemeral, like a breath.

**Layout:**
- Center: Large mic button (160px diameter circle with thin border)
- Below mic: Label that says "tap to jot" when idle, "listening..." when recording
- Below label: Timer showing recording duration (MM:SS, monospace font)
- Below timer: Live transcript preview (text appears as speech is recognized)
- Below transcript: Silence progress bar (thin 3px bar that fills over 4 seconds of silence)
- Below progress bar: Save/Discard buttons (appear after recording stops)
- Top-right corner: Engine toggle pills ("webspeech" / "whisper")
- Bottom center: Gallery entry point — text button showing "{N} jots"

**Recording Behavior:**
1. Tap mic → start recording immediately, no confirmation
2. Mic ring gets a red border + subtle pulse animation while recording
3. Transcript builds live in the center as words are recognized
4. Swipe hint appears at top: "swipe right to save"

**Auto-Save on Silence:**
- Track when the last speech was detected
- Start a 4-second silence countdown (visualized as the progress bar filling up)
- When any new speech is detected, reset the countdown to 0
- When countdown completes (4s of silence): auto-stop recording and auto-save
- This is the PRIMARY save mechanism — most dumps should end this way

**Manual Save Options (all equivalent, give user choice):**
- Swipe right gesture → save immediately
- Tap mic again → stop recording, show save/discard buttons
- Tap "save" button → save to gallery
- All paths lead to the same result: jot saved, screen resets to idle state

**Discard:**
- Tap "discard" button after stopping → clear transcript, reset to idle
- No confirmation dialog for discard (ephemeral philosophy)

**Title Generation:**
- Auto-generate from first ~6 words of transcript
- Truncate with "..." if longer
- No manual title editing (keep it frictionless)

### Screen 2: Gallery
Chronological scroll of all saved jots. No pagination — just a scroll list.

**Layout:**
- Top: Header row with "jots" label (left) and "+ jot" button (right) + jot count
- Below: List of jot cards, newest first

**Jot Card (Collapsed):**
- Relative timestamp (e.g., "2h ago", "3 Apr")
- Title (bold, 15px)
- Excerpt: first 2 lines of transcript, truncated with ellipsis

**Jot Card (Expanded — tap to expand):**
- Same timestamp + title
- Full transcript text (white-space: pre-wrap)
- "delete" and "close" action buttons

**Delete:**
- Tap delete → remove jot immediately
- No confirmation dialog (ephemeral philosophy, consistent with record screen)

**Navigation:**
- From Record → Gallery: tap "{N} jots" at bottom
- From Gallery → Record: tap "+ jot" button in header

## Visual Design Language

### Aesthetic: Ephemeral Minimalism
The app should feel like capturing a fleeting thought. Not heavy, not permanent, not enterprise.

### Typography
- **Primary font**: DM Sans (clean, modern, slightly warm)
- **Monospace accents**: Space Mono (for timestamps, timer, engine labels)
- No font smaller than 11px

### Colors
- Use the system/platform default for light/dark mode
- Accent color: Soft red (#E24B4A) — used ONLY for recording state (mic ring, pulse, silence bar fill, "listening..." label)
- Everything else is neutral grays from the system palette
- No gradients, no shadows, no glow effects

### Animation
- Mic ring: smooth pulse animation while recording (CSS keyframes, ~2s cycle)
- Silence bar: linear fill over 4 seconds
- Transcript: fade-in as text appears
- Screen transitions: no fancy transitions, instant swap
- Card expand/collapse: no animation, instant

### Spacing
- Generous whitespace around the mic area
- Gallery cards: clean list with subtle dividers (0.5px borders)
- Overall feel: airy, not cramped

## Transcription Engine Details

### Web Speech API (Default)
- Use `webkitSpeechRecognition` or `SpeechRecognition`
- Set `continuous = true` and `interimResults = true`
- Language: `en-IN` (Indian English, since Ved is in Bengaluru)
- On `onresult`: update live transcript, reset silence timer
- On `onerror` or `onend`: handle gracefully, allow retry
- On mobile React Native: this won't be available natively — use `@react-native-voice/voice` package instead

### Whisper API (Optional)
- Record full audio via `expo-av`, save as WAV/M4A
- POST to OpenAI Whisper API (`https://api.openai.com/v1/audio/transcriptions`)
- Model: `whisper-1`
- No live transcript for Whisper — show a "transcribing..." state after recording stops
- Store the API key in environment variables, never hardcode
- Whisper gives better accuracy but adds latency and cost — that's the tradeoff

### Engine Toggle
- Two pill buttons in top-right: "webspeech" (default active) and "whisper"
- Switching engines takes effect on the NEXT recording, not mid-recording
- Store preference in SQLite or AsyncStorage so it persists

## Project Structure

```
jot/
├── apps/
│   ├── mobile/              # Expo React Native app
│   │   ├── app/             # Expo Router or simple entry
│   │   ├── src/
│   │   │   ├── components/  # RecordScreen, JotGallery, MicButton, JotCard
│   │   │   ├── hooks/       # useRecording, useTranscription, useSilenceDetection
│   │   │   ├── store/       # Zustand store (jots, recording state, engine preference)
│   │   │   ├── db/          # SQLite setup, queries, migrations
│   │   │   └── utils/       # Title generation, time formatting
│   │   └── package.json
│   └── desktop/             # Tauri app
│       ├── src/             # Reuses components from a shared web build
│       ├── src-tauri/       # Rust backend config
│       └── package.json
├── packages/
│   └── shared/              # Shared types, constants, utils (if needed)
├── CLAUDE.md
└── package.json             # Monorepo root (pnpm workspaces)
```

Use pnpm workspaces for the monorepo. Don't over-engineer the shared package — start with everything in the mobile app and extract shared code only when the desktop app actually needs it.

## Implementation Order

1. **Mobile first**: Get the Expo app running with Web Speech (via `@react-native-voice/voice`), SQLite storage, and both screens fully functional
2. **Polish the UX**: Silence detection, swipe gestures, animations, engine toggle
3. **Whisper integration**: Add the API call path, test accuracy vs Web Speech
4. **Desktop**: Create the Tauri wrapper, adapt voice input for web context
5. **Audio storage** (optional): Save raw audio files alongside transcripts for replay

## Key Principles for the Agent

- **No over-engineering**: This is a personal tool. No auth, no user management, no analytics, no error tracking services. Console.log is fine for debugging.
- **Ephemeral UX philosophy**: Every interaction should feel lightweight. No confirmation dialogs. No "are you sure?" prompts. Save fast, delete fast.
- **Silence detection is critical**: The 4-second auto-save on silence is the core differentiator. Get this right. It should feel magical — you stop talking, and a few seconds later your jot is just... saved.
- **Don't block on Whisper**: If implementing Whisper and the API is slow, never block the UI. Show progress, allow cancellation.
- **Mobile-first gestures**: Swipe right to save should work smoothly. Use `react-native-gesture-handler` for proper gesture handling.
- **Test on actual device**: The mic and speech recognition behave differently on simulators. Test on a real phone.

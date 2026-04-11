<p align="center">
  <img src="complete-logo.png" width="300" alt="Jot" />
</p>

<p align="center">
  Voice-to-idea capture for Mac. Open → speak → saved.
</p>

<p align="center">
  <strong>Menu bar app · Cmd+Shift+J from anywhere · Auto-saves on silence</strong>
</p>

---

## Install

### Download (easiest)

1. Grab `Jot-0.1.2.dmg` from [Releases](../../releases/latest)
2. Open the DMG, drag **Jot** into Applications
3. First launch: macOS will block it — go to **System Settings → Privacy & Security → Open Anyway**
4. Jot appears in your menu bar. Done.

### Build from source

Requirements: [Rust](https://rustup.rs) · [Node.js 20+](https://nodejs.org) · [pnpm](https://pnpm.io)

```bash
git clone https://github.com/vedchitnis/jot
cd jot
pnpm install
pnpm build          # builds the app
bash scripts/build-dmg.sh   # packages release/Jot-x.x.x.dmg
```

Or `pnpm release` to do both in one shot.

---

## Usage

| Action | How |
|---|---|
| Open Jot | Click the waveform icon in your menu bar, or press **⌘⇧J** |
| Record | Tap the mic button |
| Auto-save | Just stop talking — Jot saves after 4 seconds of silence |
| Save manually | Click **save** after recording stops |
| Discard | Click **discard**, or press **Esc** |
| Browse jots | Click the jot count at the bottom of the record screen |
| Close panel | Click anywhere outside Jot |

---

## Configuration

Open ⚙ in the gallery to configure. Settings are saved to `~/.config/jot/.env`.

You can also set any of these in your shell and they'll take precedence over the settings panel:

| Variable | Purpose |
|---|---|
| `JOT_OPENAI_API_KEY` | Whisper transcription + Enrich (`sk-...`) |
| `JOT_ELEVENLABS_API_KEY` | ElevenLabs transcription |
| `JOT_OBSIDIAN_VAULT_PATH` | Obsidian vault path (e.g. `/Users/you/Documents/MyVault`) |
| `JOT_OBSIDIAN_GIT_REMOTE` | Git remote URL for cross-machine sync (e.g. `git@github.com:you/jots.git`) |

---

## Transcription engines

| Engine | Quality | Cost | Setup |
|---|---|---|---|
| **webspeech** (default) | Good | Free | None — works out of the box |
| **whisper** | Great | ~$0.006/min | Add `JOT_OPENAI_API_KEY` |
| **elevenlabs** | Great | See ElevenLabs pricing | Add `JOT_ELEVENLABS_API_KEY` |

Switch engines using the pills in the top-right of the record screen.

---

## Enrich

After saving a jot, expand it in the gallery and tap **✦ enrich**. Jot sends the transcript to `gpt-4o-mini` which classifies it and rewrites it into a structured, actionable note:

| Category | What you get |
|---|---|
| **idea** | Core insight · Why it matters · Angles to explore · Next steps |
| **task** | Goal with definition of done · Checkbox sub-tasks · Blockers |
| **remember** | Fact stated plainly · Why it matters · Related context |
| **other** | Grammar-fixed, readable transcript |

You can edit the enriched content before saving, or dismiss it to keep the original. The enrich prompt is fully customisable in ⚙ Settings → Enrich.

Requires `JOT_OPENAI_API_KEY`.

---

## Sync

Jots sync to your Obsidian vault as markdown files with YAML frontmatter. The vault's `Jots/` folder is a git repo — so you can push to any remote for cross-machine access without any tokens stored in the app.

**File layout:**

```
{vault}/Jots/
  Inbox/       ← unenriched jots
  Ideas/
  Tasks/
  Remember/
  Other/
```

Each file is named `{slug}.md` and includes frontmatter:

```yaml
---
jot-id: <uuid>
title: "My idea about X"
created: 2026-04-11T14:30:00.000Z
engine: webspeech
tags: [jot, idea]
category: idea
---
```

**Setup:**

1. In ⚙ Settings → Sync, set your **Vault path**
2. Optionally add a **Git remote** (e.g. `git@github.com:you/jots-private.git`) — Jot will run `git init`, set the remote, commit, and push automatically on every sync using your system's existing git credentials (SSH key or macOS Keychain)
3. Enable **Auto-sync on save** to sync silently after every jot

If no git remote is set, jots are still committed locally — useful for local history even without a remote.

---

## Privacy

- Everything stays local by default (localStorage in the app's WebView data)
- Obsidian sync writes to your own vault; git pushes to your own private repo
- API keys are stored in `~/.config/jot/.env` — never sent anywhere except the respective API
- No telemetry, no analytics, no accounts

---

## Troubleshooting

**Jot won't open after install (macOS Gatekeeper)**
Go to System Settings → Privacy & Security → scroll down → Open Anyway.

**Microphone permission denied**
Go to System Settings → Privacy & Security → Microphone → enable Jot.

**Speech recognition not working**
Web Speech (the default) requires an internet connection and uses the macOS/Chrome speech engine. If you're offline, switch to Whisper.

**The window doesn't appear when I click the tray icon**
Try the keyboard shortcut: **⌘⇧J**. If that doesn't work, quit and relaunch from Applications.

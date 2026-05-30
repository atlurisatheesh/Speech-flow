# SpeechFlow — AI Speech-to-Text + Autonomous Voice Assistant

## Original Problem Statement
User imported an existing GitHub project "SpeechFlow" (Wispr Flow-style transcription app) and asked to expand it into a full AI assistant: all Wispr Flow features (and better), attractive animations, accurate mobile experience, faster speech-to-text, replies in the user's own voice (no Google voice), AI memory + auto-drafting of message/email replies, multilingual incl. Telugu, plus (deferred) spam-call/auto-answer agent and Gmail read/reply.

## User Choices
- LLM: **Emergent Universal LLM key** (no user OpenAI key needed).
- Voice cloning: **free alternative** → OpenAI neural TTS preset voices (true cloning via ElevenLabs deferred/paid).
- Gmail: yes (Emergent Google Auth + Gmail API) — **deferred to Phase 2**.
- Twilio spam-call/auto-answer agent — **deferred** (also OS-limited; needs cloud call-forwarding).

## Architecture
- **Backend**: FastAPI + MongoDB. AI routed through the Emergent universal-key proxy (`AsyncOpenAI(base_url=INTEGRATION_PROXY_URL + "/llm")`) for Whisper STT, GPT chat, and OpenAI TTS.
- **Frontend**: React 19 + Tailwind + shadcn + Framer Motion (Swiss/high-contrast, Outfit + IBM Plex Sans).
- Also in repo: electron-app, marketing website, desktop_widget.py (not the focus this session).

## What's Been Implemented
### Feb 2026 (pre-existing, now verified working)
- Whisper transcription (file/chunk/stream/batch), AI enhance/process, summarize, translate (30+ langs incl. Telugu), command-mode edit, diarization, snippets, dictionary, settings, analytics, history, SRT/VTT/TXT/JSON export, folder watcher, websocket clipboard sync.

### This session (Jan 2026)
- ✅ Migrated entire backend from direct `OPENAI_API_KEY` to **Emergent universal key** via the OpenAI-compatible proxy (`make_llm_client()`). No user key required.
- ✅ **Low-latency live dictation**: new WebSocket `/api/transcribe/live` (continuous per-segment capture, ~1s interim results, pause-based commit, Whisper prompt-continuity + `seq` echo). Rewrote `MicRecorder.jsx`; EditorPane live text is now replace-mode.
- ✅ Repo review: `website/` (marketing landing) and `electron-app/` (desktop app with feature views) contain real code; `mobileApp/` folder is EMPTY (nothing committed). Voice-cloning research: Gemini & OpenAI TTS = preset voices only, NO user-voice cloning (needs ElevenLabs, paid).
- ⏸️ Gmail agent: paused by user (needs GOOGLE_CLIENT_ID/SECRET). Playbook obtained; scopes = gmail.readonly + gmail.send.
- ✅ Fixed frontend build (stale wavesurfer.js webpack cache). Full app runs in workspace.
- ✅ **Mobile app scaffolded**: Expo/React Native app in `/app/mobileApp` (Dictate, Assistant w/ memory + spoken replies, History, Settings) wired to the backend. Preset voices (no cloning). Runs via `npx expo start`; validated via babel-preset-expo transform + lint (no native simulator in this env).
- ✅ **Desktop app (Wispr Flow-style)** in `/app/electron-app`: global hotkey dictation (Ctrl/Cmd+Shift+Space), records mic → Whisper → auto-paste into the focused app (Windows), history/insights/dictionary/snippets/voice-profiles dock UI. Migrated to the **Emergent universal key** (OpenAI-compatible proxy) so no personal OpenAI key is needed. Runs locally via `npm run electron:dev` (can't run a GUI in this cloud env).
- ✅ **Desktop → full Wispr Flow parity (Jan 2026)**: dictation pipeline now does AI **auto-clean** (filler removal/punctuation/format, cleanup levels low/med/high + style), **personal dictionary** applied to transcription (Whisper prompt) with functional CRUD UI, **snippet text-expansion** with functional CRUD UI, and **Command/Transform mode** hotkey (Ctrl/Cmd+Shift+E polishes selected text in place). Settings (cleanup level/style/language) exposed via IPC with sensible defaults. Validated via babel transform + lint + backend CRUD tests (GUI not runnable in cloud env). Deferred: full Settings UI, Scratchpad/Flow Notes, deep context-awareness, team/shared dictionaries.
- ✅ **NEW: AI Voice Assistant** — listens (Whisper) → thinks with personal memory (GPT) → replies aloud (TTS). Endpoints: `/api/assistant/text`, `/api/assistant/voice`, `/api/assistant/history`, `/api/assistant/voices`.
- ✅ **NEW: Personal Memory** — `/api/memory` CRUD; injected into the assistant system prompt so replies are personalized/auto-drafted in the user's style; multilingual (replies in the language spoken).
- ✅ **NEW frontend**: `VoiceAssistant.jsx` — mic recording, text chat, voice playback, voice selector, live Memory panel. Sidebar Sparkles nav button.
- ✅ Hardening: cached TTS client, 2000-char memory cap.
- ✅ Tested: backend 22/22 pytest + full regression; frontend 100% on all testable selectors.

## Prioritized Backlog
- **P1 (next)**: Gmail read & auto-reply agent (Emergent Google Auth + Gmail API).
- **P1**: True voice cloning ("reply in MY voice") via ElevenLabs (paid) — currently preset neural voices.
- **P1**: Faster live dictation — true WebSocket streaming (vs preset voices/5s chunks); latency profiling.
- **P2**: Map Emergent proxy `budget_exceeded` to friendly 429 + retry/backoff.
- **P2**: Per-user/session id for assistant (currently shared `web-assistant` session); add auth.
- **P2**: Memory relevance/top-k retrieval as memory grows; split server.py into routers.
- **P3 (later)**: Cloud spam-call / missed-call auto-answer agent via Twilio call-forwarding (phone-OS cannot inject audio into live calls).
- **P3**: Mobile app (currently empty `mobileApp/`).

## Next Tasks
1. Gmail agent (read inbox, draft & send replies using memory).
2. ElevenLabs voice-cloning upgrade path.
3. Streaming low-latency dictation.
